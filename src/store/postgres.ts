import { randomUUID } from "node:crypto";
import pg from "pg";
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

CREATE TABLE IF NOT EXISTS tickets (
  id          TEXT PRIMARY KEY,
  batch_id    TEXT NOT NULL,
  pool_id     TEXT NOT NULL REFERENCES pools(pool_id),
  user_id     TEXT NOT NULL,
  chip_color  TEXT NOT NULL,
  seat_number INTEGER NOT NULL,
  created_at  BIGINT NOT NULL
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
  return pool;
}

interface UserRow {
  user_id: string;
  email: string;
  password_hash: string;
  role: string;
}

function mapUser(row: UserRow): User {
  return {
    userId: row.user_id,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role as UserRole,
  };
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
        `INSERT INTO users (user_id, email, password_hash, role, created_at)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [userId, email, input.passwordHash, input.role ?? "user", Date.now()],
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
    try {
      const res = await this.pool.query<PoolRow>(
        `INSERT INTO pools (pool_id, prize, type, is_guaranteed, required_chip, capacity, filled, closes_at)
         VALUES ($1, $2, $3, $4, $5, $6, 0, $7) RETURNING *`,
        [
          poolId,
          input.prize,
          input.type,
          input.isGuaranteed,
          input.requiredChip,
          input.capacity,
          input.closesAt,
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
      await this.pool.query(
        `INSERT INTO pools (pool_id, prize, type, is_guaranteed, required_chip, capacity, filled, closes_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
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
        chipColor: input.chipColor,
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
        };
        await client.query(
          `INSERT INTO tickets (id, batch_id, pool_id, user_id, chip_color, seat_number, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            ticket.id,
            ticket.batchId,
            ticket.poolId,
            ticket.userId,
            ticket.chipColor,
            ticket.seatNumber,
            ticket.createdAt,
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
      assertDrawable(mapPool(poolRow), now);

      const ticketsRes = await client.query<{ id: string; user_id: string }>(
        "SELECT id, user_id FROM tickets WHERE pool_id = $1 ORDER BY created_at ASC, id ASC",
        [poolId],
      );
      if (ticketsRes.rows.length === 0) throw new NoTicketsError(poolId);

      const winner = ticketsRes.rows[pickWinnerIndex(ticketsRes.rows.length)]!;
      await client.query(
        "UPDATE pools SET drawn_at = $1, winner_user_id = $2, winning_ticket_id = $3 WHERE pool_id = $4",
        [now, winner.user_id, winner.id, poolId],
      );

      return {
        poolId,
        winnerUserId: winner.user_id,
        winningTicketId: winner.id,
        totalTickets: ticketsRes.rows.length,
      };
    });
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
  };
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}
