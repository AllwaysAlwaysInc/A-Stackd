import type { ChipColor } from "./chips.js";

export type PoolType = "WEEKLY_GRAND" | "DAILY_DROP" | "FLASH";

/** A prize pool as stored on the Floor. */
export interface Pool {
  poolId: string;
  prize: string;
  type: PoolType;
  isGuaranteed: boolean;
  /** Chip color required to enter (black is always also accepted). */
  requiredChip: ChipColor;
  /** Total number of ticket seats available. */
  capacity: number;
  /** Seats already claimed (mutated as tickets drop to the Floor). */
  filled: number;
  /** Epoch millis when the pool stops accepting tickets. */
  closesAt: number;
}

/**
 * Dynamic "Melting Odds" multiplier.
 *
 * The further a pool is under capacity, the more drawing power each seat
 * carries. Derived directly from fill ratio: capacity / filled. A pool at
 * 185/500 yields 500 / 185 = 2.7x, matching the Sales Agent surge alert.
 */
export function meltingMultiplier(pool: Pool): number {
  if (pool.filled <= 0) return Number((pool.capacity).toFixed(1));
  if (pool.filled >= pool.capacity) return 1;
  return Number((pool.capacity / pool.filled).toFixed(1));
}

export function poolStatusLabel(pool: Pool): string {
  return `${pool.filled}/${pool.capacity} Filled`;
}

export function seatsRemaining(pool: Pool): number {
  return Math.max(0, pool.capacity - pool.filled);
}

export function isPoolOpen(pool: Pool, now: number): boolean {
  return now < pool.closesAt && seatsRemaining(pool) > 0;
}

/** Human-readable countdown such as "3d 4h" or "5h 12m". */
export function timeLeftLabel(pool: Pool, now: number): string {
  const ms = pool.closesAt - now;
  if (ms <= 0) return "closed";
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/** Sales Agent alert string, surfaced when a pool is under capacity. */
export function salesAgentAlert(pool: Pool): string | undefined {
  const multiplier = meltingMultiplier(pool);
  if (multiplier <= 1) return undefined;
  return `\uD83D\uDCC8 ODDS SURGE: Individual drawing power multiplied by ${multiplier}x right now! (Pool under capacity)`;
}
