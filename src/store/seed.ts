import type { ChipWallet } from "../domain/chips.js";
import type { Pool } from "../domain/pools.js";
import { MemoryStore } from "./memory.js";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Demo data matching the launch spec mock responses. */
export function seedWallets(): Record<string, ChipWallet> {
  return {
    u123: { red: 25, white: 10, blue: 5, black: 1 },
  };
}

export function seedPools(now: number = Date.now()): Pool[] {
  return [
    {
      poolId: "p_weekly_tv",
      prize: "55-inch 4K Smart TV",
      type: "WEEKLY_GRAND",
      isGuaranteed: true,
      requiredChip: "blue",
      capacity: 500,
      filled: 185,
      closesAt: now + 3 * DAY + 4 * HOUR,
    },
    {
      poolId: "p_daily_cash",
      prize: "$250 Cash Drop",
      type: "DAILY_DROP",
      isGuaranteed: true,
      requiredChip: "white",
      capacity: 100,
      filled: 12,
      closesAt: now + 18 * HOUR,
    },
  ];
}

export function createSeededStore(now: number = Date.now()): MemoryStore {
  return new MemoryStore({ wallets: seedWallets(), pools: seedPools(now) });
}
