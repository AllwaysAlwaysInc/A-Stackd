import { randomUUID, createHash, randomBytes } from "node:crypto";
import pg from "pg";
import type { ShippingAddress } from "../domain/address.js";
import { type ChipColor, type ChipWallet } from "../domain/chips.js";
import { assertDrawable, assertPurchaseAllowed, pickWinnerIndex } from "../domain/economy.js";
import { EmailInUseError, NoTicketsError, PoolExistsError, PoolNotFoundError } from "../domain/errors.js";
import type { CreatePoolInput, Pool } from "../domain/pools.js";
import type { Ticket } from "../domain/tickets.js";
import { normalizeEmail, type User, type UserRole } from "../domain/users.js";
import { seedPools } from "./seed.js";
import type { CreateUserInput, DataStore, DrawResult, PurchaseInput, PurchaseResult } from "./types.js";

const { Pool: PgPool } = pg;
type PoolClient = pg.PoolClient;

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/**
 * Schema for the Floor. The `tickets` table is append-only: a trigger rejects
 * any UPDATE/DELETE so rows are immutable once dropped. A partial unique index
 * enforces the whale limit (one black-chip batch per user per pool) at the DB
 * level, independent of application checks.
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  user_id       TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user',
  created_at    BIGINT NOT NULL
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_at BIGINT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires BIGINT;

CREATE TABLE IF NOT EXISTS wallets (
  user_id TEXT PRIMARY KEY,
  red   INTEGER NOT NULL DEFAULT 0 CHECK (red >= 0),
  white INTEGER NOT NULL DEFAULT 0 CHECK (white >= 0),
  blue  INTEGER NOT NULL DEFAULT 0 CHECK (blue >= 0),
  black INTEGER NOT NULL DEFAULT 0 CHECK (black >= 0)
);

CREATE TABLE IF NOT EXISTS pools (
  pool_id        TEXT PRIMARY KEY,
  prize          TEXT NOT NULL,
  type           TEXT NOT NULL,
  is_guaranteed  BOOLEAN NOT NULL,
  required_chip  TEXT NOT NULL,
  capacity       INTEGER NOT NULL CHECK (capacity > 0),
  filled         INTEGER NOT NULL DEFAULT 0 CHECK (filled >= 0 AND filled <= capacity),
  closes_at      BIGINT NOT NULL,
  drawn_at       BIGINT,
  winner_user_id TEXT,
  winning_ticket_id TEXT
);

ALTER TABLE pools ADD COLUMN IF NOT EXISTS server_seed TEXT;
ALTER TABLE pools ADD COLUMN IF NOT EXISTS server_seed_hash TEXT;
ALTER TABLE pools ADD COLUMN IF NOT EXISTS client_seed TEXT;
ALTER TABLE pools ADD COLUMN IF NOT EXISTS final_seed TEXT;
ALTER TABLE pools ADD COLUMN IF NOT EXISTS winner_index INTEGER;

CREATE TABLE IF NOT EXISTS tickets (
  id               TEXT PRIMARY KEY,
  batch_id         TEXT NOT NULL,
  pool_id          TEXT NOT NULL REFERENCES pools(pool_id),
  user_id          TEXT NOT NULL,
  chip_color       TEXT NOT NULL,
  seat_number      INTEGER NOT NULL,
  created_at       BIGINT NOT NULL,
  shipping_address JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS tickets_pool_idx ON tickets(pool_id);
CREATE INDEX IF NOT EXISTS tickets_user_idx ON tickets(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS tickets_one_black_per_pool
  ON tickets(user_id, pool_id)
  WHERE chip_color = 'black' AND seat_number = 1;

CREATE OR REPLACE FUNCTION tickets_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'tickets are immutable (append-only)';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tickets_no_mutate ON tickets;
CREATE TRIGGER tickets_no_mutate
  BEFORE UPDATE OR DELETE ON tickets
  FOR EACH ROW EXECUTE FUNCTION tickets_immutable();

CREATE TABLE IF NOT EXISTS user_addresses (
  address_id    TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(user_id),
  name          TEXT NOT NULL,
  line1         TEXT NOT NULL,
  line2         TEXT,
  city          TEXT NOT NULL,
  state         TEXT NOT NULL,
  postal_code   TEXT NOT NULL,
  country       TEXT NOT NULL DEFAULT 'US',
  is_default    BOOLEAN NOT NULL DEFAULT false,
  created_at    BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS user_addresses_user_idx ON user_addresses(user_id);

CREATE TABLE IF NOT EXISTS orders (
  order_id         TEXT PRIMARY KEY,
  pool_id          TEXT NOT NULL REFERENCES pools(pool_id),
  winner_user_id   TEXT NOT NULL REFERENCES users(user_id),
  ticket_id        TEXT NOT NULL,
  shipping_address JSONB NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending',
  tracking_number  TEXT,
  shipped_at       BIGINT,
  created_at       BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS orders_user_idx ON orders(winner_user_id);

CREATE TABLE IF NOT EXISTS notifications (
  notification_id TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(user_id),
  title           TEXT NOT NULL,
  message         TEXT NOT NULL,
  read            BOOLEAN NOT NULL DEFAULT false,
  created_at      BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key             TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  response_body   TEXT NOT NULL,
  created_at      BIGINT NOT NULL
);
`;

interface PoolRow {
  pool_id: string;
  prize: string;
  type: string;
  is_guaranteed: boolean;
  required_chip: string;
  capacity: string | number;
  filled: string | number;
  closes_at: string | number;
  drawn_at: string | number | null;
  winner_user_id: string | null;
  winning_ticket_id: string | null;
  server_seed?: string | null;
  server_seed_hash?: string | null;
  client_seed?: string | null;
  final_seed?: string | null;
  winner_index?: string | number | null;
}

function mapPool(row: PoolRow): Pool {
  const pool: Pool = {
    poolId: row.pool_id,
    prize: row.prize,
    type: row.type as Pool["type"],
    isGuaranteed: row.is_guaranteed,
    requiredChip: row.required_chip as ChipColor,
    capacity: Number(row.capacity),
    filled: Number(row.filled),
    closesAt: Number(row.closes_at),
  };
  if (row.drawn_at != null) pool.drawnAt = Number(row.drawn_at);
  if (row.winner_user_id != null) pool.winnerUserId = row.winner_user_id;
  if (row.winning_ticket_id != null) pool.winningTicketId = row.winning_ticket_id;
  if (row.server_seed != null) pool.serverSeed = row.server_seed;
  if (row.server_seed_hash != null) pool.serverSeedHash = row.server_seed_hash;
  if (row.client_seed != null) pool.clientSeed = row.client_seed;
  if (row.final_seed != null) pool.finalSeed = row.final_seed;
  if (row.winner_index != null) pool.winnerIndex = Number(row.winner_index);
  return pool;
}

interface UserRow {
  user_id: string;
  email: string;
  password_hash: string;
  role: string;
  date_of_birth?: string | null;
  consent_at?: string | number | null;
  email_verified?: boolean | null;
  email_verification_token?: string | null;
  password_reset_token?: string | null;
  password_reset_expires?: string | number | null;
}

function mapUser(row: UserRow): User {
  const user: User = {
    userId: row.user_id,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role as UserRole,
    emailVerified: row.email_verified ?? false,
  };
  if (row.date_of_birth != null) user.dateOfBirth = row.date_of_birth;
  if (row.consent_at != null) user.consentAt = Number(row.consent_at);
  if (row.email_verification_token !== undefined) {
    user.emailVerificationToken = row.email_verification_token;
  }
  if (row.password_reset_token !== undefined) {
    user.passwordResetToken = row.password_reset_token;
  }
  if (row.password_reset_expires !== undefined) {
    user.passwordResetExpires = row.password_reset_expires ? Number(row.password_reset_expires) : null;
  }
  return user;
}

interface WalletRow {
  red: string | number;
  white: string | number;
  blue: string | number;
  black: string | number;
}


function mapWallet(row: WalletRow): ChipWallet {
  return {
    red: Number(row.red),
    white: Number(row.white),
    blue: Number(row.blue),
    black: Number(row.black),
  };
}

/** PostgreSQL-backed Floor. Purchases and draws run inside transactions. */
export class PostgresStore implements DataStore {
  private readonly pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new PgPool({ connectionString });
  }

  async migrate(): Promise<void> {
    await this.pool.query(SCHEMA_SQL);
  }

  async createUser(input: CreateUserInput): Promise<User> {
    const email = normalizeEmail(input.email);
    const userId = `u_${randomUUID().slice(0, 8)}`;
    try {
      const res = await this.pool.query<UserRow>(
        `INSERT INTO users (user_id, email, password_hash, role, created_at, date_of_birth, consent_at, email_verification_token)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
          userId,
          email,
          input.passwordHash,
          input.role ?? "user",
          Date.now(),
          input.dateOfBirth,
          input.consentAt,
          input.emailVerificationToken,
        ],
      );
      return mapUser(res.rows[0]!);
    } catch (error) {
      if (isUniqueViolation(error)) throw new EmailInUseError(email);
      throw error;
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const res = await this.pool.query<UserRow>(
      "SELECT * FROM users WHERE email = $1",
      [normalizeEmail(email)],
    );
    const row = res.rows[0];
    return row ? mapUser(row) : null;
  }

  async getUserById(userId: string): Promise<User | null> {
    const res = await this.pool.query<UserRow>(
      "SELECT * FROM users WHERE user_id = $1",
      [userId],
    );
    const row = res.rows[0];
    return row ? mapUser(row) : null;
  }

  async getWallet(userId: string): Promise<ChipWallet | null> {
    const res = await this.pool.query<WalletRow>(
      "SELECT red, white, blue, black FROM wallets WHERE user_id = $1",
      [userId],
    );
    const row = res.rows[0];
    return row ? mapWallet(row) : null;
  }

  async getOrCreateWallet(userId: string): Promise<ChipWallet> {
    const res = await this.pool.query<WalletRow>(
      `INSERT INTO wallets (user_id) VALUES ($1)
       ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
       RETURNING red, white, blue, black`,
      [userId],
    );
    return mapWallet(res.rows[0]!);
  }

  async creditWallet(userId: string, color: ChipColor, amount: number): Promise<ChipWallet> {
    const res = await this.pool.query<WalletRow>(
      `INSERT INTO wallets (user_id, ${color}) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET ${color} = wallets.${color} + EXCLUDED.${color}
       RETURNING red, white, blue, black`,
      [userId, amount],
    );
    return mapWallet(res.rows[0]!);
  }

  async listPools(_now: number): Promise<Pool[]> {
    const res = await this.pool.query<PoolRow>("SELECT * FROM pools ORDER BY closes_at ASC");
    return res.rows.map(mapPool);
  }

  async getPool(poolId: string): Promise<Pool | null> {
    const res = await this.pool.query<PoolRow>("SELECT * FROM pools WHERE pool_id = $1", [poolId]);
    const row = res.rows[0];
    return row ? mapPool(row) : null;
  }

  async createPool(input: CreatePoolInput): Promise<Pool> {
    const poolId = input.poolId ?? `p_${randomUUID().slice(0, 8)}`;
    const serverSeed = randomBytes(32).toString("hex");
    const serverSeedHash = sha256(serverSeed);
    try {
      const res = await this.pool.query<PoolRow>(
        `INSERT INTO pools (pool_id, prize, type, is_guaranteed, required_chip, capacity, filled, closes_at, server_seed, server_seed_hash)
         VALUES ($1, $2, $3, $4, $5, $6, 0, $7, $8, $9) RETURNING *`,
        [
          poolId,
          input.prize,
          input.type,
          input.isGuaranteed,
          input.requiredChip,
          input.capacity,
          input.closesAt,
          serverSeed,
          serverSeedHash,
        ],
      );
      return mapPool(res.rows[0]!);
    } catch (error) {
      if (isUniqueViolation(error)) throw new PoolExistsError(poolId);
      throw error;
    }
  }

  /** Idempotently insert demo pools so a fresh deploy has visible content. */
  async seedDemoData(now: number = Date.now()): Promise<void> {
    for (const pool of seedPools(now)) {
      const serverSeed = randomBytes(32).toString("hex");
      const serverSeedHash = sha256(serverSeed);
      await this.pool.query(
        `INSERT INTO pools (pool_id, prize, type, is_guaranteed, required_chip, capacity, filled, closes_at, server_seed, server_seed_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (pool_id) DO NOTHING`,
        [
          pool.poolId,
          pool.prize,
          pool.type,
          pool.isGuaranteed,
          pool.requiredChip,
          pool.capacity,
          pool.filled,
          pool.closesAt,
          serverSeed,
          serverSeedHash,
        ],
      );
    }
  }

  async ticketsForUser(userId: string): Promise<Ticket[]> {
    const res = await this.pool.query(
      "SELECT * FROM tickets WHERE user_id = $1 ORDER BY created_at ASC",
      [userId],
    );
    return res.rows.map(mapTicket);
  }

  async purchase(input: PurchaseInput): Promise<PurchaseResult> {
    const now = input.now ?? Date.now();
    return this.withTransaction(async (client) => {
      const poolRes = await client.query<PoolRow>(
        "SELECT * FROM pools WHERE pool_id = $1 FOR UPDATE",
        [input.poolId],
      );
      const poolRow = poolRes.rows[0];
      if (!poolRow) throw new PoolNotFoundError(input.poolId);
      const pool = mapPool(poolRow);

      const walletRes = await client.query<WalletRow>(
        `INSERT INTO wallets (user_id) VALUES ($1)
         ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
         RETURNING red, white, blue, black`,
        [input.userId],
      );
      const wallet = mapWallet(walletRes.rows[0]!);

      const blackRes = await client.query<{ count: string }>(
        `SELECT COUNT(DISTINCT batch_id) AS count FROM tickets
         WHERE user_id = $1 AND pool_id = $2 AND chip_color = 'black'`,
        [input.userId, input.poolId],
      );
      const existingBlackChipBatches = Number(blackRes.rows[0]?.count ?? 0);

      const seats = assertPurchaseAllowed({
        pool,
        wallet,
        chipColor: input.chipColor as ChipColor,
        existingBlackChipBatches,
        now,
      });

      await client.query(
        `UPDATE wallets SET ${input.chipColor} = ${input.chipColor} - 1 WHERE user_id = $1`,
        [input.userId],
      );

      const batchId = randomUUID();
      const ticketId = `tkt_secure_${now}_${batchId.slice(0, 8)}`;
      const batch: Ticket[] = [];
      for (let seatNumber = 1; seatNumber <= seats; seatNumber++) {
        const ticket: Ticket = {
          id: `${ticketId}#${seatNumber}`,
          batchId,
          poolId: input.poolId,
          userId: input.userId,
          chipColor: input.chipColor,
          seatNumber,
          createdAt: now,
          shippingAddress: input.shippingAddress,
        };
        await client.query(
          `INSERT INTO tickets (id, batch_id, pool_id, user_id, chip_color, seat_number, created_at, shipping_address)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            ticket.id,
            ticket.batchId,
            ticket.poolId,
            ticket.userId,
            ticket.chipColor,
            ticket.seatNumber,
            ticket.createdAt,
            JSON.stringify(ticket.shippingAddress),
          ],
        );
        batch.push(ticket);
      }

      await client.query("UPDATE pools SET filled = filled + $1 WHERE pool_id = $2", [
        seats,
        input.poolId,
      ]);

      return { ticketId, tickets: batch, seats, chipColor: input.chipColor };
    });
  }

  async drawWinner(poolId: string, now: number = Date.now()): Promise<DrawResult> {
    return this.withTransaction(async (client) => {
      const poolRes = await client.query<PoolRow>(
        "SELECT * FROM pools WHERE pool_id = $1 FOR UPDATE",
        [poolId],
      );
      const poolRow = poolRes.rows[0];
      if (!poolRow) throw new PoolNotFoundError(poolId);
      const pool = mapPool(poolRow);
      assertDrawable(pool, now);

      const ticketsRes = await client.query<{ id: string; user_id: string; shipping_address: any }>(
        "SELECT id, user_id, shipping_address FROM tickets WHERE pool_id = $1 ORDER BY created_at ASC, id ASC",
        [poolId],
      );
      if (ticketsRes.rows.length === 0) throw new NoTicketsError(poolId);

      let serverSeed = poolRow.server_seed;
      let serverSeedHash = poolRow.server_seed_hash;
      if (!serverSeed) {
        serverSeed = randomBytes(32).toString("hex");
        serverSeedHash = sha256(serverSeed);
      }

      const ticketIds = ticketsRes.rows.map((t) => t.id);
      const clientSeed = sha256(ticketIds.join(","));
      const finalSeed = sha256(`${serverSeed}:${clientSeed}`);

      const winnerIndex = Number(BigInt(`0x${finalSeed}`) % BigInt(ticketsRes.rows.length));
      const winnerRow = ticketsRes.rows[winnerIndex]!;

      await client.query(
        `UPDATE pools SET
          drawn_at = $1,
          winner_user_id = $2,
          winning_ticket_id = $3,
          server_seed = $4,
          server_seed_hash = $5,
          client_seed = $6,
          final_seed = $7,
          winner_index = $8
         WHERE pool_id = $9`,
        [now, winnerRow.user_id, winnerRow.id, serverSeed, serverSeedHash, clientSeed, finalSeed, winnerIndex, poolId],
      );

      const orderId = `ord_${randomUUID().slice(0, 8)}`;
      await client.query(
        `INSERT INTO orders (order_id, pool_id, winner_user_id, ticket_id, shipping_address, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [orderId, poolId, winnerRow.user_id, winnerRow.id, JSON.stringify(winnerRow.shipping_address), "pending", now]
      );

      const notificationId = `notif_${randomUUID().slice(0, 8)}`;
      await client.query(
        `INSERT INTO notifications (notification_id, user_id, title, message, read, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          notificationId,
          winnerRow.user_id,
          "🎉 Winner Reveal: You Won!",
          `Congratulations! You won the prize "${pool.prize}"! Tracking number will be updated soon.`,
          false,
          now
        ]
      );

      return {
        poolId,
        winnerUserId: winnerRow.user_id,
        winningTicketId: winnerRow.id,
        totalTickets: ticketsRes.rows.length,
        serverSeed,
        clientSeed,
        finalSeed,
        winnerIndex,
      };
    });
  }

  // --- Account Essentials ---
  async verifyEmail(userId: string, token: string): Promise<boolean> {
    const res = await this.pool.query(
      "UPDATE users SET email_verified = true, email_verification_token = null WHERE user_id = $1 AND email_verification_token = $2 RETURNING *",
      [userId, token]
    );
    return (res.rowCount ?? 0) > 0;
  }

  async sendForgotPassword(email: string, token: string, expires: number): Promise<boolean> {
    const res = await this.pool.query(
      "UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE email = $3 RETURNING *",
      [token, expires, normalizeEmail(email)]
    );
    return (res.rowCount ?? 0) > 0;
  }

  async resetPassword(token: string, passwordHash: string): Promise<boolean> {
    const now = Date.now();
    const res = await this.pool.query(
      "UPDATE users SET password_hash = $1, password_reset_token = null, password_reset_expires = null WHERE password_reset_token = $2 AND password_reset_expires > $3 RETURNING *",
      [passwordHash, token, now]
    );
    return (res.rowCount ?? 0) > 0;
  }

  async updateProfile(userId: string, updates: { dateOfBirth?: string }): Promise<User> {
    const res = await this.pool.query<UserRow>(
      "UPDATE users SET date_of_birth = COALESCE($1, date_of_birth) WHERE user_id = $2 RETURNING *",
      [updates.dateOfBirth, userId]
    );
    if ((res.rowCount ?? 0) === 0) throw new Error("User not found");
    return mapUser(res.rows[0]!);
  }

  // --- Saved Address Book ---
  async createAddress(userId: string, address: ShippingAddress, isDefault: boolean): Promise<any> {
    const addressId = `addr_${randomUUID().slice(0, 8)}`;
    if (isDefault) {
      await this.pool.query("UPDATE user_addresses SET is_default = false WHERE user_id = $1", [userId]);
    }
    const res = await this.pool.query(
      `INSERT INTO user_addresses (address_id, user_id, name, line1, line2, city, state, postal_code, country, is_default, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        addressId,
        userId,
        address.name,
        address.line1,
        address.line2 ?? null,
        address.city,
        address.state,
        address.postalCode,
        address.country || "US",
        isDefault,
        Date.now()
      ]
    );
    return res.rows[0];
  }

  async listAddresses(userId: string): Promise<any[]> {
    const res = await this.pool.query(
      "SELECT * FROM user_addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC",
      [userId]
    );
    return res.rows;
  }

  async deleteAddress(userId: string, addressId: string): Promise<void> {
    await this.pool.query("DELETE FROM user_addresses WHERE user_id = $1 AND address_id = $2", [userId, addressId]);
  }

  // --- Idempotency ---
  async checkIdempotency(key: string, userId: string): Promise<any | null> {
    const res = await this.pool.query(
      "SELECT response_body FROM idempotency_keys WHERE key = $1 AND user_id = $2",
      [key, userId]
    );
    const row = res.rows[0];
    return row ? JSON.parse(row.response_body) : null;
  }

  async saveIdempotency(key: string, userId: string, responseBody: any): Promise<void> {
    await this.pool.query(
      "INSERT INTO idempotency_keys (key, user_id, response_body, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT (key) DO NOTHING",
      [key, userId, JSON.stringify(responseBody), Date.now()]
    );
  }

  // --- Free Entry Path ---
  async freeEntry(input: { userId: string; poolId: string; shippingAddress: ShippingAddress; now?: number }): Promise<PurchaseResult> {
    const now = input.now ?? Date.now();
    return this.withTransaction(async (client) => {
      const poolRes = await client.query<PoolRow>(
        "SELECT * FROM pools WHERE pool_id = $1 FOR UPDATE",
        [input.poolId]
      );
      const poolRow = poolRes.rows[0];
      if (!poolRow) throw new PoolNotFoundError(input.poolId);
      const pool = mapPool(poolRow);

      if (pool.closesAt <= now || pool.drawnAt !== undefined) {
        throw new Error("Pool is closed.");
      }
      if (pool.filled >= pool.capacity) {
        throw new Error("Pool is full.");
      }

      const freeCountRes = await client.query<{ count: string }>(
        "SELECT COUNT(*) AS count FROM tickets WHERE user_id = $1 AND pool_id = $2 AND chip_color = 'free'",
        [input.userId, input.poolId]
      );
      if (Number(freeCountRes.rows[0]?.count ?? 0) >= 1) {
        throw new Error("Only one free entry allowed per pool.");
      }

      const batchId = randomUUID();
      const ticketId = `tkt_free_${now}_${batchId.slice(0, 8)}`;
      const ticket: Ticket = {
        id: `${ticketId}#1`,
        batchId,
        poolId: input.poolId,
        userId: input.userId,
        chipColor: "free",
        seatNumber: 1,
        createdAt: now,
        shippingAddress: input.shippingAddress
      };

      await client.query(
        `INSERT INTO tickets (id, batch_id, pool_id, user_id, chip_color, seat_number, created_at, shipping_address)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          ticket.id,
          ticket.batchId,
          ticket.poolId,
          ticket.userId,
          ticket.chipColor,
          ticket.seatNumber,
          ticket.createdAt,
          JSON.stringify(ticket.shippingAddress)
        ]
      );

      await client.query("UPDATE pools SET filled = filled + 1 WHERE pool_id = $2", [input.poolId]);

      return { ticketId, tickets: [ticket], seats: 1, chipColor: "free" };
    });
  }

  // --- Fulfillment Loop ---
  async createOrder(poolId: string, winnerUserId: string, ticketId: string, address: ShippingAddress): Promise<any> {
    const orderId = `ord_${randomUUID().slice(0, 8)}`;
    const res = await this.pool.query(
      `INSERT INTO orders (order_id, pool_id, winner_user_id, ticket_id, shipping_address, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [orderId, poolId, winnerUserId, ticketId, JSON.stringify(address), "pending", Date.now()]
    );
    return res.rows[0];
  }

  async listOrders(): Promise<any[]> {
    const res = await this.pool.query("SELECT * FROM orders ORDER BY created_at DESC");
    return res.rows;
  }

  async shipOrder(orderId: string, trackingNumber: string): Promise<any> {
    const now = Date.now();
    const res = await this.pool.query(
      "UPDATE orders SET status = 'shipped', tracking_number = $1, shipped_at = $2 WHERE order_id = $3 RETURNING *",
      [trackingNumber, now, orderId]
    );
    if ((res.rowCount ?? 0) === 0) throw new Error("Order not found");
    const order = res.rows[0]!;

    // Notify the user about the shipping status
    await this.createNotification(
      order.winner_user_id,
      "📦 Order Shipped!",
      `Your prize has been shipped! Tracking number: ${trackingNumber}`
    );

    return order;
  }

  // --- Notifications ---
  async getNotifications(userId: string): Promise<any[]> {
    const res = await this.pool.query(
      "SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC",
      [userId]
    );
    return res.rows;
  }

  async createNotification(userId: string, title: string, message: string): Promise<any> {
    const notificationId = `notif_${randomUUID().slice(0, 8)}`;
    const res = await this.pool.query(
      `INSERT INTO notifications (notification_id, user_id, title, message, read, created_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [notificationId, userId, title, message, false, Date.now()]
    );
    return res.rows[0];
  }

  async markNotificationsRead(userId: string): Promise<void> {
    await this.pool.query("UPDATE notifications SET read = true WHERE user_id = $1", [userId]);
  }


  async ticketsForPool(poolId: string): Promise<Ticket[]> {
    const res = await this.pool.query(
      "SELECT * FROM tickets WHERE pool_id = $1 ORDER BY created_at ASC, id ASC",
      [poolId]
    );
    return res.rows.map(mapTicket);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }


  private async withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

interface TicketRow {
  id: string;
  batch_id: string;
  pool_id: string;
  user_id: string;
  chip_color: string;
  seat_number: string | number;
  created_at: string | number;
  shipping_address: ShippingAddress;
}

function mapTicket(row: TicketRow): Ticket {
  return {
    id: row.id,
    batchId: row.batch_id,
    poolId: row.pool_id,
    userId: row.user_id,
    chipColor: row.chip_color as ChipColor,
    seatNumber: Number(row.seat_number),
    createdAt: Number(row.created_at),
    shippingAddress: row.shipping_address,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}
