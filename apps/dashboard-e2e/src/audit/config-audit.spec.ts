import { test } from '@playwright/test';
import { loginViaUi } from './login-helper';
import { auditCurrent, spaGoto, RouteDef } from './audit-core';

/** Deep audit of the Config module and its sub-pages. */

const ROUTES: RouteDef[] = [
  { name: 'config-home', path: '/config', settle: 700 },
  { name: 'users', path: '/config/users', settle: 900 },
  { name: 'tags', path: '/config/tags', settle: 900 },
  { name: 'seasons', path: '/config/seasons', settle: 900 },
];

test.describe('Audit: Config', () => {
  test('walk config routes', async ({ page }, testInfo) => {
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
      await auditCurrent(page, testInfo, route, consoleErrors, 'config');
    }
  });
});
