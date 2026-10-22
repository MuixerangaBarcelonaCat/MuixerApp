import type { Page } from '@playwright/test';
import type { ManualShot } from '../manual-shot';
import { spaGoto } from '../../audit/audit-core';

// Dev-DB events (TARGETS ones are stale). An upcoming assaig shows the «Ve»/«No ve» buttons;
// the actuació has «Colles» filled in; the notes event has notes written.
const ASSAIG = `/events/${process.env['MANUAL_ASSAIG_ID'] || '3ca87ae1-4f3c-44d1-b7bf-cf568ee560e4'}`;
const ACTUACIO = `/events/${process.env['MANUAL_ACTUACIO_ID'] || 'ba08ad28-3f49-43df-8879-f6dd0201bfa6'}`;
const NOTES = `/events/${process.env['MANUAL_NOTES_EVENT_ID'] || 'b5b4ae12-5662-4fb2-8489-2d8babba1d6a'}`;
const LIST_READY = 'app-data-table tbody tr';

/**
 * Opens an event detail from scratch. The detail component is reused (and keeps the previous
 * event and tab) when the router goes from one event to another, so pass through /home first.
 * The «Notes» panel remembers whether it was open (localStorage); set it explicitly.
 */
const freshEvent =
  (url: string, ready: string, notesOpen = false) =>
  async (page: Page): Promise<void> => {
    await page.evaluate((open) => localStorage.setItem('muixer_event_notes_expanded', String(open)), notesOpen);
    await spaGoto(page, '/home');
    await spaGoto(page, url);
    await page.locator(ready).first().waitFor({ state: 'attached' });
  };

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
      // The checkbox sits just below the modal body's fold; scroll the body to its end (the date stays visible).
      await dialog.locator('form').evaluate((form) => {
        form.style.paddingBottom = '8px'; // room for the red outline, or the scroller clips it
        for (let el: HTMLElement | null = form; el; el = el.parentElement) {
          if (el.scrollHeight > el.clientHeight + 1) return void (el.scrollTop = el.scrollHeight);
        }
      });
    },
    highlight: 'dialog[open] lib-checkbox:has-text("Compta per a estadístiques")',
    clip: 'dialog[open] .modal-box',
  },
  {
    file: '07-detall-resum.png',
    app: 'dashboard',
    path: `${ASSAIG}?tab=resum`,
    prepare: freshEvent(`${ASSAIG}?tab=resum`, '#event-tabpanel-resum lib-card'),
    highlight: '[data-testid="event-print"]',
    settle: 600,
  },
  {
    file: '07-detall-actuacio.png',
    app: 'dashboard',
    path: `${ACTUACIO}?tab=resum`,
    prepare: freshEvent(`${ACTUACIO}?tab=resum`, '#event-tabpanel-resum lib-card'),
    settle: 600,
  },
  {
    file: '07-notes.png',
    app: 'dashboard',
    path: `${NOTES}?tab=resum`,
    prepare: freshEvent(`${NOTES}?tab=resum`, '#event-notes-body lib-markdown-editor .ProseMirror', true),
    clip: 'app-event-notes-panel',
    settle: 800,
  },
  {
    // The phase (before / day / after) depends on the event date: buttons only show up to the event day.
    file: '07-assistencia.png',
    app: 'dashboard',
    path: `${ASSAIG}?tab=assistencia`,
    prepare: freshEvent(`${ASSAIG}?tab=assistencia`, 'app-attendance-list [data-testid="attendance-status"]'),
    highlight: 'app-attendance-list tbody tr:first-child [data-testid="attendance-status"]',
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
