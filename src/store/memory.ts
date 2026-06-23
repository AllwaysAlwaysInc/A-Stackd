import { randomUUID, createHash, randomBytes } from "node:crypto";
import { emptyWallet, type ChipColor, type ChipWallet } from "../domain/chips.js";
import { assertDrawable, assertPurchaseAllowed, pickWinnerIndex } from "../domain/economy.js";
import { EmailInUseError, NoTicketsError, PoolExistsError, PoolNotFoundError } from "../domain/errors.js";
import type { CreatePoolInput, Pool } from "../domain/pools.js";
import type { Ticket } from "../domain/tickets.js";
import { normalizeEmail, type User } from "../domain/users.js";
import type { CreateUserInput, DataStore, DrawResult, PurchaseInput, PurchaseResult } from "./types.js";
import type { ShippingAddress } from "../domain/address.js";

export class MemoryStore implements DataStore {
  private readonly wallets = new Map<string, ChipWallet>();
  private readonly pools = new Map<string, Pool>();
  private readonly tickets: Ticket[] = [];
  private readonly usersByEmail = new Map<string, User>();
  private readonly usersById = new Map<string, User>();

  private readonly addresses = new Map<string, any[]>();
  private readonly idempotencyKeys = new Map<string, any>();
  private readonly orders: any[] = [];
  private readonly notifications = new Map<string, any[]>();

  constructor(seed?: { wallets?: Record<string, ChipWallet>; pools?: Pool[]; users?: Record<string, User> }) {
    for (const [userId, wallet] of Object.entries(seed?.wallets ?? {})) {
      this.wallets.set(userId, { ...wallet });
    }
    for (const pool of seed?.pools ?? []) {
      const serverSeed = randomBytes(32).toString("hex");
      const serverSeedHash = createHash("sha256").update(serverSeed).digest("hex");
      this.pools.set(pool.poolId, {
        ...pool,
        serverSeed,
        serverSeedHash,
      });
    }
    for (const [userId, user] of Object.entries(seed?.users ?? {})) {
      this.usersById.set(userId, { ...user });
      this.usersByEmail.set(user.email, { ...user });
    }
  }


  async createUser(input: CreateUserInput): Promise<User> {
    const email = normalizeEmail(input.email);
    if (this.usersByEmail.has(email)) throw new EmailInUseError(email);
    const user: User = {
      userId: `u_${randomUUID().slice(0, 8)}`,
      email,
      passwordHash: input.passwordHash,
      role: input.role ?? "user",
      dateOfBirth: input.dateOfBirth,
      consentAt: input.consentAt,
      emailVerified: false,
      emailVerificationToken: input.emailVerificationToken,
    };
    this.usersByEmail.set(email, user);
    this.usersById.set(user.userId, user);
    return { ...user };
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const user = this.usersByEmail.get(normalizeEmail(email));
    return user ? { ...user } : null;
  }

  async getUserById(userId: string): Promise<User | null> {
    const user = this.usersById.get(userId);
    return user ? { ...user } : null;
  }

  async getWallet(userId: string): Promise<ChipWallet | null> {
    const wallet = this.wallets.get(userId);
    return wallet ? { ...wallet } : null;
  }

  async getOrCreateWallet(userId: string): Promise<ChipWallet> {
    let wallet = this.wallets.get(userId);
    if (!wallet) {
      wallet = emptyWallet();
      this.wallets.set(userId, wallet);
    }
    return { ...wallet };
  }

  async creditWallet(userId: string, color: ChipColor, amount: number): Promise<ChipWallet> {
    const wallet = this.wallets.get(userId) ?? emptyWallet();
    wallet[color] += amount;
    this.wallets.set(userId, wallet);
    return { ...wallet };
  }

  async listPools(_now: number): Promise<Pool[]> {
    return [...this.pools.values()].map((pool) => ({ ...pool }));
  }

  async getPool(poolId: string): Promise<Pool | null> {
    const pool = this.pools.get(poolId);
    return pool ? { ...pool } : null;
  }

  async createPool(input: CreatePoolInput): Promise<Pool> {
    const poolId = input.poolId ?? `p_${randomUUID().slice(0, 8)}`;
    if (this.pools.has(poolId)) throw new PoolExistsError(poolId);
    const serverSeed = randomBytes(32).toString("hex");
    const serverSeedHash = createHash("sha256").update(serverSeed).digest("hex");
    const pool: Pool = {
      poolId,
      prize: input.prize,
      type: input.type,
      isGuaranteed: input.isGuaranteed,
      requiredChip: input.requiredChip,
      capacity: input.capacity,
      filled: 0,
      closesAt: input.closesAt,
      serverSeed,
      serverSeedHash,
    };
    this.pools.set(poolId, pool);
    return { ...pool };
  }

  async ticketsForUser(userId: string): Promise<Ticket[]> {
    return this.tickets
      .filter((ticket) => ticket.userId === userId)
      .map((ticket) => ({ ...ticket }));
  }

  async purchase(input: PurchaseInput): Promise<PurchaseResult> {
    const now = input.now ?? Date.now();
    const pool = this.pools.get(input.poolId);
    if (!pool) throw new PoolNotFoundError(input.poolId);

    const wallet = this.wallets.get(input.userId) ?? emptyWallet();
    const existingBlackChipBatches = countBlackBatches(this.tickets, input.userId, input.poolId);

    const seats = assertPurchaseAllowed({
      pool,
      wallet,
      chipColor: input.chipColor as ChipColor,
      existingBlackChipBatches,
      now,
    });

    wallet[input.chipColor as ChipColor] -= 1;
    this.wallets.set(input.userId, wallet);

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
        shippingAddress: { ...input.shippingAddress },
      };
      this.tickets.push(ticket);
      batch.push({ ...ticket, shippingAddress: { ...ticket.shippingAddress } });
    }

    pool.filled += seats;

    return { ticketId, tickets: batch, seats, chipColor: input.chipColor };
  }

  async drawWinner(poolId: string, now: number = Date.now()): Promise<DrawResult> {
    const pool = this.pools.get(poolId);
    if (!pool) throw new PoolNotFoundError(poolId);
    assertDrawable(pool, now);

    const poolTickets = this.tickets.filter((ticket) => ticket.poolId === poolId);
    if (poolTickets.length === 0) throw new NoTicketsError(poolId);

    let serverSeed = pool.serverSeed;
    let serverSeedHash = pool.serverSeedHash;
    if (!serverSeed) {
      serverSeed = randomBytes(32).toString("hex");
      serverSeedHash = createHash("sha256").update(serverSeed).digest("hex");
    }

    const ticketIds = poolTickets.map((t) => t.id);
    const clientSeed = createHash("sha256").update(ticketIds.join(",")).digest("hex");
    const finalSeed = createHash("sha256").update(`${serverSeed}:${clientSeed}`).digest("hex");

    const winnerIndex = Number(BigInt(`0x${finalSeed}`) % BigInt(poolTickets.length));
    const winner = poolTickets[winnerIndex]!;

    pool.drawnAt = now;
    pool.winnerUserId = winner.userId;
    pool.winningTicketId = winner.id;
    pool.serverSeed = serverSeed;
    pool.serverSeedHash = serverSeedHash;
    pool.clientSeed = clientSeed;
    pool.finalSeed = finalSeed;
    pool.winnerIndex = winnerIndex;

    await this.createOrder(poolId, winner.userId, winner.id, winner.shippingAddress);
    await this.createNotification(
      winner.userId,
      "🎉 Winner Reveal: You Won!",
      `Congratulations! You won the prize "${pool.prize}"! Tracking number will be updated soon.`
    );

    return {
      poolId,
      winnerUserId: winner.userId,
      winningTicketId: winner.id,
      totalTickets: poolTickets.length,
      serverSeed,
      clientSeed,
      finalSeed,
      winnerIndex,
    };
  }

  // --- Account Essentials ---
  async verifyEmail(userId: string, token: string): Promise<boolean> {
    const user = this.usersById.get(userId);
    if (user && user.emailVerificationToken === token) {
      user.emailVerified = true;
      user.emailVerificationToken = null;
      return true;
    }
    return false;
  }

  async sendForgotPassword(email: string, token: string, expires: number): Promise<boolean> {
    const user = this.usersByEmail.get(normalizeEmail(email));
    if (user) {
      user.passwordResetToken = token;
      user.passwordResetExpires = expires;
      return true;
    }
    return false;
  }

  async resetPassword(token: string, passwordHash: string): Promise<boolean> {
    const now = Date.now();
    for (const user of this.usersById.values()) {
      if (user.passwordResetToken === token && user.passwordResetExpires && user.passwordResetExpires > now) {
        user.passwordHash = passwordHash;
        user.passwordResetToken = null;
        user.passwordResetExpires = null;
        return true;
      }
    }
    return false;
  }

  async updateProfile(userId: string, updates: { dateOfBirth?: string }): Promise<User> {
    const user = this.usersById.get(userId);
    if (!user) throw new Error("User not found");
    if (updates.dateOfBirth !== undefined) user.dateOfBirth = updates.dateOfBirth;
    return { ...user };
  }

  // --- Saved Address Book ---
  async createAddress(userId: string, address: ShippingAddress, isDefault: boolean): Promise<any> {
    const addressId = `addr_${randomUUID().slice(0, 8)}`;
    const userAddrs = this.addresses.get(userId) ?? [];
    if (isDefault) {
      for (const a of userAddrs) a.is_default = false;
    }
    const newAddr = {
      address_id: addressId,
      user_id: userId,
      name: address.name,
      line1: address.line1,
      line2: address.line2 ?? null,
      city: address.city,
      state: address.state,
      postal_code: address.postalCode,
      country: address.country || "US",
      is_default: isDefault,
      created_at: Date.now()
    };
    userAddrs.push(newAddr);
    this.addresses.set(userId, userAddrs);
    return newAddr;
  }

  async listAddresses(userId: string): Promise<any[]> {
    const list = this.addresses.get(userId) ?? [];
    return [...list].sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0) || b.created_at - a.created_at);
  }

  async deleteAddress(userId: string, addressId: string): Promise<void> {
    const list = this.addresses.get(userId) ?? [];
    this.addresses.set(userId, list.filter((a) => a.address_id !== addressId));
  }

  // --- Idempotency ---
  async checkIdempotency(key: string, userId: string): Promise<any | null> {
    const compound = `${key}:${userId}`;
    return this.idempotencyKeys.get(compound) ?? null;
  }

  async saveIdempotency(key: string, userId: string, responseBody: any): Promise<void> {
    const compound = `${key}:${userId}`;
    this.idempotencyKeys.set(compound, responseBody);
  }

  // --- Free Entry Path ---
  async freeEntry(input: { userId: string; poolId: string; shippingAddress: ShippingAddress; now?: number }): Promise<PurchaseResult> {
    const now = input.now ?? Date.now();
    const pool = this.pools.get(input.poolId);
    if (!pool) throw new PoolNotFoundError(input.poolId);

    if (pool.closesAt <= now || pool.drawnAt !== undefined) {
      throw new Error("Pool is closed.");
    }
    if (pool.filled >= pool.capacity) {
      throw new Error("Pool is full.");
    }

    const freeCount = this.tickets.filter((t) => t.userId === input.userId && t.poolId === input.poolId && t.chipColor === "free").length;
    if (freeCount >= 1) {
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
      shippingAddress: { ...input.shippingAddress }
    };
    this.tickets.push(ticket);
    pool.filled += 1;

    return { ticketId, tickets: [ticket], seats: 1, chipColor: "free" };
  }

  // --- Fulfillment Loop ---
  async createOrder(poolId: string, winnerUserId: string, ticketId: string, address: ShippingAddress): Promise<any> {
    const order = {
      order_id: `ord_${randomUUID().slice(0, 8)}`,
      pool_id: poolId,
      winner_user_id: winnerUserId,
      ticket_id: ticketId,
      shipping_address: address,
      status: "pending",
      tracking_number: null,
      shipped_at: null,
      created_at: Date.now()
    };
    this.orders.push(order);
    return order;
  }

  async listOrders(): Promise<any[]> {
    return [...this.orders].sort((a, b) => b.created_at - a.created_at);
  }

  async shipOrder(orderId: string, trackingNumber: string): Promise<any> {
    const order = this.orders.find((o) => o.order_id === orderId);
    if (!order) throw new Error("Order not found");
    order.status = "shipped";
    order.tracking_number = trackingNumber;
    order.shipped_at = Date.now();

    await this.createNotification(
      order.winner_user_id,
      "📦 Order Shipped!",
      `Your prize has been shipped! Tracking number: ${trackingNumber}`
    );
    return order;
  }

  // --- Notifications ---
  async getNotifications(userId: string): Promise<any[]> {
    return this.notifications.get(userId) ?? [];
  }

  async createNotification(userId: string, title: string, message: string): Promise<any> {
    const list = this.notifications.get(userId) ?? [];
    const notif = {
      notification_id: `notif_${randomUUID().slice(0, 8)}`,
      user_id: userId,
      title,
      message,
      read: false,
      created_at: Date.now()
    };
    list.unshift(notif);
    this.notifications.set(userId, list);
    return notif;
  }

  async markNotificationsRead(userId: string): Promise<void> {
    const list = this.notifications.get(userId) ?? [];
    for (const n of list) n.read = true;
  }

  async ticketsForPool(poolId: string): Promise<Ticket[]> {
    return this.tickets
      .filter((ticket) => ticket.poolId === poolId)
      .map((ticket) => ({ ...ticket }));
  }

  async close(): Promise<void> {}

}

function countBlackBatches(
  tickets: readonly Ticket[],
  userId: string,
  poolId: string,
): number {
  const batches = new Set<string>();
  for (const ticket of tickets) {
    if (ticket.userId === userId && ticket.poolId === poolId && ticket.chipColor === "black") {
      batches.add(ticket.batchId);
    }
  }
  return batches.size;
}
