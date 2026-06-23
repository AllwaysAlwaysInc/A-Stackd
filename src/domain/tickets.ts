import type { ChipColor } from "./chips.js";

/**
 * An immutable ticket row on the Floor. Tickets are append-only: once a row is
 * dropped it is never mutated or deleted. A single purchase drops one row per
 * seat claimed (1 for most chips, 10 for a black-chip carpet bomb), all sharing
 * a batchId.
 */
export interface Ticket {
  readonly id: string;
  readonly batchId: string;
  readonly poolId: string;
  readonly userId: string;
  readonly chipColor: ChipColor;
  /** 1-based seat index within this purchase batch. */
  readonly seatNumber: number;
  readonly createdAt: number;
}
