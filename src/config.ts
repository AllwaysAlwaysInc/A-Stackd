import type { ChipWallet } from "./domain/chips.js";

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
  /**
   * Demo "free play" chips granted on registration so the app is usable before
   * a real payment processor is wired in. Set WELCOME_CHIPS=0,0,0,0 to disable.
   */
  welcomeChips: ChipWallet;
  blockedStates: Set<string>;
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

  const blockedStatesRaw = env.BLOCKED_STATES ?? "WA,ID";
  const blockedStates = new Set(
    blockedStatesRaw.split(",").map((s) => s.trim().toUpperCase())
  );

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
    welcomeChips: parseWelcomeChips(env.WELCOME_CHIPS),
    blockedStates,
  };
}


/** Parse "red,white,blue,black" counts; defaults to a small starter stack. */
function parseWelcomeChips(raw: string | undefined): ChipWallet {
  const defaults: ChipWallet = { red: 10, white: 5, blue: 3, black: 1 };
  if (!raw) return defaults;
  const parts = raw.split(",").map((n) => Number(n.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0)) {
    throw new Error(`Invalid WELCOME_CHIPS: ${raw} (expected "red,white,blue,black")`);
  }
  return { red: parts[0]!, white: parts[1]!, blue: parts[2]!, black: parts[3]! };
}
