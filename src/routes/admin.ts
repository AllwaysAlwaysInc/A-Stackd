import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import type { FastifyInstance } from "fastify";
import { Type } from "@sinclair/typebox";
import { CreatePoolBodySchema, DrawResponseSchema, PoolSchema } from "../schemas.js";
import {
  meltingMultiplier,
  poolStatusLabel,
  salesAgentAlert,
  timeLeftLabel,
} from "../domain/pools.js";
import type { DataStore } from "../store/types.js";
import { sendFulfillmentEmail } from "../services/messaging.js";

const ShipOrderBody = Type.Object({
  trackingNumber: Type.String({ minLength: 1 }),
});

export function adminRoutes(store: DataStore) {
  return async function (fastify: FastifyInstance) {
    const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

    app.post(
      "/admin/pools",
      {
        preHandler: fastify.requireAdmin,
        schema: { body: CreatePoolBodySchema, response: { 201: PoolSchema } },
      },
      async (request, reply) => {
        const pool = await store.createPool(request.body);
        const now = Date.now();
        const alert = salesAgentAlert(pool);
        reply.status(201);
        return {
          poolId: pool.poolId,
          prize: pool.prize,
          type: pool.type,
          isGuaranteed: pool.isGuaranteed,
          requiredChip: pool.requiredChip,
          status: poolStatusLabel(pool),
          timeLeft: timeLeftLabel(pool, now),
          meltingMultiplier: meltingMultiplier(pool),
          closesAt: pool.closesAt,
          capacity: pool.capacity,
          filled: pool.filled,
          ...(alert ? { salesAgentAlert: alert } : {}),
        };
      },
    );

    app.post(
      "/admin/pools/:poolId/draw",
      {
        preHandler: fastify.requireAdmin,
        schema: {
          params: Type.Object({ poolId: Type.String() }),
          response: { 200: DrawResponseSchema },
        },
      },
      async (request) => {
        return store.drawWinner(request.params.poolId);
      },
    );

    // --- GET ALL ORDERS FOR FULFILLMENT (P4) ---
    app.get(
      "/admin/orders",
      {
        preHandler: fastify.requireAdmin,
      },
      async () => {
        const orders = await store.listOrders();
        return { orders };
      }
    );

    // --- MARK WIN SHIPPED (P4) ---
    app.post(
      "/admin/orders/:orderId/ship",
      {
        preHandler: fastify.requireAdmin,
        schema: {
          params: Type.Object({ orderId: Type.String() }),
          body: ShipOrderBody,
        },
      },
      async (request) => {
        const order = await store.shipOrder(request.params.orderId, request.body.trackingNumber);
        const user = await store.getUserById(order.winner_user_id);
        const pool = await store.getPool(order.pool_id);
        if (user && user.email && pool) {
          await sendFulfillmentEmail(user.email, pool.poolId, pool.prize, request.body.trackingNumber);
        }
        return { success: true, order };
      }
    );
  };
}
