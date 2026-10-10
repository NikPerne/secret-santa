import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { createApp } from '../src/app.js';

export const app = createApp();

/** Starts an in-memory MongoDB for the test file and clears all collections between tests. */
export function useDatabase(): void {
  let server: MongoMemoryServer;
  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    await mongoose.connect(server.getUri('test'));
    await mongoose.connection.syncIndexes();
  });
  beforeEach(async () => {
    const collections = await mongoose.connection.db!.collections();
    await Promise.all(collections.map((c) => c.deleteMany({})));
  });
  afterAll(async () => {
    await mongoose.disconnect();
    await server?.stop();
  });
}

/** Signs a user in via the dev-login endpoint and returns a cookie-carrying agent. */
export async function signIn(email: string, name = email.split('@')[0], inviteCode?: string) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/dev-login').send({ email, name, inviteCode });
  if (res.status !== 200) throw new Error(`dev-login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { agent, user: res.body.user as { id: string; name: string; email: string } };
}

/** Creates a group as `organizer` and has `others` join it. */
export async function createGroupWith(names: string[], groupBody: Record<string, unknown> = {}) {
  const [organizerName, ...others] = names;
  const organizer = await signIn(`${organizerName.toLowerCase()}@example.com`, organizerName);
  const res = await organizer.agent
    .post('/api/groups')
    .send({ name: 'Test group', exchangeDate: '2099-12-24', ...groupBody });
  if (res.status !== 201) throw new Error(`create failed: ${JSON.stringify(res.body)}`);
  const group = res.body.group as { id: string; inviteCode: string };
  const members = [organizer];
  for (const n of others) {
    members.push(await signIn(`${n.toLowerCase()}@example.com`, n, group.inviteCode));
  }
  return { group, organizer, members };
}
