import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PostgresStore } from "../src/store/postgres.js";
import { seedPools, seedWallets } from "../src/store/seed.js";

const DATABASE_URL = process.env.DATABASE_URL;

// These tests only run when a Postgres instance is provided via DATABASE_URL.
const describePg = DATABASE_URL ? describe : describe.skip;

describePg("PostgresStore", () => {
  let store: PostgresStore;
  const NOW = 1_000_000_000_000;

  beforeAll(async () => {
    store = new PostgresStore(DATABASE_URL!);
    await store.migrate();
  });

  afterAll(async () => {
    await store?.close();
  });

  beforeEach(async () => {
    // Reset state between tests.
    const reset = new PostgresStore(DATABASE_URL!);
    // Truncate via a throwaway connection by recreating the schema objects.
    // tickets is append-only (trigger blocks DELETE), so drop+recreate.
    // @ts-expect-error access the underlying pool for test teardown only
    await reset.pool.query(
      "DROP TABLE IF EXISTS tickets CASCADE; DROP TABLE IF EXISTS pools CASCADE; DROP TABLE IF EXISTS wallets CASCADE; DROP TABLE IF EXISTS users CASCADE;",
    );
    await reset.migrate();
    await reset.close();

    const [poolA] = seedPools(NOW);
    await store.createPool({
      poolId: poolA!.poolId,
      prize: poolA!.prize,
      type: poolA!.type,
      isGuaranteed: poolA!.isGuaranteed,
      requiredChip: poolA!.requiredChip,
      capacity: poolA!.capacity,
      closesAt: poolA!.closesAt,
    });
    const wallet = seedWallets().u123!;
    await store.creditWallet("u123", "blue", wallet.blue);
    await store.creditWallet("u123", "black", wallet.black);
  });

  it("persists users and enforces unique emails", async () => {
    const user = await store.createUser({
      email: "Persist@Example.com",
      passwordHash: "hash",
    });
    expect(user.userId).toMatch(/^u_/);
    expect(user.email).toBe("persist@example.com");

    const found = await store.getUserByEmail("persist@example.com");
    expect(found?.userId).toBe(user.userId);

    await expect(
      store.createUser({ email: "persist@example.com", passwordHash: "other" }),
    ).rejects.toMatchObject({ code: "EMAIL_IN_USE" });
  });

  it("persists a purchase: debits wallet, appends rows, advances fill", async () => {
    const before = await store.getPool("p_weekly_tv");
    const result = await store.purchase({
      userId: "u123",
      poolId: "p_weekly_tv",
      chipColor: "blue",
      shippingAddress: "1 Main St",
      now: NOW,
    });
    expect(result.seats).toBe(1);

    const wallet = await store.getWallet("u123");
    expect(wallet?.blue).toBe(seedWallets().u123!.blue - 1);

    const after = await store.getPool("p_weekly_tv");
    expect(after!.filled).toBe(before!.filled + 1);

    const tickets = await store.ticketsForUser("u123");
    expect(tickets).toHaveLength(1);
  });

  it("a black chip drops 10 immutable rows", async () => {
    const result = await store.purchase({
      userId: "u123",
      poolId: "p_weekly_tv",
      chipColor: "black",
      shippingAddress: "1 Main St",
      now: NOW,
    });
    expect(result.seats).toBe(10);
    const tickets = await store.ticketsForUser("u123");
    expect(tickets).toHaveLength(10);
  });

  it("enforces the whale limit at the data layer", async () => {
    await store.creditWallet("u123", "black", 1); // ensure balance is not the blocker
    await store.purchase({
      userId: "u123",
      poolId: "p_weekly_tv",
      chipColor: "black",
      shippingAddress: "x",
      now: NOW,
    });
    await expect(
      store.purchase({
        userId: "u123",
        poolId: "p_weekly_tv",
        chipColor: "black",
        shippingAddress: "x",
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: "WHALE_LIMIT_REACHED" });
  });

  it("tickets are immutable (UPDATE/DELETE rejected by trigger)", async () => {
    await store.purchase({
      userId: "u123",
      poolId: "p_weekly_tv",
      chipColor: "blue",
      shippingAddress: "x",
      now: NOW,
    });
    // @ts-expect-error access pool for the immutability assertion only
    const pool = store.pool;
    await expect(pool.query("DELETE FROM tickets")).rejects.toThrow(/immutable/);
    await expect(pool.query("UPDATE tickets SET user_id = 'x'")).rejects.toThrow(/immutable/);
  });
});
