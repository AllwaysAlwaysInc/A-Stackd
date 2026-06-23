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

/** Admin routes for managing pools. All require the `admin` role. */
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
  };
}
