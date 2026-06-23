import type { AppConfig } from "../config.js";
import { PostgresStore } from "./postgres.js";
import { createSeededStore } from "./seed.js";
import type { DataStore } from "./types.js";

/**
 * Pick a store implementation from config. When `DATABASE_URL` is set the
 * PostgreSQL store is used (and migrated); otherwise the seeded in-memory store
 * is returned for local/dev use.
 */
export async function createStore(config: AppConfig): Promise<DataStore> {
  if (config.databaseUrl) {
    const store = new PostgresStore(config.databaseUrl);
    await store.migrate();
    return store;
  }
  return createSeededStore();
}
