import { test } from '@playwright/test';
import { loginViaUi } from './login-helper';
import { auditCurrent, spaGoto, RouteDef } from './audit-core';
import { TARGETS } from './audit-targets';

/** Deep audit of the Events module: rehearsal/performance lists, detail, attendance. */

const T = TARGETS;

const ROUTES: RouteDef[] = [
  { name: 'rehearsals-list', path: '/rehearsals', settle: 800 },
  { name: 'performances-list', path: '/performances', settle: 800 },
  { name: 'detail-assaig', path: `/events/${T.eventAssaigId}`, settle: 1000 },
  { name: 'detail-actuacio', path: `/events/${T.eventActuacioId}`, settle: 1000 },
  { name: 'attendance-confirmation', path: `/events/${T.eventAssaigId}/confirmation`, settle: 1000 },
];

test.describe('Audit: Events', () => {
  test('walk events routes', async ({ page }, testInfo) => {
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
      await auditCurrent(page, testInfo, route, consoleErrors, 'events');
    }
  });
});
