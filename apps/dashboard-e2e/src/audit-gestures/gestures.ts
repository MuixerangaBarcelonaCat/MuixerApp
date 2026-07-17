import { Page } from '@playwright/test';

/**
 * Real touch-gesture helpers driven through the Chrome DevTools Protocol
 * (Input.dispatchTouchEvent), so they exercise the same touch pipeline a
 * device would — not just mouse events. Requires a touch-enabled context
 * (hasTouch: true).
 */

export type Pt = { x: number; y: number };

export async function makeTouch(page: Page) {
  const client = await page.context().newCDPSession(page);
  const send = (type: 'touchStart' | 'touchMove' | 'touchEnd', points: Pt[]) =>
    client.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: points.map((p) => ({ x: p.x, y: p.y })),
    });

  return {
    /** One-finger drag from a→b in `steps` moves. */
    async pan(a: Pt, b: Pt, steps = 8) {
      await send('touchStart', [a]);
      for (let i = 1; i <= steps; i++) {
        await send('touchMove', [
          { x: a.x + ((b.x - a.x) * i) / steps, y: a.y + ((b.y - a.y) * i) / steps },
        ]);
        await page.waitForTimeout(16);
      }
      await send('touchEnd', []);
    },

    /** Two-finger pinch centred on `c`; fingers move from ±from to ±to on X. */
    async pinch(c: Pt, from: number, to: number, steps = 8) {
      const left = (d: number): Pt => ({ x: c.x - d, y: c.y });
      const right = (d: number): Pt => ({ x: c.x + d, y: c.y });
      await send('touchStart', [left(from), right(from)]);
      for (let i = 1; i <= steps; i++) {
        const d = from + ((to - from) * i) / steps;
        await send('touchMove', [left(d), right(d)]);
        await page.waitForTimeout(16);
      }
      await send('touchEnd', []);
    },

    /** Single tap. */
    async tap(p: Pt) {
      await send('touchStart', [p]);
      await page.waitForTimeout(30);
      await send('touchEnd', []);
    },
  };
}

/** True if two screenshot buffers differ (i.e. the view visibly changed). */
export function buffersDiffer(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return true;
  let diff = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
  return diff / a.length > 0.005;
}
