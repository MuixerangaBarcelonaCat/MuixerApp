# S05: plantilles (llista, pinya i rengles, tronc)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Escriure les pàgines del manual de les plantilles. La 08 explica la llista, l'editor i les composicions, i és per a tothom. La 09 és per a pinyes (pestanyes Pinya i Rengles) i la 10, per a troncs i xicalla (pestanya Tronc i «Estructura del tronc»). Totes tres porten les captures generades amb la suite del manual.

**Pàgines:**

| Fitxer | Títol a `MANUAL_PAGES` | Rutes (comentari de la primera línia) |
|---|---|---|
| `docs/manual/08-plantilles.md` | Plantilles | `<!-- rutes: /pinyes /pinyes/templates/new /pinyes/templates/:id/edit /pinyes/compositions/new /pinyes/compositions/:id/edit -->` |
| `docs/manual/09-plantilles-pinya.md` | Plantilla: pinya i rengles | `<!-- rutes: /pinyes/templates/:id/edit -->` |
| `docs/manual/10-plantilles-tronc.md` | Plantilla: tronc | `<!-- rutes: /pinyes/templates/:id/edit -->` |

**Depèn de:** pla arrel, Tasks 2 (visor) i 3 (suite de captures).

**Spec:** `docs/superpowers/specs/2026-10-21-manual-us-dashboard-design.md` · **Pla arrel:** `00-general.md`

## Missatge clau (ha d'eixir a les tres pàgines)

1. **Una sola plantilla, dues mans.** Una figura és una plantilla amb dues parts:
   - pinyes en fa la pinya (pestanyes «Pinya» i «Rengles»);
   - troncs i xicalla en fan el tronc (pestanya «Tronc»).

   Les **bases** són de tots dos. Pinyes les col·loca al dibuix de la pinya i troncs les veu com el primer pis del tronc. Si cal moure-les o reordenar-les, s'ha de parlar abans.
2. **Quan una figura d'un event ja té algú assignat, deixa de seguir la plantilla.** Ho direm així, sense «snapshot» ni «instància»:
   - Quan es posa la primera persona en una figura d'un event, l'app en fa una còpia de la plantilla per a eixa figura.
   - Des d'aquell moment, el que canvieu a la plantilla no arriba a eixa figura: ni llocs, ni rengles, ni l'estructura del tronc.
   - Les figures que encara no tenen ningú assignat sí que agafen els canvis, també les d'altres assajos i actuacions.
   - Per a fer que una figura ja assignada agafe els canvis, la sola via és «Reinicialitza» a l'espai d'assignació (pàgina 13). Esborra totes les persones d'eixa figura.

   Fonts: `docs/PINYES_MODULE.md` §4 i `apps/api/src/modules/node-assignment/node-assignment.service.ts` (`resetInstance`: esborra assignacions i nodes copiats, `snapshotted = false`).
3. **L'editor de figures alça sol.** No hi ha cap botó «Alça»:
   - cada canvi s'alça uns 2 segons després (etiqueta «S'està alçant...» → «Alçat»);
   - si eixiu de l'editor abans, l'app alça el que quedava pendent.

   L'editor de composicions alça a l'instant i no té «Desfer».

## Fonts verificades

Textos copiats literalment d'estos fitxers (rutes des de l'arrel del repo):

- Llista: `apps/dashboard/src/app/features/pinyes/components/template-list/template-list.component.{html,ts}` (tutorial `PINYES_ONBOARDING_STEPS`, pestanyes `TAB_DEFS`), `.../template-list/composition-grid-tab/composition-grid-tab.component.html`
- Tutorial genèric: `apps/dashboard/src/app/shared/components/tutorial-modal/tutorial-modal.component.{html,ts}` (s'obri sol la primera vegada; clau `muixer_pinyes_onboarding_dismissed`; casella «No tornes a mostrar», botó «Entesos!»)
- Editor: `apps/dashboard/src/app/features/pinyes/components/template-editor/template-editor.component.{html,ts}` (autosave de 2 s, `requireName`, `saveStatusLabel`, `editorModeTabs`)
- Accions del node: `apps/dashboard/src/app/shared/components/controls/node-actions/node-actions.component.ts` («Duplica», «Estén rengla», «Elimina»)
- Presets: `libs/shared/src/constants/node-preset.constants.ts` (`PINYA_NODE_PRESETS`, `TRONC_NODE_PRESETS`, `TRONC_Z_DEFAULTS`)
- Nodes centrals sense rengla: `libs/pinyes-render/src/lib/utils/rengla-coordinates.util.ts` (`agulla`, `crossa`, `contrafort`)
- Rengles: `apps/dashboard/src/app/features/pinyes/components/rengla-overlay/rengla-overlay.component.{html,ts}`
- Ajuda: `apps/dashboard/src/app/features/pinyes/components/template-editor-help-modal/template-editor-help-modal.component.{html,ts}` (s'obri sola la primera vegada; clau `muixer_template_editor_help_dismissed`)
- Tronc: `libs/pinyes-render/src/lib/components/tronc-view/tronc-view.component.{html,ts}` (`MAX_TRONC_Z = 5`), `libs/pinyes-render/src/lib/utils/tronc-layout.util.ts` (P1 = «Bases»)
- Estructura: `apps/dashboard/src/app/features/pinyes/components/template-editor/tronc-support-editor/tronc-support-editor.component.{html,ts}`
- Composicions: `apps/dashboard/src/app/features/pinyes/components/composition-editor/composition-editor.component.{html,ts}`, `.../figure-properties-panel/figure-properties-panel.component.{html,ts}`
- Guard de mòbil: `apps/dashboard/src/app/core/guards/desktop-only.guard.ts`
- Esborrar plantilla en ús: `apps/api/src/modules/figure/figure-template.service.ts` (`remove`: 409 si alguna figura d'event l'usa; `generateCopyName`: «X (còpia)»)
- Aplicar composició: `apps/api/src/modules/event-segment/figure-instance.service.ts` (`applyComposition`: **canvia el nom del segment** pel de la composició)
- Domini: `docs/PINYES_MODULE.md` §4, §10 («Estructura del tronc», «Alçades acumulades»), §12 (ordre de les bases), §17-19

### Correccions a l'inventari de pantalles (no les documenteu)

- «Mostrar / Ocultar quadrícula» i el botó «Elimina» de la barra «Eines» estan comentats a la plantilla HTML. A «Vistes» només hi ha «Encaixa a la quadrícula».
- L'editor no avisa de «canvis sense alçar». `unsavedChangesGuard` només alça el que quedava pendent abans d'eixir.
- La pestanya «Tronc» de l'editor **no té «Direccions»**. Les direccions s'afigen per figura a la pestanya Troncs de l'assignació (`troncs-tab.component.html`, `directionAdded`). Van a la pàgina 12.
- El botó d'afegir pis és un «+» xicotet a la capçalera «Tronc», amb el text d'ajuda «Afegeix pis». No hi ha cap desplegable «Afegir pis», encara que ho diga l'ajuda.

### Textos de l'app que no s'han de copiar al manual (vegeu també l'informe)

- **El modal «Ajuda» de l'editor està desfasat.** Parla de:
  - «família» (eliminat a P5.13);
  - un «panell flotant» del tronc;
  - el «desplegable "Afegir pis"»;
  - el mode «Edita rengles»;
  - el botó «Finalitzar» (el botó real és «Finalitza»);
  - la insígnia «Bases desordenades», que la llista no mostra.

  El manual l'esmenta com a botó que existeix i no l'usa com a font.
- El tutorial «Com funciona el mòdul de Pinyes» diu «snapshot» i «template» i tracta de «tu» («Pots importar…»). El modal «Nom de la figura» també («Has d'introduir…»). El manual no els cita literalment.

---

### Task A: captures (`apps/dashboard-e2e/src/manual/shots/s05.ts`)

**Regles d'esta secció:**
- Mai no s'alça res en una plantilla real. El primer pas de cada `prepare` instal·la `guardReadOnly`, que avorta tota petició que no siga GET a `/api/figure-templates` i `/api/compositions`. Així, un clic que caiga en el «+» fantasma d'«Estén rengla» o un arrossegament accidental no arriben a la BD.
- No es prem mai `Delete`/`Backspace`, perquè eliminen el node o la rengla seleccionats. Per a tancar, només `Escape` o els botons «Tancar».
- La plantilla és `TARGETS.templateId` («Branca»). Ha de tindre pinya, rengles, bases i tronc amb almenys dos pisos. Si no, sobreescriviu-la amb `AUDIT_TEMPLATE_ID`.

- [ ] **Step 1: Crea `s05.ts`**

```ts
import { Page } from '@playwright/test';
import type { ManualShot } from '../manual-shot';
import { TARGETS } from '../../audit/audit-targets';
import { spaGoto } from '../../audit/audit-core';
import { selectFirstCanvasNode } from '../../template-editor-tablet/helpers';

const EDITOR = `/pinyes/templates/${TARGETS.templateId}/edit`;
const guarded = new WeakSet<Page>();

/** Blocks every write to templates/compositions: shots must never save a real template. */
async function guardReadOnly(page: Page): Promise<void> {
  if (guarded.has(page)) return;
  guarded.add(page);
  for (const pattern of ['**/api/figure-templates**', '**/api/compositions**']) {
    await page.route(pattern, (route) =>
      route.request().method() === 'GET' ? route.continue() : route.abort(),
    );
  }
}

/** Marks the first-visit intros as seen and closes whichever is showing. */
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

/**
 * A fresh editor component: the router ignores a same-URL spaGoto, so leaving state from the
 * previous shot (preview on, a modal, a pending rengla) would leak in. Hop out and back first.
 */
async function freshEditor(page: Page, url: string, tab?: 'Pinya' | 'Rengles' | 'Tronc'): Promise<void> {
  await guardReadOnly(page);
  await dismissIntros(page);
  await spaGoto(page, '/pinyes');
  await spaGoto(page, url);
  await page.locator('header.editor-topbar').waitFor();
  await dismissIntros(page);
  if (tab) {
    await page.getByRole('tab', { name: tab, exact: true }).click();
    await page.waitForTimeout(400);
  }
}

/** Template list on a given tab; the tab is clicked because ?tab= is only read on first init. */
async function listOn(page: Page, tab: 'Figures' | 'Composicions'): Promise<void> {
  await guardReadOnly(page);
  await dismissIntros(page);
  await page.getByRole('tab', { name: tab, exact: true }).click();
}

export const s05: ManualShot[] = [
  // ── 08 ──
  {
    file: '08-plantilles-tutorial.png',
    app: 'dashboard',
    path: '/pinyes',
    prepare: async (page) => {
      await guardReadOnly(page);
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
    prepare: (page) => freshEditor(page, EDITOR, 'Pinya'),
    highlight: 'header.editor-topbar',
    settle: 1500,
  },
  {
    file: '08-plantilles-previsualitzacio.png',
    app: 'dashboard',
    path: EDITOR,
    prepare: async (page) => {
      await freshEditor(page, EDITOR, 'Pinya');
      await page.locator('button[aria-label="Previsualitzar figura"]').click();
    },
    highlight: 'button[aria-label="Previsualitzar figura"]',
    settle: 1500,
  },
  {
    file: '08-plantilles-dreceres.png',
    app: 'dashboard',
    path: EDITOR,
    prepare: async (page) => {
      await freshEditor(page, EDITOR);
      await page.locator('button[aria-label="Veure dreceres de teclat"]').click();
      await page.getByRole('dialog', { name: 'Dreceres de teclat' }).waitFor();
    },
  },
  {
    file: '08-plantilles-nom-figura.png',
    app: 'dashboard',
    path: '/pinyes/templates/new',
    prepare: async (page) => {
      await freshEditor(page, '/pinyes/templates/new');
      // requireName() opens the prompt before anything is added; nothing reaches the API.
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
  // ── 09 ──
  {
    file: '09-plantilles-pinya.png',
    app: 'dashboard',
    path: EDITOR,
    prepare: (page) => freshEditor(page, EDITOR, 'Pinya'),
    highlight: 'aside[aria-label="Eines"]',
    settle: 1500,
  },
  {
    file: '09-plantilles-pinya-propietats.png',
    app: 'dashboard',
    path: EDITOR,
    prepare: async (page) => {
      await freshEditor(page, EDITOR, 'Pinya');
      await selectFirstCanvasNode(page); // click only, no drag; writes are blocked anyway
    },
    highlight: '#properties-panel',
    settle: 1200,
  },
  {
    file: '09-plantilles-rengles.png',
    app: 'dashboard',
    path: EDITOR,
    prepare: (page) => freshEditor(page, EDITOR, 'Rengles'),
    highlight: 'button[aria-label="Crea rengla nova"]',
    settle: 1500,
  },
  {
    file: '09-plantilles-rengla-nova.png',
    app: 'dashboard',
    path: EDITOR,
    prepare: async (page) => {
      await freshEditor(page, EDITOR, 'Rengles');
      // Starts a pending rengla (local state only). Never press Enter or «Finalitza».
      await page.locator('button[aria-label="Crea rengla nova"]').click();
    },
    highlight: 'div.rounded-box:has(#rengla-start-pos)',
    settle: 1200,
  },
  // ── 10 ──
  {
    file: '10-plantilles-tronc.png',
    app: 'dashboard',
    path: EDITOR,
    prepare: async (page) => {
      await freshEditor(page, EDITOR, 'Tronc');
      await page.locator('section[aria-label="Estructura del tronc"]').waitFor();
    },
    highlight: 'button[aria-label="Afegeix pis"]',
    settle: 800,
  },
  {
    file: '10-plantilles-tronc-node.png',
    app: 'dashboard',
    path: EDITOR,
    prepare: async (page) => {
      await freshEditor(page, EDITOR, 'Tronc');
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
    prepare: async (page) => {
      await freshEditor(page, EDITOR, 'Tronc');
      // Click (not drag) a handle: shows «Trieu qui té davall …». No link is added until a target is clicked.
      await page
        .locator('section[aria-label="Estructura del tronc"] button.handle:not([disabled])')
        .first()
        .click();
    },
    clip: 'section[aria-label="Estructura del tronc"]',
    highlight: 'section[aria-label="Estructura del tronc"] p.connect-status',
  },
];
```

- [ ] **Step 2: Afig `...s05` a `MANUAL_SHOTS`** a `apps/dashboard-e2e/src/manual/shots/index.ts`.

- [ ] **Step 3: Executa-ho**

Run: `pnpm run dev:up && E2E_EMAIL=… E2E_PASSWORD=… SHOTS=08,09,10 pnpm run docs:manual-shots`
Expected: 16 PNG a `docs/manual/img/` (de `08-plantilles-tutorial.png` a `10-plantilles-estructura.png`) i cap captura fallida.

- [ ] **Step 4: Revisa els PNG un per un**
  - `08-plantilles-tutorial`: es veu el pas 1 «Figures» del tutorial.
  - `08-plantilles-llista`: cap modal obert i el contorn sobre «Figura nova».
  - `09-plantilles-pinya-propietats`: el panell dret mostra «Propietats del node», no «Figura». Si mostra «Figura», el clic no ha caigut en cap node: ajusteu els desplaçaments de `selectFirstCanvasNode` o feu el clic sobre una coordenada fixa.
  - `09-plantilles-rengla-nova`: es veu la barra «Feu clic als nodes per ordre (del centre cap enfora)» amb «Primer cordó».
  - `10-plantilles-estructura`: es veu el text «Trieu qui té davall …» i les línies d'enllaç.
  - Comproveu a l'app que «Branca» no ha canviat: obriu-la a mà i mireu que no hi haja cap node nou.
  - **La captura de l'avís «Ordre incorrecte» no es fa.** Necessita una plantilla amb les bases desordenades i no n'hi ha cap de garantida a la BD. La pàgina 09 el descriu amb text.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard-e2e/src/manual/shots/s05.ts apps/dashboard-e2e/src/manual/shots/index.ts docs/manual/img/08-*.png docs/manual/img/09-*.png docs/manual/img/10-*.png
git commit -m "docs(manual): add template screenshots"
```

---

### Task B: `docs/manual/08-plantilles.md`

**Esquema:**

```
<!-- rutes: /pinyes /pinyes/templates/new /pinyes/templates/:id/edit /pinyes/compositions/new /pinyes/compositions/:id/edit -->
# Plantilles
## Per a què serveix
## On és
![…](img/08-plantilles-llista.png)
## Pas a pas
### Buscar, obrir, duplicar o eliminar una figura
### Crear una figura nova
### L'editor: la barra de dalt
### Crear o editar una composició
## Si sou de pinyes
## Si sou de troncs o xicalla
## Compte amb
## Relacionat
```

- [ ] **Step 1: «Per a què serveix»** (2-3 frases)
  - Una plantilla és el dibuix d'una figura: tots els llocs de la pinya i del tronc. Cada requadre del dibuix és un lloc; l'app en diu «node».
  - Una composició és un grup de figures ja col·locades que es fan alhora (per exemple, tres pilars en fila).
  - Les plantilles es fan una vegada. Després, a cada assaig o actuació, s'afigen als segments (pàgina 11).

- [ ] **Step 2: «On és»:** menú principal «Plantilles». Hi ha dues pestanyes: «Figures» i «Composicions».

- [ ] **Step 3: «Pas a pas»**
  1. **Primera visita.** S'obri el tutorial «Com funciona el mòdul de Pinyes», de tres passos: «Figures», «Rengles» i «Assignacions».
     - Es tanca amb «Entesos!». Si marqueu «No tornes a mostrar», ja no eixirà més.
     - Es pot tornar a obrir amb el botó «?» del costat del títol «Plantilles».
     - Captura `08-plantilles-tutorial.png`.
  2. **Buscar i obrir.**
     - Escriviu a «Cerca per nom...».
     - Cada targeta mostra el dibuix i quants llocs té («N nodes»). Feu clic a la targeta per a obrir l'editor.
     - Si hi ha més de 25 figures, a baix hi ha «Pàgina X de Y».
  3. **Duplicar.** La icona de copiar de la targeta crea «Nom (còpia)» i l'obri directament a l'editor.
     - Ho feu servir per a fer una variant sense tocar l'original. Una figura que ja es fa servir en events futurs no s'hauria de tocar.
     - Captura `08-plantilles-targeta.png`.
  4. **Eliminar.** Amb la paperera s'obri «Elimina la figura» → «Elimina».
     - Si alguna figura d'un event la fa servir, l'app no deixa esborrar-la i diu quantes la fan servir.
  5. **Crear una figura nova.**
     - «Figura nova» obri l'editor buit, amb el missatge «No hi ha cap node de pinya».
     - En afegir el primer lloc, l'app demana el nom («Nom de la figura», per exemple «Pilar de 4, Torre de 6...»). Escriviu-lo i premeu «Confirma». Fins que no té nom, no s'alça res.
     - Captura `08-plantilles-nom-figura.png`.
  6. **L'editor: la barra de dalt** (captura `08-plantilles-editor.png`, d'esquerra a dreta):
     - fletxa per a tornar a la llista;
     - nom de la figura;
     - pestanyes «Pinya», «Rengles» i «Tronc»;
     - etiqueta d'estat: «S'està alçant...», «Alçat» o «S'ha produït un error en alçar»;
     - «Desfer» i «Refer». En passar el ratolí per damunt, diuen què desfaran, per exemple «Desfer: Moure node»;
     - l'ull de «Previsualitzar» (Ctrl+Maj+P): mostra la figura com eixirà projectada, sense poder editar-la (captura `08-plantilles-previsualitzacio.png`);
     - el teclat de «Dreceres de teclat» (captura `08-plantilles-dreceres.png`);
     - el «?» d'«Ajuda». S'obri sol la primera vegada que entreu a l'editor.
  7. **Alçar.**
     - No cal fer res: cada canvi s'alça sol al cap de 2 segons.
     - Abans de tancar la pestanya del navegador, espereu a veure «Alçat».
  8. **Composicions** (pestanya «Composicions», captura `08-plantilles-composicions.png`):
     1. «Composició nova» obri l'editor de composicions.
     2. A l'esquerra, «Figures disponibles» amb «Cerca...». Un clic sobre una figura l'afig al centre. Les figures sense pinya porten la insígnia «Neta».
     3. La primera figura crea la composició amb el nom d'eixa figura. Per a canviar-lo, feu clic al llapis del costat del nom.
     4. Arrossegueu les figures al llenç per a col·locar-les. «Ajusta» activa l'ajust a la quadrícula.
     5. Feu clic en una figura per a veure el panell «Propietats»:
        - «Nom»;
        - «Mode»: «Completa», «Peu», «Remat» o «Neta», només si la figura té pinya;
        - «Cordons»: «Tots» o N, amb «−» i «+»;
        - «Cordons oberts»;
        - «Posició» X/Y i l'angle;
        - «Elimina».
     - Captura `08-plantilles-composicio-editor.png`.

- [ ] **Step 4: «Si sou de pinyes»:**
  - La pinya i les rengles són vostres: vegeu la pàgina 09.
  - Abans de canviar una plantilla que ja es fa servir en un event pròxim, mireu si eixa figura ja té gent assignada. Si en té, el canvi no li arribarà.

- [ ] **Step 5: «Si sou de troncs o xicalla»:**
  - El tronc i l'estructura del tronc són vostres: vegeu la pàgina 10.
  - Les bases les compartiu amb pinyes. Si en canvieu el nombre o l'ordre, aviseu-los.

- [ ] **Step 6: «Compte amb»** (cada punt ve del codi)
  - **Canviar una plantilla canvia les figures que encara no tenen ningú assignat, en tots els events**, també en els d'altres tècnics. Les figures que ja tenen algú assignat no canvien: guarden la còpia del dia de la primera assignació. Si cal que agafen els canvis, la sola via és «Reinicialitza» (pàgina 13), que en lleva totes les persones.
  - **Desassignar tothom a mà no fa que la figura torne a seguir la plantilla.** La còpia es manté fins que es fa «Reinicialitza».
  - **No hi ha botó «Alça».** Si veieu «S'ha produït un error en alçar», no tanqueu la pestanya. Copieu el que heu fet i aviseu.
  - Tecles: `Supr`/`Retrocés` eliminen el lloc seleccionat i `Escape` el deixa de seleccionar. «Desfer» ho recupera mentre no eixiu de l'editor.
  - **Els editors no s'obrin al mòbil.** Per davall de 768 px apareix l'avís «Aquesta funcionalitat només està disponible en dispositius d'escriptori o tauleta.» i torneu a la llista. En tauleta sí que funcionen. Per davall de 1024 px, el panell dret canvia les caselles de posició pel bloc «Moure», amb fletxes.
  - **L'editor de composicions alça a l'instant i no té «Desfer».** Eliminar una figura de la composició no es pot desfer. Eliminar una composició sí que es pot fer encara que s'haja usat en events: les figures que ja s'hi havien posat no canvien.
  - **En aplicar una composició a un segment, el segment pren el nom de la composició** i es perd el nom que tenia (vegeu la pàgina 11).
  - El contingut del botó «?» d'«Ajuda» de l'editor és antic en alguns punts: parla de «famílies» i de botons que han canviat de nom. Si no coincideix amb el que veieu, feu cas d'este manual.

- [ ] **Step 7: «Relacionat»:** `09-plantilles-pinya.md`, `10-plantilles-tronc.md`, `11-segments-i-figures.md`, `13-assignacio-pinyes.md` («Reinicialitza»).

- [ ] **Step 8: Verificació**
  - Obriu `/config/manual/08-plantilles`: totes les imatges carreguen i els enllaços «Relacionat» naveguen dins del visor.
  - Passeu la checklist de llengua del pla arrel.
  - `grep -n "snapshot\|instància\|template" docs/manual/08-plantilles.md` no ha de trobar res.

- [ ] **Step 9: Commit**

```bash
git add docs/manual/08-plantilles.md
git commit -m "docs(manual): write templates page"
```

---

### Task C: `docs/manual/09-plantilles-pinya.md` (pinyes)

**Esquema:**

```
<!-- rutes: /pinyes/templates/:id/edit -->
# Plantilla: pinya i rengles
## Per a què serveix
## On és
![…](img/09-plantilles-pinya.png)
## Pas a pas
### Afegir i col·locar llocs de pinya
### Les bases
### Canviar un lloc: «Propietats del node»
### Fer les rengles
## Si sou de pinyes
## Si sou de troncs o xicalla
## Compte amb
## Relacionat
```

- [ ] **Step 1: «Per a què serveix»:**
  - Es dibuixa la pinya vista des de dalt: on va cada persona i de quin tipus és cada lloc.
  - Les rengles diuen a quin cordó pertany cada lloc. Sense rengles, a l'event no es pot triar quants cordons es fan.

- [ ] **Step 2: «On és»:** «Plantilles» → targeta de la figura → pestanya «Pinya» o «Rengles».

- [ ] **Step 3: «Pas a pas», afegir llocs** (captura `09-plantilles-pinya.png`)
  1. A la columna «Eines» de l'esquerra, apartat «Pinya», feu clic al tipus de lloc. Els tipus, copiats de `PINYA_NODE_PRESETS`, són:
     - «AGULLA», «MANS», «LATERAL», «VENT», «CORDÓ OBERT», «TAP», «CROSSA» i «CONTRAFORT»;
     - «...», un lloc genèric amb el nom que vulgueu.
  2. El lloc apareix al dibuix. Arrossegueu-lo on toque.
     - Per a moure'l amb precisió, feu servir les fletxes: 1 px, o 10 px amb `Maj`.
     - «Encaixa a la quadrícula» l'ajusta a la quadrícula.
  3. Per a girar-lo o canviar-ne la mida, feu servir les nanses del lloc seleccionat.
  4. Per a canviar-ne el nom, feu doble clic sobre el lloc.
  5. Per a moure la vista: roda del ratolí per al zoom i arrossegar el fons per a desplaçar-la.
- [ ] **Step 4: Les bases**
  - Apartat «Base» → «BASE». Cada base nova s'anomena «Base 1», «Base 2»...
  - L'ordre és **antihorari començant per dalt a l'esquerra**: Base 1 dalt a l'esquerra, Base 2 baix a l'esquerra, Base 3 baix a la dreta i Base 4 dalt a la dreta.
  - Si no s'hi segueix, davall de «BASE» apareix l'avís groc «Ordre incorrecte». Feu-hi clic per a obrir l'ajuda amb el dibuix.
  - Per què importa: l'ordre de les bases decideix quina persona del tronc va damunt de quina base.
- [ ] **Step 5: «Propietats del node»** (captura `09-plantilles-pinya-propietats.png`). Feu clic en un lloc i, al panell dret, trobareu:
  - «Tipus de posició»: canvia el tipus i el color;
  - «Aparença»:
    - «Etiqueta»;
    - «Color»;
    - «Indicador»: una marca curta, de fins a 6 caràcters, que eixirà al costat de la persona assignada;
    - «Forma»: «El·lipse» o «Rectangle»;
  - «Posició»: «Amplada (px)», «Alçada (px)», «Rotació (°)», X i Y;
  - «Accions» a baix:
    - «Duplica» (⌘/Ctrl+D);
    - «Estén rengla» (⌘/Ctrl+Maj+D): crea un lloc darrere del seleccionat, a la mateixa rengla i en el cordó següent. Només funciona amb el lloc més exterior d'una rengla;
    - «Elimina».
  - Sense cap lloc seleccionat, el panell mostra «Figura» → «Nom», per a canviar el nom de la plantilla.
- [ ] **Step 6: Fer les rengles** (captures `09-plantilles-rengles.png` i `09-plantilles-rengla-nova.png`)
  1. Pestanya «Rengles». El dibuix queda bloquejat i dalt hi diu «Edició de rengles».
  2. «Rengla nova». Apareix la indicació «Feu clic als nodes per ordre (del centre cap enfora)».
  3. Feu clic als llocs **en ordre, del centre cap enfora**. Cada clic hi posa el número del cordó.
     - Un segon clic sobre el mateix lloc el lleva.
     - Ctrl/⌘+Z lleva l'últim.
  4. «Primer cordó» és el número del primer lloc on heu fet clic. Canvieu-lo si la rengla comença més enfora, per exemple en el cordó 2.
  5. «Finalitza» (o `Intro`) la crea amb el nom «Rengla N». «Cancel·la» (o `Escape`) la descarta.
  6. Feu clic en una rengla existent per a seleccionar-la. Llavors podeu:
     - canviar-ne el «Primer cordó»;
     - fer «Suprimeix». Esborra la rengla, però no els llocs.
  - L'agulla, la crossa i el contrafort no tenen rengla: són al centre i no s'hi pot fer clic en este mode.

- [ ] **Step 7: «Si sou de pinyes»** (és la pàgina de pinyes; el bloc concreta l'impacte):
  - **Per què importen les rengles.** A l'esquelet de l'event (pàgina 11), el comptador de cordons de cada figura («Tots», «2/4»...) amaga els llocs de cordons més exteriors. Les insígnies «x/y pinyes» només compten els llocs que queden.
    - Sense rengles, la figura mostra «Sense rengles» i no podeu ajustar els cordons.
    - Els llocs sense rengla sempre es mostren.
  - «CORDÓ OBERT» no depén del nombre de cordons. Es mostra o s'amaga amb el botó «Cordons oberts» de la figura a l'event.

- [ ] **Step 8: «Si sou de troncs o xicalla»:**
  - Ací no heu de tocar res, excepte les bases. Si en necessiteu una més, afegiu-la des de la pestanya «Tronc» (pàgina 10) i aviseu pinyes perquè la col·loque al dibuix.

- [ ] **Step 9: «Compte amb»**
  - `Supr`/`Retrocés` eliminen el lloc seleccionat. A la pestanya «Rengles», eliminen la **rengla** seleccionada. «Desfer» ho recupera.
  - Passar el ratolí per damunt d'un lloc mostra un «+» fantasma darrere. Un clic en eixe «+» crea un lloc nou, que s'alça. Si ho feu sense voler, feu «Desfer».
  - Si una figura de l'event ja té gent assignada, el canvi de rengles o de llocs no hi arriba (vegeu la pàgina 08). Feu les rengles **abans** de començar a assignar.
  - Si canvieu l'ordre de les bases, el tronc canvia de lloc respecte a la pinya. Parleu-ho amb troncs.

- [ ] **Step 10: «Relacionat»:** `08-plantilles.md`, `10-plantilles-tronc.md`, `11-segments-i-figures.md` (cordons), `13-assignacio-pinyes.md`.

- [ ] **Step 11: Verificació + commit**
  - Obriu `/config/manual/09-plantilles-pinya`. Passeu la checklist de llengua.
  - Comproveu que la llista de tipus coincideix amb `PINYA_NODE_PRESETS`.
  ```bash
  git add docs/manual/09-plantilles-pinya.md
  git commit -m "docs(manual): write template pinya and rengles page"
  ```

---

### Task D: `docs/manual/10-plantilles-tronc.md` (troncs i xicalla)

**Esquema:**

```
<!-- rutes: /pinyes/templates/:id/edit -->
# Plantilla: tronc
## Per a què serveix
## On és
![…](img/10-plantilles-tronc.png)
## Pas a pas
### Bases i pisos
### Canviar un lloc del tronc
### «Estructura del tronc»: qui va damunt de qui
## Si sou de troncs o xicalla
## Si sou de pinyes
## Compte amb
## Relacionat
```

- [ ] **Step 1: «Per a què serveix»:**
  - Es dibuixa el tronc pis per pis, vist de costat.
  - Es diu qui va damunt de qui. Amb això, a l'assignació l'app calcula les alçades i avisa si un pis queda desnivellat.

- [ ] **Step 2: «On és»:**
  - «Plantilles» → figura → pestanya «Tronc».
  - La pestanya ocupa tota la pantalla. A l'esquerra hi ha el tronc i a la dreta, «Estructura del tronc».

- [ ] **Step 3: «Pas a pas», bases i pisos** (captura `10-plantilles-tronc.png`)
  1. Si no hi ha bases, apareix el text «Afegiu bases per poder configurar el tronc.» i el botó «Afegeix base».
     - La fila P1 és la de les «Bases». El «+» d'eixa fila n'afig una altra.
  2. Per a afegir un pis, feu clic al «+» de la capçalera «Tronc» («Afegeix pis»). Cada pis nou va damunt de l'últim i porta un tipus per defecte:
     - P2 Segona;
     - P3 Terça;
     - P4 Quarta;
     - P5 Quinta;
     - P6 Xiqueta.

     Com a màxim hi ha 5 pisos damunt de les bases.
  3. El «+» del final de cada pis afig un lloc nou en eixe pis, del mateix tipus que l'últim.
  4. La paperera del costat d'un pis («Eliminar pis») només funciona amb el pis de dalt de tot. Als altres diu «Elimina primer els pisos superiors».
  5. La fletxa de la capçalera («Invertir orientació (P1 dalt / P1 baix)») només gira la vista. No canvia la plantilla.

- [ ] **Step 4: Canviar un lloc del tronc** (captura `10-plantilles-tronc-node.png`). Feu clic en un lloc. Davall apareix «Node: …» amb:
  - «Etiqueta»;
  - «Indicador», de fins a 6 caràcters, que eixirà al costat de la persona;
  - «Tipus»: «Segona», «Terça», «Quarta», «Quinta», «Sisena», «Puntal», «Alçadora» o «Xiqueta»;
  - «Pos.» i «Amp.» amb «−» i «+»: on comença el lloc i quant ocupa, en passos de mitja persona (1u és l'amplada d'una persona);
  - la paperera «Elimina node». En una base és «Elimina base».

- [ ] **Step 5: «Estructura del tronc»** (captura `10-plantilles-estructura.png`)
  1. A la dreta es veuen els mateixos pisos. Davall de cada persona (excepte a les bases) hi ha un punt.
  2. **Arrossegueu des del punt fins a la persona que té davall.** Ha de ser al pis just de davall.
     - També podeu fer clic al punt i després clic a una o més persones de davall. Mentrestant, dalt hi diu «Trieu qui té davall …. Premeu Esc per a cancel·lar.»
  3. Una persona pot anar damunt de més d'una, i una persona pot portar-ne més d'una damunt.
  4. Per a esborrar un enllaç, feu clic sobre la línia.
  5. Si un pis és buit, els punts del pis de damunt es desactiven i apareix l'avís, per exemple:
     - «No hi ha bases: afegiu-ne per a indicar damunt de qui va el P2.»;
     - «El P3 està buit: afegiu-hi nodes per a indicar damunt de qui va el P4.»

- [ ] **Step 6: «Si sou de troncs o xicalla»** (és la pàgina de troncs; el bloc diu per què val la pena):
  - **Per què importa l'estructura.** A la pestanya Troncs de l'assignació (pàgina 12), cada pis mostra la diferència d'alçada entre les persones del pis. La insígnia és groga a partir de 5 cm i roja a partir de 10 cm.
  - També hi ha una balança quan algú va damunt de persones que no tenen la mateixa alçada: groga a partir de 3 cm i roja a partir de 5 cm.
  - Sense enllaços, l'app no pot calcular res i mostra «—».
  - L'alçada que es fa servir és l'«Alçada espatlles (cm)» de la fitxa de cada persona (pàgina 03). Si a algú li falta, apareix «?? cm».
  - Llindars: `TRONC_HEIGHT_THRESHOLDS` (`docs/PINYES_MODULE.md` «Alçades acumulades»).
  - **Les direccions** (direcció de tronc, de xicalla i de pinya) no es posen a la plantilla. S'afigen en cada figura des de la pestanya Troncs de l'assignació (pàgina 12).

- [ ] **Step 7: «Si sou de pinyes»:**
  - Les bases que afegiu ací també apareixen al dibuix de la pinya, en un lloc per defecte. Col·loqueu-les a la pestanya «Pinya» seguint l'ordre antihorari (pàgina 09).

- [ ] **Step 8: «Compte amb»**
  - **L'estructura també es copia** quan una figura de l'event rep la primera persona. Si l'afegiu després, eixa figura continuarà sense alçades. Feu l'estructura **abans** d'assignar, o feu «Reinicialitza» (pàgina 13), que en lleva les persones.
  - Si elimineu un pis o un lloc, també s'esborren els enllaços que hi anaven.
  - Les bases són el P1. L'ordre és el de la pinya (antihorari des de dalt a l'esquerra). Si el tronc no quadra amb les bases, mireu l'avís «Ordre incorrecte», que també apareix damunt del tronc en esta pestanya.
  - «Desfer» i «Refer» també desfan els enllaços de l'estructura.

- [ ] **Step 9: «Relacionat»:** `08-plantilles.md`, `09-plantilles-pinya.md` (bases), `12-assignacio-troncs.md` (alçades i direccions), `03-persones.md` («Alçada espatlles (cm)»).

- [ ] **Step 10: Verificació + commit**
  - Obriu `/config/manual/10-plantilles-tronc`. Passeu la checklist de llengua.
  - Comproveu els textos dels avisos contra `tronc-support-editor.component.ts`.
  ```bash
  git add docs/manual/10-plantilles-tronc.md
  git commit -m "docs(manual): write template tronc page"
  ```

---

## Notes per a la demo (bloc 0:25-0:40 de S10, 15 min)

**Dades:**
- Una plantilla que tinga pinya, rengles, bases i un tronc de 2 pisos o més amb l'estructura feta. Per a la BD local, «Branca» (`TARGETS.templateId`).
- A banda, una còpia feta amb «Duplica» per a tocar en directe. Així no es toca l'original, que pot estar en events futurs. S'esborra en acabar.

| Min | Què es fa | Qui mira |
|---|---|---|
| 0-3 | Llista: cerca, targeta, «Duplica» (obri «… (còpia)»). Pestanya «Composicions». A l'editor: barra de dalt, «Alçat», «Desfer», ull de previsualització. **Missatge clau**, explicat amb un exemple: «si dissabte ja hi ha gent posada al Pilar, el que canviem ara no li arriba». | tothom |
| 3-9 | A la còpia, pestanya «Pinya»: afegir un «VENT», arrossegar-lo i mirar «Propietats del node». Bases i ordre antihorari. Pestanya «Rengles»: «Rengla nova», tres clics del centre cap enfora, «Finalitza». Explicar que per això a l'event es podran triar els cordons. | pinyes |
| 9-15 | Pestanya «Tronc»: «Afegeix pis», «+» en un pis, canviar «Tipus», «Pos.» i «Amp.». «Estructura del tronc»: arrossegar un enllaç i esborrar-lo amb un clic. Avançar que a l'assignació es veuran les alçades (pàgina 12). | troncs/xicalla |

**Preguntes probables:**
- *«He canviat la plantilla i a l'assaig no ha canviat res.»* La figura ja tenia gent assignada. «Reinicialitza» a l'assignació, sabent que en lleva tothom.
- *«On és el botó d'alçar?»* No n'hi ha: s'alça sol. Mireu «Alçat» dalt a la dreta.
- *«Puc fer-ho des del mòbil?»* L'editor no s'obri al mòbil, però sí en tauleta.
- *«Per què no puc fer clic a l'agulla en el mode rengles?»* L'agulla, la crossa i el contrafort no van en cap rengla.
- *«On poso la direcció del tronc?»* No va a la plantilla. Es posa a cada figura des de l'assignació, a la pestanya Troncs.
- *«Si esborre una composició, què passa amb els assajos on la vaig posar?»* Res. Les figures ja s'hi havien copiat.
