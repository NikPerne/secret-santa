import { describe, expect, it } from 'vitest';
import { AssignmentModel, GroupModel } from '../src/models/index.js';
import { createGroupWith, signIn, useDatabase } from './helpers.js';

useDatabase();

type Agent = Awaited<ReturnType<typeof signIn>>;

async function matchesOf(groupId: string, members: Agent[]) {
  const out = new Map<string, string>();
  for (const m of members) {
    const res = await m.agent.get(`/api/groups/${groupId}/match`);
    expect(res.status).toBe(200);
    out.set(m.user.id, res.body.match.id);
  }
  return out;
}

function expectValid(matches: Map<string, string>) {
  const receivers = new Set(matches.values());
  expect(receivers.size).toBe(matches.size);
  for (const [g, r] of matches) {
    expect(r).not.toBe(g);
    expect(matches.has(r)).toBe(true);
  }
}

describe('draw flow', () => {
  it('lets only the organizer draw, and everyone sees only their own match', async () => {
    const { group, organizer, members } = await createGroupWith(['Org', 'Ana', 'Bo', 'Cy']);
    const ana = members[1];

    expect((await ana.agent.post(`/api/groups/${group.id}/draw`).send({ confirm: true })).status).toBe(403);
    expect((await ana.agent.get(`/api/groups/${group.id}/match`)).body.error.code).toBe('not_drawn');
    expect((await organizer.agent.post(`/api/groups/${group.id}/draw`).send({})).status).toBe(400);

    const drawn = await organizer.agent.post(`/api/groups/${group.id}/draw`).send({ confirm: true });
    expect(drawn.status).toBe(200);
    expect(drawn.body.group.status).toBe('drawn');

    const matches = await matchesOf(group.id, members);
    expectValid(matches);

    // Nobody's response leaks who their Santa is.
    const detail = await ana.agent.get(`/api/groups/${group.id}`);
    expect(JSON.stringify(detail.body)).not.toMatch(/giver|receiver|santa/i);
    expect((await ana.agent.get(`/api/groups/${group.id}/my-santa`)).status).toBe(403);
    expect((await ana.agent.get(`/api/groups/${group.id}/dashboard`)).status).toBe(403);
    expect((await ana.agent.get(`/api/groups/${group.id}/pairs`)).status).toBe(403);
  });

  it('hides pairs from the organizer by default but shows progress', async () => {
    const { group, organizer, members } = await createGroupWith(['Org', 'Ana', 'Bo']);
    await organizer.agent.post(`/api/groups/${group.id}/draw`).send({ confirm: true });
    await members[1].agent.post(`/api/groups/${group.id}/match/viewed`);

    const dash = await organizer.agent.get(`/api/groups/${group.id}/dashboard`);
    expect(dash.status).toBe(200);
    expect(dash.body.canSeePairs).toBe(false);
    const ana = dash.body.members.find((m: { name: string }) => m.name === 'Ana');
    expect(ana).toMatchObject({ viewedMatch: true, hasMatch: true, wishlistCount: 0, giftStatus: 'none' });
    expect(JSON.stringify(dash.body)).not.toMatch(/receiver/);
    expect((await organizer.agent.get(`/api/groups/${group.id}/pairs`)).status).toBe(403);

    await organizer.agent.patch(`/api/groups/${group.id}`).send({ settings: { organizerSeesPairs: true } });
    const pairs = await organizer.agent.get(`/api/groups/${group.id}/pairs`);
    expect(pairs.status).toBe(200);
    expect(pairs.body.pairs).toHaveLength(3);
  });

  it('explains an impossible draw instead of failing', async () => {
    const { group, organizer, members } = await createGroupWith(['Org', 'Ana', 'Bo']);
    const [, ana, bo] = members;
    await organizer.agent.put(`/api/groups/${group.id}/exclusions`).send({
      exclusions: [
        { a: organizer.user.id, b: ana.user.id },
        { a: organizer.user.id, b: bo.user.id },
      ],
    });
    const check = await organizer.agent.get(`/api/groups/${group.id}/draw/check`);
    expect(check.body).toMatchObject({ ok: false, code: 'cannot_give', participantCount: 3 });
    expect(check.body.reason).toContain('Org');

    const res = await organizer.agent.post(`/api/groups/${group.id}/draw`).send({ confirm: true });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('draw_impossible');
  });

  it('excludes a non-participating organizer from the draw', async () => {
    const { group, organizer, members } = await createGroupWith(['Org', 'Ana', 'Bo', 'Cy'], {
      settings: { organizerParticipates: false },
    });
    await organizer.agent.post(`/api/groups/${group.id}/draw`).send({ confirm: true });
    expect(await AssignmentModel.countDocuments({ groupId: group.id })).toBe(3);
    expect((await organizer.agent.get(`/api/groups/${group.id}/match`)).status).toBe(404);
    expectValid(await matchesOf(group.id, members.slice(1)));
    // Not playing → may see pairs without spoiling anything for themselves.
    expect((await organizer.agent.get(`/api/groups/${group.id}/pairs`)).status).toBe(200);
  });

  it('removes a participant after the draw with a minimal reassignment', async () => {
    const { group, organizer, members } = await createGroupWith(['Org', 'Ana', 'Bo', 'Cy', 'Dee', 'Eli']);
    await organizer.agent.post(`/api/groups/${group.id}/draw`).send({ confirm: true });
    const before = await matchesOf(group.id, members);
    const leaving = members[2];

    const res = await organizer.agent.delete(`/api/groups/${group.id}/members/${leaving.user.id}`);
    expect(res.status).toBe(200);
    expect(res.body.changedCount).toBeLessThanOrEqual(2);

    const remaining = members.filter((m) => m !== leaving);
    const after = await matchesOf(group.id, remaining);
    expectValid(after);
    const unchanged = remaining.filter((m) => before.get(m.user.id) === after.get(m.user.id));
    expect(unchanged.length).toBeGreaterThanOrEqual(remaining.length - 2);
    expect((await leaving.agent.get(`/api/groups/${group.id}`)).status).toBe(404);
  });

  it('slots in a late joiner after the draw', async () => {
    const { group, organizer, members } = await createGroupWith(['Org', 'Ana', 'Bo', 'Cy']);
    await organizer.agent.post(`/api/groups/${group.id}/draw`).send({ confirm: true });
    const late = await signIn('late@example.com', 'Late', group.inviteCode);
    const all = [...members, late];
    expectValid(await matchesOf(group.id, all));
  });

  it("duplicates a group for next year and avoids last year's pairs", async () => {
    const { group, organizer, members } = await createGroupWith(['Org', 'Ana', 'Bo', 'Cy', 'Dee']);
    await organizer.agent.post(`/api/groups/${group.id}/draw`).send({ confirm: true });
    const lastYear = await matchesOf(group.id, members);

    const dup = await organizer.agent.post(`/api/groups/${group.id}/duplicate`).send({});
    expect(dup.status).toBe(201);
    const next = dup.body.group;
    expect(next.status).toBe('open');
    expect(next.previousGroupId).toBe(group.id);
    expect(next.exchangeDate.startsWith('2100-12-24')).toBe(true);

    const draw = await organizer.agent.post(`/api/groups/${next.id}/draw`).send({ confirm: true });
    expect(draw.body.avoidedPreviousPairs).toBe(true);
    const thisYear = await matchesOf(next.id, members);
    for (const [g, r] of lastYear) expect(thisYear.get(g)).not.toBe(r);
  });

  it('reveals your Santa after the exchange when enabled', async () => {
    const { group, organizer, members } = await createGroupWith(['Org', 'Ana', 'Bo']);
    await organizer.agent.post(`/api/groups/${group.id}/draw`).send({ confirm: true });
    await GroupModel.updateOne({ _id: group.id }, { exchangeDate: new Date(Date.now() - 1000) });
    const matches = await matchesOf(group.id, members);
    const ana = members[1];
    const santaId = [...matches].find(([, r]) => r === ana.user.id)![0];
    const res = await ana.agent.get(`/api/groups/${group.id}/my-santa`);
    expect(res.status).toBe(200);
    expect(res.body.santa.name).toBe(members.find((m) => m.user.id === santaId)!.user.name);
  });
});
