import { Page, expect } from '@playwright/test';
import { spaGoto } from '../audit/audit-core';

/**
 * Clicks near the center of the Konva canvas and verifies a node was actually selected
 * by checking for the color-picker swatch (only visible when the properties panel shows
 * node properties). Retries with offset positions if the first click misses.
 */
export async function selectFirstCanvasNode(page: Page): Promise<void> {
  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible({ timeout: 10000 });

  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas bounding box not found');

  const swatch = page.getByTestId('color-picker-swatch');
  const offsets = [
    { x: 0.5, y: 0.5 },
    { x: 0.4, y: 0.4 },
    { x: 0.6, y: 0.6 },
    { x: 0.3, y: 0.5 },
  ];

  for (const offset of offsets) {
    await page.mouse.click(box.x + box.width * offset.x, box.y + box.height * offset.y);
    await page.waitForTimeout(500);
    if (await swatch.isVisible()) return;
  }

  throw new Error('Could not select a canvas node — no node found at any tried position');
}

/**
 * Read the numeric value from a labeled properties panel input.
 */
export async function getPropertyInputValue(
  page: Page,
  labelText: string,
): Promise<number> {
  const label = page.locator('.panel-scroll-area label', { hasText: labelText }).first();
  const forAttr = await label.getAttribute('for');
  if (!forAttr) throw new Error(`Label "${labelText}" has no 'for' attribute`);

  const input = page.locator(`#${CSS.escape(forAttr)}`);
  const val = await input.inputValue();
  return Number(val);
}

/**
 * Navigates to the template editor using the shared spaGoto helper (consistent
 * with the rest of the e2e suite) and waits for the editor layout to render.
 */
export async function gotoTemplateEditor(
  page: Page,
  templateId: string,
): Promise<void> {
  await spaGoto(page, `/pinyes/templates/${templateId}/edit`);
  await expect(page.locator('.editor-layout')).toBeVisible({ timeout: 15000 });
}
