import { Page } from '@playwright/test';
import { ManualShot } from '../manual-shot';
import { TARGETS } from '../../audit/audit-targets';

// Demo segment: a future, unlocked event with ≥2 figures, some assignments and a template used before
// (so «Importa …» has history). A locked segment disables the import/reset buttons.
const EV = process.env['MANUAL_WS_EVENT_ID'] ?? TARGETS.workspaceEventId;
const SEG = process.env['MANUAL_WS_SEGMENT_ID'] ?? TARGETS.workspaceSegmentId;
const WS = `/pinyes/events/${EV}/segments/${SEG}/assign`;

// A segment where at least one person already holds two places (see the S07 plan for the SQL).
const C_EV = process.env['MANUAL_CONFLICT_EVENT_ID'] ?? EV;
const C_SEG = process.env['MANUAL_CONFLICT_SEGMENT_ID'] ?? SEG;

const IMPORT_TRIGGER = 'button[aria-label="Importa les assignacions d\'una figura anterior"]';
const RESET_TRIGGER = 'button[aria-label^="Reinicialitza una figura"]';

/** With more than one figure, «Selecciona una figura» opens first: pick the first one. */
async function pickFirstFigureIfAsked(page: Page): Promise<void> {
  const picker = page.locator('dialog[open]').filter({ hasText: 'Selecciona una figura' });
  if (await picker.isVisible({ timeout: 1500 }).catch(() => false)) {
    await picker.locator('ul[role="list"] button').first().click();
  }
}

/** Opens «Importa …», selects the first earlier figure with assignments and waits for its preview. Never presses «Importa». */
async function openImportPreview(page: Page): Promise<void> {
  await page.locator(IMPORT_TRIGGER).first().click();
  await pickFirstFigureIfAsked(page);
  const list = page.locator('[role="listbox"][aria-label="Pinyes anteriors"]');
  await list.waitFor();
  await list.locator('button[role="option"]:not([disabled])').first().click();
  await page.waitForTimeout(1500);
}

export const s07: ManualShot[] = [
  // ── 12: workspace + Troncs tab ─────────────────────────────────────────
  {
    file: '12-espai-treball.png',
    app: 'dashboard',
    path: `${WS}?tab=troncs`,
    ready: 'app-troncs-tab [data-figure-card]',
    highlight: 'nav[role="tablist"][aria-label="Vistes del segment"]',
    settle: 800,
  },
  {
    file: '12-troncs-lloc-seleccionat.png',
    app: 'dashboard',
    path: `${WS}?tab=troncs`,
    ready: 'app-troncs-tab .floor-grid .tronc-node',
    // Selects an EMPTY tronc place: the list reorders and «Xicalla» switches on by itself.
    // The assignment state resets on load, so no person is pending to be assigned by this click.
    prepare: async (page) => {
      await page.locator('app-troncs-tab .floor-grid .tronc-node:not(.assigned)').first().click();
      await page.waitForTimeout(1200);
    },
    highlight: 'app-troncs-tab app-person-panel',
  },
  {
    file: '12-panell-persones.png',
    app: 'dashboard',
    path: `${WS}?tab=troncs`,
    ready: '[data-testid="person-panel-counters"]',
    // Expands «Altres» to show «No ve» and «Pendents».
    prepare: async (page) => {
      await page.locator('app-person-panel button').filter({ hasText: /^\s*Altres/ }).first().click();
    },
    clip: 'app-troncs-tab app-person-panel',
  },
  {
    file: '12-troncs-alcades.png',
    app: 'dashboard',
    path: `${WS}?tab=troncs`,
    ready: 'app-troncs-tab .floor-variance',
    highlight: 'app-troncs-tab [data-figure-card]:first-of-type .floor-variance',
    clip: 'app-troncs-tab [data-figure-card]',
  },
  {
    file: '12-troncs-moure.png',
    app: 'dashboard',
    path: `${WS}?tab=troncs`,
    ready: 'app-troncs-tab .floor-grid .tronc-node.assigned',
    // Right-click = start moving. No destination is clicked.
    prepare: async (page) => {
      await page.locator('app-troncs-tab .floor-grid .tronc-node.assigned').first().click({ button: 'right' });
      await page.locator('app-move-banner').waitFor();
    },
    highlight: 'app-move-banner',
  },
  {
    file: '12-importa-tronc.png',
    app: 'dashboard',
    path: `${WS}?tab=troncs`,
    ready: IMPORT_TRIGGER,
    prepare: openImportPreview,
    settle: 800,
  },

  // ── 13: Pinyes tab ─────────────────────────────────────────────────────
  {
    file: '13-pinyes.png',
    app: 'dashboard',
    path: `${WS}?tab=pinyes`,
    ready: 'app-pinyes-tab app-figure-canvas canvas',
    highlight: '[data-testid="person-panel-counters"]',
    settle: 2000,
  },
  {
    file: '13-pinyes-capcalera.png',
    app: 'dashboard',
    path: `${WS}?tab=pinyes`,
    ready: RESET_TRIGGER,
    highlight: RESET_TRIGGER,
    clip: 'app-segment-workspace header',
  },
  {
    file: '13-reinicialitza.png',
    app: 'dashboard',
    path: `${WS}?tab=pinyes`,
    ready: RESET_TRIGGER,
    // Only opens the confirmation. «Elimina-ho tot» is NEVER pressed.
    prepare: async (page) => {
      await page.locator(RESET_TRIGGER).first().click();
      await pickFirstFigureIfAsked(page);
      await page.locator('dialog[open]').filter({ hasText: 'Elimina-ho tot' }).waitFor();
    },
  },
  {
    file: '13-importa-pinya.png',
    app: 'dashboard',
    path: `${WS}?tab=pinyes`,
    ready: IMPORT_TRIGGER,
    prepare: openImportPreview,
    settle: 800,
  },

  // ── 14: conflicts ──────────────────────────────────────────────────────
  {
    file: '14-conflictes-llista-segments.png',
    app: 'dashboard',
    path: `/events/${C_EV}?tab=pinyes`,
    ready: '[data-testid="segment-conflict-pill"]',
    prepare: async (page) => {
      await page.getByTestId('segment-conflict-pill').first().hover();
      await page.getByTestId('segment-conflict-popover').waitFor();
    },
    highlight: '[data-testid="segment-conflict-popover"]',
  },
  {
    file: '14-panell-conflictes.png',
    app: 'dashboard',
    path: `/pinyes/events/${C_EV}/segments/${C_SEG}/assign?tab=pinyes`,
    ready: 'app-segment-conflict-panel >> text=en conflicte',
    prepare: async (page) => {
      await page.getByRole('button', { name: 'Mostra', exact: true }).click();
      await page.locator('#segment-conflict-panel-body').waitFor();
    },
    highlight: '#segment-conflict-panel-body',
    settle: 1500,
  },
  {
    file: '14-participacio-conflictes.png',
    app: 'dashboard',
    path: `/events/${C_EV}?tab=participacio`,
    ready: '[data-testid="participation-conflict-counter"]',
    // Switches on «Només conflictes» (a filter, no data change).
    prepare: async (page) => {
      await page.getByTestId('participation-conflict-counter').click();
    },
    highlight: '[data-testid="participation-conflict-counter"]',
  },
];
