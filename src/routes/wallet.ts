import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import type { FastifyInstance } from "fastify";
import type { DataStore } from "../store/types.js";
import { WalletResponseSchema } from "../schemas.js";

export function walletRoutes(store: DataStore) {
  return async function (fastify: FastifyInstance) {
    const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

    // --- GET USER CHIP WALLET (READING THE STACK) ---
    app.get(
      "/wallet",
      { schema: { response: { 200: WalletResponseSchema } } },
      async (request) => {
        const stacks = await store.getOrCreateWallet(request.userId);
        return { userId: request.userId, stacks };
      },
    );
  };
}
