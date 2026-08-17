import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { loginViaUi } from '../audit/login-helper';
import { RESULTS_DIR, SHOTS_DIR } from '../audit/paths';
import { TARGETS } from '../audit/audit-targets';
import { makeTouch, buffersDiffer, Pt } from './gestures';

/**
 * Touch-gesture audit of the Projection view — unlike the template editor,
 * composition editor and segment-assignment workspace (all behind
 * `desktopOnlyGuard`, ≥768px), Projection has NO device guard: it's the only
 * Pinyes canvas a phone can actually open. Real gesture support here
 * therefore matters at every viewport, not just tablet.
 *
 * Reached via a real `page.goto()` rather than `spaGoto` (docs/AUDIT_SUITE.md
 * notes the standalone `/project` route isn't reliably reachable via in-SPA
 * popstate navigation). A full load loses the in-memory JWT, but the
 * `muixer_has_session` hint + the httpOnly rotating refresh cookie from
 * `loginViaUi` trigger a silent refresh on bootstrap, so the session survives.
 */

const PROJECTION = `/pinyes/events/${TARGETS.workspaceEventId}/segments/${TARGETS.workspaceSegmentId}/project`;

interface ProjectionGestureResult {
  device: string;
  viewport: { width: number; height: number } | null;
  canvasFound: boolean;
  canvasBox: { w: number; h: number } | null;
  zoomBefore: string | null;
  zoomAfterPinch: string | null;
  pinchChangedZoom: boolean;
  panChangedCanvas: boolean;
  consoleErrors: string[];
}

test('projection canvas gestures (no device guard)', async ({ page }, testInfo) => {
  const device = testInfo.project.name;
  const consoleErrors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

  await loginViaUi(page);
  await page.goto(PROJECTION, { waitUntil: 'networkidle' });
  if (/\/login/.test(page.url())) {
    // Silent refresh failed (e.g. cookie already rotated by a prior test run) — log in again.
    await loginViaUi(page);
    await page.goto(PROJECTION, { waitUntil: 'networkidle' });
  }

  const container = page.locator('.canvas-container').first();
  const canvasFound = await container
    .locator('canvas')
    .first()
    .waitFor({ timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  await page.waitForTimeout(800);

  const result: ProjectionGestureResult = {
    device,
    viewport: page.viewportSize(),
    canvasFound,
    canvasBox: null,
    zoomBefore: null,
    zoomAfterPinch: null,
    pinchChangedZoom: false,
    panChangedCanvas: false,
    consoleErrors: [],
  };

  const shotDir = path.join(SHOTS_DIR, 'gestures-projection', device);
  fs.mkdirSync(shotDir, { recursive: true });
  const snap = () => container.screenshot().catch(() => Buffer.alloc(0));

  if (canvasFound) {
    const box = await container.boundingBox();
    if (box) {
      result.canvasBox = { w: Math.round(box.width), h: Math.round(box.height) };
      const c: Pt = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      const touch = await makeTouch(page);

      const readZoom = () =>
        page
          .locator('select.zoom-selector')
          .first()
          .inputValue()
          .catch(() => null);

      // --- Zoom by pinch ---
      result.zoomBefore = await readZoom();
      await touch.pinch(c, 40, Math.min(box.width, box.height) / 2 - 10);
      await page.waitForTimeout(500);
      result.zoomAfterPinch = await readZoom();
      result.pinchChangedZoom =
        result.zoomBefore !== null && result.zoomAfterPinch !== result.zoomBefore;
      await page.screenshot({ path: path.join(shotDir, 'after-pinch.png') }).catch(() => {});

      // --- Pan (one-finger touch drag) ---
      const beforePan = await snap();
      await touch.pan({ x: c.x - box.width / 4, y: c.y }, { x: c.x + box.width / 4, y: c.y });
      await page.waitForTimeout(400);
      const afterPan = await snap();
      result.panChangedCanvas = buffersDiffer(beforePan, afterPan);
      await page.screenshot({ path: path.join(shotDir, 'after-pan.png') }).catch(() => {});
    }
  }

  // The recurring 403 bootstrap call is unrelated to gestures — exclude it.
  result.consoleErrors = consoleErrors.filter((e) => !/403|Forbidden/.test(e)).slice(0, 30);

  const dir = path.join(RESULTS_DIR, 'gestures-projection');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${device}.json`), JSON.stringify(result, null, 2));

  // Projection has no device guard: the canvas must be reachable on every profile.
  expect.soft(canvasFound, `${device}: projection canvas present (no desktopOnlyGuard here)`).toBeTruthy();
  expect.soft(consoleErrors, `${device}: no errors during gestures`).toHaveLength(0);
});
