import { expect, test } from '@playwright/test';
import { devJoin, devSignIn, newUser } from './helpers';

/**
 * The main journey: an organizer creates a group, three friends join through the invite link,
 * the organizer draws names, everyone unwraps their match, and a Santa chats anonymously with
 * their giftee.
 */
test('create → join → draw → reveal → anonymous chat', async ({ browser }) => {
  const stamp = Date.now();
  const people = ['Ana', 'Bor', 'Cvetka'];

  // ---------- Organizer creates the group ----------
  const org = await newUser(browser);
  await org.goto('/');
  await org.getByRole('link', { name: 'Create a group' }).click();
  await expect(org).toHaveURL(/\/signin/);
  await devSignIn(org, `olga.${stamp}@e2e.test`, 'Olga');
  await expect(org).toHaveURL(/\/create$/);

  await org.getByLabel('Group name').fill('E2E Family');
  await org.getByRole('button', { name: 'Next' }).click();
  await expect(org.getByRole('heading', { name: 'Budget & rules' })).toBeVisible();
  await org.getByRole('button', { name: 'Next' }).click();
  await expect(org.getByRole('heading', { name: 'Invite people' })).toBeVisible();

  const inviteLink = await org.getByLabel('Invite link').inputValue();
  const code = inviteLink.split('/join/')[1];
  expect(code).toMatch(/^[A-Za-z0-9]{8,}$/);
  await org.getByRole('button', { name: 'Go to group' }).click();
  await expect(org).toHaveURL(/\/g\/[a-f0-9]{24}$/);
  const groupUrl = org.url();

  // ---------- Friends join with the invite link ----------
  const friends = [];
  for (const name of people) {
    const page = await newUser(browser);
    await devJoin(page, code, name, `${name.toLowerCase()}.${stamp}@e2e.test`);
    await expect(page.getByText('Waiting for the draw')).toBeVisible();
    friends.push({ name, page });
  }

  // ---------- Organizer draws names ----------
  await org.goto(`${groupUrl}/manage`);
  await expect(org.getByText('Ready to draw for 4 people.')).toBeVisible();
  await org.getByRole('button', { name: 'Draw names' }).click();
  const confirm = org.getByRole('dialog');
  await confirm.getByRole('button', { name: 'Draw names' }).click();
  await expect(org.getByText('Names have been drawn.')).toBeVisible();

  // ---------- Everyone unwraps their match ----------
  const everyone = [{ name: 'Olga', page: org }, ...friends];
  const matchOf = new Map<string, string>();
  for (const { name, page } of everyone) {
    await page.goto(groupUrl);
    await page.getByRole('link', { name: 'Unwrap my match' }).click();
    await page.getByRole('button', { name: 'Tap the gift to unwrap' }).click();
    const revealed = page.locator('.name');
    await expect(revealed).toBeVisible();
    const match = (await revealed.textContent())!.trim();
    expect(match).not.toBe(name);
    matchOf.set(name, match);
  }
  // A valid draw: everyone gives once and receives once.
  expect(new Set(matchOf.values()).size).toBe(everyone.length);

  // ---------- Anonymous chat: Ana's Santa-chat reaches her giftee ----------
  const ana = friends[0];
  const gifteeName = matchOf.get('Ana')!;
  const giftee = everyone.find((p) => p.name === gifteeName)!;
  const message = `Do you like tea? ${stamp}`;

  await ana.page.goto(`${groupUrl}/chat/match`);
  await ana.page.getByLabel('Write a message…').fill(message);
  await ana.page.getByRole('button', { name: 'Send' }).click();
  await expect(ana.page.getByText(message)).toBeVisible();

  await giftee.page.goto(groupUrl);
  // Unread badge on the "chat with your Santa" tile.
  await expect(giftee.page.getByLabel('Unread messages: 1')).toBeVisible();
  await giftee.page.getByRole('link', { name: /Chat with your Santa/ }).click();
  await expect(giftee.page.getByText(message)).toBeVisible();
  // The giftee only sees "Secret Santa", never Ana's name.
  await expect(giftee.page.getByRole('heading', { name: 'Your Secret Santa 🎅' })).toBeVisible();
  await expect(giftee.page.getByRole('log')).not.toContainText('Ana');
});

test('the dashboard explains an impossible draw', async ({ browser }) => {
  const stamp = Date.now();
  const org = await newUser(browser);
  await org.goto('/signin');
  await devSignIn(org, `solo.${stamp}@e2e.test`, 'Solo');
  await org.goto('/create');
  await org.getByLabel('Group name').fill('Too small');
  await org.getByRole('button', { name: 'Next' }).click();
  await org.getByRole('button', { name: 'Next' }).click();
  await org.getByRole('button', { name: 'Go to group' }).click();
  await org.getByRole('link', { name: 'Manage group' }).click();
  await expect(org.getByText('You need at least 2 participants to draw names.')).toBeVisible();
  await expect(org.getByRole('button', { name: 'Draw names' })).toBeDisabled();
});
