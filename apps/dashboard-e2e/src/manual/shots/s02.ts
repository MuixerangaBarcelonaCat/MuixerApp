import { Page } from '@playwright/test';
import { ManualShot } from '../manual-shot';

/**
 * Dev-DB persons in each account state. Pick them with the SQL in the S02 plan (Task A, step 1)
 * and pass them as env vars; the fallback only guarantees the route loads.
 */
const PERSON = {
  detail: process.env['MANUAL_PERSON_DETAIL_ID'] || 'f964b0dd-6396-4ec6-991e-12f99494da66', // "PERSIANA"
  history: process.env['MANUAL_PERSON_HISTORY_ID'] || '56319de5-c29a-44f8-a0d7-68114573a21f',
  pendingAccount: process.env['MANUAL_PERSON_PENDING_ID'] || 'bbd6f0b4-fc04-4156-923a-e9769a7f909b',
  xicallaNoGuardian: process.env['MANUAL_PERSON_XICALLA_ID'] || '8561b7a6-2dd3-48da-871b-0a543737875b',
  xicallaWithGuardian: process.env['MANUAL_PERSON_XICALLA_GUARDIAN_ID'] || '9abaed2c-f5e6-4cfa-9ee0-a073d3c4798d',
};

/** The persons table holds real rows once its row links exist (skeleton rows have none). */
const LIST_READY = 'app-data-table tbody a[href^="/persons/"]';

const INFO_PERSONAL = 'lib-card[title="Informació personal"]';
const INFO_COLLA = 'lib-card[title="Informació de la colla"]';
const DETAIL_READY = `${INFO_PERSONAL} dl`;
/** Every personal field of the sheet in edit mode except the alias. */
const PERSONAL_INPUTS = `${INFO_PERSONAL} lib-input:not([formcontrolname="alias"]) input`;
const SHIRT_READY = '[data-testid^="shirt-row-"]';
/** «Nom complet» and «Telèfon» columns of the persons table. */
const LIST_PERSONAL = 'app-data-table td[data-col="fullName"], app-data-table td[data-col="phone"]';
async function startEditing(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Edita' }).click();
  await page.locator(`${INFO_PERSONAL} input`).first().waitFor();
}

/** S02 · 02-dades-app-antiga + 03-persones. Never clicks Inicia / Crea / Alça / Afegeix. */
export const s02: ManualShot[] = [
  // ── 02-dades-app-antiga ──────────────────────────────────────────
  {
    file: '02-inici-avis-sincronitzacio.png',
    app: 'dashboard',
    path: '/home',
    ready: 'lib-card[tone="warning"] > *',
    clip: 'lib-card[tone="warning"] > *', // lib-card is display:contents
  },
  {
    file: '02-sincronitzacio-global.png',
    app: 'dashboard',
    path: '/sync',
    ready: 'lib-card[title="Sincronitza persones"] > *',
    highlight: 'lib-card[title="Sincronitza persones"] > *',
  },
  {
    file: '02-sincronitzacio-persones.png',
    app: 'dashboard',
    path: '/persons/sync-start',
    ready: 'button:has-text("Inicia")',
    highlight: 'button:has-text("Inicia")', // never clicked: it would really import
  },
  {
    file: '02-sincronitzacio-events.png',
    app: 'dashboard',
    path: '/rehearsals/sync',
    ready: 'button:has-text("Inicia")',
  },

  // ── 03-persones ──────────────────────────────────────────────────
  {
    file: '03-persones-llista.png',
    app: 'dashboard',
    path: '/persons',
    ready: LIST_READY,
    blur: [LIST_PERSONAL],
    settle: 500,
  },
  {
    file: '03-persones-falten-etiquetes.png',
    app: 'dashboard',
    path: '/persons',
    ready: LIST_READY,
    prepare: async (page) => {
      await page.locator('lib-select[label="Etiquetes"] [data-testid="lib-select-multi-trigger"]').click();
      await page.locator('[data-testid="lib-select-multi"] [role="listbox"]').waitFor();
      await page
        .locator('[data-testid="lib-select-multi"] li[role="option"]:has-text("Falten etiquetes")')
        .scrollIntoViewIfNeeded();
    },
    highlight: '[data-testid="lib-select-multi"] li[role="option"]:has-text("Falten etiquetes")',
    blur: [LIST_PERSONAL],
  },
  {
    file: '03-persones-provisionals.png',
    app: 'dashboard',
    path: '/persons',
    ready: LIST_READY,
    prepare: async (page) => {
      const list = page.waitForResponse((r) => r.url().includes('/api/persons'));
      await page.getByRole('button', { name: 'Provisionals' }).click();
      await list;
    },
    highlight: 'lib-button-group > *', // Cens / Provisionals
    blur: [LIST_PERSONAL],
    settle: 500,
  },
  {
    file: '03-persona-nova.png',
    app: 'dashboard',
    path: '/persons',
    ready: LIST_READY,
    prepare: async (page) => {
      await page.getByRole('button', { name: 'Persona nova' }).click();
      await page.locator('dialog[open]').waitFor();
    },
    blur: [LIST_PERSONAL],
  },
  {
    file: '03-persona-fitxa.png',
    app: 'dashboard',
    path: `/persons/${PERSON.history}`, // a filled-in sheet with pinyes history
    ready: DETAIL_READY,
    // Full name under the alias title and every personal field except the alias (the bold one).
    blur: ['div.flex-1:has(> div > h1) > p', `${INFO_PERSONAL} dd:not(.font-medium)`],
    settle: 800, // delegates and history load after the person
  },
  {
    file: '03-persona-compte-pendent.png',
    app: 'dashboard',
    path: `/persons/${PERSON.pendingAccount}`,
    ready: DETAIL_READY,
    highlight: `${INFO_COLLA} button:has-text("Crea enllaç d'invitació")`,
    clip: `${INFO_COLLA} > *`,
    settle: 800,
  },
  {
    file: '03-persona-xicalla-sense-responsable.png',
    app: 'dashboard',
    path: `/persons/${PERSON.xicallaNoGuardian}`,
    ready: DETAIL_READY,
    highlight: `${INFO_COLLA} button:has-text("Defineix adult responsable")`,
    clip: `${INFO_COLLA} > *`,
    settle: 800,
  },
  {
    file: '03-persona-xicalla-responsable.png',
    app: 'dashboard',
    path: `/persons/${PERSON.xicallaWithGuardian}`,
    ready: DETAIL_READY,
    highlight: `${INFO_COLLA} dl.border-t`,
    clip: `${INFO_COLLA} > *`,
    settle: 800,
  },
  {
    file: '03-persona-historial.png',
    app: 'dashboard',
    path: `/persons/${PERSON.history}`,
    ready: DETAIL_READY,
    prepare: async (page) => {
      // The full history is taller than the scrolling main area and comes out half blank; keep 10 rows.
      await page.addStyleTag({ content: 'div.collapse tbody tr:nth-child(n+11) { display: none; }' });
      await page.locator('div.collapse:has-text("Historial de pinyes")').evaluate((el) => el.scrollIntoView({ block: 'end' }));
      await page.mouse.move(0, 0); // no hovered row
    },
    clip: 'div.collapse:has-text("Historial de pinyes")',
    settle: 1000,
  },
  {
    file: '03-persones-camises.png',
    app: 'dashboard',
    path: '/persons/camises',
    ready: SHIRT_READY,
    blur: [`${SHIRT_READY} p.truncate`], // full name under the alias
    settle: 500,
  },
  {
    // Someone still «En curs», so the dialog shows the missing-requirements warning. Never clicks «Lliura».
    file: '03-persones-camisa-lliurament.png',
    app: 'dashboard',
    path: '/persons/camises',
    ready: SHIRT_READY,
    prepare: async (page) => {
      await page.locator('[data-testid="shirt-in-progress"] button:has-text("Lliura la camisa")').first().click();
      await page.locator('dialog[open]').waitFor();
    },
    clip: 'dialog[open] .modal-box',
    settle: 500,
  },
  // Edit mode survives a navigation to another person (same component), so these go last.
  {
    file: '03-persona-edicio.png',
    app: 'dashboard',
    path: `/persons/${PERSON.detail}`,
    ready: DETAIL_READY,
    prepare: startEditing, // never clicks «Alça»
    highlight: `${INFO_COLLA} [data-tag-group]`,
    blur: [PERSONAL_INPUTS],
  },
  {
    file: '03-persona-delegat.png',
    app: 'dashboard',
    path: `/persons/${PERSON.detail}`,
    ready: DETAIL_READY,
    prepare: async (page) => {
      await startEditing(page);
      await page.getByRole('button', { name: '+ Afegeix' }).click();
      await page.locator('dialog[open] [role="listbox"] li').first().waitFor();
      // Keep only the 4 rows the list shows.
      await page.addStyleTag({ content: 'dialog[open] [role="listbox"] li:nth-child(n+5) { display: none; }' });
    },
    blur: ['dialog[open] [role="listbox"] li span.opacity-70, dialog[open] [role="listbox"] li span.text-sm:not(.font-medium)'], // emails; the alias line stays
    clip: 'dialog[open] .modal-box', // the sheet behind is the same as 03-persona-edicio
    settle: 800, // the user list is debounced
  },
];
