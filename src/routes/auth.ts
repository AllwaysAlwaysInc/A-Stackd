import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import type { FastifyInstance } from "fastify";
import { Type } from "@sinclair/typebox";

const DevTokenBody = Type.Object({
  userId: Type.String({ minLength: 1 }),
  role: Type.Optional(Type.Union([Type.Literal("user"), Type.Literal("admin")])),
});

const DevTokenResponse = Type.Object({ token: Type.String() });

/**
 * Development-only helper to mint an access token without a full auth system.
 * Disabled when NODE_ENV=production. In production, tokens are issued by the
 * real identity provider / login flow.
 */
export function authRoutes(isProduction: boolean) {
  return async function (fastify: FastifyInstance) {
    if (isProduction) return;
    const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

    app.post(
      "/auth/dev-token",
      { schema: { body: DevTokenBody, response: { 200: DevTokenResponse } } },
      async (request) => {
        const { userId, role } = request.body;
        const token = await fastify.jwt.sign({ sub: userId, role: role ?? "user" });
        return { token };
      },
    );
  };
}
