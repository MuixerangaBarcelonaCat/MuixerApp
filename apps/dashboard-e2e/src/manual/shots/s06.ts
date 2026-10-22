import { Locator, Page } from '@playwright/test';
import { ManualShot } from '../manual-shot';
import { TARGETS } from '../../audit/audit-targets';
import { spaGoto } from '../../audit/audit-core';

/**
 * Segments i figures (pàgina 11). Needs an event that is NOT locked (dated < 2 days ago or
 * upcoming), with ≥ 2 segments and a figure that has rengles + cordons oberts: set
 * MANUAL_SEGMENTS_EVENT_ID. The locked shot uses MANUAL_LOCKED_EVENT_ID (an event dated > 2 days
 * ago with segments). Never click delete/«Confirma»/«Aplica» nor change a mode or cordon control.
 */

const EVENT_ID = process.env['MANUAL_SEGMENTS_EVENT_ID'] || TARGETS.workspaceEventId;
const LOCKED_EVENT_ID = process.env['MANUAL_LOCKED_EVENT_ID'] || TARGETS.eventActuacioId;
const EVENT = `/events/${EVENT_ID}?tab=pinyes`;
const LOCKED_EVENT = `/events/${LOCKED_EVENT_ID}?tab=pinyes`;
const SEGMENTS = '[role="list"][aria-label="Llista de segments"]';
const FIRST_SEGMENT = `${SEGMENTS} > [role="listitem"]:first-child`;
const ADD_FIGURE = `${FIRST_SEGMENT} button[aria-label="Afig una figura o composició al segment"]`;
const MARK = '[data-manual-hl]';

/** Tags an element without a stable CSS hook so `highlight: MARK` can outline it. */
async function mark(locator: Locator): Promise<void> {
  await locator.first().evaluate((el) => el.setAttribute('data-manual-hl', ''));
}

/** The Pinyes/Troncs view is remembered per browser, so every shot picks it explicitly. */
async function view(page: Page, mode: 'Pinyes' | 'Troncs'): Promise<void> {
  await page
    .locator('div[role="group"][aria-label="Mode de visualització"]')
    .getByRole('button', { name: mode, exact: true })
    .click();
  await page.waitForLoadState('networkidle').catch(() => undefined);
}

const pinyes = (page: Page) => view(page, 'Pinyes');

export const s06: ManualShot[] = [
  {
    file: '11-segments-llista.png',
    app: 'dashboard',
    path: EVENT,
    ready: SEGMENTS,
    prepare: pinyes,
    highlight: 'button[aria-label="Afegir segment nou"]',
    settle: 800,
  },
  {
    file: '11-segments-comptadors.png',
    app: 'dashboard',
    path: EVENT,
    ready: SEGMENTS,
    prepare: async (page) => {
      await pinyes(page);
      // Segment badge «x/y pinyes, x/y total» (lib-badge is display:contents → mark its <span>).
      await mark(page.locator(`${FIRST_SEGMENT} lib-badge > span`).filter({ hasText: 'total' }));
    },
    highlight: MARK,
    settle: 800,
  },
  {
    file: '11-segments-fila.png',
    app: 'dashboard',
    path: EVENT,
    ready: SEGMENTS,
    prepare: pinyes,
    clip: FIRST_SEGMENT,
    highlight: `${FIRST_SEGMENT} button[aria-label^="Visible als membres"], ${FIRST_SEGMENT} button[aria-label^="Ocult als membres"]`,
  },
  {
    file: '11-segments-cordons.png',
    app: 'dashboard',
    path: EVENT,
    ready: SEGMENTS,
    prepare: pinyes,
    clip: FIRST_SEGMENT,
    highlight: `${FIRST_SEGMENT} div[role="group"][aria-label^="Cordons de "]`,
  },
  {
    file: '11-segments-figura-picker.png',
    app: 'dashboard',
    path: EVENT,
    ready: SEGMENTS,
    prepare: async (page) => {
      await pinyes(page);
      await page.locator(ADD_FIGURE).click();
      const list = page.locator('ul[aria-label="Figures disponibles"]');
      await list.waitFor();
      // Local selection only — «Confirma (N)» is never clicked.
      await list.locator('li:nth-child(1) button').click();
      await list.locator('li:nth-child(2) button').click();
      // Its scroll container clips an outer outline: draw it inside.
      await page.addStyleTag({ content: 'ul[aria-label="Figures seleccionades"] { outline-offset: -3px !important; }' });
    },
    highlight: 'ul[aria-label="Figures seleccionades"]',
    settle: 500,
  },
  {
    file: '11-segments-composicio-picker.png',
    app: 'dashboard',
    path: EVENT,
    ready: SEGMENTS,
    prepare: async (page) => {
      await pinyes(page);
      await page.locator(ADD_FIGURE).click();
      const dialog = page.getByRole('dialog', { name: 'Afegir figures al segment' });
      await dialog.getByRole('tab', { name: 'Composicions', exact: true }).click();
      // Selecting is local; «Aplica «…»» is never clicked.
      await dialog.locator('ul[aria-label="Composicions disponibles"] li:first-child button').click();
      await page.mouse.move(0, 0); // drop the hover state off the selected row
    },
    settle: 800, // the selection and the «Aplica» button fade in
  },
  {
    file: '11-segments-copia.png',
    app: 'dashboard',
    path: EVENT,
    ready: SEGMENTS,
    prepare: async (page) => {
      await pinyes(page);
      await page.locator(`${FIRST_SEGMENT} button[aria-label$=" a un altre segment"]`).first().click();
      await page.getByRole('dialog', { name: 'Copia la figura al segment:' }).waitFor();
    },
  },
  {
    // Needs a segment with conflicts in EVENT_ID; otherwise this shot fails and is listed at the end.
    file: '11-segments-conflictes.png',
    app: 'dashboard',
    path: EVENT,
    ready: SEGMENTS,
    prepare: async (page) => {
      await pinyes(page);
      // Any scroll closes the popover, so scroll first and let it settle before hovering.
      const pill = page.locator('[data-testid="segment-conflict-pill"]').first();
      await pill.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await pill.hover();
      await page.locator('[data-testid="segment-conflict-popover"]').waitFor();
    },
    highlight: '[data-testid="segment-conflict-pill"]',
  },
  {
    file: '11-segments-troncs.png',
    app: 'dashboard',
    path: EVENT,
    ready: SEGMENTS,
    prepare: (page) => view(page, 'Troncs'),
    highlight: `${FIRST_SEGMENT} select[aria-label^="Mode de "]`,
    settle: 1200,
  },
  {
    file: '11-segments-bloquejat.png',
    app: 'dashboard',
    path: LOCKED_EVENT,
    ready: SEGMENTS,
    prepare: async (page) => {
      // The dev API runs with ASSIGNMENT_LOCK_DAYS=200, so no event with segments is locked yet.
      // Answer lock-status as production does (default 2 days: locked once the date is 2+ days
      // past) and reload the event so the page reads it. `times: 1`: later shots see the real API.
      await page.route(
        `**/api/events/${LOCKED_EVENT_ID}/lock-status`,
        (route) => route.fulfill({ json: { locked: true, lockDate: null, lockDays: 2 } }),
        { times: 1 },
      );
      await spaGoto(page, '/home');
      await spaGoto(page, LOCKED_EVENT);
      await page.locator(SEGMENTS).waitFor({ state: 'attached', timeout: 20_000 });
      await pinyes(page);
      await mark(page.locator('lib-badge > span').filter({ hasText: 'Assignacions bloquejades' }));
    },
    highlight: MARK,
    settle: 800,
  },
];
