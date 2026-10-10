import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDb, disconnectDb } from './db.js';
import { scheduleDailyJob } from './jobs/daily.js';
import { startKeepAlive } from './jobs/keep-alive.js';
import { seedDemo } from './scripts/seed-data.js';
import { logger } from './utils/logger.js';

async function main() {
  await connectDb();
  // Convenience for the in-memory dev database, which starts empty on every restart.
  if (!env.MONGODB_URI && process.env.SEED_DEMO === 'true') await seedDemo();

  const app = createApp();
  const server = app.listen(env.PORT, () => logger.info(`API listening on http://localhost:${env.PORT}`));
  const stopJobs = scheduleDailyJob();
  const stopKeepAlive = startKeepAlive();

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    stopJobs();
    stopKeepAlive();
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
