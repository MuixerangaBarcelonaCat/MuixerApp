import { test } from '@playwright/test';
import { loginViaUi } from '../audit/login-helper';
import { auditCurrent, spaGoto, RouteDef } from '../audit/audit-core';
import { TARGETS } from '../audit/audit-targets';

/**
 * Audit of the PWA (apps/pwa) — the member-facing, mobile-first, gesture-oriented
 * app. Runs against http://localhost:4300 (see playwright.pwa-audit.config.ts).
 * Results go to audit-results/pwa/.
 */

const ROUTES: RouteDef[] = [
  { name: 'login', path: '/login', public: true, settle: 700 },
  { name: 'home', path: '/home', settle: 900 },
  { name: 'events', path: '/events', settle: 900 },
  { name: 'event-detail', path: `/events/${TARGETS.eventAssaigId}`, settle: 1000 },
  { name: 'profile', path: '/profile', settle: 800 },
];

test.describe('Audit: PWA', () => {
  test('walk pwa routes', async ({ page }, testInfo) => {
    const consoleErrors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

    // Public login page, logged-out.
    await page.goto('/login', { waitUntil: 'networkidle' }).catch(() => {});
    await auditCurrent(page, testInfo, ROUTES[0], consoleErrors, 'pwa');

    await loginViaUi(page);

    for (const route of ROUTES.slice(1)) {
      consoleErrors.length = 0;
      await spaGoto(page, route.path);
      if (/\/login/.test(page.url())) {
        await loginViaUi(page);
        await spaGoto(page, route.path);
      }
      await auditCurrent(page, testInfo, route, consoleErrors, 'pwa');
    }
  });
});
