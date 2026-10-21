import { Page } from '@playwright/test';
import { ManualShot } from '../manual-shot';
import { TARGETS } from '../../audit/audit-targets';

const ws = `/events/${TARGETS.workspaceEventId}`;
const projection = `${ws}/segments/${TARGETS.workspaceSegmentId}`;
const assaig = `/events/${TARGETS.eventAssaigId}`;

/** Clicks «Ara no» on the PWA push banner if it is showing (writes localStorage only). */
async function dismissPushBanner(page: Page): Promise<void> {
  const later = page.getByRole('button', { name: 'No activar ara' });
  if (await later.isVisible().catch(() => false)) await later.click();
}

// `ready` waits for a *visible* first match, so it never targets a display:contents host
// (lib-card, lib-button): those use `> *` or a real inner element instead.
export const s09: ManualShot[] = [
  // ── 18 · Comunicació (Dashboard) ──────────────────────────────────────────
  {
    file: '18-comunicacio-centre.png',
    app: 'dashboard',
    path: '/communication',
    ready: 'lib-card[title="Notificacions"] > *',
  },
  {
    file: '18-comunicacio-noticia-nova.png',
    app: 'dashboard',
    path: '/communication/news/new',
    ready: 'div[role="group"][aria-label="Quan es publica la notícia"]',
    prepare: (page) => page.getByRole('button', { name: 'Programa', exact: true }).click(),
    highlight: 'div[role="group"][aria-label="Quan es publica la notícia"]',
    settle: 800, // Tiptap editor is @defer'd
  },
  {
    file: '18-comunicacio-noticia-avis.png',
    app: 'dashboard',
    path: '/communication/news/new',
    ready: '.form-control:has(input#send-push)',
    highlight: '.form-control:has(input#send-push)',
    settle: 800,
  },
  {
    file: '18-comunicacio-noticies.png',
    app: 'dashboard',
    path: '/communication/news',
    ready: 'table',
  },
  {
    file: '18-comunicacio-envia.png',
    app: 'dashboard',
    path: '/communication/notifications',
    ready: 'select#linked-event-kind',
    prepare: async (page) => {
      await page.selectOption('select#linked-event-kind', 'NEXT_ASSAIG');
      await page.getByRole('button', { name: 'Segons assistència' }).click();
    },
    highlight: 'div[role="group"][aria-label="Tipus de destinataris"]',
  },
  {
    file: '18-comunicacio-enllac.png',
    app: 'dashboard',
    path: '/communication/notifications',
    ready: 'div[role="group"][aria-label="Enllaç de la notificació"]',
    highlight: 'div[role="group"][aria-label="Enllaç de la notificació"]',
  },
  {
    file: '18-comunicacio-programa.png',
    app: 'dashboard',
    path: '/communication/notifications/schedules/new',
    ready: 'div[role="group"][aria-label="Tipus de programació"]',
    prepare: (page) => page.getByRole('button', { name: "Abans d'un esdeveniment" }).click(),
    highlight: 'div[role="group"][aria-label="Tipus de programació"]',
  },
  {
    file: '18-comunicacio-programades.png',
    app: 'dashboard',
    path: '/communication/notifications/schedules',
    ready: 'app-page-header h1',
  },
  {
    file: '18-comunicacio-historial.png',
    app: 'dashboard',
    path: '/communication/notifications/history',
    ready: 'app-page-header h1',
  },
  {
    file: '18-comunicacio-dispositius.png',
    app: 'dashboard',
    path: '/communication/notifications/devices',
    ready: 'app-page-header h1',
    mask: ['table tbody td:first-child'], // full first name + surname
  },

  // ── 19 · PWA, compte tècnic ───────────────────────────────────────────────
  {
    file: '19-pwa-avis-notificacions.png',
    app: 'pwa',
    path: '/home',
    ready: 'div.fixed[role="alert"]',
    highlight: 'div.fixed[role="alert"]',
  },
  {
    file: '19-pwa-inici.png',
    app: 'pwa',
    path: '/home',
    ready: 'section h2',
    prepare: dismissPushBanner,
    settle: 500,
  },
  {
    file: '19-pwa-agenda.png',
    app: 'pwa',
    path: '/events',
    ready: '[role="article"]',
    prepare: dismissPushBanner,
    highlight: 'app-event-card div.items-end.shrink-0', // Vaig / No vaig of the first card
  },
  {
    file: '19-pwa-agenda-calendari.png',
    app: 'pwa',
    path: '/events',
    ready: 'button[aria-label="Mostra el calendari"]',
    prepare: async (page) => {
      await dismissPushBanner(page);
      await page.click('button[aria-label="Mostra el calendari"]');
      await page.waitForSelector('[data-testid="calendar-legend"]');
    },
    highlight: '[data-testid="calendar-legend"]',
  },
  {
    file: '19-pwa-detall-tecnic.png',
    app: 'pwa',
    path: assaig,
    ready: '[data-testid="attendance-stats-box"] > *',
    prepare: dismissPushBanner,
    highlight: '[data-testid="attendance-stats-box"] > *',
  },
  {
    file: '19-pwa-detall-segments.png',
    app: 'pwa',
    path: ws,
    ready: '.segments-section',
    prepare: dismissPushBanner,
    highlight: '.segments-section',
  },
  {
    file: '19-pwa-projeccio.png',
    app: 'pwa',
    path: projection,
    ready: 'lib-pinya-projection canvas',
    settle: 2000, // camera flies to the caller's placement
  },
  {
    file: '19-pwa-projeccio-cerca.png',
    app: 'pwa',
    path: projection,
    ready: 'button[aria-label="Cerca una persona"]',
    prepare: async (page) => {
      await page.click('button[aria-label="Cerca una persona"]');
      await page.waitForSelector('[data-testid="participant-filter"]');
    },
    settle: 500,
  },
  {
    file: '19-pwa-passa-llista.png',
    app: 'pwa',
    path: `${assaig}/roll-call`,
    ready: '[data-testid="roll-call-filters"]',
    prepare: dismissPushBanner,
    highlight: '[data-testid="roll-call-filters"]',
    settle: 500,
  },
  {
    file: '19-pwa-passa-llista-provisional.png',
    app: 'pwa',
    path: `${assaig}/roll-call`,
    ready: '[data-testid="roll-call-add-person"] button',
    prepare: async (page) => {
      await dismissPushBanner(page);
      await page.click('[data-testid="roll-call-add-person"] button'); // opens the form only
    },
    highlight: 'div.card.bg-base-200',
  },
  {
    file: '19-pwa-perfil.png',
    app: 'pwa',
    path: '/profile',
    ready: '[data-testid="profile-stat-tile"] > *',
    prepare: dismissPushBanner,
    highlight: 'div.grid.grid-cols-3',
    mask: ['section h2 + p'], // name + first surname under the alias
  },
  {
    file: '19-pwa-delegacions.png',
    app: 'pwa',
    path: '/profile',
    ready: '[data-testid="profile-stat-tile"] > *',
    prepare: async (page) => {
      await dismissPushBanner(page);
      await page.getByRole('button', { name: /delegaci/ }).click();
      await page.waitForSelector('#add-delegate-form');
    },
    mask: ['dialog li .truncate'], // delegate alias, or email when it has no person
  },
  {
    file: '19-pwa-configuracio.png',
    app: 'pwa',
    path: '/profile/settings',
    ready: '[data-testid="appearance-row"]',
    prepare: dismissPushBanner,
    highlight: '[data-testid="notifications-row"] > div',
  },

  // ── 19 · PWA, compte de membre (només amb E2E_MEMBER_EMAIL/PASSWORD) ───────
  {
    file: '19-pwa-membre-agenda.png',
    app: 'pwa-member',
    path: '/events',
    ready: '[role="article"]',
    prepare: dismissPushBanner,
  },
  {
    file: '19-pwa-membre-detall.png',
    app: 'pwa-member',
    path: assaig,
    ready: '[role="article"]',
    prepare: dismissPushBanner,
  },
];
