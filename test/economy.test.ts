import { describe, expect, it } from "vitest";
import { assertPurchaseAllowed } from "../src/domain/economy.js";
import {
  InsufficientChipsError,
  InvalidChipForPoolError,
  PoolClosedError,
  PoolFullError,
  WhaleLimitError,
} from "../src/domain/errors.js";
import { meltingMultiplier, type Pool } from "../src/domain/pools.js";

const NOW = 1_000_000;

function pool(overrides: Partial<Pool> = {}): Pool {
  return {
    poolId: "p1",
    prize: "TV",
    type: "WEEKLY_GRAND",
    isGuaranteed: true,
    requiredChip: "blue",
    capacity: 500,
    filled: 185,
    closesAt: NOW + 1000,
    ...overrides,
  };
}

describe("meltingMultiplier", () => {
  it("derives 2.7x from a 185/500 pool (matches the spec)", () => {
    expect(meltingMultiplier(pool())).toBe(2.7);
  });

  it("is 1 when the pool is full", () => {
    expect(meltingMultiplier(pool({ filled: 500 }))).toBe(1);
  });
});

describe("assertPurchaseAllowed", () => {
  const wallet = { red: 25, white: 10, blue: 5, black: 1 };

  it("allows a matching chip and returns 1 seat", () => {
    const seats = assertPurchaseAllowed({
      pool: pool(),
      wallet,
      chipColor: "blue",
      existingBlackChipBatches: 0,
      now: NOW,
    });
    expect(seats).toBe(1);
  });

  it("treats a black chip as a 10-seat carpet bomb on any pool", () => {
    const seats = assertPurchaseAllowed({
      pool: pool(),
      wallet,
      chipColor: "black",
      existingBlackChipBatches: 0,
      now: NOW,
    });
    expect(seats).toBe(10);
  });

  it("rejects a non-matching, non-black chip", () => {
    expect(() =>
      assertPurchaseAllowed({
        pool: pool(),
        wallet,
        chipColor: "red",
        existingBlackChipBatches: 0,
        now: NOW,
      }),
    ).toThrow(InvalidChipForPoolError);
  });

  it("enforces the whale limit (max one black chip per pool)", () => {
    expect(() =>
      assertPurchaseAllowed({
        pool: pool(),
        wallet,
        chipColor: "black",
        existingBlackChipBatches: 1,
        now: NOW,
      }),
    ).toThrow(WhaleLimitError);
  });

  it("rejects when the user holds no chip of that color", () => {
    expect(() =>
      assertPurchaseAllowed({
        pool: pool(),
        wallet: { red: 0, white: 0, blue: 0, black: 0 },
        chipColor: "blue",
        existingBlackChipBatches: 0,
        now: NOW,
      }),
    ).toThrow(InsufficientChipsError);
  });

  it("rejects a closed pool", () => {
    expect(() =>
      assertPurchaseAllowed({
        pool: pool({ closesAt: NOW - 1 }),
        wallet,
        chipColor: "blue",
        existingBlackChipBatches: 0,
        now: NOW,
      }),
    ).toThrow(PoolClosedError);
  });

  it("rejects when not enough seats remain for a carpet bomb", () => {
    expect(() =>
      assertPurchaseAllowed({
        pool: pool({ filled: 495, capacity: 500 }),
        wallet,
        chipColor: "black",
        existingBlackChipBatches: 0,
        now: NOW,
      }),
    ).toThrow(PoolFullError);
  });
});
