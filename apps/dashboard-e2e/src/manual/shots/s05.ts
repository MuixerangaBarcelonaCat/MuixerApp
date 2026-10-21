import { Page } from '@playwright/test';
import { ManualShot } from '../manual-shot';
import { TARGETS } from '../../audit/audit-targets';
import { selectFirstCanvasNode } from '../../template-editor-tablet/helpers';

/**
 * Plantilles (pàgines 08, 09, 10). The harness blocks every API write, so a stray click on the
 * autosaving editor (e.g. the «Estén rengla» ghost "+") never reaches the template. Never press
 * Delete/Backspace here: they remove the selected node or rengla.
 */

const EDITOR = `/pinyes/templates/${TARGETS.templateId}/edit`;
const EDITOR_CANVAS = 'main[aria-label="Editor visual de la figura"] canvas';

/** Marks the first-visit intros (pinyes tutorial, editor help) as seen and closes whichever is showing. */
async function dismissIntros(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.setItem('muixer_pinyes_onboarding_dismissed', 'true');
    localStorage.setItem('muixer_template_editor_help_dismissed', 'true');
  });
  for (const sel of ['button[aria-label="Tancar ajuda"]', 'dialog[open] [data-testid="lib-modal-close"]']) {
    const button = page.locator(sel).first();
    if (await button.isVisible().catch(() => false)) await button.click();
  }
}

/** Template list on a tab; clicked because `?tab=` is only read on the component's first init. */
async function listOn(page: Page, tab: 'Figures' | 'Composicions'): Promise<void> {
  await dismissIntros(page);
  await page.getByRole('tab', { name: tab, exact: true }).click();
}

/** Template editor with the intros closed, on one of its three tabs. */
async function editorOn(page: Page, tab: 'Pinya' | 'Rengles' | 'Tronc'): Promise<void> {
  await dismissIntros(page);
  await page.getByRole('tab', { name: tab, exact: true }).click();
  await page.waitForTimeout(400);
}

export const s05: ManualShot[] = [
  // ── 08 Plantilles ──
  {
    file: '08-plantilles-tutorial.png',
    app: 'dashboard',
    path: '/pinyes',
    prepare: async (page) => {
      const dialog = page.getByRole('dialog', { name: 'Com funciona el mòdul de Pinyes' });
      if (!(await dialog.isVisible().catch(() => false))) {
        await page.locator('button[aria-label="Ajuda sobre el mòdul de Pinyes"]').click();
      }
      await dialog.waitFor();
    },
  },
  {
    file: '08-plantilles-llista.png',
    app: 'dashboard',
    path: '/pinyes',
    ready: 'ul[aria-label="Llista de figures"]',
    prepare: (page) => listOn(page, 'Figures'),
    highlight: 'button[aria-label="Crea figura nova"]',
    settle: 600,
  },
  {
    file: '08-plantilles-targeta.png',
    app: 'dashboard',
    path: '/pinyes',
    ready: 'ul[aria-label="Llista de figures"]',
    prepare: (page) => listOn(page, 'Figures'),
    clip: 'ul[aria-label="Llista de figures"] > li:first-child',
    highlight: 'ul[aria-label="Llista de figures"] > li:first-child button[aria-label^="Duplica "]',
  },
  {
    file: '08-plantilles-composicions.png',
    app: 'dashboard',
    path: '/pinyes',
    prepare: async (page) => {
      await listOn(page, 'Composicions');
      await page.locator('ul[aria-label="Llista de composicions"]').waitFor();
    },
    highlight: 'button[aria-label="Crea composició nova"]',
    settle: 600,
  },
  {
    file: '08-plantilles-editor.png',
    app: 'dashboard',
    path: EDITOR,
    ready: EDITOR_CANVAS,
    prepare: (page) => editorOn(page, 'Pinya'),
    highlight: 'header.editor-topbar',
    settle: 1500,
  },
  {
    file: '08-plantilles-previsualitzacio.png',
    app: 'dashboard',
    path: EDITOR,
    ready: EDITOR_CANVAS,
    prepare: async (page) => {
      await editorOn(page, 'Pinya');
      await page.locator('button[aria-label="Previsualitzar figura"]').click();
    },
    highlight: 'button[aria-label="Previsualitzar figura"]',
    settle: 1500,
  },
  {
    file: '08-plantilles-dreceres.png',
    app: 'dashboard',
    path: EDITOR,
    ready: EDITOR_CANVAS,
    prepare: async (page) => {
      await dismissIntros(page);
      await page.locator('button[aria-label="Veure dreceres de teclat"]').click();
      await page.getByRole('dialog', { name: 'Dreceres de teclat' }).waitFor();
    },
  },
  {
    file: '08-plantilles-nom-figura.png',
    app: 'dashboard',
    path: '/pinyes/templates/new',
    ready: 'aside[aria-label="Eines"]',
    prepare: async (page) => {
      await dismissIntros(page);
      // requireName() opens the prompt before anything is added.
      await page.locator('button[aria-label="Afegir node AGULLA"]').click();
      await page.getByRole('dialog', { name: 'Nom de la figura' }).waitFor();
    },
  },
  {
    file: '08-plantilles-composicio-editor.png',
    app: 'dashboard',
    path: '/pinyes',
    prepare: async (page) => {
      await listOn(page, 'Composicions');
      // lib-card is display:contents: click its <a>, near the title, away from the Duplica/Elimina icons.
      await page
        .locator('ul[aria-label="Llista de composicions"] > li:first-child lib-card > a')
        .click({ position: { x: 24, y: 16 } });
      await page.locator('main[aria-label="Llenç de la composició"] canvas').first().waitFor();
    },
    highlight: 'aside[aria-label="Figures disponibles"]',
    settle: 1500,
  },
  // ── 09 Plantilla: pinya i rengles ──
  {
    file: '09-plantilles-pinya.png',
    app: 'dashboard',
    path: EDITOR,
    ready: EDITOR_CANVAS,
    prepare: (page) => editorOn(page, 'Pinya'),
    highlight: 'aside[aria-label="Eines"]',
    settle: 1500,
  },
  {
    file: '09-plantilles-pinya-propietats.png',
    app: 'dashboard',
    path: EDITOR,
    ready: EDITOR_CANVAS,
    prepare: async (page) => {
      await editorOn(page, 'Pinya');
      await selectFirstCanvasNode(page); // click only, no drag
    },
    highlight: '#properties-panel',
    settle: 1200,
  },
  {
    file: '09-plantilles-rengles.png',
    app: 'dashboard',
    path: EDITOR,
    ready: EDITOR_CANVAS,
    prepare: (page) => editorOn(page, 'Rengles'),
    highlight: 'button[aria-label="Crea rengla nova"]',
    settle: 1500,
  },
  {
    file: '09-plantilles-rengla-nova.png',
    app: 'dashboard',
    path: EDITOR,
    ready: EDITOR_CANVAS,
    prepare: async (page) => {
      await editorOn(page, 'Rengles');
      // Starts a pending rengla (local state only). Never press Enter or «Finalitza».
      await page.locator('button[aria-label="Crea rengla nova"]').click();
    },
    highlight: 'div.rounded-box:has(#rengla-start-pos)',
    settle: 1200,
  },
  // ── 10 Plantilla: tronc ──
  {
    file: '10-plantilles-tronc.png',
    app: 'dashboard',
    path: EDITOR,
    ready: EDITOR_CANVAS,
    prepare: async (page) => {
      await editorOn(page, 'Tronc');
      await page.locator('section[aria-label="Estructura del tronc"]').waitFor();
    },
    highlight: 'button[aria-label="Afegeix pis"]',
    settle: 800,
  },
  {
    file: '10-plantilles-tronc-node.png',
    app: 'dashboard',
    path: EDITOR,
    ready: EDITOR_CANVAS,
    prepare: async (page) => {
      await editorOn(page, 'Tronc');
      // First node of a tronc floor (only non-base floors carry the floor delete button).
      await page
        .locator('section[aria-label="Tronc de la figura"] .floor-row:has(.floor-delete-btn) button.tronc-node')
        .first()
        .click();
      await page.locator('section[aria-label="Tronc de la figura"] .selected-node-controls').waitFor();
    },
    clip: 'section[aria-label="Tronc de la figura"]',
    highlight: 'section[aria-label="Tronc de la figura"] .selected-node-controls',
  },
  {
    file: '10-plantilles-estructura.png',
    app: 'dashboard',
    path: EDITOR,
    ready: EDITOR_CANVAS,
    prepare: async (page) => {
      await editorOn(page, 'Tronc');
      // Click (not drag) a handle: shows «Trieu qui té davall …»; no link exists until a target is clicked.
      await page
        .locator('section[aria-label="Estructura del tronc"] button.handle:not([disabled])')
        .first()
        .click();
    },
    clip: 'section[aria-label="Estructura del tronc"]',
    highlight: 'section[aria-label="Estructura del tronc"] p.connect-status',
  },
];
