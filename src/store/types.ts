import type { ChipColor, ChipWallet } from "../domain/chips.js";
import type { CreatePoolInput, Pool } from "../domain/pools.js";
import type { Ticket } from "../domain/tickets.js";
import type { User, UserRole } from "../domain/users.js";

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  role?: UserRole;
}

export interface PurchaseInput {
  userId: string;
  poolId: string;
  chipColor: ChipColor;
  shippingAddress: string;
  now?: number;
}

export interface PurchaseResult {
  /** Batch id returned to the client as the canonical ticketId. */
  ticketId: string;
  /** Individual immutable ticket rows dropped to the Floor. */
  tickets: Ticket[];
  seats: number;
  chipColor: ChipColor;
}

export interface DrawResult {
  poolId: string;
  winnerUserId: string;
  winningTicketId: string;
  totalTickets: number;
}

/**
 * Storage abstraction for the air-gapped Transactional Floor. The in-memory
 * implementation is the default; the PostgreSQL implementation satisfies the
 * same contract for production (immutable, append-only ticket rows).
 */
export interface DataStore {
  /** Create a user account. Throws EmailInUseError if the email exists. */
  createUser(input: CreateUserInput): Promise<User>;
  getUserByEmail(email: string): Promise<User | null>;
  getWallet(userId: string): Promise<ChipWallet | null>;
  getOrCreateWallet(userId: string): Promise<ChipWallet>;
  creditWallet(userId: string, color: ChipColor, amount: number): Promise<ChipWallet>;
  listPools(now: number): Promise<Pool[]>;
  getPool(poolId: string): Promise<Pool | null>;
  createPool(input: CreatePoolInput): Promise<Pool>;
  ticketsForUser(userId: string): Promise<Ticket[]>;
  /**
   * Validate and execute a purchase atomically: enforce the ruleset, debit the
   * wallet, append immutable ticket rows, and advance the pool fill count.
   */
  purchase(input: PurchaseInput): Promise<PurchaseResult>;
  /** Draw a uniformly-random winning ticket for a closed/full pool. */
  drawWinner(poolId: string, now?: number): Promise<DrawResult>;
  /** Release any held resources (e.g. DB pool). */
  close(): Promise<void>;
}
