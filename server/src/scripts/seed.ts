/**
 * Seeds the demo group into the database at MONGODB_URI.
 * Usage: npm run seed  (for the in-memory dev DB, start the API with SEED_DEMO=true instead)
 */
import { env } from '../config/env.js';
import { connectDb, disconnectDb } from '../db.js';
import { seedDemo } from './seed-data.js';

if (!env.MONGODB_URI) {
  console.error(
    'MONGODB_URI is not set. The in-memory dev database only lives inside the API process,\n' +
      'so start the API with SEED_DEMO=true (e.g. in server/.env) to get demo data there.',
  );
  process.exit(1);
}

await connectDb();
const { groupId, inviteCode } = await seedDemo();
console.log(`Demo group ${groupId} ready. Invite link: ${env.CLIENT_URL}/join/${inviteCode}`);
await disconnectDb();
