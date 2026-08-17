import { test } from '@playwright/test';
import { loginViaUi } from './login-helper';
import { auditCurrent, spaGoto, RouteDef } from './audit-core';

/**
 * Visual regression net for the Phase 5 style guide (Phase 6.3 of the design-system plan) — full-page
 * screenshots + the standard overflow/tap-target/console-error checks, same idiom as every other
 * *-audit.spec.ts here (this repo has no pixel-diff baseline tooling; screenshots are for manual review).
 * ADMIN-only route — needs E2E_EMAIL/E2E_PASSWORD for an ADMIN account, not just TECHNICAL.
 */

const ROUTES: RouteDef[] = [{ name: 'design-system', path: '/design-system', settle: 900 }];

test.describe('Audit: Design System', () => {
  test('walk design-system route', async ({ page }, testInfo) => {
    const consoleErrors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

    await loginViaUi(page);

    for (const route of ROUTES) {
      consoleErrors.length = 0;
      await spaGoto(page, route.path);
      if (/\/login/.test(page.url())) {
        await loginViaUi(page);
        await spaGoto(page, route.path);
      }
      await auditCurrent(page, testInfo, route, consoleErrors, 'design-system');
    }
  });
});
