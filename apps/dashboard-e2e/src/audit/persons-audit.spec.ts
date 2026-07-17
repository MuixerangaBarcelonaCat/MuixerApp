import { test } from '@playwright/test';
import { loginViaUi } from './login-helper';
import { auditCurrent, spaGoto, RouteDef } from './audit-core';
import { TARGETS } from './audit-targets';

/** Deep audit of the Persons module (priority module): list, form, detail. */

const ROUTES: RouteDef[] = [
  { name: 'list', path: '/persons', ready: 'app-page-header', settle: 800 },
  { name: 'list-provisionals', path: '/persons', settle: 800 }, // measured after switching tab below
  { name: 'new', path: '/persons/new', settle: 800 },
  { name: 'detail', path: `/persons/${TARGETS.personId}`, settle: 1000 },
];

test.describe('Audit: Persons', () => {
  test('walk persons routes', async ({ page }, testInfo) => {
    const consoleErrors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

    await loginViaUi(page);

    // list
    await spaGoto(page, ROUTES[0].path);
    if (/\/login/.test(page.url())) {
      await loginViaUi(page);
      await spaGoto(page, ROUTES[0].path);
    }
    await auditCurrent(page, testInfo, ROUTES[0], consoleErrors, 'persons');

    // list with "Provisionals" tab active (different data shape / empty-state)
    consoleErrors.length = 0;
    await page.getByRole('button', { name: 'Provisionals' }).click().catch(() => {});
    await page.waitForTimeout(500);
    await auditCurrent(page, testInfo, ROUTES[1], consoleErrors, 'persons');

    // new + detail
    for (const route of ROUTES.slice(2)) {
      consoleErrors.length = 0;
      await spaGoto(page, route.path);
      if (/\/login/.test(page.url())) {
        await loginViaUi(page);
        await spaGoto(page, route.path);
      }
      await auditCurrent(page, testInfo, route, consoleErrors, 'persons');
    }
  });
});
