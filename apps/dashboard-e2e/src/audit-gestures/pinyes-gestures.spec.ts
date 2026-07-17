import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { loginViaUi } from '../audit/login-helper';
import { spaGoto } from '../audit/audit-core';
import { RESULTS_DIR, SHOTS_DIR } from '../audit/paths';
import { TARGETS } from '../audit/audit-targets';
import { makeTouch, buffersDiffer, Pt } from './gestures';

/**
 * Touch-gesture smoke audit of the Pinyes segment workspace (the assignment
 * canvas). Drives REAL touch events via CDP and records observable effects:
 * zoom-level change (bound to the `select.zoom-selector`), canvas pixel change
 * for pan, selection change on tap, and any console/page errors.
 *
 * Observation is necessarily coarse (Konva state lives in JS, not the DOM), so
 * this reports "gesture produced a visible change / did not crash" per device.
 */

const WS_ASSIGN = `/pinyes/events/${TARGETS.workspaceEventId}/segments/${TARGETS.workspaceSegmentId}/assign`;

interface GestureResult {
  device: string;
  viewport: { width: number; height: number } | null;
  canvasFound: boolean;
  canvasBox: { w: number; h: number } | null;
  zoomBefore: string | null;
  zoomAfterPinch: string | null;
  zoomAfterWheel: string | null;
  pinchChangedZoom: boolean;
  wheelChangedZoom: boolean;
  panChangedCanvas: boolean;
  mouseDragPanChanged: boolean;
  tapChangedCanvas: boolean;
  assignFlowChangedView: boolean;
  zoomDropdownWorks: boolean;
  consoleErrors: string[];
}

test('pinyes canvas gestures', async ({ page }, testInfo) => {
  const device = testInfo.project.name;
  const consoleErrors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

  await loginViaUi(page);
  await spaGoto(page, `${WS_ASSIGN}?tab=pinyes`);
  if (/\/login/.test(page.url())) {
    await loginViaUi(page);
    await spaGoto(page, `${WS_ASSIGN}?tab=pinyes`);
  }

  const container = page.locator('.canvas-container').first();
  const canvasFound = await container
    .locator('canvas')
    .first()
    .waitFor({ timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  await page.waitForTimeout(800);

  const result: GestureResult = {
    device,
    viewport: page.viewportSize(),
    canvasFound,
    canvasBox: null,
    zoomBefore: null,
    zoomAfterPinch: null,
    zoomAfterWheel: null,
    pinchChangedZoom: false,
    wheelChangedZoom: false,
    panChangedCanvas: false,
    mouseDragPanChanged: false,
    tapChangedCanvas: false,
    assignFlowChangedView: false,
    zoomDropdownWorks: false,
    consoleErrors: [],
  };

  const shotDir = path.join(SHOTS_DIR, 'gestures', device);
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

      // --- Zoom by wheel (mouse wheel over the canvas) ---
      const zBeforeWheel = await readZoom();
      await page.mouse.move(c.x, c.y);
      await page.mouse.wheel(0, -600);
      await page.waitForTimeout(500);
      result.zoomAfterWheel = await readZoom();
      result.wheelChangedZoom =
        zBeforeWheel !== null && result.zoomAfterWheel !== zBeforeWheel;

      // --- Pan (one-finger touch drag) ---
      const beforePan = await snap();
      await touch.pan({ x: c.x - box.width / 4, y: c.y }, { x: c.x + box.width / 4, y: c.y });
      await page.waitForTimeout(400);
      const afterPan = await snap();
      result.panChangedCanvas = buffersDiffer(beforePan, afterPan);
      await page.screenshot({ path: path.join(shotDir, 'after-pan.png') }).catch(() => {});

      // --- Pan via mouse drag (to distinguish "unsupported" from "touch not delivered") ---
      const beforeMouse = await snap();
      await page.mouse.move(c.x - box.width / 4, c.y);
      await page.mouse.down();
      for (let i = 1; i <= 8; i++) {
        await page.mouse.move(c.x - box.width / 4 + (box.width / 2) * (i / 8), c.y);
        await page.waitForTimeout(16);
      }
      await page.mouse.up();
      await page.waitForTimeout(400);
      result.mouseDragPanChanged = buffersDiffer(beforeMouse, await snap());

      // --- Tap to select a node ---
      const beforeTap = await snap();
      await touch.tap(c);
      await page.waitForTimeout(400);
      const afterTap = await snap();
      result.tapChangedCanvas = buffersDiffer(beforeTap, afterTap);

      // --- Assignment flow (best-effort): tap a person, then tap the canvas ---
      const beforeAssign = await snap();
      // People panel sits to the right of the canvas; tap where a row should be.
      const panelX = Math.min(box.x + box.width + 120, (page.viewportSize()?.width ?? box.x) - 20);
      await touch.tap({ x: panelX, y: box.y + 120 });
      await page.waitForTimeout(300);
      await touch.tap(c);
      await page.waitForTimeout(500);
      const afterAssign = await snap();
      result.assignFlowChangedView = buffersDiffer(beforeAssign, afterAssign);
      await page.screenshot({ path: path.join(shotDir, 'after-assign.png') }).catch(() => {});

      // --- Zoom via the dropdown (the only supported zoom mechanism) ---
      const beforeZoomUi = await snap();
      await page
        .locator('select.zoom-selector')
        .first()
        .selectOption('2')
        .catch(() => {});
      await page.waitForTimeout(500);
      const zoomVal = await readZoom();
      result.zoomDropdownWorks = zoomVal === '2' && buffersDiffer(beforeZoomUi, await snap());
    }
  }

  // The recurring 403 bootstrap call is unrelated to gestures — exclude it.
  result.consoleErrors = consoleErrors.filter((e) => !/403|Forbidden/.test(e)).slice(0, 30);

  const dir = path.join(RESULTS_DIR, 'gestures');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${device}.json`), JSON.stringify(result, null, 2));

  // Non-blocking signals for the report.
  expect.soft(canvasFound, `${device}: canvas present`).toBeTruthy();
  expect.soft(consoleErrors, `${device}: no errors during gestures`).toHaveLength(0);
});
