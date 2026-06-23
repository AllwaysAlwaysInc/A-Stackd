import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import type { FastifyInstance } from "fastify";
import type { DataStore } from "../store/types.js";
import {
  meltingMultiplier,
  poolStatusLabel,
  salesAgentAlert,
  timeLeftLabel,
} from "../domain/pools.js";
import { ActivePoolsResponseSchema } from "../schemas.js";

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
        return {
          pools: pools.map((pool) => {
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
            };
          }),
        };
      },
    );
  };
}
