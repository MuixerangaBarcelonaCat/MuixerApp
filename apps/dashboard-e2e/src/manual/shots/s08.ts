import { ManualShot } from '../manual-shot';
import { TARGETS } from '../../audit/audit-targets';

// Same demo segment as S07 (future, unlocked). Its first figure must be Completa or Peu,
// otherwise the Pinya presets of «Nodes extra» are disabled.
const EV = process.env['MANUAL_WS_EVENT_ID'] ?? TARGETS.workspaceEventId;
const SEG = process.env['MANUAL_WS_SEGMENT_ID'] ?? TARGETS.workspaceSegmentId;
const WS = `/pinyes/events/${EV}/segments/${SEG}/assign`;

// A past ASSAIG with several assigned segments and an ACTUACIO later in the same season
// (so the «Pròxima actuació» column shows).
const PART_EV = process.env['MANUAL_PARTICIPATION_EVENT_ID'] ?? TARGETS.eventAssaigId;

const PROPS = 'aside[aria-label="Propietats de la figura"]';
const NODES_ASIDE = 'aside[aria-label="Nodes i propietats"]';
const OPTIMIZE = 'button[aria-label="Esborra la distribució i torna al disseny automàtic"]';
const PROJECTION_NAV = 'nav[aria-label="Navegació de la projecció"]';

// Never: drag figures, press «Optimitza distribució», change mode/cordons/«Cordons oberts»
// («Completa», «Peu» and «+» apply at once), or click the canvas in placement mode.
export const s08: ManualShot[] = [
  // ── 15: Distribució ─────────────────────────────────────────────────────
  {
    file: '15-distribucio.png',
    app: 'dashboard',
    path: `${WS}?tab=distribucio`,
    ready: 'app-distribucio-tab app-figure-canvas canvas',
    highlight: PROPS,
    settle: 2500,
  },
  {
    file: '15-propietats-figura.png',
    app: 'dashboard',
    path: `${WS}?tab=distribucio`,
    ready: PROPS,
    clip: PROPS,
    settle: 1500,
  },
  {
    file: '15-optimitza.png',
    app: 'dashboard',
    path: `${WS}?tab=distribucio`,
    ready: OPTIMIZE,
    highlight: OPTIMIZE,
    settle: 2500,
  },

  // ── 15: Nodes extra ─────────────────────────────────────────────────────
  {
    file: '15-nodes-extra.png',
    app: 'dashboard',
    path: `${WS}?tab=nodes`,
    ready: NODES_ASIDE,
    highlight: NODES_ASIDE,
    settle: 2000,
  },
  {
    file: '15-nodes-extra-col-locacio.png',
    app: 'dashboard',
    path: `${WS}?tab=nodes`,
    ready: `${NODES_ASIDE} button:has-text("MANS"):not([disabled])`,
    // Enters placement mode only. The canvas is NOT clicked.
    prepare: async (page) => {
      await page.locator(`${NODES_ASIDE} button:has-text("MANS")`).first().click();
      await page.getByText('Mode col·locació:').waitFor();
    },
    highlight: '.alert-info[role="status"]',
    settle: 1000,
  },

  // ── 16: Previsualitza i Projecta ────────────────────────────────────────
  {
    file: '16-previsualitza.png',
    app: 'dashboard',
    path: `${WS}?tab=previsualitza`,
    ready: 'app-previsualitza-tab lib-pinya-projection canvas',
    highlight: 'nav[role="tablist"][aria-label="Vistes del segment"]',
    settle: 2500,
  },
  {
    file: '16-projeccio.png',
    app: 'dashboard',
    path: `/pinyes/events/${EV}/segments/${SEG}/project`,
    ready: PROJECTION_NAV,
    // Keeps the bottom bar visible (it hides after 3 s without mouse movement).
    prepare: async (page) => {
      await page.mouse.move(640, 400);
    },
    highlight: PROJECTION_NAV,
    settle: 1500,
  },
  {
    file: '16-projeccio-dreceres.png',
    app: 'dashboard',
    path: `/pinyes/events/${EV}/segments/${SEG}/project`,
    ready: PROJECTION_NAV,
    prepare: async (page) => {
      await page.mouse.move(640, 400);
      await page.locator(`${PROJECTION_NAV} button[aria-label="Ajuda de dreceres de teclat"]`).click();
      await page.locator('dialog.modal-open .modal-box').waitFor();
    },
    highlight: 'dialog.modal-open .modal-box',
  },

  // ── 17: Participació ────────────────────────────────────────────────────
  {
    file: '17-participacio.png',
    app: 'dashboard',
    path: `/events/${PART_EV}?tab=participacio`,
    ready: 'app-event-participation app-data-table',
    highlight: 'app-event-participation span:has-text("Càrrega:")',
    settle: 1000,
  },
  {
    file: '17-participacio-filtres.png',
    app: 'dashboard',
    path: `/events/${PART_EV}?tab=participacio`,
    ready: '[data-testid="participation-area-filter"]',
    clip: 'app-event-participation app-filter-bar',
  },
  {
    file: '17-participacio-troncs.png',
    app: 'dashboard',
    path: `/events/${PART_EV}?tab=participacio`,
    ready: '[data-testid="participation-area-filter"] select',
    // «Només troncs» filter (no data change).
    prepare: async (page) => {
      await page.locator('[data-testid="participation-area-filter"] select').selectOption('TRONC');
      await page.waitForTimeout(500);
    },
    highlight: '[data-testid="participation-area-filter"] select',
  },
];
