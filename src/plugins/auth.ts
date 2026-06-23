import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { UnauthorizedError } from "../domain/errors.js";

declare module "fastify" {
  interface FastifyRequest {
    userId: string;
  }
}

/**
 * Minimal credential extraction for the data bridge. Accepts either
 * `Authorization: Bearer <userId>` or an `x-user-id` header and decorates the
 * request with `userId`.
 *
 * NOTE: This is a placeholder for the cryptographic authenticity check the spec
 * calls for. In production, replace `resolveUserId` with real JWT/signature
 * verification before the request ever reaches the Floor.
 */
export function resolveUserId(request: FastifyRequest): string {
  const header = request.headers["authorization"];
  if (typeof header === "string" && header.toLowerCase().startsWith("bearer ")) {
    const token = header.slice(7).trim();
    if (token) return token;
  }
  const xUserId = request.headers["x-user-id"];
  if (typeof xUserId === "string" && xUserId.trim()) {
    return xUserId.trim();
  }
  throw new UnauthorizedError();
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest("userId", "");
  fastify.addHook("onRequest", async (request) => {
    if (request.url === "/" || request.url.startsWith("/health")) return;
    request.userId = resolveUserId(request);
  });
};

export default fp(authPlugin, { name: "auth" });
