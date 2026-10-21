import type { ManualShot } from '../manual-shot';
import { TARGETS } from '../../audit/audit-targets';

const ASSAIG = `/events/${TARGETS.eventAssaigId}`;
const ACTUACIO = `/events/${TARGETS.eventActuacioId}`;
const LIST_READY = 'app-data-table tbody tr';
// «Nom» column of the attendance list (name + first surname).
const ATTENDANCE_NAME = 'app-attendance-list tbody td:nth-child(2)';

/** Page 07 (Assajos i actuacions). */
export const s04: ManualShot[] = [
  {
    file: '07-assajos-llista.png',
    app: 'dashboard',
    path: '/rehearsals',
    ready: LIST_READY,
    highlight: 'app-event-list button:has-text("Assaig nou")',
    settle: 600,
  },
  {
    file: '07-llista-accions.png',
    app: 'dashboard',
    path: '/rehearsals',
    ready: LIST_READY,
    prepare: async (page) => {
      await page.getByRole('button', { name: 'Accions' }).first().click();
      await page.getByRole('menu').waitFor();
    },
    highlight: '[role="menu"]',
  },
  {
    file: '07-columnes-visibles.png',
    app: 'dashboard',
    path: '/performances',
    ready: LIST_READY,
    prepare: async (page) => {
      await page.locator('app-column-toggle .collapse > input[type="checkbox"]').click();
    },
    clip: 'app-column-toggle',
    settle: 400,
  },
  {
    file: '07-event-nou.png',
    app: 'dashboard',
    path: '/rehearsals',
    ready: LIST_READY,
    prepare: async (page) => {
      await page.getByRole('button', { name: 'Assaig nou' }).click();
      const dialog = page.getByRole('dialog', { name: 'Assaig nou' });
      await dialog.waitFor();
      // Today's date so the «Temporada: …» hint shows under the field.
      await dialog.locator('input[type="date"]').fill(new Date().toISOString().slice(0, 10));
    },
    highlight: 'dialog[open] lib-checkbox:has-text("Compta per a estadístiques")',
    clip: 'dialog[open] .modal-box',
  },
  {
    file: '07-detall-resum.png',
    app: 'dashboard',
    path: `${ASSAIG}?tab=resum`,
    ready: '#event-tabpanel-resum lib-card',
    highlight: '[data-testid="event-print"]',
    settle: 600,
  },
  {
    file: '07-detall-actuacio.png',
    app: 'dashboard',
    path: `${ACTUACIO}?tab=resum`,
    ready: '#event-tabpanel-resum lib-card',
    settle: 600,
  },
  {
    file: '07-notes.png',
    app: 'dashboard',
    path: `${ASSAIG}?tab=resum`,
    ready: '[data-testid="event-notes-toggle"]',
    prepare: async (page) => {
      await page.locator('[data-testid="event-notes-toggle"] button, button[data-testid="event-notes-toggle"]').first().click();
      await page.locator('#event-notes-body lib-markdown-editor').waitFor();
    },
    clip: 'app-event-notes-panel',
    settle: 800,
  },
  {
    // The phase (before / day / after) depends on the event date: buttons only show up to the event day.
    file: '07-assistencia.png',
    app: 'dashboard',
    path: `${ASSAIG}?tab=assistencia`,
    ready: 'app-attendance-list [data-testid="attendance-status"]',
    highlight: 'app-attendance-list tbody tr:first-child [data-testid="attendance-status"]',
    mask: [ATTENDANCE_NAME],
  },
  {
    // Nothing typed: the results column stays empty and shows no names.
    file: '07-confirmacio.png',
    app: 'dashboard',
    path: `${ASSAIG}/confirmation`,
    ready: 'app-attendance-confirmation lib-button',
    settle: 400,
  },
];
