import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createSeededStore } from "../src/store/seed.js";

const config = loadConfig({ NODE_ENV: "test" });

async function makeApp(): Promise<FastifyInstance> {
  return buildApp({ store: createSeededStore(), config });
}

function auth(app: FastifyInstance, sub = "u123", role: "user" | "admin" = "user") {
  return { authorization: `Bearer ${app.jwt.sign({ sub, role })}` };
}

const ADDRESS = {
  name: "Austin Hanshew",
  line1: "123 Jackpot Ave",
  city: "Las Vegas",
  state: "NV",
  postalCode: "89101",
};

describe("routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await makeApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("GET /health is public", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "ok" });
  });

  it("GET / serves the landing page", async () => {
    const res = await app.inject({ method: "GET", url: "/" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
  });

  it("GET /wallet rejects a missing token", async () => {
    const res = await app.inject({ method: "GET", url: "/wallet" });
    expect(res.statusCode).toBe(401);
  });

  it("GET /wallet rejects a garbage token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/wallet",
      headers: { authorization: "Bearer not-a-jwt" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("GET /wallet returns the seeded stack with a valid token", async () => {
    const res = await app.inject({ method: "GET", url: "/wallet", headers: auth(app) });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      userId: "u123",
      stacks: { red: 25, white: 10, blue: 5, black: 1 },
    });
  });

  it("POST /auth/dev-token mints a working token outside production", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/dev-token",
      payload: { userId: "u999" },
    });
    expect(res.statusCode).toBe(200);
    const token = res.json().token as string;
    const wallet = await app.inject({
      method: "GET",
      url: "/wallet",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(wallet.json().userId).toBe("u999");
  });

  it("POST /auth/register creates an account, grants welcome chips, and logs in", async () => {
    const reg = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "Player@Example.com", password: "hunter2hunter" },
    });
    expect(reg.statusCode).toBe(201);
    const { token, userId, role } = reg.json();
    expect(role).toBe("user");

    const wallet = await app.inject({
      method: "GET",
      url: "/wallet",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(wallet.json()).toEqual({
      userId,
      stacks: { red: 10, white: 5, blue: 3, black: 1 },
    });

    const dup = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "player@example.com", password: "anotherpass1" },
    });
    expect(dup.statusCode).toBe(409);
    expect(dup.json().error.code).toBe("EMAIL_IN_USE");

    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "player@example.com", password: "hunter2hunter" },
    });
    expect(login.statusCode).toBe(200);
    expect(login.json().userId).toBe(userId);

    const bad = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "player@example.com", password: "wrongpassword" },
    });
    expect(bad.statusCode).toBe(401);
    expect(bad.json().error.code).toBe("INVALID_CREDENTIALS");
  });

  it("POST /auth/register rejects a short password and bad email", async () => {
    const shortPw = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "a@b.co", password: "short" },
    });
    expect(shortPw.statusCode).toBe(400);

    const badEmail = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "not-an-email", password: "longenough1" },
    });
    expect(badEmail.statusCode).toBe(400);
  });

  it("GET /active-pools surfaces melting odds and the surge alert", async () => {
    const res = await app.inject({ method: "GET", url: "/active-pools", headers: auth(app) });
    expect(res.statusCode).toBe(200);
    const tv = res.json().pools.find((p: { poolId: string }) => p.poolId === "p_weekly_tv");
    expect(tv.status).toBe("185/500 Filled");
    expect(tv.meltingMultiplier).toBe(2.7);
    expect(tv.salesAgentAlert).toContain("2.7x");
  });

  it("GET /pools/:id returns one pool and 404s for unknown", async () => {
    const ok = await app.inject({ method: "GET", url: "/pools/p_weekly_tv", headers: auth(app) });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().poolId).toBe("p_weekly_tv");

    const missing = await app.inject({ method: "GET", url: "/pools/nope", headers: auth(app) });
    expect(missing.statusCode).toBe(404);
  });

  it("POST /buy-ticket claims one seat for a blue chip and debits the wallet", async () => {
    const buy = await app.inject({
      method: "POST",
      url: "/buy-ticket",
      headers: auth(app),
      payload: { poolId: "p_weekly_tv", chipColor: "blue", shippingAddress: ADDRESS },
    });
    expect(buy.statusCode).toBe(200);
    expect(buy.json()).toMatchObject({ success: true, seats: 1 });

    const wallet = await app.inject({ method: "GET", url: "/wallet", headers: auth(app) });
    expect(wallet.json().stacks.blue).toBe(4);

    const tickets = await app.inject({ method: "GET", url: "/tickets", headers: auth(app) });
    expect(tickets.json().tickets).toHaveLength(1);
  });

  it("POST /buy-ticket claims 10 seats for a black chip (carpet bomb)", async () => {
    const buy = await app.inject({
      method: "POST",
      url: "/buy-ticket",
      headers: auth(app),
      payload: { poolId: "p_weekly_tv", chipColor: "black", shippingAddress: ADDRESS },
    });
    expect(buy.statusCode).toBe(200);
    expect(buy.json()).toMatchObject({ success: true, seats: 10 });
  });

  it("enforces the whale limit across requests", async () => {
    const payload = { poolId: "p_weekly_tv", chipColor: "black", shippingAddress: ADDRESS };
    const first = await app.inject({ method: "POST", url: "/buy-ticket", headers: auth(app), payload });
    expect(first.statusCode).toBe(200);
    const second = await app.inject({ method: "POST", url: "/buy-ticket", headers: auth(app), payload });
    expect(second.statusCode).toBe(429);
    expect(second.json().error.code).toBe("WHALE_LIMIT_REACHED");
  });

  it("rejects an unknown pool with 404", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/buy-ticket",
      headers: auth(app),
      payload: { poolId: "nope", chipColor: "blue", shippingAddress: ADDRESS },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("POOL_NOT_FOUND");
  });

  it("rejects a wrong chip for the pool with 422", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/buy-ticket",
      headers: auth(app),
      payload: { poolId: "p_weekly_tv", chipColor: "red", shippingAddress: ADDRESS },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe("INVALID_CHIP_FOR_POOL");
  });

  it("validates the request body", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/buy-ticket",
      headers: auth(app),
      payload: { poolId: "p_weekly_tv" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects a buy with no shipping address (schema-level 400)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/buy-ticket",
      headers: auth(app),
      payload: { poolId: "p_weekly_tv", chipColor: "blue" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects a buy with an invalid ZIP and does not debit the wallet", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/buy-ticket",
      headers: auth(app),
      payload: {
        poolId: "p_weekly_tv",
        chipColor: "blue",
        shippingAddress: { ...ADDRESS, postalCode: "abcde" },
      },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe("INVALID_ADDRESS");

    const wallet = await app.inject({ method: "GET", url: "/wallet", headers: auth(app) });
    expect(wallet.json().stacks.blue).toBe(5);
  });

  it("rejects a buy with an unknown state code", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/buy-ticket",
      headers: auth(app),
      payload: {
        poolId: "p_weekly_tv",
        chipColor: "blue",
        shippingAddress: { ...ADDRESS, state: "ZZ" },
      },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe("INVALID_ADDRESS");
  });

  it("rejects a street with no number", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/buy-ticket",
      headers: auth(app),
      payload: {
        poolId: "p_weekly_tv",
        chipColor: "blue",
        shippingAddress: { ...ADDRESS, line1: "Jackpot Avenue" },
      },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe("INVALID_ADDRESS");
  });

  it("persists the shipping address on the ticket so the prize can ship", async () => {
    const buy = await app.inject({
      method: "POST",
      url: "/buy-ticket",
      headers: auth(app),
      payload: { poolId: "p_weekly_tv", chipColor: "blue", shippingAddress: ADDRESS },
    });
    expect(buy.statusCode).toBe(200);

    const tickets = await app.inject({ method: "GET", url: "/tickets", headers: auth(app) });
    expect(tickets.json().tickets[0].shippingAddress).toMatchObject({
      name: "Austin Hanshew",
      line1: "123 Jackpot Ave",
      city: "Las Vegas",
      state: "NV",
      postalCode: "89101",
      country: "US",
    });
  });

  describe("admin", () => {
    it("forbids non-admin from creating a pool", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/admin/pools",
        headers: auth(app, "u123", "user"),
        payload: {
          prize: "PS5",
          type: "FLASH",
          isGuaranteed: true,
          requiredChip: "white",
          capacity: 2,
          closesAt: Date.now() + 60_000,
        },
      });
      expect(res.statusCode).toBe(401);
    });

    it("lets an admin create a pool then draw a winner once full", async () => {
      const admin = auth(app, "admin1", "admin");
      const create = await app.inject({
        method: "POST",
        url: "/admin/pools",
        headers: admin,
        payload: {
          poolId: "p_flash",
          prize: "PS5",
          type: "FLASH",
          isGuaranteed: true,
          requiredChip: "white",
          capacity: 2,
          closesAt: Date.now() + 60_000,
        },
      });
      expect(create.statusCode).toBe(201);

      // u123 has white chips seeded; buy two seats to fill the pool.
      for (let i = 0; i < 2; i++) {
        const buy = await app.inject({
          method: "POST",
          url: "/buy-ticket",
          headers: auth(app),
          payload: { poolId: "p_flash", chipColor: "white", shippingAddress: ADDRESS },
        });
        expect(buy.statusCode).toBe(200);
      }

      const draw = await app.inject({
        method: "POST",
        url: "/admin/pools/p_flash/draw",
        headers: admin,
      });
      expect(draw.statusCode).toBe(200);
      expect(draw.json().winnerUserId).toBe("u123");
      expect(draw.json().totalTickets).toBe(2);

      // A second draw is rejected.
      const again = await app.inject({
        method: "POST",
        url: "/admin/pools/p_flash/draw",
        headers: admin,
      });
      expect(again.statusCode).toBe(409);
      expect(again.json().error.code).toBe("POOL_ALREADY_DRAWN");
    });
  });
});
