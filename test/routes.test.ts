import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { createSeededStore } from "../src/store/seed.js";

const AUTH = { authorization: "Bearer u123" };

describe("routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp({ store: createSeededStore() });
  });

  afterEach(async () => {
    await app.close();
  });

  it("GET /health is public", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "ok" });
  });

  it("GET /wallet requires auth", async () => {
    const res = await app.inject({ method: "GET", url: "/wallet" });
    expect(res.statusCode).toBe(401);
  });

  it("GET /wallet returns the seeded stack", async () => {
    const res = await app.inject({ method: "GET", url: "/wallet", headers: AUTH });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      userId: "u123",
      stacks: { red: 25, white: 10, blue: 5, black: 1 },
    });
  });

  it("GET /active-pools surfaces melting odds and the surge alert", async () => {
    const res = await app.inject({ method: "GET", url: "/active-pools", headers: AUTH });
    expect(res.statusCode).toBe(200);
    const tv = res.json().pools.find((p: { poolId: string }) => p.poolId === "p_weekly_tv");
    expect(tv.status).toBe("185/500 Filled");
    expect(tv.meltingMultiplier).toBe(2.7);
    expect(tv.salesAgentAlert).toContain("2.7x");
  });

  it("POST /buy-ticket claims one seat for a blue chip and debits the wallet", async () => {
    const buy = await app.inject({
      method: "POST",
      url: "/buy-ticket",
      headers: AUTH,
      payload: { poolId: "p_weekly_tv", chipColor: "blue", shippingAddress: "1 Main St" },
    });
    expect(buy.statusCode).toBe(200);
    expect(buy.json()).toMatchObject({ success: true, seats: 1 });
    expect(buy.json().msg).toContain("[1] seats");

    const wallet = await app.inject({ method: "GET", url: "/wallet", headers: AUTH });
    expect(wallet.json().stacks.blue).toBe(4);
  });

  it("POST /buy-ticket claims 10 seats for a black chip (carpet bomb)", async () => {
    const buy = await app.inject({
      method: "POST",
      url: "/buy-ticket",
      headers: AUTH,
      payload: { poolId: "p_weekly_tv", chipColor: "black", shippingAddress: "1 Main St" },
    });
    expect(buy.statusCode).toBe(200);
    expect(buy.json()).toMatchObject({ success: true, seats: 10 });
  });

  it("enforces the whale limit across requests", async () => {
    const store = createSeededStore();
    // give u123 a second black chip so the limit (not the balance) is what blocks
    const local = await buildApp({ store });
    const payload = { poolId: "p_weekly_tv", chipColor: "black", shippingAddress: "x" };
    const first = await local.inject({ method: "POST", url: "/buy-ticket", headers: AUTH, payload });
    expect(first.statusCode).toBe(200);
    const second = await local.inject({ method: "POST", url: "/buy-ticket", headers: AUTH, payload });
    expect(second.statusCode).toBe(429);
    expect(second.json().error.code).toBe("WHALE_LIMIT_REACHED");
    await local.close();
  });

  it("rejects an unknown pool with 404", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/buy-ticket",
      headers: AUTH,
      payload: { poolId: "nope", chipColor: "blue", shippingAddress: "x" },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("POOL_NOT_FOUND");
  });

  it("rejects a wrong chip for the pool with 422", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/buy-ticket",
      headers: AUTH,
      payload: { poolId: "p_weekly_tv", chipColor: "red", shippingAddress: "x" },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe("INVALID_CHIP_FOR_POOL");
  });

  it("validates the request body", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/buy-ticket",
      headers: AUTH,
      payload: { poolId: "p_weekly_tv" },
    });
    expect(res.statusCode).toBe(400);
  });
});
