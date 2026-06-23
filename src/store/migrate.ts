import { loadConfig } from "../config.js";
import { PostgresStore } from "./postgres.js";

async function main(): Promise<void> {
  const config = loadConfig();
  if (!config.databaseUrl) {
    console.error("DATABASE_URL is not set; nothing to migrate.");
    process.exit(1);
  }
  const store = new PostgresStore(config.databaseUrl);
  await store.migrate();
  await store.seedDemoData();
  await store.close();
  console.log("A Stack'd schema migration complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
