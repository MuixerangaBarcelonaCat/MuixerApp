# S07: Assignació de troncs, assignació de pinyes i conflictes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objectiu:** escriure les tres pàgines del manual que expliquen l'espai de treball del segment (on es posa cada persona al seu lloc) i els conflictes. És el cor de la demo: troncs i xicalla trien primer, pinyes ompli després, i tots revisen els conflictes.

**Pàgines:**

| Fitxer | Títol (`MANUAL_PAGES`) | Rutes (`<!-- rutes: … -->`) |
|---|---|---|
| `docs/manual/12-assignacio-troncs.md` | Assignació de troncs | `/pinyes/events/:eventId/segments/:segmentId/assign` `/pinyes/events/:eventId/segments/:segmentId/assign/:instanceId` |
| `docs/manual/13-assignacio-pinyes.md` | Assignació de pinyes | `/pinyes/events/:eventId/segments/:segmentId/assign` |
| `docs/manual/14-conflictes.md` | Conflictes | `/events/:id` `/pinyes/events/:eventId/segments/:segmentId/assign` |

**Spec:** `docs/superpowers/specs/2026-10-21-manual-us-dashboard-design.md` · **Pla arrel:** `00-general.md` (plantilla de pàgina, `ManualShot`, `MANUAL_PAGES`, checklist de llengua).

**Fora d'esta secció:** la llista de segments i figures (pestanya «Pinyes i Figures», botons «Assigna»/«Projecta», comptadors i cordons de la llista) és de S06, pàgina 11. Les pestanyes Distribució, Nodes extra i Previsualitza són de S08. Aquí només s'hi enllaça.

---

## Fonts verificades

Tots els textos literals d'este pla s'han copiat d'estos fitxers (rutes relatives a `apps/dashboard/src/app/features/`, excepte les de `libs/`):

| Què | Fitxer |
|---|---|
| Capçalera de l'espai de treball, pestanyes, fletxes, «Ajuda», «Importa …», «Reinicialitza», modal de reinicialitzar | `pinyes/components/segment-workspace/segment-workspace.component.{html,ts}` |
| Pestanya Troncs, minimapa, «+ Figura», moure amb clic dret, modal tàctil | `pinyes/components/segment-workspace/tabs/troncs-tab/troncs-tab.component.{html,ts}` |
| Pestanya Pinyes, dreceres de teclat, avanç automàtic | `pinyes/components/segment-workspace/tabs/pinyes-tab/pinyes-tab.component.{html,ts}` |
| Panell de persones (grups, comptadors, filtres, 🎭, refresc de 10 s) | `pinyes/components/person-panel/person-panel.component.{html,ts}` (`ROSTER_MAX_AGE_MS = 10_000`) |
| Etiquetes dels grups segons la fase | `libs/shared/src/utils/event-phase.util.ts` (`attendanceGroupLabel`) |
| Comptadors «N lliures · N elegibles per a pinya» | `pinyes/services/assignment-state.service.ts` (`freeCountForArea`, `pinyaEligibleCount`) |
| Assignar, moure, intercanviar, desfer, error «Este lloc ja està ocupat.» | `pinyes/services/segment-assignment-actions.service.ts` |
| Banner «S'està movent» | `pinyes/components/move-banner/move-banner.component.html` |
| Diàleg «Persona ja assignada» | `pinyes/components/already-assigned-dialog/already-assigned-dialog.component.ts` |
| Modal d'importació i «Nodes ja ocupats» | `pinyes/components/import-pinya-modal/import-pinya-modal.component.{html,ts}` |
| Regles de la importació (què es copia i què no) | `apps/api/src/modules/node-assignment/node-assignment.service.ts` (`bulkImport`, `getHistory`) |
| Vista del tronc: direccions, pisos, alçades acumulades | `libs/pinyes-render/src/lib/components/tronc-view/tronc-view.component.{html,ts}` |
| Llindars d'alçades | `libs/shared/src/utils/tronc-height.util.ts` (`TRONC_HEIGHT_THRESHOLDS`: pis 5/10 cm, suport 3/5 cm) |
| Colors d'assistència al llenç | `libs/pinyes-render/src/lib/components/figure-canvas/figure-canvas.component.ts` (`ATTENDANCE_COLORS`) |
| Zoom i «Ajusta a la pantalla» | `libs/pinyes-render/src/lib/components/figure-canvas/figure-canvas.component.html` |
| Panell de conflictes | `pinyes/components/segment-conflict-panel/segment-conflict-panel.component.{html,ts}` |
| Què compta com a conflicte | `libs/shared/src/constants/assignment-area.constants.ts` (`conflictRelevantPlacements`) |
| Píndola de conflictes a la llista de segments | `events/components/segment-conflict-pill/segment-conflict-pill.component.{html,ts}` |
| Comptador de conflictes a Participació | `events/components/event-participation/event-participation.component.{html,ts}` |
| Bloqueig 2 dies després de l'event | `apps/api/src/modules/node-assignment/node-assignment.service.ts` (`getLockStatus`, `ASSIGNMENT_LOCK_DAYS` per defecte 2) |
| Pestanyes visibles en pantalles tàctils | `segment-workspace.component.ts` (`TOUCH_TABS`) i `core/services/layout.service.ts` (`pointer: coarse`) |

### Fets del codi que la pàgina ha de reflectir (i que contradiuen l'inventari o la intuïció)

1. **Importació: només dos àmbits per pestanya, no tres.** Des de Troncs s'ofereixen «Tronc» i «Tot»; des de Pinyes, «Pinya» i «Tot». Cada fila té un botó «Importa» (no «Importa Pinya»). La fila «Tot» es diu «Pinya i tronc».
2. **La importació no mira l'assistència.** Copia les persones de la figura d'origen encara que no vinguen a este event. Després d'importar cal revisar els punts de color.
3. **La importació no evita conflictes.** Si una persona importada ja era en un altre lloc del segment, s'hi posa igualment. L'avís ix al missatge final («N persones han quedat en conflicte.»).
4. **La importació sempre copia els nodes extra** de la figura d'origen, siga quin siga l'àmbit triat.
5. **Només s'ofereixen figures de la mateixa plantilla**, les 20 més recents per data (també d'events futurs o del mateix event). Les que no tenen ningú assignat apareixen grises.
6. **El camp d'alçada no filtra, ordena.** Ningú no desapareix de la llista: queden primer els més pròxims a l'alçada escrita. Les persones sense alçada van al final.
7. **L'alçada sempre és relativa** (diferència respecte de 140 cm d'espatlles). El codi té un mode absolut («Alçada absoluta (cm)»), però cap botó no l'activa (`toggleHeightMode` no té cap crida). No l'esmenteu.
8. **La casella «Xicalla» del panell fa servir el camp «Menor de 16» de la persona** (`isXicalla`), no l'etiqueta de categoria XICALLA. Una criatura sense «Menor de 16» marcat ix sempre, encara que la casella estiga desactivada. Si està marcada però li falta l'etiqueta, s'amaga igualment. La casella comença desactivada i canvia sola: s'activa en clicar un lloc del tronc (zona TRONC; `person-panel.component.ts`, `onXicallaChange(selectedNodeZone() === FigureZone.TRONC)`) i es desactiva en clicar qualsevol altre lloc (base, pinya, direcció).
9. **Les etiquetes només reordenen, mai no amaguen ni bloquegen.** Amb un lloc seleccionat, les persones amb una etiqueta pensada per a eixe lloc van primer, amb un punt del color de l'etiqueta (`sortByPosition`). Ningú no queda amagat ni se'n prohibeix l'assignació. L'única excepció és el filtre manual «Totes les etiquetes». És on es nota l'efecte de les etiquetes (pàgina 04).
10. **Els comptadors no compten la xicalla.** «N lliures» = adults confirmats sense cap lloc en este segment (a Troncs: sense lloc al tronc). «N elegibles per a pinya» = adults confirmats que no són al tronc.
11. **En pantalla tàctil (tauleta o mòbil) només hi ha les pestanyes Pinyes i Troncs**, i el panell de persones s'obri en una finestra en tocar un lloc. En mòbil (menys de 640 px) no hi ha «Importa …», «Reinicialitza» ni «Ajuda».
12. **Arrossegar només funciona entre llocs** (d'una persona ja posada a un altre lloc). No es pot arrossegar des de la llista de persones. Arrossegar no funciona en pantalla tàctil: allà es fa amb toc mantingut.
13. **Intro amb el cercador buit assigna la primera persona lliure** de la llista al lloc seleccionat.
14. **«Reinicialitza» també esborra els nodes extra** de la figura i buida l'historial de «Desfer».
15. **Els canvis d'un altre tècnic en el mateix segment no apareixen sols** al llenç: cal canviar de pestanya o recarregar. El que sí es manté fresc és l'assistència (refresc en clicar un lloc si la llista té més de 10 s). Si dos tècnics ocupen el mateix lloc alhora, el segon rep «Este lloc ja està ocupat.».
16. **Bloqueig:** 2 dies després de la data de l'event, el segment queda «Bloquejat» i no es pot canviar res (els botons queden desactivats).
17. **L'«Ajuda» de l'espai de treball és la del creador de figures** («Ajuda del creador de figures») i té dreceres que no funcionen ací: «⌘/Ctrl + 1…8», «⌘/Ctrl + 9» i «E» (alternar Pinyes/Troncs a la projecció). La pàgina no les ha d'esmentar. (Vegeu «Incidències trobades», al final.)

---

### Task A: captures (`shots/s07.ts`)

**Files:**
- Create: `apps/dashboard-e2e/src/manual/shots/s07.ts`
- Modify: `apps/dashboard-e2e/src/manual/shots/index.ts` (afig `...s07`)

**Dades per a les captures.** El segment de `TARGETS.workspace*` pot ser d'un event antic i, per tant, «Bloquejat» (els botons «Importa …» i «Reinicialitza» queden desactivats i Playwright s'esperaria en va). Feu servir un **segment de demostració** en un event futur (el mateix que es prepara per a la demo, vegeu «Notes per a la demo»), amb:
- dues figures com a mínim (una amb tronc i base) i alguna persona ja assignada a cada una;
- unes quantes persones marcades com a «Ve» a la pestanya «Assistència»;
- una plantilla que ja s'haja fet servir en events anteriors amb assignacions (perquè «Importa …» tinga historial).

Per als conflictes cal un segment que **ja** tinga una persona en dos llocs. Trobeu-ne un a la BD de desenvolupament (només lectura):

```sql
SELECT es."eventId", na."segmentId", p.alias, count(*) AS llocs
FROM node_assignments na
JOIN event_segments es ON es.id = na."segmentId"
JOIN persons p ON p.id = na."personId"
GROUP BY es."eventId", na."segmentId", p.alias
HAVING count(*) > 1
LIMIT 5;
```

Si no n'hi ha cap, creeu-lo a mà al segment de demostració (assigneu una persona a dos llocs amb «Assignar igualment») **abans** d'executar les captures. Les captures mai no ho fan.

**Regles de seguretat (obligatòries):** les captures no assignen, no importen, no reinicialitzen, no canvien cordons ni modes i no confirmen res. Només naveguen, canvien de pestanya, seleccionen un lloc **buit** (el servei d'estat es reinicia en carregar el segment, així que no hi ha cap persona «pendent» que s'hi puga assignar), obrin un modal i el fotografien. No es fan captures de:
- «Persona ja assignada»: per a obrir-lo cal triar una persona ja assignada amb un lloc seleccionat, i si no hi ha conflicte l'app l'assigna directament;
- «Nodes ja ocupats»: només ix després de prémer «Importa», i si no hi ha llocs ocupats la importació es fa directament.

Estos dos diàlegs es descriuen amb text.

**Dependència del runner (Task 3 del pla arrel), avisar abans d'executar:** `spaGoto` dispara un `popstate`. L'espai de treball i la projecció escolten `popstate` i fan «torna arrere» (`SegmentWorkspaceComponent.onPopState`, `ProjectionViewComponent.onPopState`). Si la captura següent es fa amb `spaGoto` mentre encara s'hi està, la navegació es creua i es pot acabar en una altra pàgina. El runner ha de **sortir** abans de navegar si l'URL actual conté `/pinyes/events/`:
1. prémer `Escape` dues vegades (tanca modals, cancel·la moviments i el mode de col·locació);
2. si l'URL encara conté `/assign`, fer clic a `button[aria-label="Torna arrere"]`; si conté `/project`, prémer `Escape`;
3. esperar que l'URL canvie.

Si Task 3 ja està feta sense esta guarda, afegiu-la en esta task, a `manual-shots.spec.ts`.

**Nota sobre `highlight`:** `lib-button`, `lib-card` i `lib-button-group` tenen l'amfitrió amb `display: contents`. El runner ja passa el contorn al primer fill, però ací es fan servir directament selectors del fill (per exemple, `button[aria-label="…"]`). Quan el selector en trobe més d'un, el runner ha de ressaltar el primer (`locator.first()`).

- [ ] **Step 1: Escriu `s07.ts`**

```ts
import type { Page } from '@playwright/test';
import type { ManualShot } from '../manual-shot';
import { TARGETS } from '../../audit/audit-targets';

// Segment de demostració: event futur, no bloquejat. Vegeu «Dades per a les captures».
const EV = process.env['MANUAL_WS_EVENT_ID'] ?? TARGETS.workspaceEventId;
const SEG = process.env['MANUAL_WS_SEGMENT_ID'] ?? TARGETS.workspaceSegmentId;
const WS = `/pinyes/events/${EV}/segments/${SEG}/assign`;

// Segment amb almenys una persona en dos llocs (consulta SQL de dalt).
const C_EV = process.env['MANUAL_CONFLICT_EVENT_ID'] ?? EV;
const C_SEG = process.env['MANUAL_CONFLICT_SEGMENT_ID'] ?? SEG;

const IMPORT_TRIGGER = 'button[aria-label="Importa les assignacions d\'una figura anterior"]';
const RESET_TRIGGER = 'button[aria-label^="Reinicialitza una figura"]';

/** Si el segment té més d'una figura, primer ix «Selecciona una figura»: tria la primera. */
async function pickFirstFigureIfAsked(page: Page): Promise<void> {
  const picker = page.locator('dialog[open]').filter({ hasText: 'Selecciona una figura' });
  if (await picker.isVisible({ timeout: 1500 }).catch(() => false)) {
    await picker.locator('ul[role="list"] button').first().click();
  }
}

/** Obri «Importa …», tria la primera figura anterior amb assignacions i espera la previsualització. NO prem «Importa». */
async function openImportPreview(page: Page): Promise<void> {
  await page.locator(IMPORT_TRIGGER).click();
  await pickFirstFigureIfAsked(page);
  const list = page.locator('[role="listbox"][aria-label="Pinyes anteriors"]');
  await list.waitFor();
  await list.locator('button[role="option"]:not([disabled])').first().click();
  await page.waitForTimeout(1500);
}

export const s07: ManualShot[] = [
  // ── 12: espai de treball i pestanya Troncs ──────────────────────────────
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
    // Selecciona un lloc BUIT del tronc: la llista s'ordena i «Xicalla» s'activa sola.
    prepare: async (page) => {
      await page.locator('app-troncs-tab .floor-grid .tronc-node:not(.assigned)').first().click();
      await page.waitForTimeout(1200); // refresc de la llista (>10 s)
    },
    highlight: 'app-troncs-tab app-person-panel',
  },
  {
    file: '12-panell-persones.png',
    app: 'dashboard',
    path: `${WS}?tab=troncs`,
    ready: '[data-testid="person-panel-counters"]',
    // Desplega «Altres» per a ensenyar «No ve» i «Pendents».
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
    highlight: 'app-troncs-tab .floor-variance',
    clip: 'app-troncs-tab [data-figure-card]',
  },
  {
    file: '12-troncs-moure.png',
    app: 'dashboard',
    path: `${WS}?tab=troncs`,
    ready: 'app-troncs-tab .floor-grid .tronc-node.assigned',
    // Clic dret = començar a moure. No es clica cap destí: el runner surt amb Escape.
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

  // ── 13: pestanya Pinyes ─────────────────────────────────────────────────
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
    // Només obri la confirmació. MAI no es prem «Elimina-ho tot».
    prepare: async (page) => {
      await page.locator(RESET_TRIGGER).click();
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

  // ── 14: conflictes ──────────────────────────────────────────────────────
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
    // Activa «Només conflictes» (és un filtre, no canvia dades).
    prepare: async (page) => {
      await page.getByTestId('participation-conflict-counter').click();
    },
    highlight: '[data-testid="participation-conflict-counter"]',
  },
];
```

- [ ] **Step 2: Afig `s07` a `shots/index.ts`.**

- [ ] **Step 3: Executa-ho**

Run: `pnpm run dev:up && MANUAL_WS_EVENT_ID=… MANUAL_WS_SEGMENT_ID=… MANUAL_CONFLICT_EVENT_ID=… MANUAL_CONFLICT_SEGMENT_ID=… E2E_EMAIL=… E2E_PASSWORD=… SHOTS=12,13,14 pnpm run docs:manual-shots`
Expected: 13 PNG nous a `docs/manual/img/`, cap captura fallida.

- [ ] **Step 4: Revisa cada PNG**
  - Cap nom complet ni dada personal: només àlies. La columna «Nom» de Participació està amagada per defecte; si hi apareix, amagueu-la i torneu-ho a fer.
  - Cap badge «Bloquejat» a la capçalera (si ix, el segment no és el de demostració).
  - `12-troncs-lloc-seleccionat.png`: lloc ressaltat, «Xicalla» activada i persones amb punt de color dalt de tot.
  - `12-importa-tronc.png`: ha d'eixir el títol «Importació de tronc anterior», amb les files «Tronc» i «Pinya i tronc».
  - `13-reinicialitza.png`: ha d'eixir el modal amb «Elimina-ho tot» i, a la BD, l'assignació ha de continuar intacta (comproveu-ho obrint el segment).

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard-e2e/src/manual/shots/s07.ts apps/dashboard-e2e/src/manual/shots/index.ts docs/manual/img/12-*.png docs/manual/img/13-*.png docs/manual/img/14-*.png
git commit -m "docs(manual): add screenshots for assignment and conflicts"
```

---

### Task B: `12-assignacio-troncs.md`

**Files:** Create `docs/manual/12-assignacio-troncs.md`

Primera línia: `<!-- rutes: /pinyes/events/:eventId/segments/:segmentId/assign /pinyes/events/:eventId/segments/:segmentId/assign/:instanceId -->`

**Esquema de la pàgina:**

#### `# Assignació de troncs`

#### Per a què serveix
L'espai de treball del segment és la pantalla on es posa cada persona al seu lloc. Té cinc pestanyes; esta pàgina explica la part comuna i la pestanya «Troncs», que és la primera que es fa servir: troncs i xicalla trien primer, i pinyes ompli després amb la gent que queda.

Explicar el vocabulari una sola vegada: **lloc** (cada caixa de la figura on va una persona), **figura** (la construcció), **segment** (cada prova de l'event).

#### On és
- Event → pestanya «Pinyes i Figures» → al segment, «Assigna». Si la llista està en mode «Troncs», s'obri directament la pestanya «Troncs».
- O cliqueu el nom d'una figura a la llista: s'obri amb eixa figura seleccionada.
- També des de la pestanya «Participació» de l'event, clicant una casella (pàgina 17).

Captura: `![Espai de treball del segment](img/12-espai-treball.png)`

#### Pas a pas

**A. Conéixer la pantalla (capçalera)** — de dalt a l'esquerra cap a la dreta:
1. Fletxa de tornar (té l'etiqueta «Torna arrere»): torna a l'event, a la pestanya d'on veníeu.
2. Nom del segment. Si ix «Bloquejat», ja han passat 2 dies de l'event i no es pot canviar res.
3. Pestanyes «Pinyes», «Troncs», «Distribució», «Nodes extra» i «Previsualitza». L'app recorda l'última que heu fet servir (Pinyes o Troncs) en este navegador.
4. Fletxes de segment anterior i següent, amb la posició («3/7»). En canviar de segment, es manté la pestanya.
5. «Ajuda» (icona d'interrogant).
6. A la dreta: «Importa tronc» (a la pestanya Troncs) o «Importa pinya» i «Reinicialitza» (a la pestanya Pinyes).

**B. La pestanya Troncs** — una targeta per figura amb tronc, del mateix color que la figura al minimapa:
- Dins de cada targeta:
  - «Direccions»: tres espais, «Tronc», «Xicalla» i «Pinya». Cada un té «+» per a afegir una persona que dirigeix i una paperera per a llevar un espai buit.
  - Els pisos del tronc, amb la base a baix o dalt segons el botó d'invertir orientació («Invertir orientació (P1 dalt / P1 baix)»).
  - Al costat de cada pis, quants llocs hi ha plens («3/4»).
- Cada lloc ple mostra:
  - l'àlies de la persona;
  - l'alçada relativa;
  - l'emoji d'observacions, si en té;
  - un punt de color d'assistència (vegeu la taula de colors).
- Els llocs buits mostren el nom del lloc.
- Si al segment li falta una figura, «Figura» (amb un «+») obri el selector de figures, el mateix que «+ Figura» de la llista de segments.
- El botó redó de baix a la dreta («Mostra o amaga el mapa de figures») obri o tanca el minimapa: un plànol de com estan col·locades les figures, amb els mateixos colors que les targetes. Serveix per a orientar-se quan hi ha moltes figures.

Taula de colors del punt d'assistència (dels codis `getAttendanceColor` / `ATTENDANCE_COLORS`):

| Color | Abans del dia de l'event | El dia i després |
|---|---|---|
| verd | ve | ha arribat |
| taronja/groc | — | diu que venia però no ha arribat |
| vermell | no ve | no ve o no ha contestat |
| gris (només al tronc) / groc (al llenç de pinya) | no ha contestat | — |

Deixeu clar que la taula és d'abans/del dia segons la data de l'event. Verifiqueu el gris i el groc en la captura (el tronc i el llenç fan servir colors una mica diferents per a «no ha contestat»).

**C. Posar una persona en un lloc**
1. Feu clic en un lloc buit. Queda ressaltat i el cursor salta al cercador «Cerca per nom o àlies...» del panell de la dreta.
2. Escriviu unes lletres de l'àlies. Ixen fins a 5 resultats; trieu-ne un amb el ratolí o amb les fletxes i Intro.
3. O feu clic directament en una persona de la llista.
4. La persona queda posada i la selecció **salta sola al lloc buit següent** del tronc: base, primer pis, segon pis… i les direccions al final. Podeu continuar escrivint sense tornar a clicar.
5. Tab i Maj+Tab passen al lloc següent o anterior sense assignar.

Al revés també funciona: cliqueu primer una persona de la llista (queda marcada) i després el lloc buit.

Captura: `![Lloc seleccionat i llista ordenada](img/12-troncs-lloc-seleccionat.png)`

**D. Canviar, moure o llevar**
- **Canviar la persona d'un lloc:** cliqueu el lloc ple i trieu una altra persona. La primera queda lliure.
- **Llevar:** cliqueu el lloc ple i «Desassigna» (al panell, davall dels filtres). També funciona la tecla Retrocés amb el cercador buit.
- **Moure o intercanviar:**
  - arrossegueu la persona d'un lloc a un altre: si el destí és buit, s'hi mou; si és ple, les dues persones s'intercanvien. També funciona entre figures diferents;
  - o feu clic dret sobre la persona: ix «S'està movent …»; cliqueu el lloc de destí. Esc o la creu cancel·len.
- **Desfer i Refer:** els dos botons de dalt a la dreta, o Ctrl+Z i Ctrl+Maj+Z. Desfan assignar, llevar, moure i intercanviar.

Captura: `![Moure una persona](img/12-troncs-moure.png)`

**E. El panell de persones**

Captures: `![Panell de persones](img/12-panell-persones.png)`

- Capçalera:
  - «Persones», amb el botó de refrescar;
  - el comptador «N lliures»: adults que vénen i encara no tenen lloc al tronc d'este segment. La xicalla no hi compta.
- Filtres:
  - **Alçada:** escriviu una diferència («+5», «-10») respecte de 140 cm d'espatlles. La llista **no amaga ningú**: posa primer qui s'hi acosta més. «Max» posa primer els més alts; «Min», els més baixos. Les persones sense alçada registrada van al final.
  - **«Xicalla»:** mostra o amaga les persones amb «Menor de 16» marcat a la seua fitxa. No mira l'etiqueta de xicalla. Comença desactivada i canvia sola: s'activa en clicar un lloc del tronc i es desactiva en clicar una base, una direcció o un lloc de pinya. La podeu tornar a canviar a mà.
  - **«Totes les etiquetes»:** mostra només qui porta una etiqueta. Té un cercador d'etiquetes, i la «✕» lleva el filtre. És l'únic lloc on una etiqueta amaga gent.
- Grups (el nom canvia segons el dia):

  | Grup | Abans del dia de l'event | El dia de l'event | Després |
  |---|---|---|---|
  | persones que vénen | «Ve (N)» | «Ha arribat (N)» | «Va vindre (N)» |
  | han dit que venien però no han arribat | — | «No ha arribat (N)» | «No presentat (N)» |
  | ja posades a la pinya | «A la pinya (N)» | igual | igual |
  | ja posades al tronc o a una direcció | «Al tronc (N)» | igual | igual |
  | la resta, plegat | «Altres (N)»: «No ve» i «Pendents» | «Altres (N)»: «No vindrà», que inclou els que no han contestat | «Altres (N)»: «No va vindre» i «Sense resposta» |

  Comproveu la fila «Després» en una captura d'un event passat: el codi fa servir les mateixes funcions, però no s'ha vist en pantalla.
- **Qui ix primer:**
  - quan hi ha un lloc seleccionat, les persones amb una etiqueta pensada per a eixe lloc van dalt de tot, amb un punt del color de l'etiqueta;
  - la resta continua a la llista i es pot posar igualment: l'etiqueta només suggereix, no prohibeix;
  - per això és important tindre les etiquetes al dia (pàgina 04).
- **Icones al costat de l'àlies:**
  - l'emoji o la icona d'observacions: passeu-hi el ratolí per a llegir la nota;
  - 🎭: «Vindrà a la propera actuació». Ajuda a prioritzar qui assaja allò que farà a l'actuació.
- **Fitxa ràpida:** en passar el ratolí per una persona ix una fitxa amb l'assistència, l'alçada, les etiquetes i les observacions.
- **Trobar on és algú:** cliqueu una persona d'«A la pinya» o «Al tronc» sense cap lloc seleccionat i l'app hi va (si cal, canvia de pestanya).
- **L'assistència sempre està al dia:**
  - cada vegada que cliqueu un lloc, si la llista té més de 10 segons, es torna a demanar;
  - així, si algú confirma des de la PWA o si es passa llista el dia de l'assaig, ho veieu mentre assigneu;
  - el botó de refrescar ho fa a l'instant.

  Ho explica per què dos tècnics poden treballar alhora en segments diferents sense trepitjar-se.

**F. Alçades del tronc** (avisos de `analyzeTroncHeights`)

Captura: `![Diferències d'alçades](img/12-troncs-alcades.png)`

- Cada lloc ple mostra l'alçada relativa de la persona.
- A la dreta de cada pis, l'app calcula a quina alçada queden les espatlles de cada persona amb la figura alçada, sumant les persones de davall. Mostra:
  - «N cm»: la diferència entre la persona més alta i la més baixa del pis. Es posa taronja a partir de 5 cm i roja a partir de 10 cm;
  - un xip amb una balança i «N cm»: una persona que va damunt de dues o més que no estan igualades. Es posa taronja a partir de 3 cm i roja a partir de 5 cm. Passeu-hi el ratolí: ressalta els llocs implicats i diu «La diferència d'alçades és 4 cm, entre A i B, que porten C.»;
  - «?? cm»: algú del pis o de davall no té l'alçada registrada;
  - «—»: encara no hi ha prou gent posada al pis, o la plantilla no diu qui va damunt de qui. Esta part la fa la plantilla (pàgina 10, «Estructura del tronc»).
- Els límits (5/10 i 3/5 cm) són fixos de moment.

**G. Importar un tronc anterior («Importa tronc»)**

Captura: `![Importació de tronc anterior](img/12-importa-tronc.png)`

1. Feu clic a «Importa tronc». Si el segment té més d'una figura, trieu-ne una a «Selecciona una figura».
2. A l'esquerra ix la llista de figures fetes amb la **mateixa plantilla** en altres segments o events (les 20 més recents), amb:
   - la data;
   - el segment;
   - quants llocs tenien gent («12/20 assignades»);
   - el resum del tronc.
   Les grises no tenen ningú assignat.
3. Cliqueu-ne una per a veure-la a la dreta. Els botons «Tronc» i «Tot» canvien què es previsualitza.
4. Davall de la figura triada ixen dues files:
   - «Tronc»: només el tronc, la base i les direccions;
   - «Pinya i tronc»: tota la figura.
   Cada una diu quantes persones portaria. Premeu «Importa» en la que vulgueu.
5. Si a la figura de destí ja hi ha llocs ocupats, ix «Nodes ja ocupats»:
   - els llocs ocupats no es toquen, i la resta s'importa;
   - «Entesos, importa» continua i «Cancel·la» no fa res.
6. Ix un missatge amb quantes assignacions s'han importat, quantes s'han omés i si alguna persona ha quedat en conflicte.

#### Si sou de troncs o xicalla
- Sou els primers: assigneu el tronc i les direccions abans que pinyes comence.
- Per a la xicalla:
  - en clicar un lloc del tronc, la casella «Xicalla» ja s'activa sola;
  - si busqueu un adult per a un pis de dalt, desactiveu-la;
  - la casella es guia per «Menor de 16» (fitxa de la persona, pàgina 03), no per l'etiqueta. Si una criatura ix com a adult o no ix, reviseu eixe camp.
- Abans de donar el tronc per bo, mireu les diferències d'alçada de cada pis i els xips de la balança.
- «Importa tronc» és la manera ràpida de repetir el tronc d'un assaig anterior. Després repasseu els punts de color: la importació no mira qui ve.
- Si treballeu des de la tauleta el dia de l'assaig:
  - toqueu un lloc i ix la llista en una finestra («Assigna una persona» o «Canvia la persona»);
  - per a moure algú, mantingueu el dit sobre la persona i toqueu el destí;
  - en tauleta només hi ha les pestanyes «Pinyes» i «Troncs».

#### Si sou de pinyes
- Normalment no toqueu esta pestanya. Ací veureu qui ja és al tronc: eixes persones ixen a «Al tronc» del vostre panell i no compten a «elegibles per a pinya».

#### Compte amb
- **La importació copia les persones encara que no vinguen.** Després d'importar, busqueu els punts rojos o grisos i substituïu eixes persones.
- **La importació pot crear conflictes:** si una persona importada ja era en un altre lloc del segment, s'hi posa igualment. Mireu la barra roja de conflictes (pàgina 14).
- **La importació porta també els nodes extra** de la figura d'origen, encara que només importeu el tronc.
- **El camp d'alçada no filtra,** només ordena. Si «no trobeu» algú, és més avall.
- **Intro amb el cercador buit** posa la primera persona lliure de la llista al lloc seleccionat.
- **Dos tècnics en el mateix segment:**
  - no veureu els canvis de l'altre fins que no canvieu de pestanya o recarregueu;
  - si tots dos ocupeu el mateix lloc, el segon rep «Este lloc ja està ocupat.»;
  - repartiu-vos els segments.
- **Per a moure el llenç** (pestanya Pinyes) no hi ha d'haver cap lloc seleccionat. Premeu Esc primer.
- **«Bloquejat»:** 2 dies després de l'event ja no es pot canviar res.
- **L'«Ajuda»** és la del creador de figures. Algunes dreceres que hi apareixen no funcionen ací (vegeu S07 «Incidències trobades»). No hi remeteu el lector.

#### Relacionat
- [Segments i figures](11-segments-i-figures.md)
- [Assignació de pinyes](13-assignacio-pinyes.md)
- [Conflictes](14-conflictes.md)
- [Plantilla: tronc](10-plantilles-tronc.md) («Estructura del tronc», necessària per a les alçades)
- [Etiquetes](04-etiquetes.md)
- [Participació](17-participacio.md)

- [ ] **Step 1: Escriu la pàgina** seguint l'esquema. No escrigueu «node», «instància» ni «snapshot»: digueu «lloc», «figura» i «segment».
- [ ] **Step 2: Verifica:** obriu `/config/manual/12-assignacio-troncs`, comproveu que les 6 captures es veuen i que els enllaços naveguen dins de l'app. Passeu la checklist de llengua del pla arrel.
- [ ] **Step 3: Commit:** `git add docs/manual/12-assignacio-troncs.md && git commit -m "docs(manual): add tronc assignment page"`

---

### Task C: `13-assignacio-pinyes.md`

**Files:** Create `docs/manual/13-assignacio-pinyes.md`

Primera línia: `<!-- rutes: /pinyes/events/:eventId/segments/:segmentId/assign -->`

**Esquema de la pàgina:**

#### `# Assignació de pinyes`

#### Per a què serveix
Pestanya «Pinyes» de l'espai de treball: tota la pinya del segment en un sol dibuix, amb totes les figures col·locades com a la distribució. És on pinyes ompli els llocs de pinya amb la gent que queda després de troncs.

#### On és
Espai de treball del segment (pàgina 12) → pestanya «Pinyes». Si la llista de segments està en mode «Pinyes», «Assigna» ja l'obri.

Captura: `![Pestanya Pinyes](img/13-pinyes.png)`

#### Pas a pas

**A. Moure's pel dibuix**
- Roda del ratolí: zoom. També Ctrl+ i Ctrl−, o el selector de percentatge de baix a l'esquerra.
- Arrossegueu el fons per a moure el dibuix. Només funciona si no hi ha cap lloc seleccionat (premeu Esc). El botó del mig del ratolí sempre funciona.
- «Ajusta a la pantalla» (botó de la cantonada): torna a veure-ho tot.
- Si el segment no té cap figura amb pinya, ix «Este segment no té cap figura amb pinya.».

**B. Assignar, igual que a Troncs** (remeteu a la pàgina 12, apartat C, i resumiu):
- Clic al lloc buit, escriviu al cercador i trieu. També funciona al revés: primer la persona i després el lloc.
- Després d'assignar, la selecció salta sola al lloc buit següent en este ordre: base, agulla, crossa, contrafort, i després cordó per cordó (mans, vents, laterals…), cordons oberts i la resta.
- Tab i Maj+Tab: lloc següent o anterior.
- Supr o Retrocés amb un lloc ple seleccionat: el deixa lliure.
- Esc: lleva la selecció i cancel·la un moviment.
- Moure o intercanviar: arrossegueu una persona a un altre lloc, o feu clic dret i cliqueu el destí. Mentre es mou, ix «S'està movent …», que té una creu per a cancel·lar.
- «Desfer» i «Refer»: dalt a la dreta del dibuix, o Ctrl+Z i Ctrl+Maj+Z.
- Al dibuix, cada persona porta el punt de color d'assistència i, si escau, 🎭. Una vora roja vol dir conflicte (pàgina 14).

**C. Els comptadors del panell**
- «N lliures»: adults confirmats (que «vénen» o «han arribat») sense **cap** lloc en este segment, ni a la pinya ni al tronc.
- «N elegibles per a pinya»: adults confirmats que no són al tronc. És el màxim de gent que podeu posar a la pinya sense traure ningú del tronc.
- Cap dels dos no compta la xicalla.
- Com que el Dashboard no té cap comptador de «mans necessàries contra gent apuntada», combineu-los amb la insígnia de la llista de segments («23/35 pinyes, 29/45 total», pàgina 11):
  - si «elegibles per a pinya» és menor que els llocs de pinya que falten, no hi ha prou gent;
  - en eixe cas, reduïu cordons (pàgina 11 o 15) o parleu amb troncs.

**D. «Persona ja assignada»** (descripció textual, sense captura)
- Quan ix: teniu un lloc seleccionat i trieu una persona que ja és en un altre lloc del segment (des del cercador, o des d'«A la pinya» o «Al tronc»).
- Diu «X ja és Y a Z.» i llista tots els llocs de la persona, amb una etiqueta «Tronc», «Pinya» o «Direcció».
- Si un dels llocs és al tronc, ho avisa en roig.
- Botons:
  - «Moure ací» (el principal): la porta al lloc nou i la lleva de tots els anteriors;
  - «Veure col·locació»: va on és ara;
  - «Assignar igualment»: la deixa als dos llocs. Això crea un conflicte;
  - «Cancel·lar».
- Excepció: una persona de «Direcció pinya» es pot posar a la pinya de la mateixa figura sense que isca el diàleg. No és conflicte.

**E. «Importa pinya»**

Captura: `![Importació de pinya anterior](img/13-importa-pinya.png)`

- És igual que «Importa tronc» (pàgina 12, apartat G), però amb el títol «Importació de pinya anterior» i les files «Pinya» i «Pinya i tronc».
- Avís per a pinyes: **no trieu «Pinya i tronc»** si troncs ja ha fet la seua feina. Els llocs ocupats no es toquen, però sí que s'ompliran els llocs de tronc que troncs haja deixat buits.

**F. «Reinicialitza»**

Captures: `![Botons de la capçalera](img/13-pinyes-capcalera.png)` i `![Confirmació de reinicialitzar](img/13-reinicialitza.png)`

- Quan ix: només a la pestanya «Pinyes», i només si alguna figura del segment ja té gent assignada.
- Si hi ha més d'una figura, primer demana quina («Selecciona una figura»).
- La confirmació diu: «Esta acció eliminarà N assignacions i tornarà la figura a la plantilla original. Les persones assignades quedaran lliures.» i «Esta acció no es pot desfer.». El botó és «Elimina-ho tot».
- Què s'esborra:
  - **totes** les persones de la figura, **també les del tronc i les direccions**;
  - els nodes extra afegits a la figura;
  - l'historial de «Desfer».
- Per a què serveix: la figura torna a llegir la plantilla. Feu-lo servir si algú ha canviat la plantilla i voleu els canvis en este segment.
- Explicació sense tecnicismes:
  - mentre una figura no té ningú assignat, segueix la plantilla;
  - quan s'hi posa la primera persona, la figura es copia i els canvis posteriors de la plantilla ja no li arriben;
  - «Reinicialitza» desfà eixa còpia.

#### Si sou de pinyes
- Espereu que troncs i xicalla hagen acabat el segment, o, si més no, el tronc de cada figura.
- Comenceu amb «Importa pinya» (fila «Pinya») si hi ha un assaig anterior semblant. Després:
  - repasseu els punts rojos i grisos: la importació no mira qui ve;
  - mireu la barra de conflictes.
- Ompliu de dins cap a fora deixant que la selecció avance sola: només cal escriure l'àlies i prémer Intro.
- Abans de començar, mireu «elegibles per a pinya». Si no arriba, reduïu cordons.

#### Si sou de troncs o xicalla
- No cal que hi entreu. Si necessiteu algú que pinyes ja ha posat, parleu-ho: si el poseu igualment amb «Assignar igualment», quedarà en conflicte.
- **No premeu «Reinicialitza»:** també esborra el tronc.

#### Compte amb
- **«Reinicialitza» esborra també el tronc i les direccions** de la figura, i no es pot desfer.
- **«Importa pinya» amb «Pinya i tronc»** pot omplir llocs de tronc.
- **«Assignar igualment» crea un conflicte** a posta. Feu-lo servir només si la persona realment farà les dues coses (per exemple, una direcció).
- **Per a moure el dibuix**, primer premeu Esc perquè no hi haja cap lloc seleccionat.
- **En tauleta**, tocar un lloc obri la llista en una finestra i no hi ha avanç automàtic: cada lloc és toc → triar. Per a moure algú, cal mantindre el dit.

#### Relacionat
- [Assignació de troncs](12-assignacio-troncs.md) (com funciona el panell de persones)
- [Conflictes](14-conflictes.md)
- [Distribució i nodes extra](15-distribucio-i-nodes-extra.md)
- [Segments i figures](11-segments-i-figures.md)
- [Plantilla: pinya i rengles](09-plantilles-pinya.md)

- [ ] **Step 1: Escriu la pàgina.** No repetiu el panell de persones: remeteu a la pàgina 12, apartat E.
- [ ] **Step 2: Verifica** al visor i amb la checklist de llengua.
- [ ] **Step 3: Commit:** `git add docs/manual/13-assignacio-pinyes.md && git commit -m "docs(manual): add pinya assignment page"`

---

### Task D: `14-conflictes.md`

**Files:** Create `docs/manual/14-conflictes.md`

Primera línia: `<!-- rutes: /events/:id /pinyes/events/:eventId/segments/:segmentId/assign -->`

**Esquema de la pàgina:**

#### `# Conflictes`

#### Per a què serveix
Hi ha conflicte quan **una persona té dos llocs o més en el mateix segment**: no pot estar en dos llocs alhora. L'app **mai no ho impedeix**, només ho avisa, perquè de vegades és volgut o és temporal mentre es reorganitza. Esta pàgina diu on es veuen i com es resolen.

#### Què compta com a conflicte
- Tronc i tronc, tronc i pinya, o pinya i pinya, en figures iguals o diferents **del mateix segment**.
- Una direcció també compta, amb una excepció: una persona amb «Direcció pinya» d'una figura i un lloc a la pinya d'**eixa mateixa** figura no és conflicte.
- Estar en segments diferents no és mai conflicte.
- No tindre cap lloc tampoc no ho és.

#### On es veuen
1. **Llista de segments** (event → «Pinyes i Figures»):
   - una píndola roja «N conflictes» al costat del segment, on N és el nombre de persones;
   - passeu-hi el ratolí: ix la llista de persones, amb cada lloc etiquetat «Tronc», «Pinya» o «Direcció»;
   - al final diu «Resoleu-los des de l'assignació.».

   Captura: `![Píndola de conflictes](img/14-conflictes-llista-segments.png)`
2. **Espai de treball:**
   - una barra roja davall de la capçalera, «N persones en conflicte», que es veu des de les cinc pestanyes;
   - al llenç i al tronc, els llocs de la persona en conflicte tenen una vora roja.
3. **Participació** (pàgina 17):
   - a la capçalera, «N persones en dos llocs alhora»;
   - davant de l'àlies, el signe «‼»;
   - les caselles en conflicte, en roig.

#### Pas a pas: resoldre un conflicte
1. A l'espai de treball, a la barra roja, feu clic a «Mostra».

   Captura: `![Panell de conflictes](img/14-panell-conflictes.png)`
2. Ix una targeta per persona, amb tots els seus llocs: l'etiqueta de l'àrea, la figura i el lloc. Si no hi caben, useu les fletxes «Conflicte anterior» i «Conflicte següent» o desplaceu-les.
3. Per a cada lloc:
   - l'ull («Veure on està assignada») o el nom de la figura us hi porten, canviant de pestanya si cal;
   - la paperera («Treure aquesta assignació») deixa lliure eixe lloc. No demana confirmació, però es pot desfer amb «Desfer».
4. Quan la persona ja només té un lloc, la targeta desapareix. Quan no en queda cap, desapareix la barra.
5. Alternativa: aneu al lloc, cliqueu-lo i poseu-hi una altra persona.

**Des de Participació:**
1. Feu clic a «N persones en dos llocs alhora»: s'activa el filtre «Només conflictes».
2. Cliqueu la casella del segment: s'obri l'espai de treball en eixe segment i figura.

Captura: `![Conflictes a Participació](img/14-participacio-conflictes.png)`

#### Si sou de pinyes
- Normalment el conflicte ve de posar a la pinya algú que troncs ja tenia, o d'una importació.
- La regla del flux: **el tronc té prioritat**. Lleveu el lloc de pinya i busqueu una altra persona.

#### Si sou de troncs o xicalla
- Si importeu un tronc, mireu la barra roja just després: el missatge final ja diu quantes persones han quedat en conflicte.
- Si una persona ha de fer realment dues coses en el mateix segment (per exemple, dirigir i ser a la pinya d'una altra figura), deixeu-ho així. És un avís, no un error.

#### Compte amb
- **Una importació pot crear conflictes** sense preguntar-ho (pàgines 12 i 13).
- **«Assignar igualment»** al diàleg «Persona ja assignada» crea un conflicte a posta.
- **La barra roja comença plegada:** el nombre ja indica que hi ha feina.
- **Amb el segment bloquejat** (2 dies després de l'event), els botons del panell estan desactivats.
- **Els conflictes no impedeixen publicar ni projectar.** Els membres veuran la persona en dos llocs a la PWA.

#### Relacionat
- [Assignació de troncs](12-assignacio-troncs.md)
- [Assignació de pinyes](13-assignacio-pinyes.md)
- [Participació](17-participacio.md)
- [Segments i figures](11-segments-i-figures.md)

- [ ] **Step 1: Escriu la pàgina.**
- [ ] **Step 2: Verifica** al visor i amb la checklist de llengua.
- [ ] **Step 3: Commit:** `git add docs/manual/14-conflictes.md && git commit -m "docs(manual): add conflicts page"`

---

## Notes per a la demo (per a S10)

**Dades:**
- Cal un **event de demostració** per a assignar en directe sense tocar dades reals. Requisits:
  - data futura, perquè no estiga bloquejat i els grups diguen «Ve»;
  - dos segments, amb dues figures cada un, una amb tronc i base;
  - una plantilla que ja s'haja fet servir abans, perquè «Importa …» tinga historial;
  - unes 25-30 persones marcades com a «Ve» des de la pestanya «Assistència», algunes amb 🎭 (que vagen a la pròxima actuació) i alguna de xicalla.
- **On:** millor en l'entorn de preproducció. En producció, l'event i l'assistència marcada els veurien els membres a la PWA. Si s'ha de fer en producció:
  - poseu-li un títol inequívoc («PROVA DEMO – no feu cas»);
  - no el publiqueu;
  - elimineu-lo al final.
  Cal decidir-ho abans de la demo.
- Prepareu un conflicte a posta (una persona a la pinya i al tronc del mateix segment) per a la pàgina 14.

**Guió (uns 27 min):**

| Min | Pàgina | Què es fa en directe | Qui ho mira |
|---|---|---|---|
| 3 | 12 | Obrir l'espai de treball des de «Assigna». Recórrer la capçalera: pestanyes, fletxes de segment i «Bloquejat» (explicar-lo, no ensenyar-lo). | tots |
| 9 | 12 | Pestanya «Troncs»: clicar la base, veure com la llista s'ordena per etiquetes i com «Xicalla» s'activa sola, assignar escrivint 3 àlies seguits (avanç automàtic), moure'n un amb clic dret, «Desfer». Mirar els avisos d'alçada en posar algú desnivellat. «Importa tronc» d'un assaig anterior → triar «Tronc» → ensenyar el missatge i un punt roig d'algú que no ve. | troncs i xicalla |
| 2 | 12 | El panell: grups, 🎭, fitxa en passar el ratolí, refrescar. Explicar els 10 s: «si algú confirma ara des del mòbil, ho veieu en clicar un lloc». | tots |
| 8 | 13 | Pestanya «Pinyes»: zoom i «Ajusta a la pantalla», comptadors «lliures» i «elegibles per a pinya» comparats amb la insígnia «x/y pinyes» de la llista. Assignar uns quants llocs. Intentar posar algú que és al tronc → «Persona ja assignada» → «Moure ací» o «Assignar igualment» (fer-ho per a crear el conflicte en directe). Obrir «Reinicialitza» i **cancel·lar-lo**, explicant que també esborra el tronc. | pinyes |
| 5 | 14 | Barra roja → «Mostra» → «Veure on està assignada» → «Treure aquesta assignació». Tornar a la llista de segments i ensenyar la píndola. Passar per Participació → «Només conflictes». | tots |

**Preguntes probables (preparar la resposta):**
- «Per què no trobe X a la llista?». Possibles causes:
  - té «Menor de 16» marcat i la casella «Xicalla» està desactivada;
  - és a «Altres» perquè no ha confirmat;
  - ja és a «A la pinya» o «Al tronc»;
  - el camp d'alçada l'ha enviat al final.
- «Quina diferència hi ha entre lliures i elegibles?» (apartat C de la pàgina 13).
- «Podem treballar dos alhora?» Sí, en segments diferents. En el mateix, no es veuen els canvis de l'altre fins a canviar de pestanya.
- «Per què ha canviat la figura si he tocat la plantilla?» o «per què no ha canviat?» La còpia es fa amb la primera assignació; «Reinicialitza» la desfà.
- «Puc fer-ho des del mòbil?» Pinyes i Troncs sí (amb toc i toc mantingut). Distribució, Nodes extra i Previsualitza, no.

Apunteu els trucs propis de cada tècnic per a `20-preguntes-frequents.md`.

---

## Incidències trobades (no es corregeixen en este pla; per a `docs/DEBT.md` o un issue)

1. **«Ajuda» de l'espai de treball:**
   - obri «Ajuda del creador de figures» (`TemplateEditorHelpModalComponent`), amb dreceres que no existeixen: «⌘/Ctrl + 1…8», «⌘/Ctrl + 9» i «E»;
   - també parla de doble clic per a obrir les propietats d'un node extra, quan es fa amb un sol clic a la pestanya «Nodes extra».
2. **Mode d'alçada absoluta inabastable:** `AssignmentStateService.toggleHeightMode()` no té cap crida. O s'esborra el codi mort o s'hi posa un botó.
3. **Textos fora de la guia de llengua:**
   - «Cancel·lar» i «Assignar igualment», en infinitiu al diàleg «Persona ja assignada»;
   - «Aquesta instància no té assignacions per importar» (forma i terme tècnic);
   - «Error en importar les assignacions. Torna-ho a intentar.» (tracte de tu);
   - els motius en anglés de la llista de conflictes omesos a la importació («No matching node found in target instance», «Node already occupied in target instance»). De tota manera no es veuen: el modal es tanca en acabar.
4. **Resultat de la importació invisible:** el bloc «N assignacions importades, N conflictes omesos» del modal no arriba a veure's, perquè `onImportCompleted` tanca el modal. L'usuari només veu el missatge emergent.
5. **La importació no filtra per assistència ni per àmbit els nodes extra.** Potser és volgut, però és sorprenent; s'ha documentat com a «Compte amb».
6. **`docs/internal/ad-hoc-nodes-user-guide.md` està desfasat:**
   - parla d'un botó «+» al llenç i de les dreceres Ctrl+1…9, que ja no existeixen;
   - diu «Reset pinya» en lloc de «Reinicialitza».
7. **Runner de captures:** `spaGoto` + `popstate` fa saltar el «torna arrere» de l'espai de treball i de la projecció (vegeu Task A). La suite d'auditoria (`pinyes-audit.spec.ts`) té el mateix risc en passar de l'espai de treball a `/project`.
