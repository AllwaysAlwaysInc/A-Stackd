import fastifyJwt from "@fastify/jwt";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { UnauthorizedError } from "../domain/errors.js";

/** Claims carried in a A Stack'd access token. */
export interface AppJwtPayload {
  sub: string;
  role?: "user" | "admin";
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AppJwtPayload;
    user: AppJwtPayload;
  }
}

declare module "fastify" {
  interface FastifyRequest {
    userId: string;
  }
  interface FastifyInstance {
    requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export interface AuthPluginOptions {
  secret: string;
}

const PUBLIC_PREFIXES = ["/health", "/docs", "/auth"];

function isPublic(url: string): boolean {
  const path = url.split("?")[0] ?? url;
  if (path === "/") return true;
  return PUBLIC_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix + "/"));
}

const authPlugin: FastifyPluginAsync<AuthPluginOptions> = async (fastify, opts) => {
  await fastify.register(fastifyJwt, { secret: opts.secret });

  fastify.decorateRequest("userId", "");

  fastify.decorate(
    "requireAdmin",
    async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
      if (request.user?.role !== "admin") {
        throw new UnauthorizedError("Admin role required.");
      }
    },
  );

  fastify.addHook("onRequest", async (request) => {
    if (isPublic(request.url)) return;
    try {
      await request.jwtVerify();
    } catch {
      throw new UnauthorizedError("Missing or invalid access token.");
    }
    request.userId = request.user.sub;
  });
};

export default fp(authPlugin, { name: "auth" });
