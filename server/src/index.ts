import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDb, disconnectDb } from './db.js';
import { logger } from './utils/logger.js';

async function main() {
  await connectDb();
  const app = createApp();
  const server = app.listen(env.PORT, () => logger.info(`API listening on http://localhost:${env.PORT}`));

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    server.close();
    await disconnectDb();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start');
  process.exit(1);
});
