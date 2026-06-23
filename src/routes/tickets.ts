import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import type { FastifyInstance } from "fastify";
import { Type } from "@sinclair/typebox";
import { parseShippingAddress } from "../domain/address.js";
import { EmailNotVerifiedError } from "../domain/errors.js";
import {
  BuyTicketBodySchema,
  BuyTicketResponseSchema,
  TicketsResponseSchema,
  ShippingAddressSchema,
} from "../schemas.js";
import type { DataStore } from "../store/types.js";

const FreeEntryBodySchema = Type.Object({
  poolId: Type.String({ minLength: 1 }),
  shippingAddress: ShippingAddressSchema,
});

export function ticketRoutes(store: DataStore, blockedStates: Set<string> = new Set()) {
  return async function (fastify: FastifyInstance) {
    const app = fastify.withTypeProvider<TypeBoxTypeProvider>();


    // --- POST BUY TICKET REQUEST (THE DATA BRIDGE TRANSITION) ---
    app.post(
      "/buy-ticket",
      {
        schema: {
          body: BuyTicketBodySchema,
          response: { 200: BuyTicketResponseSchema },
        },
      },
      async (request) => {
        const { poolId, chipColor, shippingAddress } = request.body;
        const userId = request.userId;
        const idempotencyKey = request.headers["x-idempotency-key"] as string | undefined;

        // Enforce email verification (P5)
        const user = await store.getUserById(userId);
        if (!user || !user.emailVerified) {
          throw new EmailNotVerifiedError();
        }

        // Idempotency check (P2)
        if (idempotencyKey) {
          const cached = await store.checkIdempotency(idempotencyKey, userId);
          if (cached) return cached;
        }

        const address = parseShippingAddress(shippingAddress, blockedStates);
        const result = await store.purchase({
          userId,
          poolId,
          chipColor,
          shippingAddress: address,
        });

        const responseBody = {
          success: true,
          ticketId: result.ticketId,
          seats: result.seats,
          msg: `Ticket secured on the floor. [${result.seats}] seats claimed.`,
        };

        if (idempotencyKey) {
          await store.saveIdempotency(idempotencyKey, userId, responseBody);
        }

        return responseBody;
      },
    );

    // --- GET MY TICKETS ---
    app.get(
      "/tickets",
      { schema: { response: { 200: TicketsResponseSchema } } },
      async (request) => {
        const tickets = await store.ticketsForUser(request.userId);
        return { tickets };
      },
    );

    // --- POST ALTERNATIVE ENTRY PATH (AMOE - NO PURCHASE NECESSARY) ---
    app.post(
      "/free-entry",
      {
        schema: {
          body: FreeEntryBodySchema,
          response: { 200: BuyTicketResponseSchema },
        },
      },
      async (request) => {
        const { poolId, shippingAddress } = request.body;
        const userId = request.userId;

        // Enforce email verification (P5)
        const user = await store.getUserById(userId);
        if (!user || !user.emailVerified) {
          throw new EmailNotVerifiedError();
        }

        const address = parseShippingAddress(shippingAddress, blockedStates);
        const result = await store.freeEntry({
          userId,
          poolId,
          shippingAddress: address,
        });

        return {
          success: true,
          ticketId: result.ticketId,
          seats: result.seats,
          msg: `Free entry ticket secured on the floor. [${result.seats}] seat claimed.`,
        };
      }
    );
  };
}
