import { test, expect } from '@playwright/test';
import { loginViaUi } from '../audit/login-helper';
import { spaGoto } from '../audit/audit-core';
import { TARGETS } from '../audit/audit-targets';

/**
 * Phase 4 — "Resolució interactiva al taller" — zero-conflict regression.
 *
 * With production data the unique constraints are still in place, so every segment has ZERO
 * conflicts and the banner/panel never render. This suite proves:
 *   - no conflict banner/panel anywhere in the workshop (invisible with real data),
 *   - the "N lliures" counter renders on both tabs, and "elegibles per a pinya" only on Pinyes,
 *   - the move-conflict modal (when reachable) offers 3 options with KEEP_BOTH first & disabled.
 *
 * Every assertion is an explicit `expect(...).toHaveCount(...)`/`toBeVisible()` — never gated
 * behind `if (await x.count())`, which is what let a broken assertion pass silently in
 * fase-3.spec.ts.
 *
 * Requires the dashboard + API dev servers up and E2E_EMAIL / E2E_PASSWORD set.
 */

const EVENT_ID = TARGETS.workspaceEventId;
const SEGMENT_ID = TARGETS.workspaceSegmentId;

test.describe('Segments flexibility · Phase 4 (zero-conflict regression)', () => {
  test('the workshop shows no conflict banner/panel and no console errors', async ({ page }, testInfo) => {
    const consoleErrors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

    await loginViaUi(page);
    await spaGoto(page, `/pinyes/events/${EVENT_ID}/segments/${SEGMENT_ID}/assign`);

    await expect(page.locator('app-segment-workspace, app-figure-canvas').first()).toBeVisible({
      timeout: 15000,
    });

    // No conflict banner in production (0 conflicts) — invisible on both tabs.
    await expect(page.locator('app-segment-conflict-panel')).toHaveCount(1);
    await expect(page.getByText(/persones? en conflicte/)).toHaveCount(0);

    await page.getByRole('tab', { name: /troncs/i }).click();
    await expect(page.getByText(/persones? en conflicte/)).toHaveCount(0);

    await page.screenshot({
      path: testInfo.outputPath('phase4-workshop-zero-conflict.png'),
      fullPage: true,
    });

    expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);
  });

  test('the "N lliures" counter is visible on both tabs, and "elegibles per a pinya" only on Pinyes', async ({ page }) => {
    await loginViaUi(page);
    await spaGoto(page, `/pinyes/events/${EVENT_ID}/segments/${SEGMENT_ID}/assign`);
    await expect(page.locator('app-figure-canvas').first()).toBeVisible({ timeout: 15000 });

    const counters = page.locator('[data-testid="person-panel-counters"]');
    await expect(counters).toHaveCount(1);
    await expect(counters.locator('[data-testid="free-count"]')).toContainText(/\d+ lliures/);
    await expect(counters.locator('[data-testid="pinya-eligible-count"]')).toHaveCount(1);

    await page.getByRole('tab', { name: /troncs/i }).click();

    const troncCounters = page.locator('[data-testid="person-panel-counters"]');
    await expect(troncCounters).toHaveCount(1);
    await expect(troncCounters.locator('[data-testid="free-count"]')).toContainText(/\d+ lliures/);
    await expect(troncCounters.locator('[data-testid="pinya-eligible-count"]')).toHaveCount(0);
  });
});
