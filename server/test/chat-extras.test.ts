import { describe, expect, it } from 'vitest';
import { GroupModel, MessageModel } from '../src/models/index.js';
import { buildIcs } from '../src/services/ics.js';
import { createGroupWith, useDatabase } from './helpers.js';

useDatabase();

async function drawnGroup(names = ['Org', 'Ana', 'Bo', 'Cy']) {
  const ctx = await createGroupWith(names);
  await ctx.organizer.agent.post(`/api/groups/${ctx.group.id}/draw`).send({ confirm: true });
  const matchOf = new Map<string, string>();
  for (const m of ctx.members) {
    matchOf.set(m.user.id, (await m.agent.get(`/api/groups/${ctx.group.id}/match`)).body.match.id);
  }
  return { ...ctx, matchOf };
}

describe('anonymous chat', () => {
  it('delivers Santa ↔ giftee messages without revealing the Santa', async () => {
    const { group, members, matchOf } = await drawnGroup();
    const santa = members[1];
    const giftee = members.find((m) => m.user.id === matchOf.get(santa.user.id))!;
    const base = `/api/groups/${group.id}/chat`;

    const sent = await santa.agent.post(`${base}/match`).send({ text: 'Do you like tea?' });
    expect(sent.status).toBe(201);
    expect(sent.body.message.mine).toBe(true);

    const inbox = await giftee.agent.get(`${base}/santa`);
    expect(inbox.body.messages).toHaveLength(1);
    expect(inbox.body.messages[0]).toMatchObject({ text: 'Do you like tea?', mine: false });
    const raw = JSON.stringify(inbox.body);
    expect(raw).not.toContain(santa.user.id);
    expect(raw).not.toContain(santa.user.name);
    expect(raw).not.toMatch(/threadKey|fromRole|giver/);

    await giftee.agent.post(`${base}/santa`).send({ text: 'Yes, green tea!' });
    const santaView = await santa.agent.get(`${base}/match`);
    expect(santaView.body.messages.map((m: { mine: boolean }) => m.mine)).toEqual([true, false]);

    const after = santaView.body.messages[0].createdAt;
    const newer = await santa.agent.get(`${base}/match`).query({ after });
    expect(newer.body.messages).toHaveLength(1);
  });

  it("keeps other people's threads private", async () => {
    const { group, members, matchOf } = await drawnGroup();
    const santa = members[1];
    await santa.agent.post(`/api/groups/${group.id}/chat/match`).send({ text: 'secret' });
    const outsiders = members.filter((m) => m !== santa && m.user.id !== matchOf.get(santa.user.id));
    for (const o of outsiders) {
      for (const who of ['match', 'santa']) {
        const res = await o.agent.get(`/api/groups/${group.id}/chat/${who}`);
        expect(JSON.stringify(res.body)).not.toContain('secret');
      }
    }
  });

  it('validates messages and requires a draw', async () => {
    const { group, members } = await createGroupWith(['Org', 'Ana']);
    expect((await members[1].agent.get(`/api/groups/${group.id}/chat/match`)).status).toBe(409);
    expect((await members[1].agent.get(`/api/groups/${group.id}/chat/nobody`)).status).toBe(400);
    const d = await drawnGroup(['Org2', 'Dee', 'Eli']);
    expect(
      (await d.members[1].agent.post(`/api/groups/${d.group.id}/chat/match`).send({ text: '  ' })).status,
    ).toBe(400);
    expect(await MessageModel.countDocuments()).toBe(0);
  });
});

describe('gift status', () => {
  it('updates my gift status and shows it to the organizer', async () => {
    const { group, organizer, members } = await drawnGroup();
    const res = await members[1].agent.patch(`/api/groups/${group.id}/me`).send({ giftStatus: 'bought' });
    expect(res.body.me.giftStatus).toBe('bought');
    expect(
      (await members[1].agent.patch(`/api/groups/${group.id}/me`).send({ giftStatus: 'wrapped' })).status,
    ).toBe(400);
    const dash = await organizer.agent.get(`/api/groups/${group.id}/dashboard`);
    expect(dash.body.members.find((m: { id: string }) => m.id === members[1].user.id).giftStatus).toBe(
      'bought',
    );
  });
});

describe('calendar', () => {
  it('builds an all-day event on the exchange date', () => {
    const ics = buildIcs({ uid: 'x@y', title: 'Family, 2026; fun', date: new Date('2026-12-24T12:00:00Z') });
    expect(ics).toContain('DTSTART;VALUE=DATE:20261224');
    expect(ics).toContain('DTEND;VALUE=DATE:20261225');
    expect(ics).toContain('SUMMARY:Family\\, 2026\\; fun');
    expect(ics.split('\r\n').every((l) => Buffer.byteLength(l) <= 75)).toBe(true);
  });

  it('downloads the .ics for members', async () => {
    const { group, members } = await createGroupWith(['Org', 'Ana']);
    const res = await members[1].agent.get(`/api/groups/${group.id}/calendar.ics`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/calendar');
    expect(res.text).toContain('DTSTART;VALUE=DATE:20991224');
  });
});

describe('gallery', () => {
  it('stays closed until the exchange date', async () => {
    const { group, members } = await createGroupWith(['Org', 'Ana']);
    const res = await members[1].agent.get(`/api/groups/${group.id}/gallery`);
    expect(res.body).toEqual({ open: false, photos: [] });
    const post = await members[1].agent
      .post(`/api/groups/${group.id}/gallery`)
      .send({ image: { url: 'https://res.cloudinary.com/x/image/upload/a.jpg', publicId: 'a' } });
    expect(post.status).toBe(409);
  });

  it('opens after the exchange date', async () => {
    const { group, members } = await createGroupWith(['Org', 'Ana']);
    await GroupModel.updateOne({ _id: group.id }, { exchangeDate: new Date(Date.now() - 1000) });
    const res = await members[1].agent.get(`/api/groups/${group.id}/gallery`);
    expect(res.body.open).toBe(true);
  });
});
