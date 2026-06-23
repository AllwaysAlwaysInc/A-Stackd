export interface AppConfig {
  port: number;
  host: string;
  logLevel: string;
  nodeEnv: string;
  isProduction: boolean;
  jwtSecret: string;
  /** When set, the PostgreSQL store is used instead of the in-memory store. */
  databaseUrl: string | undefined;
  corsOrigin: string;
  rateLimitMax: number;
  rateLimitWindow: string;
}

const DEV_JWT_SECRET = "dev-only-insecure-secret-change-me";

/** Load and validate configuration, failing fast on invalid production setup. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = env.NODE_ENV ?? "development";
  const isProduction = nodeEnv === "production";

  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid PORT: ${env.PORT}`);
  }

  const jwtSecret = env.JWT_SECRET ?? (isProduction ? "" : DEV_JWT_SECRET);
  if (!jwtSecret) {
    throw new Error("JWT_SECRET is required in production.");
  }

  return {
    port,
    host: env.HOST ?? "0.0.0.0",
    logLevel: env.LOG_LEVEL ?? "info",
    nodeEnv,
    isProduction,
    jwtSecret,
    databaseUrl: env.DATABASE_URL || undefined,
    corsOrigin: env.CORS_ORIGIN ?? "*",
    rateLimitMax: Number(env.RATE_LIMIT_MAX ?? 100),
    rateLimitWindow: env.RATE_LIMIT_WINDOW ?? "1 minute",
  };
}
