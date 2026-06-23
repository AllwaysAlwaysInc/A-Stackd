/**
 * The chip tiers that define the A Stack'd "Casino Tiered Economy".
 *
 * Each chip color carries a dollar value, a mood label, and the number of
 * ticket seats it claims on the Floor when spent. Black is the "whale" chip:
 * it consumes all (a 10-seat carpet bomb) and is rate-limited per pool.
 */
export const CHIP_COLORS = ["red", "white", "blue", "black"] as const;

export type ChipColor = (typeof CHIP_COLORS)[number];

export interface ChipTier {
  color: ChipColor;
  /** Dollar value of a single chip. */
  value: number;
  /** Mood label shown in the UI. */
  label: string;
  /** Number of ticket seats claimed when one chip of this color is spent. */
  seats: number;
}

export const CHIP_TIERS: Record<ChipColor, ChipTier> = {
  red: { color: "red", value: 1, label: "Rage", seats: 1 },
  white: { color: "white", value: 5, label: "Safe", seats: 1 },
  blue: { color: "blue", value: 10, label: "Calm", seats: 1 },
  black: { color: "black", value: 100, label: "Consumes All", seats: 10 },
};

/** A wallet is a per-color chip balance. */
export type ChipWallet = Record<ChipColor, number>;

export function emptyWallet(): ChipWallet {
  return { red: 0, white: 0, blue: 0, black: 0 };
}

export function isChipColor(value: string): value is ChipColor {
  return (CHIP_COLORS as readonly string[]).includes(value);
}

/** How many seats one chip of the given color claims. */
export function seatsForChip(color: ChipColor): number {
  return CHIP_TIERS[color].seats;
}
