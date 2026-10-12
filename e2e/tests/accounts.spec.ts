import { expect, test } from '@playwright/test';
import { devSignIn, newUser } from './helpers';

/**
 * Accounts: the admin registers someone, they set a password from the emailed link (shown on
 * screen because e2e has no email provider), sign in with it, change it, and the admin can send a
 * reset link from the user list.
 */
test('admin registers a user → set password → sign in → change password → reset', async ({
  browser,
}) => {
  const stamp = Date.now();
  const email = `petra.${stamp}@e2e.test`;

  // ---------- Admin registers Petra ----------
  const admin = await newUser(browser);
  await admin.goto('/signin');
  await devSignIn(admin, 'admin@e2e.test', 'Admin');
  await admin.goto('/admin/register');
  await admin.getByLabel('Username').fill('Petra');
  await admin.getByLabel('Email', { exact: true }).fill(email);
  await admin.getByRole('button', { name: 'Create account and send email' }).click();
  await expect(admin.getByText(`Account created. We emailed ${email}`)).toBeVisible();
  const setupLink = await admin.getByRole('link', { name: 'Open link' }).getAttribute('href');
  expect(setupLink).toContain('/auth/set-password?token=');

  // ---------- Petra sets her password ----------
  const petra = await newUser(browser);
  await petra.goto(setupLink!);
  await expect(petra.getByRole('heading', { name: 'Welcome! Choose your password' })).toBeVisible();
  await petra.getByLabel('New password', { exact: true }).fill('first password');
  await petra.getByLabel('Repeat the new password').fill('first passwordX');
  await expect(petra.getByText("The passwords don't match")).toBeVisible();
  await petra.getByLabel('Repeat the new password').fill('first password');
  await petra.getByRole('button', { name: 'Save password and sign in' }).click();
  await expect(petra).toHaveURL(/\/$/);

  // ---------- She changes it in Settings ----------
  await petra.goto('/settings');
  await petra.getByLabel('Current password').fill('first password');
  await petra.getByLabel('New password', { exact: true }).fill('second password');
  await petra.getByLabel('Repeat the new password').fill('second password');
  await petra.getByRole('button', { name: 'Change password' }).click();
  await expect(petra.getByText('Password changed.')).toBeVisible();

  // ---------- Signs out and back in with the new password ----------
  await petra.getByRole('button', { name: 'Sign out' }).click();
  await expect(petra).toHaveURL(/\/$/);
  await petra.goto('/signin');
  await petra.getByLabel('Email', { exact: true }).fill(email);
  await petra.getByLabel('Password', { exact: true }).fill('first password');
  await petra.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(petra.getByText('Wrong email or password.')).toBeVisible();
  await petra.getByLabel('Password', { exact: true }).fill('second password');
  await petra.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(petra).toHaveURL(/\/$/);

  // ---------- Admin sends a reset link from the user list ----------
  await admin.goto('/admin');
  const row = admin.getByRole('listitem').filter({ hasText: email });
  await row.getByRole('button', { name: 'Reset password' }).click();
  await admin.getByRole('dialog').getByRole('button', { name: 'Send email' }).click();
  await expect(admin.getByText(`Email sent to ${email}.`)).toBeVisible();
  await expect(row.getByRole('link', { name: 'Open link' })).toBeVisible();
});

test('non-admins cannot open the register page', async ({ browser }) => {
  const page = await newUser(browser);
  await page.goto('/signin');
  await devSignIn(page, `regular.${Date.now()}@e2e.test`, 'Regular');
  await page.goto('/admin/register');
  await expect(page).toHaveURL(/\/$/);
});
