import { expect, Locator, Page, test } from '@playwright/test';
import { makeTouch, Pt } from '../audit-gestures/gestures';
import { installMockApi, MockApi, WORKSPACE_URL } from './mock-api';

/**
 * Touch e2e of the segment workspace's assignment flow, on phone and tablet profiles
 * (`(pointer: coarse)`): tap a node → person modal, long press → move, tap the destination →
 * move / swap, cancelling, and no drag-and-drop. Real touch events are sent through the Chrome
 * DevTools Protocol (see `../audit-gestures/gestures.ts`), so they go through the same pointer /
 * touch pipeline a device does — including Chrome's own long-press `contextmenu`.
 *
 * The API is mocked in the browser (`mock-api.ts`): no credentials, no database, no dev data.
 */

let api: MockApi;

test.beforeEach(async ({ page }) => {
  // Records navigator.vibrate() calls (the brief bump when a move starts).
  await page.addInitScript(() => {
    const calls: unknown[] = [];
    (window as unknown as { __vibrations: unknown[] }).__vibrations = calls;
    navigator.vibrate = ((pattern: VibratePattern) => {
      calls.push(pattern);
      return true;
    }) as Navigator['vibrate'];
  });
  api = await installMockApi(page);
});

test.afterEach(() => {
  expect(api.unmocked(), 'every request the app made was mocked').toEqual([]);
});

// ── helpers ─────────────────────────────────────────────────────────────────────

const vibrations = (page: Page) =>
  page.evaluate(() => (window as unknown as { __vibrations: unknown[] }).__vibrations);

/** The pill itself (`role=status`): in the Troncs tab its host element is a zero-height sticky wrapper. */
const banner = (page: Page) => page.locator('app-move-banner [role="status"]');
const modal = (page: Page) => page.locator('dialog[open]').filter({ has: page.locator('app-person-panel') });

/** Center of a locator in viewport coordinates, after scrolling it into view. */
async function center(locator: Locator): Promise<Pt> {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error('element has no box');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

const troncNode = (page: Page, id: string) => page.locator(`[data-tronc-node-id="${id}"]`);

async function openTroncs(page: Page) {
  await page.goto(`${WORKSPACE_URL}?tab=troncs`);
  await expect(troncNode(page, 'tronc-1')).toBeVisible();
}

/**
 * Center of a pinya node on the Konva canvas, in viewport coordinates. Konva keeps every stage on
 * `window.Konva`, so the position is read from the real render instead of guessed from pixels.
 * Waits until the canvas has finished fitting the content (the position stops changing).
 */
async function konvaNodeCenter(page: Page, nodeId: string): Promise<Pt> {
  const read = () =>
    page.evaluate((id) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const konva = (window as any).Konva;
      const stage = konva?.stages?.[0];
      if (!stage) return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const group = stage.find('Group').find((g: any) => String(g.id()).endsWith(id));
      if (!group) return null;
      const r = group.getClientRect();
      const c = stage.container().getBoundingClientRect();
      return { x: c.left + r.x + r.width / 2, y: c.top + r.y + r.height / 2 };
    }, nodeId);

  let previous: Pt | null = null;
  for (let i = 0; i < 40; i++) {
    const now = await read();
    if (now && previous && Math.abs(now.x - previous.x) < 0.5 && Math.abs(now.y - previous.y) < 0.5) return now;
    previous = now;
    await page.waitForTimeout(150);
  }
  throw new Error(`canvas node ${nodeId} never settled`);
}

async function openPinyes(page: Page) {
  await page.goto(`${WORKSPACE_URL}?tab=pinyes`);
  await expect(page.locator('app-figure-canvas canvas').first()).toBeVisible();
  await konvaNodeCenter(page, 'pinya-b');
}

// ═══════════════════════════════════════════════════════════════════════════════════
// Troncs tab (DOM nodes, pointer events)
// ═══════════════════════════════════════════════════════════════════════════════════

test.describe('Troncs tab', () => {
  test('touch layout: only Pinyes and Troncs, no side panel, minimap hidden', async ({ page }) => {
    await openTroncs(page);

    await expect(page.getByRole('tab')).toHaveCount(2);
    await expect(page.getByText('Encara no optimitzat per a mòbil')).toHaveCount(0);
    // The person list lives inside the (closed) modal, not in a side column.
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    expect(await page.locator('app-person-panel').evaluate((el) => !el.closest('dialog')?.open)).toBe(true);
    await expect(page.getByLabel('Mapa de la posició de les figures del segment')).toHaveCount(0);
  });

  test.describe('tap opens the person modal', () => {
    test('an empty node: keyboard-ready search, narrowing, and assigning by tap', async ({ page }) => {
      await openTroncs(page);

      await troncNode(page, 'tronc-2').tap();

      await expect(modal(page)).toBeVisible();
      await expect(modal(page).getByRole('heading', { name: 'Assigna una persona' })).toBeVisible();
      const search = modal(page).locator('input[type="search"]');
      await expect(search, 'the search box is focused so the keyboard opens').toBeFocused();

      await search.fill('ann');
      await expect(modal(page).getByRole('button', { name: 'Seleccionar Anna' })).toBeVisible();
      await expect(modal(page).getByRole('button', { name: 'Seleccionar Josep' })).toHaveCount(0);

      await modal(page).getByRole('button', { name: 'Seleccionar Anna' }).tap();

      await expect.poll(() => api.mutations().map((m) => `${m.method} ${JSON.stringify(m.body)}`)).toEqual([
        'POST {"nodeId":"tronc-2","personId":"p-anna"}',
      ]);
      await expect(modal(page)).toBeHidden();
      await expect(troncNode(page, 'tronc-2')).toContainText('Anna');
    });

    test('an assigned node: "Canvia la persona", and the person is replaced', async ({ page }) => {
      await openTroncs(page);

      await troncNode(page, 'tronc-1').tap();
      await expect(modal(page).getByRole('heading', { name: 'Canvia la persona' })).toBeVisible();
      await modal(page).getByRole('button', { name: 'Seleccionar Anna' }).tap();

      await expect.poll(() => api.mutations().map((m) => m.method)).toEqual(['DELETE', 'POST']);
      await expect(troncNode(page, 'tronc-1')).toContainText('Anna');
      expect(api.occupant('tronc-1')).toBe('Anna');
    });

    test('dismissing the modal with its cross changes nothing', async ({ page }) => {
      await openTroncs(page);
      await troncNode(page, 'tronc-1').tap();

      await modal(page).getByRole('button', { name: 'Tancar' }).tap();

      await expect(modal(page)).toBeHidden();
      expect(api.mutations()).toEqual([]);
    });
  });

  test.describe('long press starts a move', () => {
    test('shows the banner, marks the node, bumps once, and stays after lifting the finger', async ({ page }) => {
      await openTroncs(page);
      const touch = await makeTouch(page);

      await touch.longPress(await center(troncNode(page, 'tronc-1')), 700);

      await expect(banner(page)).toContainText("S'està movent");
      await expect(banner(page)).toContainText('Maria');
      await expect(troncNode(page, 'tronc-1')).toHaveClass(/highlighted/);
      await expect(modal(page), 'a long press must not also open the person modal').toBeHidden();
      // The click the browser emits on lifting the finger must not cancel the move it just started.
      await page.waitForTimeout(1000);
      await expect(banner(page)).toBeVisible();
      expect(await vibrations(page)).toEqual([15]);
      expect(api.mutations()).toEqual([]);
    });

    test('tapping an empty node then moves the person there', async ({ page }) => {
      await openTroncs(page);
      const touch = await makeTouch(page);
      await touch.longPress(await center(troncNode(page, 'tronc-1')), 700);
      await expect(banner(page)).toBeVisible();

      await troncNode(page, 'tronc-2').tap();

      await expect.poll(() => api.mutations().map((m) => m.method)).toEqual(['DELETE', 'POST']);
      await expect(banner(page)).toHaveCount(0);
      await expect(troncNode(page, 'tronc-2')).toContainText('Maria');
      expect(api.occupant('tronc-1')).toBeNull();
      await expect(modal(page), 'completing a move must not open the person modal').toBeHidden();
    });

    test('tapping an occupied node swaps the two people', async ({ page }) => {
      await openTroncs(page);
      const touch = await makeTouch(page);
      await touch.longPress(await center(troncNode(page, 'tronc-1')), 700);
      await expect(banner(page)).toBeVisible();

      await troncNode(page, 'tronc-3').tap();

      await expect.poll(() => api.mutations().map((m) => m.path.split('/').pop())).toEqual(['swap']);
      await expect(troncNode(page, 'tronc-1')).toContainText('Josep');
      await expect(troncNode(page, 'tronc-3')).toContainText('Maria');
      await expect(banner(page)).toHaveCount(0);
    });

    test('a long press on the destination completes the move too', async ({ page }) => {
      await openTroncs(page);
      const touch = await makeTouch(page);
      await touch.longPress(await center(troncNode(page, 'tronc-1')), 700);
      await expect(banner(page)).toBeVisible();

      await touch.longPress(await center(troncNode(page, 'tronc-2')), 700);

      await expect.poll(() => api.occupant('tronc-2')).toBe('Maria');
      await expect(banner(page)).toHaveCount(0);
    });

    test('a long press on an empty node with nothing to move does nothing', async ({ page }) => {
      await openTroncs(page);
      const touch = await makeTouch(page);

      await touch.longPress(await center(troncNode(page, 'tronc-2')), 700);
      await page.waitForTimeout(500);

      await expect(banner(page)).toHaveCount(0);
      await expect(modal(page)).toBeHidden();
      expect(await vibrations(page)).toEqual([]);
    });
  });

  test.describe('cancelling a move', () => {
    const startMove = async (page: Page) => {
      await openTroncs(page);
      const touch = await makeTouch(page);
      await touch.longPress(await center(troncNode(page, 'tronc-1')), 700);
      await expect(banner(page)).toBeVisible();
      return touch;
    };

    test('tapping outside any node cancels', async ({ page }) => {
      const touch = await startMove(page);

      // The empty area below the figures.
      const viewport = page.viewportSize();
      await touch.tap({ x: 20, y: (viewport?.height ?? 800) - 150 });

      await expect(banner(page)).toHaveCount(0);
      expect(api.mutations()).toEqual([]);
    });

    test('the cross on the banner cancels', async ({ page }) => {
      await startMove(page);

      await page.getByRole('button', { name: 'Cancel·la el moviment' }).tap();

      await expect(banner(page)).toHaveCount(0);
      expect(api.mutations()).toEqual([]);
    });

    test('tapping the same node again cancels', async ({ page }) => {
      await startMove(page);

      await troncNode(page, 'tronc-1').tap();

      await expect(banner(page)).toHaveCount(0);
      expect(api.mutations()).toEqual([]);
    });
  });

  test.describe('no drag and drop, no accidental long press', () => {
    test('dragging a person onto another node moves nobody', async ({ page }) => {
      await openTroncs(page);
      const touch = await makeTouch(page);
      const from = await center(troncNode(page, 'tronc-1'));
      const to = await center(troncNode(page, 'tronc-2'));

      await touch.pan(from, to);
      await page.waitForTimeout(500);

      expect(api.mutations()).toEqual([]);
      expect(api.occupant('tronc-1')).toBe('Maria');
      await expect(banner(page)).toHaveCount(0);
    });

    test('starting a scroll on a node is not a long press', async ({ page }) => {
      await openTroncs(page);
      const touch = await makeTouch(page);
      const from = await center(troncNode(page, 'tronc-1'));

      // A slow drag: the finger moves away long before the press delay elapses.
      await touch.pan(from, { x: from.x, y: from.y + 80 }, 30);
      await page.waitForTimeout(800);

      await expect(banner(page)).toHaveCount(0);
      expect(await vibrations(page)).toEqual([]);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════
// Pinyes tab (Konva canvas, touch events)
// ═══════════════════════════════════════════════════════════════════════════════════

test.describe('Pinyes tab (canvas)', () => {
  test('tap on a node opens the person modal', async ({ page }) => {
    await openPinyes(page);
    const touch = await makeTouch(page);

    await touch.tap(await konvaNodeCenter(page, 'pinya-a'));

    await expect(modal(page).getByRole('heading', { name: 'Assigna una persona' })).toBeVisible();
    await expect(modal(page).locator('input[type="search"]')).toBeFocused();
  });

  test('picking a person in the modal assigns them to the tapped node', async ({ page }) => {
    await openPinyes(page);
    const touch = await makeTouch(page);
    await touch.tap(await konvaNodeCenter(page, 'pinya-a'));
    await expect(modal(page)).toBeVisible();

    await modal(page).getByRole('button', { name: 'Seleccionar Anna' }).tap();

    await expect.poll(() => api.occupant('pinya-a')).toBe('Anna');
    await expect(modal(page)).toBeHidden();
  });

  test('long press starts a move (banner + one bump, no modal), and it survives lifting the finger', async ({ page }) => {
    await openPinyes(page);
    const touch = await makeTouch(page);

    await touch.longPress(await konvaNodeCenter(page, 'pinya-b'), 700);

    await expect(banner(page)).toContainText("S'està movent");
    await expect(banner(page)).toContainText('Pepet');
    await expect(modal(page)).toBeHidden();
    await page.waitForTimeout(1000);
    await expect(banner(page)).toBeVisible();
    expect(await vibrations(page)).toEqual([15]);
  });

  test('tapping an empty node then moves the person there', async ({ page }) => {
    await openPinyes(page);
    const touch = await makeTouch(page);
    await touch.longPress(await konvaNodeCenter(page, 'pinya-b'), 700);
    await expect(banner(page)).toBeVisible();

    await touch.tap(await konvaNodeCenter(page, 'pinya-c'));

    await expect.poll(() => api.occupant('pinya-c')).toBe('Pepet');
    expect(api.occupant('pinya-b')).toBeNull();
    await expect(banner(page)).toHaveCount(0);
    await expect(modal(page)).toBeHidden();
  });

  test('tapping the empty canvas cancels the move', async ({ page }) => {
    await openPinyes(page);
    const touch = await makeTouch(page);
    await touch.longPress(await konvaNodeCenter(page, 'pinya-b'), 700);
    await expect(banner(page)).toBeVisible();
    const box = await page.locator('app-figure-canvas canvas').first().boundingBox();
    if (!box) throw new Error('no canvas');

    await touch.tap({ x: box.x + 8, y: box.y + box.height - 8 });

    await expect(banner(page)).toHaveCount(0);
    expect(api.mutations()).toEqual([]);
  });

  test('dragging a person onto another node moves nobody', async ({ page }) => {
    await openPinyes(page);
    const touch = await makeTouch(page);
    const from = await konvaNodeCenter(page, 'pinya-b');
    const to = await konvaNodeCenter(page, 'pinya-c');

    await touch.pan(from, to);
    await page.waitForTimeout(500);

    expect(api.mutations()).toEqual([]);
    expect(api.occupant('pinya-b')).toBe('Pepet');
  });
});
