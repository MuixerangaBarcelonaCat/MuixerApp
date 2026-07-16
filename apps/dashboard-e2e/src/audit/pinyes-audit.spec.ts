import { test, Page } from '@playwright/test';
import { loginViaUi } from './login-helper';
import { auditCurrent, spaGoto, RouteDef } from './audit-core';
import { TARGETS } from './audit-targets';

/**
 * Deep audit of the Pinyes module — the most gesture-heavy surface of the app
 * (Konva canvas editors + the per-segment workspace with 5 tabs). Reaches detail
 * routes with sample dev IDs from audit-targets.ts.
 *
 * Navigation is client-side (SPA) to keep the in-memory session alive; the auth
 * controller is throttled to 10 req/60s (login+refresh), so full reloads per
 * route are not an option. Workspace tabs are switched by clicking the tab
 * buttons (query-param-only URL changes don't re-trigger the router reliably).
 */

const T = TARGETS;
const WS_BASE = `/pinyes/events/${T.workspaceEventId}/segments/${T.workspaceSegmentId}`;

/** SPA navigate and wait until the URL actually reflects the target path. */
async function goVerified(page: Page, url: string, expectFragment: string): Promise<void> {
  await spaGoto(page, url);
  await page
    .waitForFunction((frag) => location.href.includes(frag), expectFragment, { timeout: 6000 })
    .catch(() => {});
}

const SIMPLE_ROUTES: RouteDef[] = [
  { name: 'template-list', path: '/pinyes', settle: 800 },
  { name: 'template-editor', path: `/pinyes/templates/${T.templateId}/edit`, settle: 1600 },
  { name: 'template-new', path: '/pinyes/templates/new', settle: 1200 },
  { name: 'composition-new', path: '/pinyes/compositions/new', settle: 1200 },
];

const TABS: { name: string; label: string }[] = [
  { name: 'workspace-pinyes', label: 'Pinyes' },
  { name: 'workspace-troncs', label: 'Troncs' },
  { name: 'workspace-distribucio', label: 'Distribució' },
  { name: 'workspace-nodes', label: 'Nodes extra' },
  { name: 'workspace-previsualitza', label: 'Previsualitza' },
];

test.describe('Audit: Pinyes', () => {
  test('walk pinyes routes', async ({ page }, testInfo) => {
    const consoleErrors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

    await loginViaUi(page);

    // --- Simple detail routes (distinct paths) ---
    for (const route of SIMPLE_ROUTES) {
      consoleErrors.length = 0;
      await goVerified(page, route.path, route.path.split('?')[0]);
      if (/\/login/.test(page.url())) {
        await loginViaUi(page);
        await goVerified(page, route.path, route.path.split('?')[0]);
      }
      await auditCurrent(page, testInfo, route, consoleErrors, 'pinyes');
    }

    // --- Segment workspace: land once, then switch tabs by clicking ---
    await goVerified(page, `${WS_BASE}/assign`, '/segments/');
    if (/\/login/.test(page.url())) {
      await loginViaUi(page);
      await goVerified(page, `${WS_BASE}/assign`, '/segments/');
    }
    for (const tab of TABS) {
      consoleErrors.length = 0;
      await page.getByRole('tab', { name: tab.label, exact: true }).click().catch(() => {});
      await page.waitForTimeout(300);
      await auditCurrent(
        page,
        testInfo,
        { name: tab.name, path: `${WS_BASE}/assign?tab=${tab.label}`, settle: 1600 },
        consoleErrors,
        'pinyes',
      );
    }

    // --- Projection view ---
    consoleErrors.length = 0;
    await goVerified(page, `${WS_BASE}/project`, '/project');
    if (/\/login/.test(page.url())) {
      await loginViaUi(page);
      await goVerified(page, `${WS_BASE}/project`, '/project');
    }
    await auditCurrent(
      page,
      testInfo,
      { name: 'projection', path: `${WS_BASE}/project`, settle: 1800 },
      consoleErrors,
      'pinyes',
    );
  });
});
