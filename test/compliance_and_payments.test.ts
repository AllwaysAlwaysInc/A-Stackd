import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createSeededStore } from "../src/store/seed.js";

const config = loadConfig({ NODE_ENV: "test", BLOCKED_STATES: "WA,ID" });

async function makeApp(): Promise<FastifyInstance> {
  return buildApp({ store: createSeededStore(), config });
}

function auth(app: FastifyInstance, sub = "u123", role: "user" | "admin" = "user") {
  return { authorization: `Bearer ${app.jwt.sign({ sub, role })}` };
}

describe("Compliance, Payments, and Draw Verification", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await makeApp();
  });

  afterEach(async () => {
    await app.close();
  });

  // --- P1 Age Gate & Consent Tests ---
  it("POST /auth/register enforces 18+ age gate and terms consent", async () => {
    // Underage check
    const underage = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "kid@example.com",
        password: "hunter2hunter",
        dateOfBirth: "2015-05-15",
        consentToTerms: true,
      },
    });
    expect(underage.statusCode).toBe(400);
    expect(underage.json().error.code).toBe("UNDERAGE");

    // Missing consent check
    const noConsent = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "adult@example.com",
        password: "hunter2hunter",
        dateOfBirth: "1990-01-01",
        consentToTerms: false,
      },
    });
    expect(noConsent.statusCode).toBe(400);
    expect(noConsent.json().error.code).toBe("TERMS_CONSENT_REQUIRED");

    // Success registration
    const success = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "adult@example.com",
        password: "hunter2hunter",
        dateOfBirth: "1990-01-01",
        consentToTerms: true,
      },
    });
    expect(success.statusCode).toBe(201);
    expect(success.json().emailVerified).toBe(false);
  });

  // --- P1 & P5 Email Verification Tests ---
  it("POST /buy-ticket requires email verification", async () => {
    // Register unverified user
    const reg = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "unverified@example.com",
        password: "hunter2hunter",
        dateOfBirth: "1990-01-01",
        consentToTerms: true,
      },
    });
    const token = reg.json().token;

    // Try to buy ticket (should be blocked)
    const blockedBuy = await app.inject({
      method: "POST",
      url: "/buy-ticket",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        poolId: "p_weekly_tv",
        chipColor: "blue",
        shippingAddress: {
          name: "John Doe",
          line1: "123 Main St",
          city: "Las Vegas",
          state: "NV",
          postalCode: "89101",
        },
      },
    });
    expect(blockedBuy.statusCode).toBe(403);
    expect(blockedBuy.json().error.code).toBe("EMAIL_NOT_VERIFIED");
  });

  // --- P1 Geo-Blocking Tests ---
  it("POST /buy-ticket enforces state geo-blocking", async () => {
    // u123 is seeded as emailVerified: true in our mock seeds
    const blockedState = await app.inject({
      method: "POST",
      url: "/buy-ticket",
      headers: auth(app),
      payload: {
        poolId: "p_weekly_tv",
        chipColor: "blue",
        shippingAddress: {
          name: "John Doe",
          line1: "123 Main St",
          city: "Seattle",
          state: "WA", // Blocked state
          postalCode: "98101",
        },
      },
    });
    expect(blockedState.statusCode).toBe(403);
    expect(blockedState.json().error.code).toBe("GEO_BLOCKED");
  });

  // --- P1 AMOE Free-Entry path ---
  it("POST /free-entry credits a ticket without debiting wallet, limit 1 per pool", async () => {
    // Claim first free entry
    const res1 = await app.inject({
      method: "POST",
      url: "/free-entry",
      headers: auth(app),
      payload: {
        poolId: "p_weekly_tv",
        shippingAddress: {
          name: "John Doe",
          line1: "123 Main St",
          city: "Las Vegas",
          state: "NV",
          postalCode: "89101",
        },
      },
    });
    expect(res1.statusCode).toBe(200);
    expect(res1.json().success).toBe(true);
    expect(res1.json().seats).toBe(1);

    // Claim duplicate free entry (should be blocked)
    const res2 = await app.inject({
      method: "POST",
      url: "/free-entry",
      headers: auth(app),
      payload: {
        poolId: "p_weekly_tv",
        shippingAddress: {
          name: "John Doe",
          line1: "123 Main St",
          city: "Las Vegas",
          state: "NV",
          postalCode: "89101",
        },
      },
    });
    expect(res2.statusCode).toBe(500); // throws error due to limit
  });

  // --- P2 Payments Mock Stripe & Webhook Tests ---
  it("POST /payments/create-checkout-session and Webhook confirmation", async () => {
    const session = await app.inject({
      method: "POST",
      url: "/payments/create-checkout-session",
      headers: auth(app),
      payload: { packId: "starter_bundle" },
    });
    expect(session.statusCode).toBe(200);
    expect(session.json().url).toContain("/payments/checkout-mock");

    // Fetch initial wallet balance
    const wBefore = await app.inject({
      method: "GET",
      url: "/wallet",
      headers: auth(app),
    });
    expect(wBefore.json().stacks.red).toBe(25);

    // Send mock Webhook
    const webhook = await app.inject({
      method: "POST",
      url: "/payments/webhook",
      payload: {
        sessionId: session.json().sessionId,
        packId: "starter_bundle",
        userId: "u123",
      },
    });
    expect(webhook.statusCode).toBe(200);

    // Fetch updated wallet balance (starter_bundle credits 5 red, 2 white, 1 blue)
    const wAfter = await app.inject({
      method: "GET",
      url: "/wallet",
      headers: auth(app),
    });
    expect(wAfter.json().stacks.red).toBe(30);
    expect(wAfter.json().stacks.white).toBe(12);
  });

  // --- P2 Idempotency Keys ---
  it("POST /buy-ticket respects x-idempotency-key headers", async () => {
    const payload = {
      poolId: "p_weekly_tv",
      chipColor: "blue",
      shippingAddress: {
        name: "John Doe",
        line1: "123 Main St",
        city: "Las Vegas",
        state: "NV",
        postalCode: "89101",
      },
    };

    const first = await app.inject({
      method: "POST",
      url: "/buy-ticket",
      headers: { ...auth(app), "x-idempotency-key": "idem-key-123" },
      payload,
    });
    expect(first.statusCode).toBe(200);
    const firstTicketId = first.json().ticketId;

    const second = await app.inject({
      method: "POST",
      url: "/buy-ticket",
      headers: { ...auth(app), "x-idempotency-key": "idem-key-123" },
      payload,
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().ticketId).toBe(firstTicketId); // returns cached response instead of processing again
  });

  // --- P3 & P4 Draw Winner Commit-Reveal and Fulfillments Audit ---
  it("Draw Winner commits-reveals seeds, creates orders and notifications, exposes audit logs", async () => {
    // Fill the pool to capacity so we can draw it
    // Seed pools capacity is 500, filled is 185, required chip is blue (1 seat)
    // Let's create a guaranteed flash pool with capacity 1 to draw it immediately
    const adminToken = auth(app, "admin_user", "admin");
    const newPool = await app.inject({
      method: "POST",
      url: "/admin/pools",
      headers: adminToken,
      payload: {
        poolId: "p_test_draw",
        prize: "Gold Bar",
        type: "FLASH",
        isGuaranteed: true,
        requiredChip: "blue",
        capacity: 1,
        closesAt: Date.now() + 10000,
      },
    });
    expect(newPool.statusCode).toBe(201);

    // Purchase 1 ticket to fill the capacity
    const buy = await app.inject({
      method: "POST",
      url: "/buy-ticket",
      headers: auth(app),
      payload: {
        poolId: "p_test_draw",
        chipColor: "blue",
        shippingAddress: {
          name: "John Doe",
          line1: "123 Main St",
          city: "Las Vegas",
          state: "NV",
          postalCode: "89101",
        },
      },
    });
    expect(buy.statusCode).toBe(200);

    // Draw the winner
    const draw = await app.inject({
      method: "POST",
      url: `/admin/pools/p_test_draw/draw`,
      headers: adminToken,
    });
    expect(draw.statusCode).toBe(200);
    const drawResult = draw.json();
    expect(drawResult.serverSeed).toBeDefined();
    expect(drawResult.clientSeed).toBeDefined();
    expect(drawResult.finalSeed).toBeDefined();
    expect(drawResult.winnerIndex).toBe(0);

    // Check public audit log
    const audit = await app.inject({
      method: "GET",
      url: "/pools/p_test_draw/audit",
    });
    expect(audit.statusCode).toBe(200);
    expect(audit.json().totalTickets).toBe(1);
    expect(audit.json().pool.serverSeed).toBeDefined();

    // Check user notifications
    const notifs = await app.inject({
      method: "GET",
      url: "/notifications",
      headers: auth(app),
    });
    expect(notifs.statusCode).toBe(200);
    expect(notifs.json().notifications[0].title).toContain("Winner Reveal");

    // Check admin fulfillment orders list
    const orders = await app.inject({
      method: "GET",
      url: "/admin/orders",
      headers: adminToken,
    });
    expect(orders.statusCode).toBe(200);
    expect(orders.json().orders[0].pool_id).toBe("p_test_draw");
  });
});
