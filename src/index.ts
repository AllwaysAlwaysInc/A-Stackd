import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const app = await buildApp({ config, logger: { level: config.logLevel } });

  try {
    await app.listen({ port: config.port, host: config.host });
    app.log.info(`A Stack'd backend listening on ${config.host}:${config.port}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

main();
