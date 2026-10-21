import { Page } from '@playwright/test';
import { ManualShot } from '../manual-shot';
import { TARGETS } from '../../audit/audit-targets';

/**
 * Dev-DB persons in each account state. Pick them with the SQL in the S02 plan (Task A, step 1)
 * and pass them as env vars; the fallback only guarantees the route loads.
 */
const PERSON = {
  detail: TARGETS.personId, // "PERSIANA"
  history: process.env['MANUAL_PERSON_HISTORY_ID'] || TARGETS.personId,
  pendingAccount: process.env['MANUAL_PERSON_PENDING_ID'] || TARGETS.personId,
  xicallaNoGuardian: process.env['MANUAL_PERSON_XICALLA_ID'] || TARGETS.personId,
  xicallaWithGuardian: process.env['MANUAL_PERSON_XICALLA_GUARDIAN_ID'] || TARGETS.personId,
};

/** The persons table holds real rows once its row links exist (skeleton rows have none). */
const LIST_READY = 'app-data-table tbody a[href^="/persons/"]';
/** "Nom complet" is the 2nd default column of the persons table. */
const LIST_MASK = ['app-data-table tbody td:nth-child(2)'];

const INFO_PERSONAL = 'lib-card[title="Informació personal"]';
const INFO_COLLA = 'lib-card[title="Informació de la colla"]';
const DETAIL_READY = `${INFO_PERSONAL} dl`;
/** Everything personal on the person detail page in read mode. */
const DETAIL_MASK = [
  'div.flex-1 > p.text-xs', // full name under the alias in the header
  `${INFO_PERSONAL} dd`, // name, surnames, gender, e-mail, phone, birth date, height
  `${INFO_COLLA} dd.whitespace-pre-wrap`, // Observacions tècniques (may be health-related)
  `${INFO_COLLA} dl.border-t dd`, // responsible/delegate e-mails when they have no alias
];
/** Same, with the sheet in edit mode. */
const EDIT_MASK = [
  'div.flex-1 > p.text-xs',
  `${INFO_PERSONAL} input`,
  `${INFO_PERSONAL} select`,
  `${INFO_COLLA} input[aria-label="Observació"]`,
  `${INFO_COLLA} dl.border-t dd`,
];

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
    mask: LIST_MASK,
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
    },
    highlight: '[data-testid="lib-select-multi"] li[role="option"]:has-text("Falten etiquetes")',
    mask: LIST_MASK,
  },
  {
    file: '03-persones-provisionals.png',
    app: 'dashboard',
    path: '/persons',
    ready: LIST_READY,
    prepare: async (page) => {
      await page.getByRole('button', { name: 'Provisionals' }).click();
      await page.waitForLoadState('networkidle');
    },
    highlight: 'lib-button-group > *', // Cens / Provisionals
    mask: LIST_MASK,
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
    mask: LIST_MASK, // the table stays visible behind the modal backdrop
  },
  {
    file: '03-persona-fitxa.png',
    app: 'dashboard',
    path: `/persons/${PERSON.detail}`,
    ready: DETAIL_READY,
    mask: DETAIL_MASK,
    settle: 800, // delegates and history load after the person
  },
  {
    file: '03-persona-edicio.png',
    app: 'dashboard',
    path: `/persons/${PERSON.detail}`,
    ready: DETAIL_READY,
    prepare: startEditing, // never clicks «Alça»
    highlight: `${INFO_COLLA} [data-tag-group]`,
    mask: EDIT_MASK,
  },
  {
    file: '03-persona-compte-pendent.png',
    app: 'dashboard',
    path: `/persons/${PERSON.pendingAccount}`,
    ready: DETAIL_READY,
    highlight: `${INFO_COLLA} button:has-text("Crea enllaç d'invitació")`,
    mask: DETAIL_MASK,
    clip: `${INFO_COLLA} > *`,
    settle: 800,
  },
  {
    file: '03-persona-xicalla-sense-responsable.png',
    app: 'dashboard',
    path: `/persons/${PERSON.xicallaNoGuardian}`,
    ready: DETAIL_READY,
    highlight: `${INFO_COLLA} button:has-text("Defineix adult responsable")`,
    mask: DETAIL_MASK,
    clip: `${INFO_COLLA} > *`,
    settle: 800,
  },
  {
    file: '03-persona-xicalla-responsable.png',
    app: 'dashboard',
    path: `/persons/${PERSON.xicallaWithGuardian}`,
    ready: DETAIL_READY,
    highlight: `${INFO_COLLA} dl.border-t`,
    mask: DETAIL_MASK,
    clip: `${INFO_COLLA} > *`,
    settle: 800,
  },
  {
    file: '03-persona-delegat.png',
    app: 'dashboard',
    path: `/persons/${PERSON.detail}`,
    ready: DETAIL_READY,
    prepare: async (page) => {
      await startEditing(page);
      await page.getByRole('button', { name: '+ Afegeix' }).click();
      await page.locator('dialog[open]').waitFor();
    },
    mask: [
      ...EDIT_MASK,
      'dialog[open] [role="listbox"] button > div:first-child', // alias + e-mail of each user
    ],
    settle: 800, // the user list is debounced
  },
  {
    file: '03-persona-historial.png',
    app: 'dashboard',
    path: `/persons/${PERSON.history}`,
    ready: DETAIL_READY,
    clip: 'div.collapse:has-text("Historial de pinyes")',
    settle: 1000,
  },
];
