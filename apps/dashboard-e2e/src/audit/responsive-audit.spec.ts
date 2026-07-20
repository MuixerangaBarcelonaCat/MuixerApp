import { test, expect, Page, TestInfo } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { RESULTS_DIR, SHOTS_DIR } from './paths';
import { loginViaUi } from './login-helper';

/**
 * Responsive / usability audit.
 *
 * One test per device. The device logs in ONCE and then walks every route via
 * client-side (SPA) navigation, so the in-memory access token survives and no
 * per-route server refresh is triggered. This keeps auth requests well under the
 * backend throttle (10 req / 60 s on /api/auth) — reloading each route would
 * blow past it and get 429s.
 *
 * For every route × device it records objective metrics (horizontal overflow,
 * elements wider than the viewport, undersized tap targets, console errors) plus
 * a full-page screenshot, written to audit-results/<device>.json.
 */

interface RouteDef {
  name: string;
  path: string;
  /** Wait for this selector before measuring (route considered "ready"). */
  ready?: string;
  /** Public route, audited logged-out (measured before login). */
  public?: boolean;
}

const ROUTES: RouteDef[] = [
  { name: 'login', path: '/login', public: true },
  { name: 'home', path: '/home' },
  { name: 'persons-list', path: '/persons', ready: 'app-page-header' },
  { name: 'persons-new', path: '/persons/new' },
  { name: 'rehearsals', path: '/rehearsals' },
  { name: 'performances', path: '/performances' },
  { name: 'pinyes', path: '/pinyes' },
  { name: 'config', path: '/config' },
];

/** WCAG 2.5.5 recommends 44px; 2.5.8 (AA) requires a 24px minimum. */
const MIN_TAP_TARGET = 24;

interface RouteResult {
  route: string;
  path: string;
  device: string;
  viewport: { width: number; height: number } | null;
  finalUrl: string;
  redirectedToLogin: boolean;
  horizontalOverflowPx: number;
  overflowingElements: { selector: string; width: number }[];
  smallTapTargets: { selector: string; w: number; h: number }[];
  consoleErrors: string[];
  screenshot: string;
}

/** Navigate inside the SPA without a full reload (keeps the in-memory session). */
async function spaGoto(page: Page, url: string): Promise<void> {
  await page.evaluate((u) => {
    history.pushState({}, '', u);
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
  }, url);
  await page.waitForLoadState('networkidle').catch(() => {});
}

async function collectMetrics(page: Page, minTap: number) {
  return page.evaluate((min) => {
    const de = document.documentElement;
    const vw = window.innerWidth;
    const horizontalOverflowPx = Math.max(0, de.scrollWidth - de.clientWidth);

    const cssPath = (el: Element): string => {
      const parts: string[] = [];
      let node: Element | null = el;
      let depth = 0;
      while (node && node.nodeType === 1 && depth < 4) {
        let sel = node.nodeName.toLowerCase();
        if (node.id) {
          sel += `#${node.id}`;
          parts.unshift(sel);
          break;
        }
        const cls = (node.getAttribute('class') || '')
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .join('.');
        if (cls) sel += `.${cls}`;
        parts.unshift(sel);
        node = node.parentElement;
        depth++;
      }
      return parts.join(' > ');
    };

    const overflowing: { selector: string; width: number }[] = [];
    document.querySelectorAll('body *').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > vw + 1 && r.height > 0) {
        overflowing.push({ selector: cssPath(el), width: Math.round(r.width) });
      }
    });
    const seen = new Set<string>();
    const overflowingElements = overflowing
      .sort((a, b) => b.width - a.width)
      .filter((o) => (seen.has(o.selector) ? false : (seen.add(o.selector), true)))
      .slice(0, 12);

    const isVisible = (el: Element) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return (
        s.display !== 'none' &&
        s.visibility !== 'hidden' &&
        +s.opacity !== 0 &&
        r.width > 0 &&
        r.height > 0
      );
    };

    const smallSeen = new Set<string>();
    const smallTapTargets: { selector: string; w: number; h: number }[] = [];
    document
      .querySelectorAll(
        'a[href], button, input:not([type=hidden]), select, [role="button"], [tabindex]:not([tabindex="-1"])',
      )
      .forEach((el) => {
        if (!isVisible(el)) return;
        const r = el.getBoundingClientRect();
        if (r.width < min || r.height < min) {
          const sel = cssPath(el);
          if (!smallSeen.has(sel)) {
            smallSeen.add(sel);
            smallTapTargets.push({ selector: sel, w: Math.round(r.width), h: Math.round(r.height) });
          }
        }
      });

    return {
      horizontalOverflowPx,
      overflowingElements,
      smallTapTargets: smallTapTargets.slice(0, 20),
    };
  }, minTap);
}

async function auditRoute(
  page: Page,
  testInfo: TestInfo,
  route: RouteDef,
  consoleErrors: string[],
): Promise<void> {
  const device = testInfo.project.name;
  const viewport = page.viewportSize();
  consoleErrors.length = 0;

  if (route.ready) {
    await page.locator(route.ready).first().waitFor({ timeout: 8000 }).catch(() => {});
  }
  await page.waitForTimeout(600); // let layout / animations settle

  const finalUrl = page.url();
  const redirectedToLogin = !route.public && /\/login/.test(finalUrl);

  const metrics = await collectMetrics(page, MIN_TAP_TARGET);

  const deviceShotDir = path.join(SHOTS_DIR, device);
  fs.mkdirSync(deviceShotDir, { recursive: true });
  const screenshot = path.join(deviceShotDir, `${route.name}.png`);
  await page.screenshot({ path: screenshot, fullPage: true }).catch(() => {});
  await testInfo.attach(`${device}-${route.name}`, {
    path: screenshot,
    contentType: 'image/png',
  });

  const result: RouteResult = {
    route: route.name,
    path: route.path,
    device,
    viewport,
    finalUrl,
    redirectedToLogin,
    ...metrics,
    consoleErrors: [...consoleErrors].slice(0, 30),
    screenshot: path.relative(RESULTS_DIR, screenshot),
  };

  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const file = path.join(RESULTS_DIR, `${device}.json`);
  const existing: RouteResult[] = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, 'utf-8'))
    : [];
  const idx = existing.findIndex((r) => r.route === result.route);
  if (idx >= 0) existing[idx] = result;
  else existing.push(result);
  fs.writeFileSync(file, JSON.stringify(existing, null, 2));

  expect
    .soft(result.horizontalOverflowPx, `No horizontal overflow on ${device}/${route.name}`)
    .toBeLessThanOrEqual(1);
  expect
    .soft(result.redirectedToLogin, `${device}/${route.name} reachable when authenticated`)
    .toBeFalsy();
}

test.describe('Responsive & usability audit', () => {
  // One test per device: log in once, then walk every route client-side.
  test('audit all routes', async ({ page }, testInfo) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

    // 1. Public login page, measured logged-out.
    await page.goto('/login', { waitUntil: 'networkidle' }).catch(() => {});
    await auditRoute(page, testInfo, ROUTES[0], consoleErrors);

    // 2. Authenticate once for the whole device run.
    await loginViaUi(page);

    // 3. Walk the authenticated routes via SPA navigation (no reloads).
    for (const route of ROUTES.slice(1)) {
      await spaGoto(page, route.path);
      // If the session was somehow lost, re-login once and retry.
      if (/\/login/.test(page.url())) {
        await loginViaUi(page);
        await spaGoto(page, route.path);
      }
      await auditRoute(page, testInfo, route, consoleErrors);
    }
  });
});
