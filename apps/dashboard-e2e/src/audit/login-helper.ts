import { Page, expect } from '@playwright/test';

/**
 * Logs in through the UI within the current page/context.
 *
 * The dashboard keeps the access token in memory and the refresh token in a
 * single-use, rotating httpOnly cookie. A shared storageState therefore goes
 * stale after the first rotation, so each test authenticates fresh instead.
 *
 * Credentials come from env vars (never hardcoded):
 *   E2E_EMAIL=... E2E_PASSWORD=...
 */
export async function loginViaUi(page: Page): Promise<void> {
  const email = process.env['E2E_EMAIL'];
  const password = process.env['E2E_PASSWORD'];
  if (!email || !password) {
    throw new Error('Missing credentials: set E2E_EMAIL and E2E_PASSWORD.');
  }

  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.fill('input[formcontrolname="email"]', email);
  await page.fill('input[formcontrolname="password"]', password);
  await page.click('button[type="submit"]');

  await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
}
