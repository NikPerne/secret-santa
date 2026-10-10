import mongoose from 'mongoose';
import { env, isProd } from './config/env.js';
import { logger } from './utils/logger.js';

let memoryServer: { stop: () => Promise<boolean> } | undefined;

/** Connects to MongoDB. Without MONGODB_URI (dev/test only) an in-memory server is started. */
export async function connectDb(uri = env.MONGODB_URI): Promise<void> {
  mongoose.set('strictQuery', true);
  let target = uri;
  if (!target) {
    if (isProd) throw new Error('MONGODB_URI is required in production');
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const server = await MongoMemoryServer.create();
    memoryServer = server;
    target = server.getUri('secret-santa');
    logger.warn('MONGODB_URI not set: using in-memory MongoDB (data is lost on restart)');
  }
  await mongoose.connect(target, { serverSelectionTimeoutMS: 15_000 });
  await mongoose.connection.syncIndexes();
  logger.info('MongoDB connected');
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = undefined;
  }
}
