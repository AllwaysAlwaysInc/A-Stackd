import { randomUUID } from "node:crypto";
import { emptyWallet, type ChipColor, type ChipWallet } from "../domain/chips.js";
import { assertDrawable, assertPurchaseAllowed, pickWinnerIndex } from "../domain/economy.js";
import { EmailInUseError, NoTicketsError, PoolExistsError, PoolNotFoundError } from "../domain/errors.js";
import type { CreatePoolInput, Pool } from "../domain/pools.js";
import type { Ticket } from "../domain/tickets.js";
import { normalizeEmail, type User } from "../domain/users.js";
import type { CreateUserInput, DataStore, DrawResult, PurchaseInput, PurchaseResult } from "./types.js";

/**
 * In-memory implementation of the Floor. Node runs each mutating method to
 * completion synchronously, so debit/append/advance is effectively atomic — no
 * partial writes can interleave. The ticket array is append-only.
 */
export class MemoryStore implements DataStore {
  private readonly wallets = new Map<string, ChipWallet>();
  private readonly pools = new Map<string, Pool>();
  private readonly tickets: Ticket[] = [];
  private readonly usersByEmail = new Map<string, User>();

  constructor(seed?: { wallets?: Record<string, ChipWallet>; pools?: Pool[] }) {
    for (const [userId, wallet] of Object.entries(seed?.wallets ?? {})) {
      this.wallets.set(userId, { ...wallet });
    }
    for (const pool of seed?.pools ?? []) {
      this.pools.set(pool.poolId, { ...pool });
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
    };
    this.usersByEmail.set(email, user);
    return { ...user };
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const user = this.usersByEmail.get(normalizeEmail(email));
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
    const pool: Pool = {
      poolId,
      prize: input.prize,
      type: input.type,
      isGuaranteed: input.isGuaranteed,
      requiredChip: input.requiredChip,
      capacity: input.capacity,
      filled: 0,
      closesAt: input.closesAt,
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
      chipColor: input.chipColor,
      existingBlackChipBatches,
      now,
    });

    // Commit: debit one chip, drop immutable rows, advance the fill count.
    wallet[input.chipColor] -= 1;
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

    const winner = poolTickets[pickWinnerIndex(poolTickets.length)]!;
    pool.drawnAt = now;
    pool.winnerUserId = winner.userId;
    pool.winningTicketId = winner.id;

    return {
      poolId,
      winnerUserId: winner.userId,
      winningTicketId: winner.id,
      totalTickets: poolTickets.length,
    };
  }

  async close(): Promise<void> {
    // Nothing to release for the in-memory store.
  }
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
