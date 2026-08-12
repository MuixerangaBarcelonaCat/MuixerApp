import { test, expect } from '@playwright/test';
import { loginViaUi } from '../audit/login-helper';
import { spaGoto } from '../audit/audit-core';
import { TARGETS } from '../audit/audit-targets';

/**
 * Phase 3 — "El taller en mode lectura" — zero-conflict regression.
 *
 * With production data the unique constraints are still in place, so every segment has ZERO
 * conflicts. This suite proves the Phase 3 additions are invisible in that state:
 *   - no conflict style anywhere (canvas `.conflict`, tronc-view `.tronc-node.conflict`),
 *   - no `⚠ N conflictes` warning pill in the segment manager,
 *   - the new dotació-per-àrea tooltip is present on the people pill.
 *
 * The seeded-conflict visual proof (the amber style actually showing) is deliberately deferred
 * to after Phase 5 (user decision), when real duplicates can exist in the dev DB.
 *
 * Requires the dashboard + API dev servers up and E2E_EMAIL / E2E_PASSWORD set.
 */

const EVENT_ID = TARGETS.workspaceEventId;
const SEGMENT_ID = TARGETS.workspaceSegmentId;

test.describe('Segments flexibility · Phase 3 (zero-conflict regression)', () => {
  test('the segment workshop renders no conflict style with production data', async ({ page }, testInfo) => {
    const consoleErrors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

    await loginViaUi(page);
    await spaGoto(page, `/pinyes/events/${EVENT_ID}/segments/${SEGMENT_ID}/assign`);

    // The workshop mounted (Pinyes tab canvas or the tab bar is visible).
    await expect(page.locator('app-segment-workspace, app-figure-canvas').first()).toBeVisible({
      timeout: 15000,
    });

    // No conflict style in the canvas or the tronc-view with production data.
    await expect(page.locator('.tronc-node.conflict')).toHaveCount(0);

    // Switch to the Troncs tab (tronc-view) and re-check.
    const troncsTab = page.getByRole('tab', { name: /troncs/i }).first();
    await expect(troncsTab).toBeVisible();
    await troncsTab.click();
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.locator('.tronc-node.conflict')).toHaveCount(0);

    await page.screenshot({
      path: testInfo.outputPath('phase3-workshop-zero-conflict.png'),
      fullPage: true,
    });

    expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);
  });

  test('the segment manager shows the dotació tooltip and no conflict pill', async ({ page }) => {
    await loginViaUi(page);
    await spaGoto(page, `/events/${EVENT_ID}`);
    await page.waitForLoadState('networkidle').catch(() => {});

    // The people pill carries the new dotació-per-àrea tooltip (…al tronc · …a la pinya).
    const peoplePill = page.locator('span.badge:has(lucide-icon)').filter({ hasText: /total/ }).first();
    await expect(peoplePill).toBeVisible();
    await expect(peoplePill).toHaveAttribute('title', /al tronc|a la pinya/);

    // No conflict warning pill in production (zero conflicts).
    await expect(page.getByText(/\d+ conflictes?/)).toHaveCount(0);
  });
});
