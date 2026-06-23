import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import type { FastifyInstance } from "fastify";
import { parseShippingAddress } from "../domain/address.js";
import {
  BuyTicketBodySchema,
  BuyTicketResponseSchema,
  TicketsResponseSchema,
} from "../schemas.js";
import type { DataStore } from "../store/types.js";

export function ticketRoutes(store: DataStore) {
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
        // A chip cannot be spent without a valid, deliverable address: prizes
        // are physical goods and must ship somewhere real.
        const address = parseShippingAddress(shippingAddress);
        const result = await store.purchase({
          userId: request.userId,
          poolId,
          chipColor,
          shippingAddress: address,
        });
        return {
          success: true,
          ticketId: result.ticketId,
          seats: result.seats,
          msg: `Ticket secured on the floor. [${result.seats}] seats claimed.`,
        };
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
  };
}
