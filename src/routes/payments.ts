import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import type { FastifyInstance } from "fastify";
import { Type } from "@sinclair/typebox";
import { randomUUID } from "node:crypto";
import type { DataStore } from "../store/types.js";
import { type ChipColor } from "../domain/chips.js";

const CreateSessionBody = Type.Object({
  packId: Type.Union([
    Type.Literal("red_pack_5"),
    Type.Literal("white_pack_5"),
    Type.Literal("blue_pack_5"),
    Type.Literal("black_pack_1"),
    Type.Literal("starter_bundle"),
  ]),
});

interface PackDetails {
  name: string;
  price: string;
  chips: Partial<Record<ChipColor, number>>;
}

const PACKS: Record<string, PackDetails> = {
  red_pack_5: { name: "Red Chip Pack (5x)", price: "$5.00", chips: { red: 5 } },
  white_pack_5: { name: "White Chip Pack (5x)", price: "$25.00", chips: { white: 5 } },
  blue_pack_5: { name: "Blue Chip Pack (5x)", price: "$50.00", chips: { blue: 5 } },
  black_pack_1: { name: "Black Whale Chip (1x)", price: "$100.00", chips: { black: 1 } },
  starter_bundle: { name: "Starter Bundle", price: "$20.00", chips: { red: 5, white: 2, blue: 1 } },
};

export function paymentsRoutes(store: DataStore, isDev: boolean) {
  return async function (fastify: FastifyInstance) {
    const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

    // Route to create a Stripe checkout session (falls back to mock session url)
    app.post(
      "/payments/create-checkout-session",
      { schema: { body: CreateSessionBody } },
      async (request) => {
        const { packId } = request.body;
        const userId = request.userId;
        const pack = PACKS[packId];
        if (!pack) throw new Error("Invalid packId");

        const sessionId = `sess_${randomUUID().slice(0, 8)}`;
        const baseUrl = `${request.protocol}://${request.hostname}`;
        
        // Mock Stripe Checkout URL that opens our mock payment portal
        const checkoutUrl = `${baseUrl}/payments/checkout-mock?session_id=${sessionId}&pack_id=${packId}&user_id=${userId}`;

        return { url: checkoutUrl, sessionId };
      }
    );

    // Mock HTML Stripe Page for testing
    app.get(
      "/payments/checkout-mock",
      {
        schema: {
          querystring: Type.Object({
            session_id: Type.String(),
            pack_id: Type.String(),
            user_id: Type.String(),
          }),
        },
      },
      async (request, reply) => {
        const { session_id, pack_id, user_id } = request.query;
        const pack = PACKS[pack_id];
        if (!pack) return reply.status(400).send("Invalid pack_id");

        const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Stripe Checkout (Mock Mode)</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              background-color: #0B0B0F;
              color: #F5F5F7;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
            }
            .card {
              background-color: #16161D;
              border: 1px solid #2A2A36;
              border-radius: 16px;
              padding: 28px;
              width: 100%;
              max-width: 400px;
              box-shadow: 0 8px 30px rgba(0,0,0,0.5);
              text-align: center;
            }
            h1 {
              color: #F7B500;
              font-size: 24px;
              font-weight: 900;
              letter-spacing: 1px;
              margin-top: 0;
            }
            .stripe-label {
              font-size: 11px;
              text-transform: uppercase;
              color: #9A9AA8;
              font-weight: 700;
              letter-spacing: 2px;
              margin-bottom: 20px;
            }
            .details {
              background-color: #1E1E28;
              border-radius: 10px;
              padding: 16px;
              margin: 20px 0;
              text-align: left;
            }
            .row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 8px;
            }
            .row:last-child {
              margin-bottom: 0;
            }
            .label { color: #9A9AA8; font-size: 14px; }
            .val { color: #F5F5F7; font-weight: 700; font-size: 14px; }
            .price { color: #F7B500; font-size: 20px; font-weight: 900; }
            button {
              background-color: #F7B500;
              color: #0B0B0F;
              border: none;
              border-radius: 10px;
              padding: 14px;
              width: 100%;
              font-size: 16px;
              font-weight: 800;
              cursor: pointer;
              margin-top: 15px;
              transition: background-color 0.2s;
            }
            button:hover {
              background-color: #dfa400;
            }
            .test-badge {
              background-color: rgba(247,181,0,0.15);
              color: #F7B500;
              font-size: 11px;
              font-weight: 800;
              padding: 4px 10px;
              border-radius: 999px;
              display: inline-block;
              margin-bottom: 12px;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <span class="test-badge">TEST MODE</span>
            <h1>A STACK'D PAY</h1>
            <div class="stripe-label">Powered by Stripe Scaffold</div>
            <div class="details">
              <div class="row">
                <span class="label">Item</span>
                <span class="val">${pack.name}</span>
              </div>
              <div class="row">
                <span class="label">User</span>
                <span class="val">${user_id}</span>
              </div>
              <div class="row" style="margin-top: 12px; border-top: 1px solid #2A2A36; padding-top: 12px;">
                <span class="label" style="font-size: 16px; font-weight: 800;">Total</span>
                <span class="price">${pack.price}</span>
              </div>
            </div>
            <form action="/payments/webhook" method="POST">
              <input type="hidden" name="sessionId" value="${session_id}">
              <input type="hidden" name="packId" value="${pack_id}">
              <input type="hidden" name="userId" value="${user_id}">
              <button type="submit">Authorize Payment</button>
            </form>
          </div>
        </body>
        </html>
        `;
        reply.type("text/html").send(html);
      }
    );

    // Webhook route to receive payment confirmation
    app.post(
      "/payments/webhook",
      async (request, reply) => {
        // Support either real Stripe JSON hook or our mock HTML URL-encoded POST
        let sessionId = "";
        let packId = "";
        let userId = "";

        const body = request.body as any;
        if (body && typeof body === "object") {
          // Check if it's the mock form submit
          if (body.sessionId && body.packId && body.userId) {
            sessionId = body.sessionId;
            packId = body.packId;
            userId = body.userId;
          } else if (body.type === "checkout.session.completed") {
            // Real Stripe event structure
            const session = body.data.object;
            sessionId = session.id;
            userId = session.client_reference_id;
            packId = session.metadata.packId;
          }
        }

        if (!userId || !packId) {
          return reply.status(400).send({ error: "Missing metadata in webhook" });
        }

        const pack = PACKS[packId];
        if (!pack) return reply.status(400).send({ error: "Invalid pack ID" });

        // Credit the user's wallet with the chips from this pack
        for (const [color, amount] of Object.entries(pack.chips)) {
          if (amount && amount > 0) {
            await store.creditWallet(userId, color as ChipColor, amount);
          }
        }

        // Send confirmation notification
        await store.createNotification(
          userId,
          "💰 Chips Deposited",
          `Payment confirmed! Credited ${Object.entries(pack.chips)
            .map(([color, qty]) => `${qty} ${color}`)
            .join(", ")} chips to your stack.`
        );

        // If it was a mock HTML submit, redirect the user back to a mock landing/app success page
        const headers = request.headers["content-type"] ?? "";
        if (headers.includes("application/x-www-form-urlencoded")) {
          return reply.type("text/html").send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Payment Successful</title>
              <style>
                body {
                  background-color: #0B0B0F;
                  color: #34C759;
                  font-family: -apple-system, sans-serif;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  min-height: 100vh;
                  margin: 0;
                  text-align: center;
                }
                h1 { font-size: 28px; font-weight: 800; margin-bottom: 10px; }
                p { color: #9A9AA8; font-size: 16px; margin-bottom: 24px; }
                .btn {
                  background-color: #34C759;
                  color: #0B0B0F;
                  padding: 12px 24px;
                  border-radius: 8px;
                  text-decoration: none;
                  font-weight: 800;
                  display: inline-block;
                }
              </style>
            </head>
            <body>
              <div>
                <h1>🎉 PAYMENT SUCCESSFUL</h1>
                <p>Your chips have been deposited on the Floor.</p>
                <a class="btn" href="astackd://payment-success">Back to App</a>
              </div>
            </body>
            </html>
          `);
        }

        return { received: true };
      }
    );
  };
}
