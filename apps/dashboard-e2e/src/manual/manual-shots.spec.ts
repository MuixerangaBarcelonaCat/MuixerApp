import { Locator, Page, test } from '@playwright/test';
import * as path from 'path';
import { workspaceRoot } from '@nx/devkit';
import { loginViaUi } from '../audit/login-helper';
import { spaGoto } from '../audit/audit-core';
import { ManualShot } from './manual-shot';
import { MANUAL_SHOTS } from './shots';

const IMG_DIR = path.join(workspaceRoot, 'docs/manual/img');

/** `SHOTS=03,04` keeps only files starting with one of those prefixes. */
function selectedShots(app: string): ManualShot[] {
  const prefixes = process.env['SHOTS']?.split(',').map((s) => s.trim()).filter(Boolean);
  return MANUAL_SHOTS.filter(
    (shot) => shot.app === app && (!prefixes?.length || prefixes.some((p) => shot.file.startsWith(p))),
  );
}

/** Only reads reach the API: a stray click on an autosaving editor must never change data. */
async function blockWrites(page: Page): Promise<void> {
  await page.route('**/api/**', (route) => {
    const req = route.request();
    if (req.method() === 'GET' || req.url().includes('/api/auth/')) return route.continue();
    return route.abort();
  });
}

const pathOf = (url: string) => new URL(url).pathname + new URL(url).search;

async function goTo(page: Page, target: string): Promise<void> {
  // The router ignores navigation to the current URL, which would keep the previous shot's state.
  if (pathOf(page.url()) === target) await spaGoto(page, '/home');
  await spaGoto(page, target);
  // The segment workspace and projection react to popstate by going back; retry once after Esc.
  if (!pathOf(page.url()).startsWith(target.split('?')[0])) {
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await spaGoto(page, target);
  }
}

/** display:contents hosts (lib-card, lib-button) draw no outline themselves; use their first child. */
async function outline(locator: Locator, on: boolean): Promise<void> {
  await locator.evaluateAll((els, on) => {
    for (const el of els as HTMLElement[]) {
      const target =
        getComputedStyle(el).display === 'contents' ? ((el.firstElementChild as HTMLElement) ?? el) : el;
      target.style.outline = on ? '3px solid red' : '';
      target.style.outlineOffset = on ? '2px' : '';
    }
  }, on);
}

async function shoot(page: Page, shot: ManualShot): Promise<void> {
  await goTo(page, shot.path);
  // 'attached', not 'visible': display:contents hosts (lib-card, lib-button) never count as visible.
  if (shot.ready) await page.locator(shot.ready).first().waitFor({ state: 'attached', timeout: 20_000 });
  if (shot.prepare) await shot.prepare(page);
  if (shot.settle) await page.waitForTimeout(shot.settle);

  const highlight = shot.highlight ? page.locator(shot.highlight) : null;
  if (highlight) await outline(highlight, true);
  const options = {
    path: path.join(IMG_DIR, shot.file),
    animations: 'disabled' as const,
  };
  if (shot.clip) await page.locator(shot.clip).first().screenshot(options);
  else await page.screenshot(options);
  if (highlight) await outline(highlight, false);
}

test('manual screenshots', async ({ page }, testInfo) => {
  const app = testInfo.project.name;
  const shots = selectedShots(app);
  test.skip(shots.length === 0, `No shots for ${app}`);

  const member = app === 'pwa-member';
  const creds = member
    ? { email: process.env['E2E_MEMBER_EMAIL'], password: process.env['E2E_MEMBER_PASSWORD'] }
    : {};
  test.skip(member && !creds.email, 'Set E2E_MEMBER_EMAIL/E2E_MEMBER_PASSWORD for member shots');

  await loginViaUi(page, creds);
  await blockWrites(page);

  const failed: string[] = [];
  for (const shot of shots) {
    // Consecutive workspace pages race with the previous one's teardown: retry before giving up.
    for (let attempt = 1; ; attempt++) {
      try {
        await shoot(page, shot);
        console.log(`✓ ${shot.file}`);
        break;
      } catch (err) {
        const reason = (err as Error).message.split('\n')[0];
        if (attempt < 3) continue;
        failed.push(`${shot.file}: ${reason}`);
        console.log(`✗ ${shot.file}: ${reason}`);
        break;
      }
    }
  }
  if (failed.length) throw new Error(`Failed shots:\n${failed.join('\n')}`);
});
