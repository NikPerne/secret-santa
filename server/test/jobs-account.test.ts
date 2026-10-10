import { describe, expect, it } from 'vitest';
import { runDailyJob } from '../src/jobs/daily.js';
import {
  AssignmentModel,
  GroupModel,
  MembershipModel,
  NotificationLogModel,
  UserModel,
  WishlistItemModel,
} from '../src/models/index.js';
import { devOutbox } from '../src/services/email.js';
import { seedDemo } from '../src/scripts/seed-data.js';
import { createGroupWith, signIn, useDatabase } from './helpers.js';

useDatabase();

const DAY = 24 * 60 * 60 * 1000;

describe('daily job', () => {
  it('sends "exchange in 3 days" once, even when run repeatedly (cold-start catch-up)', async () => {
    const { group, organizer } = await createGroupWith(['Org', 'Ana', 'Bo']);
    await organizer.agent.post(`/api/groups/${group.id}/draw`).send({ confirm: true });
    await GroupModel.updateOne({ _id: group.id }, { exchangeDate: new Date(Date.now() + 2 * DAY) });

    devOutbox.length = 0;
    const first = await runDailyJob();
    expect(first?.exchangeSoon).toBe(3);
    expect(devOutbox.filter((m) => /3 (days|dni)/.test(m.subject))).toHaveLength(3);

    const second = await runDailyJob();
    expect(second?.exchangeSoon).toBe(0);
    expect(devOutbox.filter((m) => /3 (days|dni)/.test(m.subject))).toHaveLength(3);
  });

  it('reminds only people with an empty wishlist, after a grace period', async () => {
    const { group, organizer, members } = await createGroupWith(['Org', 'Ana', 'Bo']);
    await members[1].agent.post(`/api/groups/${group.id}/wishlist`).send({ title: 'Book' });
    await organizer.agent.post(`/api/groups/${group.id}/draw`).send({ confirm: true });

    expect((await runDailyJob())?.wishlistMissing).toBe(0); // too soon after the draw
    await GroupModel.updateOne({ _id: group.id }, { drawnAt: new Date(Date.now() - 3 * DAY) });
    expect((await runDailyJob())?.wishlistMissing).toBe(2);
    expect((await runDailyJob())?.wishlistMissing).toBe(0);
  });

  it('respects the email opt-out', async () => {
    const { group, organizer } = await createGroupWith(['Org', 'Ana']);
    await UserModel.updateMany({}, { emailNotifications: false });
    await organizer.agent.post(`/api/groups/${group.id}/draw`).send({ confirm: true });
    await GroupModel.updateOne({ _id: group.id }, { exchangeDate: new Date(Date.now() + DAY) });
    devOutbox.length = 0;
    await runDailyJob();
    expect(devOutbox.filter((m) => /3 (days|dni)/.test(m.subject))).toHaveLength(0);
  });

  it('finishes past groups and deletes data after the retention period', async () => {
    const { group, organizer, members } = await createGroupWith(['Org', 'Ana', 'Bo']);
    await members[1].agent.post(`/api/groups/${group.id}/wishlist`).send({ title: 'Book' });
    await organizer.agent.post(`/api/groups/${group.id}/draw`).send({ confirm: true });

    await GroupModel.updateOne({ _id: group.id }, { exchangeDate: new Date(Date.now() - 2 * DAY) });
    expect((await runDailyJob())?.finished).toBe(1);
    expect((await GroupModel.findById(group.id))?.status).toBe('finished');

    await GroupModel.updateOne({ _id: group.id }, { exchangeDate: new Date(Date.now() - 61 * DAY) });
    // createdAt is immutable through Mongoose, so backdate via the driver.
    await UserModel.collection.updateMany({}, { $set: { createdAt: new Date(Date.now() - 90 * DAY) } });
    const report = await runDailyJob();
    expect(report?.deletedGroups).toBe(1);
    expect(report?.deletedUsers).toBe(3);
    expect(await GroupModel.countDocuments()).toBe(0);
    expect(await AssignmentModel.countDocuments()).toBe(0);
    expect(await WishlistItemModel.countDocuments()).toBe(0);
    expect(await NotificationLogModel.countDocuments()).toBe(0);
  });
});

describe('delete my data', () => {
  it('removes the user, deletes groups they organize, and reassigns elsewhere', async () => {
    const a = await createGroupWith(['Org', 'Ana', 'Bo', 'Cy']);
    await a.organizer.agent.post(`/api/groups/${a.group.id}/draw`).send({ confirm: true });
    const ana = a.members[1];
    // Ana also organizes her own group.
    const own = await ana.agent.post('/api/groups').send({ name: "Ana's group" });

    const res = await ana.agent.delete('/api/auth/me');
    expect(res.status).toBe(200);
    expect(await UserModel.exists({ _id: ana.user.id })).toBeNull();
    expect(await GroupModel.exists({ _id: own.body.group.id })).toBeNull();
    expect(await MembershipModel.countDocuments({ userId: ana.user.id })).toBe(0);

    const remaining = a.members.filter((m) => m !== ana);
    const receivers = new Set<string>();
    for (const m of remaining) {
      const match = await m.agent.get(`/api/groups/${a.group.id}/match`);
      expect(match.status).toBe(200);
      expect(match.body.match.id).not.toBe(ana.user.id);
      receivers.add(match.body.match.id);
    }
    expect(receivers.size).toBe(3);
    expect((await ana.agent.get('/api/auth/me')).body.user).toBeNull();
  });
});

describe('push subscriptions', () => {
  it('reports push as disabled without VAPID keys', async () => {
    const { agent } = await signIn('p@example.com');
    const res = await agent
      .post('/api/push/subscribe')
      .send({ endpoint: 'https://push.example/1', keys: { p256dh: 'x', auth: 'y' } });
    expect(res.status).toBe(503);
  });
});

describe('seed', () => {
  it('creates a demo group with 6 people, 2 exclusions and wishlists, idempotently', async () => {
    await seedDemo();
    const { groupId } = await seedDemo();
    expect(await GroupModel.countDocuments()).toBe(1);
    const group = await GroupModel.findById(groupId);
    expect(group?.exclusions).toHaveLength(2);
    expect(await MembershipModel.countDocuments({ groupId })).toBe(6);
    expect(await WishlistItemModel.countDocuments({ groupId })).toBeGreaterThan(5);
  });
});

describe('admin health page', () => {
  it('is only available to admins', async () => {
    const regular = await signIn('someone@example.com');
    expect((await regular.agent.get('/api/admin/health')).status).toBe(403);
    expect((await regular.agent.get('/api/auth/me')).body.user.isAdmin).toBe(false);

    const admin = await signIn('boss@example.com');
    expect((await admin.agent.get('/api/auth/me')).body.user.isAdmin).toBe(true);
    await runDailyJob();
    const res = await admin.agent.get('/api/admin/health');
    expect(res.status).toBe(200);
    expect(res.body.database.limitBytes).toBe(512 * 1024 * 1024);
    expect(res.body.database.counts.users).toBe(2);
    expect(res.body.email).toMatchObject({ provider: 'console', dailyLimit: 300, today: 0 });
    expect(res.body.images.configured).toBe(false);
    expect(res.body.dailyJob.ok).toBe(true);
  });
});
