import type { Page } from '@playwright/test';
import type { ManualShot } from '../manual-shot';
import { TARGETS } from '../../audit/audit-targets';

const TAGS_READY = 'app-tags-list tbody tr td.font-medium';
const USERS_READY = 'app-data-table tbody tr';
// Users table: «Correu» and «Persona» (alias + name + surname) are personal data.

const openTagEdit = async (page: Page, name: string) => {
  await page.getByRole('button', { name: `Edita ${name}` }).click();
  await page.locator('dialog[open]').waitFor();
};

/** Pages 04 (Etiquetes), 05 (Temporades) and 06 (Usuaris i accés). */
export const s03: ManualShot[] = [
  // ── 04 Etiquetes ─────────────────────────────────────────────
  {
    file: '04-etiquetes-llista.png',
    app: 'dashboard',
    path: '/config/tags',
    ready: TAGS_READY,
    prepare: async (page) => {
      await page.mouse.move(0, 0); // the pointer is left over a row's «Elimina» by the previous shot
    },
    highlight: 'app-tags-list button:has-text("Etiqueta persones")',
  },
  {
    // A pinya tag's form with the «Pinya» group of «Posicions de figura» expanded.
    file: '04-etiqueta-posicions.png',
    app: 'dashboard',
    path: '/config/tags',
    ready: TAGS_READY,
    prepare: async (page) => {
      await openTagEdit(page, '1es Mans');
      await page.locator('dialog[open] details summary').first().click();
    },
    highlight: 'dialog[open] .form-control:has-text("Posicions de figura")',
    clip: 'dialog[open] .modal-box',
  },
  {
    // «Tothom» mode so there is always a card («Pendents» may be empty).
    file: '04-assistent-etiquetatge.png',
    app: 'dashboard',
    path: '/config/tags',
    ready: TAGS_READY,
    prepare: async (page) => {
      await page.getByRole('button', { name: 'Etiqueta persones' }).click();
      await page.getByRole('dialog', { name: 'Etiqueta persones' }).getByRole('tab', { name: 'Tothom' }).click();
      await page.locator('app-tagging-wizard-modal [data-testid^="tag-group-"]').first().waitFor();
    },
    // Name + surnames on the card and the observations: personal data.
    clip: 'dialog[open] .modal-box',
  },
  {
    file: '04-etiqueta-detall.png',
    app: 'dashboard',
    path: '/config/tags',
    ready: TAGS_READY,
    prepare: async (page) => {
      await page.getByRole('row', { name: /1es Mans/ }).locator('td.font-medium').click();
      await page.locator('app-tag-detail app-data-table').waitFor();
    },
    highlight: 'app-tag-detail app-person-search-input label', // the whole field, not the bare <input>
  },
  {
    // Person panel of the segment workspace with the tag filter open.
    file: '04-panell-filtre-etiqueta.png',
    app: 'dashboard',
    // An event with attendance, so the panel lists people. `returnUrl`: see s07 (keeps the
    // workspace's popstate handler off `location.back()`, which ends on about:blank).
    path: `/pinyes/events/${process.env['MANUAL_WS_EVENT_ID'] ?? TARGETS.workspaceEventId}/segments/${
      process.env['MANUAL_WS_SEGMENT_ID'] ?? TARGETS.workspaceSegmentId
    }/assign?returnUrl=%2Fhome`,
    ready: 'app-person-panel',
    prepare: async (page) => {
      await page.getByRole('button', { name: 'Filtra per etiqueta' }).click();
      await page.getByPlaceholder('Cerca etiqueta...').first().waitFor();
    },
    clip: 'app-person-panel',
    settle: 800,
  },

  // ── 05 Temporades ────────────────────────────────────────────
  {
    file: '05-temporades-llista.png',
    app: 'dashboard',
    path: '/config/seasons',
    ready: 'app-season-list tbody tr td.font-medium',
    highlight: 'app-season-list tbody tr:has-text("Actual")',
  },
  {
    file: '05-temporada-nova.png',
    app: 'dashboard',
    path: '/config/seasons',
    ready: 'app-season-list tbody tr td.font-medium',
    prepare: async (page) => {
      await page.getByRole('button', { name: 'Temporada nova' }).click();
      await page.getByRole('dialog', { name: 'Temporada nova' }).waitFor();
    },
    clip: 'dialog[open] .modal-box',
  },

  // ── 06 Usuaris i accés ───────────────────────────────────────
  {
    file: '06-usuaris-llista.png',
    app: 'dashboard',
    path: '/config/users',
    ready: USERS_READY,
    highlight: 'button:has-text("Crea usuari")',
  },
  {
    file: '06-usuari-accions.png',
    app: 'dashboard',
    path: '/config/users',
    ready: USERS_READY,
    prepare: async (page) => {
      await page.getByRole('button', { name: 'Accions' }).first().click();
      await page.getByRole('menu').waitFor();
    },
    highlight: '[role="menu"]',
  },
  {
    file: '06-usuari-nou.png',
    app: 'dashboard',
    path: '/config/users',
    ready: USERS_READY,
    prepare: async (page) => {
      await page.getByRole('button', { name: 'Crea usuari' }).click();
      await page.getByRole('dialog', { name: 'Crea usuari' }).waitFor();
    },
    clip: 'dialog[open] .modal-box',
  },
  {
    // ADMIN only: «Assignar rol» is not in the menu for TECHNICAL. Drop this entry if the E2E user is TECHNICAL.
    file: '06-assignar-rol.png',
    app: 'dashboard',
    path: '/config/users',
    ready: USERS_READY,
    prepare: async (page) => {
      await page.getByRole('button', { name: 'Accions' }).first().click();
      await page.getByRole('menuitem', { name: 'Assignar rol' }).click();
      await page.getByRole('dialog', { name: 'Assignar rol' }).waitFor();
    },
    // The modal shows the user's email.
    clip: 'dialog[open] .modal-box',
  },
];
