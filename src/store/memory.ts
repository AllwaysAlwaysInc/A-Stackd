import { randomUUID } from "node:crypto";
import { emptyWallet, type ChipWallet } from "../domain/chips.js";
import { assertPurchaseAllowed } from "../domain/economy.js";
import { PoolNotFoundError } from "../domain/errors.js";
import type { Pool } from "../domain/pools.js";
import type { Ticket } from "../domain/tickets.js";
import type { DataStore, PurchaseInput, PurchaseResult } from "./types.js";

/**
 * In-memory implementation of the Floor. Node runs purchase() to completion
 * synchronously, so debit/append/advance is effectively atomic — no partial
 * writes can interleave. The ticket array is append-only.
 */
export class MemoryStore implements DataStore {
  private readonly wallets = new Map<string, ChipWallet>();
  private readonly pools = new Map<string, Pool>();
  private readonly tickets: Ticket[] = [];

  constructor(seed?: { wallets?: Record<string, ChipWallet>; pools?: Pool[] }) {
    for (const [userId, wallet] of Object.entries(seed?.wallets ?? {})) {
      this.wallets.set(userId, { ...wallet });
    }
    for (const pool of seed?.pools ?? []) {
      this.pools.set(pool.poolId, { ...pool });
    }
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

  async listPools(_now: number): Promise<Pool[]> {
    return [...this.pools.values()].map((pool) => ({ ...pool }));
  }

  async getPool(poolId: string): Promise<Pool | null> {
    const pool = this.pools.get(poolId);
    return pool ? { ...pool } : null;
  }

  async ticketsForUser(userId: string): Promise<Ticket[]> {
    return this.tickets.filter((ticket) => ticket.userId === userId);
  }

  async purchase(input: PurchaseInput): Promise<PurchaseResult> {
    const now = input.now ?? Date.now();
    const pool = this.pools.get(input.poolId);
    if (!pool) throw new PoolNotFoundError(input.poolId);

    const wallet = this.wallets.get(input.userId) ?? emptyWallet();

    const existingBlackChipBatches = countBlackBatches(
      this.tickets,
      input.userId,
      input.poolId,
    );

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
      };
      this.tickets.push(ticket);
      batch.push(ticket);
    }

    pool.filled += seats;

    return { ticketId, tickets: batch, seats, chipColor: input.chipColor };
  }
}

function countBlackBatches(
  tickets: readonly Ticket[],
  userId: string,
  poolId: string,
): number {
  const batches = new Set<string>();
  for (const ticket of tickets) {
    if (
      ticket.userId === userId &&
      ticket.poolId === poolId &&
      ticket.chipColor === "black"
    ) {
      batches.add(ticket.batchId);
    }
  }
  return batches.size;
}
