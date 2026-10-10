import { expect, type Browser, type Page } from '@playwright/test';

/** A fresh browser context (own cookies) in English with dismissed engagement prompts. */
export async function newUser(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    localStorage.setItem('ss.lang', 'en');
    localStorage.setItem('ss.engage.dismissed', '1');
  });
  return context.newPage();
}

/** Sign in from the sign-in page with the dev instant button (no email round-trip). */
export async function devSignIn(page: Page, email: string, name?: string): Promise<void> {
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: /Sign in instantly/ }).click();
  if (name) {
    // Brand-new email-only accounts are asked for a name once.
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Your name').fill(name);
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toBeHidden();
  }
}

/** Join through an invite link with the dev instant button. */
export async function devJoin(page: Page, code: string, name: string, email: string): Promise<void> {
  await page.goto(`/join/${code}`);
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: /Join instantly/ }).click();
  await expect(page).toHaveURL(/\/g\/[a-f0-9]{24}$/);
}
