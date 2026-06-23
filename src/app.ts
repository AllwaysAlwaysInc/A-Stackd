import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import { loadConfig, type AppConfig } from "./config.js";
import { DomainError } from "./domain/errors.js";
import { LANDING_HTML } from "./landing.js";
import authPlugin from "./plugins/auth.js";
import { adminRoutes } from "./routes/admin.js";
import { authRoutes } from "./routes/auth.js";
import { poolRoutes } from "./routes/pools.js";
import { ticketRoutes } from "./routes/tickets.js";
import { walletRoutes } from "./routes/wallet.js";
import { createStore } from "./store/factory.js";
import type { DataStore } from "./store/types.js";

export interface BuildAppOptions {
  store?: DataStore;
  config?: AppConfig;
  logger?: boolean | object;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const config = options.config ?? loadConfig();
  const store = options.store ?? (await createStore(config));
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
    if (error.statusCode === 429) {
      return reply
        .status(429)
        .send({ error: { code: "RATE_LIMITED", message: error.message } });
    }
    request.log.error(error);
    return reply
      .status(error.statusCode ?? 500)
      .send({ error: { code: "INTERNAL_ERROR", message: "Unexpected error." } });
  });

  await app.register(fastifyHelmet, { contentSecurityPolicy: false });
  await app.register(fastifyCors, { origin: config.corsOrigin });
  await app.register(fastifyRateLimit, {
    max: config.rateLimitMax,
    timeWindow: config.rateLimitWindow,
  });

  await app.register(fastifySwagger, {
    openapi: {
      info: { title: "A Stack'd API", version: "0.1.0" },
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        },
      },
    },
  });
  await app.register(fastifySwaggerUi, { routePrefix: "/docs" });

  await app.register(authPlugin, { secret: config.jwtSecret });

  app.get("/", (_request, reply) => {
    reply.type("text/html").send(LANDING_HTML);
  });
  app.get("/health", async () => ({ status: "ok", service: "astackd-backend" }));

  await app.register(authRoutes(config.isProduction));
  await app.register(walletRoutes(store));
  await app.register(ticketRoutes(store));
  await app.register(poolRoutes(store));
  await app.register(adminRoutes(store));

  app.addHook("onClose", async () => {
    await store.close();
  });

  return app;
}
