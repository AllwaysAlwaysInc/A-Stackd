import { seatsForChip, type ChipColor, type ChipWallet } from "./chips.js";
import {
  InsufficientChipsError,
  InvalidChipForPoolError,
  PoolClosedError,
  PoolFullError,
  WhaleLimitError,
} from "./errors.js";
import { isPoolOpen, seatsRemaining, type Pool } from "./pools.js";

/** Context required to validate a purchase against the Floor ruleset. */
export interface PurchaseContext {
  pool: Pool;
  wallet: ChipWallet;
  chipColor: ChipColor;
  /** Number of black-chip purchases this user already made in this pool. */
  existingBlackChipBatches: number;
  now: number;
}

/**
 * Enforce the full A Stack'd ruleset for a single purchase. Throws a
 * {@link DomainError} subclass on the first violated rule; returns the number
 * of seats that will be claimed on success.
 *
 * Rules, in order:
 *  1. Pool must be open (not closed, has seats).
 *  2. Chip must match the pool's required chip, or be a black chip.
 *  3. The whale limit: at most one black chip per person per pool.
 *  4. The user must hold at least one chip of the chosen color.
 *  5. The pool must have enough remaining seats for the claim.
 */
export function assertPurchaseAllowed(ctx: PurchaseContext): number {
  const { pool, wallet, chipColor, existingBlackChipBatches, now } = ctx;

  if (!isPoolOpen(pool, now)) {
    if (now >= pool.closesAt) throw new PoolClosedError(pool.poolId);
    throw new PoolFullError(pool.poolId);
  }

  const chipAccepted = chipColor === pool.requiredChip || chipColor === "black";
  if (!chipAccepted) {
    throw new InvalidChipForPoolError(pool.poolId, pool.requiredChip);
  }

  if (chipColor === "black" && existingBlackChipBatches >= 1) {
    throw new WhaleLimitError(pool.poolId);
  }

  if (wallet[chipColor] < 1) {
    throw new InsufficientChipsError(chipColor);
  }

  const seats = seatsForChip(chipColor);
  if (seats > seatsRemaining(pool)) {
    throw new PoolFullError(pool.poolId);
  }

  return seats;
}
