import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import { DomainError } from "./domain/errors.js";
import { LANDING_HTML } from "./landing.js";
import authPlugin from "./plugins/auth.js";
import { poolRoutes } from "./routes/pools.js";
import { ticketRoutes } from "./routes/tickets.js";
import { walletRoutes } from "./routes/wallet.js";
import { createSeededStore } from "./store/seed.js";
import type { DataStore } from "./store/types.js";

export interface BuildAppOptions {
  store?: DataStore;
  logger?: boolean | object;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const store = options.store ?? createSeededStore();
  const app = Fastify({ logger: options.logger ?? false });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof DomainError) {
      return reply
        .status(error.statusCode)
        .send({ error: { code: error.code, message: error.message } });
    }
    if (error.validation) {
      return reply
        .status(400)
        .send({ error: { code: "VALIDATION_ERROR", message: error.message } });
    }
    request.log.error(error);
    return reply
      .status(error.statusCode ?? 500)
      .send({ error: { code: "INTERNAL_ERROR", message: "Unexpected error." } });
  });

  app.get("/", (_request, reply) => {
    reply.type("text/html").send(LANDING_HTML);
  });

  app.get("/health", async () => ({ status: "ok", service: "astackd-backend" }));

  await app.register(authPlugin);
  await app.register(walletRoutes(store));
  await app.register(ticketRoutes(store));
  await app.register(poolRoutes(store));

  return app;
}
