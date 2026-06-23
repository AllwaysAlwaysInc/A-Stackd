import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import type { FastifyInstance } from "fastify";
import { Type } from "@sinclair/typebox";
import { PoolNotFoundError } from "../domain/errors.js";
import {
  meltingMultiplier,
  poolStatusLabel,
  salesAgentAlert,
  timeLeftLabel,
  type Pool,
} from "../domain/pools.js";
import { ActivePoolsResponseSchema, PoolSchema } from "../schemas.js";
import type { DataStore } from "../store/types.js";

function viewPool(pool: Pool, now: number) {
  const alert = salesAgentAlert(pool);
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
    ...(pool.drawnAt !== undefined ? { drawnAt: pool.drawnAt } : {}),
    ...(pool.winnerUserId !== undefined ? { winnerUserId: pool.winnerUserId } : {}),
    ...(pool.winningTicketId !== undefined ? { winningTicketId: pool.winningTicketId } : {}),
  };
}

export function poolRoutes(store: DataStore) {
  return async function (fastify: FastifyInstance) {
    const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

    // --- GET ACTIVE POOLS (INCLUDING MELTING ODDS) ---
    app.get(
      "/active-pools",
      { schema: { response: { 200: ActivePoolsResponseSchema } } },
      async () => {
        const now = Date.now();
        const pools = await store.listPools(now);
        return { pools: pools.map((pool) => viewPool(pool, now)) };
      },
    );

    // --- GET A SINGLE POOL ---
    app.get(
      "/pools/:poolId",
      {
        schema: {
          params: Type.Object({ poolId: Type.String() }),
          response: { 200: PoolSchema },
        },
      },
      async (request) => {
        const now = Date.now();
        const pool = await store.getPool(request.params.poolId);
        if (!pool) throw new PoolNotFoundError(request.params.poolId);
        return viewPool(pool, now);
      },
    );
  };
}
