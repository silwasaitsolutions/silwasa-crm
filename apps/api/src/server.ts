import { createApp } from "./app";
import { getEnv } from "./config/env";
import { logger } from "./config/logger";
import { prisma } from "./config/prisma";

async function main() {
  const env = getEnv();
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  // Env validation errors land here with a readable message.
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
