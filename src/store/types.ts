import type { ShippingAddress } from "../domain/address.js";
import type { ChipColor, ChipWallet } from "../domain/chips.js";
import type { CreatePoolInput, Pool } from "../domain/pools.js";
import type { Ticket } from "../domain/tickets.js";
import type { User, UserRole } from "../domain/users.js";

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  role?: UserRole;
  dateOfBirth: string;
  consentAt: number;
  emailVerificationToken: string;
}

export interface PurchaseInput {
  userId: string;
  poolId: string;
  chipColor: ChipColor | "free";
  shippingAddress: ShippingAddress;
  now?: number;
}

export interface PurchaseResult {
  /** Batch id returned to the client as the canonical ticketId. */
  ticketId: string;
  /** Individual immutable ticket rows dropped to the Floor. */
  tickets: Ticket[];
  seats: number;
  chipColor: ChipColor | "free";
}

export interface DrawResult {
  poolId: string;
  winnerUserId: string;
  winningTicketId: string;
  totalTickets: number;
  serverSeed: string;
  clientSeed: string;
  finalSeed: string;
  winnerIndex: number;
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
  getUserById(userId: string): Promise<User | null>;
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

  // --- Account Essentials ---
  verifyEmail(userId: string, token: string): Promise<boolean>;
  sendForgotPassword(email: string, token: string, expires: number): Promise<boolean>;
  resetPassword(token: string, passwordHash: string): Promise<boolean>;
  updateProfile(userId: string, updates: { dateOfBirth?: string }): Promise<User>;

  // --- Saved Address Book ---
  createAddress(userId: string, address: ShippingAddress, isDefault: boolean): Promise<any>;
  listAddresses(userId: string): Promise<any[]>;
  deleteAddress(userId: string, addressId: string): Promise<void>;

  // --- Idempotency ---
  checkIdempotency(key: string, userId: string): Promise<any | null>;
  saveIdempotency(key: string, userId: string, responseBody: any): Promise<void>;

  // --- Free Entry Path ---
  freeEntry(input: { userId: string; poolId: string; shippingAddress: ShippingAddress; now?: number }): Promise<PurchaseResult>;

  // --- Fulfillment Loop ---
  createOrder(poolId: string, winnerUserId: string, ticketId: string, address: ShippingAddress): Promise<any>;
  listOrders(): Promise<any[]>;
  shipOrder(orderId: string, trackingNumber: string): Promise<any>;

  // --- Notifications ---
  getNotifications(userId: string): Promise<any[]>;
  createNotification(userId: string, title: string, message: string): Promise<any>;
  markNotificationsRead(userId: string): Promise<void>;

  ticketsForPool(poolId: string): Promise<Ticket[]>;
}


