# S08: Distribució, nodes extra, previsualització i projecció, participació

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objectiu:** escriure les tres pàgines que cobreixen el que es fa després d'assignar:
- col·locar les figures tal com eixiran a la pantalla i a la plaça;
- afegir llocs que no són a la plantilla;
- comprovar què es projectarà i què veuran els membres;
- repartir la càrrega entre els membres amb la pestanya «Participació».

**Pàgines:**

| Fitxer | Títol (`MANUAL_PAGES`) | Rutes (`<!-- rutes: … -->`) |
|---|---|---|
| `docs/manual/15-distribucio-i-nodes-extra.md` | Distribució i nodes extra | `/pinyes/events/:eventId/segments/:segmentId/assign` |
| `docs/manual/16-previsualitza-i-projeccio.md` | Previsualitza i projecció | `/pinyes/events/:eventId/segments/:segmentId/assign` `/pinyes/events/:eventId/segments/:segmentId/project` `/pinyes/events/:eventId/segments/:segmentId/project/:instanceId` |
| `docs/manual/17-participacio.md` | Participació | `/events/:id` |

**Spec:** `docs/superpowers/specs/2026-10-21-manual-us-dashboard-design.md` · **Pla arrel:** `00-general.md` · **Germà:** `S07-assignacio-i-conflictes.md` (espai de treball, panell de persones, conflictes; la guarda de sortida del runner i el segment de demostració es comparteixen).

---

## Fonts verificades

Rutes relatives a `apps/dashboard/src/app/features/`, excepte les de `libs/` i `apps/`:

| Què | Fitxer |
|---|---|
| Pestanya Distribució, «Optimitza distribució», alçat automàtic | `pinyes/components/segment-workspace/tabs/distribucio-tab/distribucio-tab.component.{html,ts}` |
| Panell «Propietats» (Nom, Mode, Cordons, «Cordons oberts», Posició, Angle) | `pinyes/components/figure-properties-panel/figure-properties-panel.component.{html,ts}` (`MODE_OPTIONS`) |
| Confirmacions de cordons | `pinyes/components/cordons-change/cordons-change.component.{html,ts}` |
| Confirmacions de mode | `pinyes/components/figure-mode-change/figure-mode-change.component.{html,ts}` |
| Llenç en mode composició (arrossegar, girar, quadre del tronc) | `libs/pinyes-render/src/lib/components/figure-canvas/figure-canvas.component.ts` |
| Pestanya Nodes extra, paleta, mode col·locació, etiqueta, eliminar, dreceres | `pinyes/components/segment-workspace/tabs/nodes-tab/nodes-tab.component.{html,ts}` |
| Propietats d'un node extra | `pinyes/components/ad-hoc-node-properties/ad-hoc-node-properties.component.html` |
| Presets de pinya i de decoració | `libs/shared/src/constants/node-preset.constants.ts` (`PINYA_NODE_PRESETS`, `DECORATION_NODE_PRESETS`) |
| Quines pestanyes ixen en pantalla tàctil | `pinyes/components/segment-workspace/segment-workspace.component.ts` (`TOUCH_TABS`) |
| Previsualitza | `pinyes/components/segment-workspace/tabs/previsualitza-tab/` (incrusta `ProjectionViewComponent` amb `[embedded]="true"`) |
| Projecció a pantalla completa, HUD, dreceres, modal d'ajuda | `pinyes/components/projection-view/projection-view.component.{html,ts}` |
| Dibuix de la projecció | `libs/pinyes-render/src/lib/components/pinya-projection/pinya-projection.component.html` |
| Abast de la projecció: personal tots els segments, membres només els publicats | `apps/api/src/modules/event-segment/projection.service.ts` (`onlyPublished`), `apps/api/src/modules/me/me.service.ts` |
| Projecció a la PWA (per a la comparació) | `apps/pwa/src/app/features/events/segment-projection/segment-projection.component.html`, `libs/pinyes-render/src/lib/components/own-position-banner/` («Troba'm» / «On està») |
| Pestanya Participació | `events/components/event-participation/event-participation.component.{html,ts}` |
| Qui hi apareix i «Pròxima actuació» | `apps/api/src/modules/node-assignment/event-participation.service.ts` |
| Etiquetes d'assistència segons la fase | `libs/shared/src/utils/event-phase.util.ts` |
| Selector de columnes | `shared/components/data/column-toggle/column-toggle.component.ts` («Columnes visibles (N de M)») |
| Pestanyes de l'event (`?tab=`) | `events/components/event-detail/event-detail.component.ts` (`resum`, `pinyes`, `assistencia`, `participacio`; per defecte `pinyes`) |

### Fets del codi que la pàgina ha de reflectir

1. **Distribució = el que es projecta.** La projecció (Dashboard i PWA) col·loca les figures amb la distribució guardada; les figures sense posició guardada es col·loquen automàticament.
2. **«Optimitza distribució» no demana confirmació ni es pot desfer.** Esborra totes les posicions que heu posat a mà en el segment i torna a la col·locació automàtica (etiqueta per a lectors de pantalla: «Esborra la distribució i torna al disseny automàtic»).
3. **Els canvis de distribució es guarden sols**, poc després de deixar de moure.
4. **Mode de figura:**
   - «Completa» i «Peu» s'apliquen a l'instant, sense preguntar;
   - «Remat» i «Neta» demanen confirmació només si desassignaran algú:
     - «Canviar a Figura neta» lleva la gent de la pinya;
     - «Canviar a Remat» lleva la de la pinya i la de la base;
   - no es pot desfer.
5. **Cordons:**
   - augmentar o tornar a «Tots» s'aplica sense preguntar;
   - reduir demana «Canvia els cordons» si hi ha gent als cordons que s'amagaran;
   - desmarcar «Cordons oberts» demana «Desactiva els cordons oberts» si hi ha gent als cordons oberts;
   - en tots dos casos el botó és «Elimina-les», i no es pot desfer.
   - Els cordons només ixen en mode «Completa» o «Peu» i si la plantilla té rengles («Sense rengles» si no en té). «Cordons oberts» només ix si la plantilla té llocs de cordó obert.
6. **El mode i els cordons també es poden canviar des de la llista de segments** (pàgina 11). Les confirmacions són les mateixes.
7. **Nodes extra:**
   - es creen i es mouen a la pestanya «Nodes extra», però **una persona s'hi assigna a la pestanya «Pinyes»**: la pestanya «Nodes extra» no té panell de persones;
   - a la pestanya «Pinyes» no es poden moure.
8. **Nodes extra de pinya:** «AGULLA», «MANS», «LATERAL», «VENT», «CORDÓ OBERT», «TAP», «CROSSA», «CONTRAFORT» i «...» (comodí, que demana un nom: «Etiqueta del comodí»). Estan desactivats si la figura està en mode «Remat» o «Neta» («Esta figura no té pinya.»).
9. **Decoració:** «Rectangle», «El·lipse», «Triangle», «Estrela», «Cercle», «Fletxa dreta», «Fletxa esquerra», «Fletxa amunt», «Fletxa avall» i «Fletxa doble». Sempre demanen un nom («Etiqueta del node decoratiu») i ningú no s'hi pot assignar.
10. **Pantalla tàctil (tauleta i mòbil):** les pestanyes «Distribució», «Nodes extra» i «Previsualitza» no hi ixen (només «Pinyes» i «Troncs»). En un navegador d'escriptori estret (menys de 640 px), «Nodes extra» mostra «Encara no optimitzat per a mòbil».
11. **Previsualitza ≠ Projecta:**
    - «Previsualitza» és la mateixa vista dins de l'espai de treball, sense la barra de navegació ni les fletxes del teclat;
    - **però dins de «Previsualitza» la tecla Esc també surt a la pàgina de l'event**, F posa el navegador a pantalla completa i ? o H obrin l'ajuda (vegeu «Incidències trobades»).
12. **La projecció del Dashboard ensenya tots els segments, també els no publicats.** Les fletxes passen per tots. A la PWA, els membres només veuen els segments publicats (icona de l'ull a la llista de segments).
13. **Dreceres de la projecció** (modal «Dreceres de teclat»):
    - ← i →: segment anterior i següent;
    - F: pantalla completa del navegador;
    - Esc: torna enrere;
    - ?: mostra o amaga l'ajuda;
    - gestos tàctils: «1 dit» per a desplaçar la vista i «Pinça (2 dits)» per al zoom.

    El cursor s'amaga després de 3 s sense moure el ratolí. **La tecla E que diu l'«Ajuda» de l'espai de treball no existeix.**
14. **Qui ix a Participació:** les persones que vénen o han vingut a l'event, més qualsevol persona amb algun lloc en un segment de l'event (encara que no vinga).
15. **Columnes visibles per defecte:**
    - «Persona», «Assistència», «Pròxima actuació (data)» i una columna per segment;
    - amagades: «Nom», «Etiquetes», «Alçada», «Col·locacions», «Troncs», «% segments» i «Tronc»;
    - l'elecció es recorda per usuari en este navegador.
16. **«Pròxima actuació (data)» només ix en un assaig**, i només si hi ha una actuació posterior dins de la mateixa temporada.
17. **«Només troncs» / «Només pinyes» no amaguen persones:** només limiten què es pinta a les caselles. Les files continuen sent les mateixes, i un conflicte continua marcat encara que el lloc de l'altra àrea no es pinte.
18. **La línia «Càrrega: …» es calcula sobre tota la gent de l'event**, no sobre el que queda després de filtrar.
19. **Clic en una casella** obri l'espai de treball en eixe segment i figura, a la pestanya Pinyes o Troncs segons on és la persona (o a Troncs si la casella és buida). Les accions de fila diuen «Obri <segment> l'assignació».
20. **Marques davant de l'àlies:** «‼» (conflicte), 👶 (té «Menor de 16») i l'emoji d'observacions (o ⚠️).

---

### Task A: captures (`shots/s08.ts`)

**Files:**
- Create: `apps/dashboard-e2e/src/manual/shots/s08.ts`
- Modify: `apps/dashboard-e2e/src/manual/shots/index.ts` (afig `...s08`)

**Dades:**
- Les mateixes de S07: un segment de demostració en un event futur i no bloquejat (`MANUAL_WS_EVENT_ID`, `MANUAL_WS_SEGMENT_ID`), amb dues figures o més i alguna assignació. La primera figura ha d'estar en mode «Completa» o «Peu» (si no, els botons de pinya de «Nodes extra» estan desactivats).
- Per a Participació, un **assaig** amb diversos segments assignats i una actuació posterior en la mateixa temporada, perquè isca «Pròxima actuació» (`MANUAL_PARTICIPATION_EVENT_ID`, si no `TARGETS.eventAssaigId`).

Comproveu-lo abans a la BD (només lectura):

```sql
SELECT e.id, e.title, e.date, count(DISTINCT na."segmentId") AS segments_amb_gent
FROM events e
JOIN event_segments es ON es."eventId" = e.id
JOIN node_assignments na ON na."segmentId" = es.id
WHERE e."eventType" = 'ASSAIG'
GROUP BY e.id ORDER BY e.date DESC LIMIT 5;
```

**Seguretat (obligatòria):** cap captura no mou figures, ni prem «Optimitza distribució», ni canvia el mode, els cordons o «Cordons oberts», ni col·loca, mou o esborra nodes extra. Clicar «Completa», «Peu» o «+» als cordons **aplica el canvi a l'instant**, i clicar el llenç en mode col·locació **crea un node**. Les confirmacions «Canvia els cordons», «Desactiva els cordons oberts», «Canviar a Figura neta» i «Canviar a Remat» es descriuen amb text: per a obrir-les caldria un clic que, si ningú no quedava afectat, ja hauria fet el canvi.

**Runner:** el mateix requisit que S07 (guarda de sortida abans de `spaGoto` quan l'URL conté `/pinyes/events/`). Ací és crític: la captura del mode col·locació deixa l'espai de treball en un estat en què un clic al llenç crearia un node. La guarda prem Esc, que en surt sense clicar.

**`display: contents`:** `lib-button` i `lib-button-group` el tenen. Feu servir el `button` intern o un contenidor real (`aside[…]`).

- [ ] **Step 1: Escriu `s08.ts`**

```ts
import type { ManualShot } from '../manual-shot';
import { TARGETS } from '../../audit/audit-targets';

const EV = process.env['MANUAL_WS_EVENT_ID'] ?? TARGETS.workspaceEventId;
const SEG = process.env['MANUAL_WS_SEGMENT_ID'] ?? TARGETS.workspaceSegmentId;
const WS = `/pinyes/events/${EV}/segments/${SEG}/assign`;
const PART_EV = process.env['MANUAL_PARTICIPATION_EVENT_ID'] ?? TARGETS.eventAssaigId;

const PROPS = 'aside[aria-label="Propietats de la figura"]';
const NODES_ASIDE = 'aside[aria-label="Nodes i propietats"]';

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
    ready: 'button[aria-label="Esborra la distribució i torna al disseny automàtic"]',
    highlight: 'button[aria-label="Esborra la distribució i torna al disseny automàtic"]',
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
    // Entra en mode col·locació. NO es clica el llenç: el runner en surt amb Esc.
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
    ready: 'nav[aria-label="Navegació de la projecció"]',
    // Moure el ratolí perquè no s'amague la barra (s'amaga als 3 s).
    prepare: async (page) => {
      await page.mouse.move(640, 400);
    },
    highlight: 'nav[aria-label="Navegació de la projecció"]',
    settle: 1500,
  },
  {
    file: '16-projeccio-dreceres.png',
    app: 'dashboard',
    path: `/pinyes/events/${EV}/segments/${SEG}/project`,
    ready: 'nav[aria-label="Navegació de la projecció"]',
    prepare: async (page) => {
      await page.locator('nav[aria-label="Navegació de la projecció"] button[aria-label="Ajuda de dreceres de teclat"]').click();
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
    // Filtre «Només troncs» (no canvia dades).
    prepare: async (page) => {
      await page.locator('[data-testid="participation-area-filter"] select').selectOption('TRONC');
      await page.waitForTimeout(500);
    },
    highlight: '[data-testid="participation-area-filter"] select',
  },
];
```

- [ ] **Step 2: Afig `s08` a `shots/index.ts`.**

- [ ] **Step 3: Executa-ho**

Run: `pnpm run dev:up && MANUAL_WS_EVENT_ID=… MANUAL_WS_SEGMENT_ID=… MANUAL_PARTICIPATION_EVENT_ID=… E2E_EMAIL=… E2E_PASSWORD=… SHOTS=15,16,17 pnpm run docs:manual-shots`
Expected: 11 PNG nous, cap captura fallida.

- [ ] **Step 4: Revisa cada PNG i la BD**
  - **Només àlies.** A Participació, la columna «Nom» ha d'estar amagada. Si el navegador de Playwright la recorda visible, amagueu-la amb «Columnes visibles» i torneu-ho a fer.
  - `17-participacio.png` mostra la columna «Pròxima actuació (…)» (si no, l'event no és un assaig o no té cap actuació posterior en la temporada).
  - Després de l'execució, obriu el segment de demostració: cap node extra nou ni cap figura moguda.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard-e2e/src/manual/shots/s08.ts apps/dashboard-e2e/src/manual/shots/index.ts docs/manual/img/15-*.png docs/manual/img/16-*.png docs/manual/img/17-*.png
git commit -m "docs(manual): add screenshots for distribution, projection and participation"
```

---

### Task B: `15-distribucio-i-nodes-extra.md`

**Files:** Create `docs/manual/15-distribucio-i-nodes-extra.md`

Primera línia: `<!-- rutes: /pinyes/events/:eventId/segments/:segmentId/assign -->`

**Esquema:**

#### `# Distribució i nodes extra`

#### Per a què serveix
- **Distribució:** col·loqueu les figures del segment com eixiran a la pantalla de projecció i a la PWA dels membres, i com es faran a la plaça (quina va al costat de quina i cap a on mira cada una). També s'hi ajusta cada figura: nom, mode i cordons.
- **Nodes extra:** afegiu, només per a este segment, llocs que la plantilla no té (una mà de més, un comodí) o marques del lloc (l'església, una paret, una fletxa).

#### On és
Espai de treball del segment (pàgina 12) → pestanyes «Distribució» i «Nodes extra». Només en ordinador: en tauleta i en mòbil estes pestanyes no ixen.

Captura: `![Pestanya Distribució](img/15-distribucio.png)`

#### Pas a pas: Distribució
1. Cada figura apareix amb la seua pinya i, al costat, el quadre del seu tronc.
2. **Moure una figura:** arrossegueu-la. El quadre del tronc la segueix. També podeu arrossegar només el quadre del tronc per a posar-lo en un altre lloc (verifiqueu en pantalla si després continua seguint la figura; vegeu «Punts no verificats»).
3. **Girar una figura:** arrossegueu el punt taronja que ix en seleccionar-la. També ho podeu fer amb el control «Angle» del panell.
4. **Ajust fi:** al panell «Propietats», camps «X», «Y» i «Angle».
5. **Es guarda sol** un moment després de deixar de moure. No hi ha botó d'alçar.
6. **Tornar a començar:** «Optimitza distribució» (baix a la dreta) esborra les posicions que heu posat a mà i torna a col·locar-les totes automàticament. **No demana confirmació ni es pot desfer.**

Captura: `![Optimitza distribució](img/15-optimitza.png)`

#### Pas a pas: Propietats de la figura

Captura: `![Propietats de la figura](img/15-propietats-figura.png)`

Cliqueu una figura per a veure'n les propietats a la dreta:
- **«Nom»:** el nom que es veu en este segment. Buit, fa servir el de la plantilla. Canvia també els títols que veuen els membres.
- **«Mode»:** «Completa», «Peu», «Remat» o «Neta». Explicar què amaga cada un. Comproveu-ho amb pinyes; el codi diu:
  - «Neta» no té pinya;
  - «Remat» no té pinya ni base.

  Què passa en canviar:
  - «Completa» i «Peu» canvien a l'instant;
  - «Remat» i «Neta», si hi ha gent que es quedaria sense lloc, pregunten:
    - «Canviar a Figura neta» → «… desassignarà N persones de la pinya.»;
    - «Canviar a Remat» → «… de la pinya i la base.»;
    - els botons són «Canvia a Figura neta» / «Canvia a Remat» o «Cancel·la»;
  - **no es pot desfer**.
- **«Cordons»** (només en «Completa» i «Peu»):
  - «−» i «+» canvien quants cordons es fan servir;
  - «Tots» vol dir sense límit, i «2/4» vol dir que se'n fan servir 2 de 4;
  - si en lleveu i hi ha gent als cordons que desapareixen, ix «Canvia els cordons» («Esta acció eliminarà N assignacions dels cordons que deixaran de mostrar-se. Les persones assignades quedaran lliures.») amb «Elimina-les»;
  - no es pot desfer;
  - si la plantilla no té rengles, ix «Sense rengles».
- **«Cordons oberts»:** casella que mostra o amaga els llocs de cordó obert de la plantilla. Si la desmarqueu amb gent als cordons oberts, ix «Desactiva els cordons oberts» amb «Elimina-les».

#### Pas a pas: Nodes extra

Captura: `![Pestanya Nodes extra](img/15-nodes-extra.png)`

1. A l'esquerra, trieu la figura. Les altres es veuen més apagades.
2. A la dreta, trieu què afegir:
   - **«Pinya»:** llocs on es pot posar gent, com «AGULLA», «MANS», «LATERAL», «VENT», «CORDÓ OBERT», «TAP», «CROSSA» o «CONTRAFORT». «...» és un comodí amb el nom que vulgueu («Etiqueta del comodí» → «Col·loca»). Estan desactivats si la figura està en «Remat» o «Neta» («Esta figura no té pinya.»);
   - **«Decoració»:** formes per a marcar el lloc, com rectangle, el·lipse, triangle, estrela, cercle o fletxes. Sempre demanen un nom («Etiqueta del node decoratiu») i no s'hi pot posar ningú.
3. Ix «Mode col·locació: cliqueu a l'àrea de treball per situar el node.». Cliqueu on el vulgueu. «Cancel·la» o Esc ho anul·len.

   Captura: `![Mode col·locació](img/15-nodes-extra-col-locacio.png)`
4. Cliqueu un node extra per a editar-lo («Propietats del node manual»):
   - «Etiqueta», «Color» i «Treure fons»;
   - «Forma»;
   - «Amplada», «Alçada», «Rotació», «X» i «Y»;
   - duplicar (Ctrl+D), «Desassigna» i eliminar.
5. **Teclat:**
   - fletxes: moure 1 px (amb Maj, 10 px);
   - Ctrl+C i Ctrl+V: copiar i enganxar;
   - Ctrl+D: duplicar;
   - Supr o Retrocés: eliminar. Si hi ha algú assignat, demana «Eliminar node manual» i avisa que l'assignació es perdrà.
6. **Posar-hi una persona:** aneu a la pestanya «Pinyes» i assigneu-la com en qualsevol altre lloc (pàgina 13). A «Nodes extra» no es pot assignar, i a «Pinyes» els nodes extra no es poden moure.

Els nodes extra es distingeixen dels de la plantilla perquè tenen la vora discontínua. Verifiqueu-ho en la captura; ho diu la guia interna, que està parcialment desfasada.

#### Si sou de pinyes
- La distribució és vostra: és el que es projectarà a l'assaig. Poseu les figures com les fareu a la plaça, perquè la gent s'orienta amb la pantalla.
- Els cordons es poden ajustar ací o a la llista de segments. Abans de reduir-los, mireu quanta gent en traureu: el missatge ho diu, i no es pot desfer.
- Nodes extra de pinya: per a una mà o un vent de més que només calen en este segment. Feu-los servir abans que tocar la plantilla.

#### Si sou de troncs o xicalla
- Comproveu que el quadre de cada tronc no tapa cap altra figura a la distribució: és el que veuran els membres.
- Canviar el mode a «Remat» lleva també la base. Parleu-ho amb pinyes abans.

#### Compte amb
- **«Optimitza distribució» esborra la vostra col·locació** sense preguntar.
- **«Completa» i «Peu» s'apliquen en clicar-los.** «Remat», «Neta», reduir cordons i desmarcar «Cordons oberts» poden llevar gent, i **no es pot desfer**.
- **«Reinicialitza» (pàgina 13) esborra també els nodes extra.** «Importa …» (pàgina 12) els copia de la figura d'origen.
- **En tauleta o mòbil** no hi ha ni Distribució ni Nodes extra.
- **Un node de decoració no admet ningú:** si l'intenteu assignar, ix «Els nodes decoratius no es poden assignar.».

#### Relacionat
- [Segments i figures](11-segments-i-figures.md) (cordons i mode des de la llista)
- [Assignació de pinyes](13-assignacio-pinyes.md)
- [Previsualitza i projecció](16-previsualitza-i-projeccio.md)
- [Plantilla: pinya i rengles](09-plantilles-pinya.md)

- [ ] **Step 1: Escriu la pàgina.** Digueu «lloc» o «node extra»; no escrigueu «ad hoc», «instància» ni «slot».
- [ ] **Step 2: Verifica** al visor i amb la checklist de llengua.
- [ ] **Step 3: Commit:** `git add docs/manual/15-distribucio-i-nodes-extra.md && git commit -m "docs(manual): add distribution and extra nodes page"`

---

### Task C: `16-previsualitza-i-projeccio.md`

**Files:** Create `docs/manual/16-previsualitza-i-projeccio.md`

Primera línia: `<!-- rutes: /pinyes/events/:eventId/segments/:segmentId/assign /pinyes/events/:eventId/segments/:segmentId/project /pinyes/events/:eventId/segments/:segmentId/project/:instanceId -->`

**Esquema:**

#### `# Previsualitza i projecció`

#### Per a què serveix
Comprovar com es veurà el segment a la pantalla gran de l'assaig. La projecció mostra totes les figures col·locades com a la distribució, amb la gent als seus llocs i el tronc de cada figura al costat. També serveix per a saber què veuen els membres a la PWA.

#### On és
- **«Previsualitza»:** la cinquena pestanya de l'espai de treball (pàgina 12).
- **«Projecta»:** a la llista de segments (event → «Pinyes i Figures»), botó «Projecta» de cada segment. S'obri a pantalla completa.

Captura: `![Previsualitza](img/16-previsualitza.png)`

#### Pas a pas
1. **Revisar mentre assigneu:**
   - obriu «Previsualitza». És la mateixa imatge que la projecció, sense eixir de l'espai de treball;
   - els colors d'assistència i les vores roges de conflicte també hi ixen.
2. **Projectar a l'assaig:**
   - des de la llista de segments, «Projecta» → el segment ocupa tota la pantalla;
   - premeu F per a posar el navegador a pantalla completa.

   Captura: `![Projecció](img/16-projeccio.png)`
3. **Barra de baix** (s'amaga si no moveu el ratolí durant 3 s):
   - fletxa de tornar («Torna a l'esdeveniment», Esc);
   - nom del segment;
   - ← i → per al segment anterior i el següent;
   - «?» per a l'ajuda.
4. **Passar de segment:** fletxes del teclat o de la barra. Passen per **tots** els segments, també els que no estan publicats.
5. **Dreceres** («Dreceres de teclat»):
   - ← i →: segment anterior i següent;
   - F: pantalla completa;
   - Esc: torna enrere;
   - ?: mostra o amaga l'ajuda;
   - en pantalla tàctil: «1 dit» per a desplaçar la vista, «Pinça (2 dits)» per al zoom.

   Captura: `![Dreceres de teclat](img/16-projeccio-dreceres.png)`

#### Què veuen els membres a la PWA
Text a partir del codi i de `CLAUDE.md`. Les captures de la PWA són de S09, pàgina 19: enllaceu-les, no les dupliqueu.
- Només veuen els segments **publicats** (icona de l'ull a la llista de segments, pàgina 11). Un segment no publicat no existeix per a ells: ni a la llista ni amb les fletxes.
- Al detall de l'event, cada segment publicat té un títol automàtic i una línia sobre on va el membre («Vent (C1) a Roscana»).
- En obrir-lo, veuen la mateixa projecció, amb un anell que marca el seu lloc i un avís amb «Troba'm». Poden buscar una altra persona («Cerca una persona», «Nom o àlies») i veure «On està».
- Veuen el que hi ha **quan obrin la pantalla**. Si canvieu una assignació després de publicar, la veuran en tornar-la a obrir. No verificat amb la memòria cau del service worker; vegeu «Punts no verificats».
- Un membre en dos llocs (conflicte) ix en els dos, i l'avís li diu que té més d'un lloc.

#### Si sou de pinyes
- Abans de publicar, mireu «Previsualitza»: si les figures se superposen o no estan com a la plaça, torneu a «Distribució».

#### Si sou de troncs o xicalla
- El quadre del tronc de cada figura és el que la xicalla i el tronc miraran per saber on van. Comproveu que és llegible i que no queda tapat.

#### Compte amb
- **Esc dins de «Previsualitza» us trau de l'espai de treball** i us porta a la pàgina de l'event. F i ? també hi funcionen. Les fletxes ← i →, en canvi, no.
- **La projecció del Dashboard ensenya els segments no publicats.** Que es vegen ací no vol dir que els membres els vegen.
- **El que es veu depén de la distribució** (pàgina 15). Si no l'heu tocada, les figures es col·loquen soles.
- **L'«Ajuda» de l'espai de treball parla d'una tecla E per a alternar Pinyes/Troncs a la projecció.** No existeix.

#### Relacionat
- [Distribució i nodes extra](15-distribucio-i-nodes-extra.md)
- [Segments i figures](11-segments-i-figures.md) (publicar)
- [L'app dels membres (PWA)](19-pwa.md)
- [Conflictes](14-conflictes.md)

- [ ] **Step 1: Escriu la pàgina.**
- [ ] **Step 2: Verifica** al visor i amb la checklist de llengua. Coordineu els enllaços a les captures de la PWA amb S09.
- [ ] **Step 3: Commit:** `git add docs/manual/16-previsualitza-i-projeccio.md && git commit -m "docs(manual): add preview and projection page"`

---

### Task D: `17-participacio.md`

**Files:** Create `docs/manual/17-participacio.md`

Primera línia: `<!-- rutes: /events/:id -->`

**Esquema:**

#### `# Participació`

#### Per a què serveix
Una taula de **persones × segments** de l'event: què fa cada membre en cada prova. Serveix per a repartir la feina: que ningú no faça totes les proves mentre altres no en fan cap, i que qui va a la pròxima actuació assage el que hi farà.

#### On és
Event → pestanya «Participació».

Captura: `![Participació](img/17-participacio.png)`

#### Com es llig
- **Capçalera:**
  - «N persones · N amb assignació»;
  - «Càrrega: mín X · mitjana Y · màx Z · N sense cap col·locació»: quants llocs té cada persona en tot l'event (el mínim, la mitjana i el màxim) i quantes no en tenen cap;
  - si n'hi ha, «N persones en dos llocs alhora» (pàgina 14).
- **Qui ix:** les persones que vénen (o han vingut) i qualsevol persona que tinga un lloc en algun segment encara que no vinga. Això últim és una alerta: algú assignat que no ve.
- **Una columna per segment.** Cada casella diu el lloc i la figura («Mans C1 · Roscana»), o «—» si no fa res. Davall dels filtres hi ha la llegenda: quines figures té cada segment i quins estan «(no publicat)».
- **Marques davant de l'àlies:** «‼» té un conflicte; 👶 té «Menor de 16»; un emoji o ⚠️ té observacions.
- **«Pròxima actuació (data)»:** en un assaig, si la persona va a la pròxima actuació de la temporada. És la mateixa informació que el 🎭 del panell de persones.
- **Columnes amagades** que es poden mostrar amb «Columnes visibles»:
  - «Nom», «Etiquetes» i «Alçada»;
  - «Col·locacions» (quants llocs té en total) i «Troncs» (quants al tronc);
  - «% segments» (en quin percentatge de segments fa alguna cosa);
  - «Tronc» (tots els seus llocs de tronc de l'event en una casella).

  L'elecció es recorda.
- **Ordenar:** cliqueu la capçalera de «Persona», «Assistència», «Col·locacions», «Troncs», «% segments» o «Alçada».

#### Filtres

Captura: `![Filtres](img/17-participacio-filtres.png)`

- «Cerca persona, figura o posició...»: busca pel nom de la persona o pel que fa («Roscana», «vent»).
- «Tots els segments» o un segment concret. Amb un segment, les columnes passen a ser «Figura», «Posició» i «Zona».
- «Tota l'assistència»: les opcions canvien segons la fase («Ve», «Assistit», «No ve», «Pendent» abans de l'event; «Ha arribat», etc. el dia).
- «Tota l'àrea» / «Només troncs» / «Només pinyes».
- «Tota la colla» / «Només xicalla» / «Sense xicalla». Es guia per «Menor de 16».
- «Totes les etiquetes». Les etiquetes que no porta ningú de l'event hi ixen amb «(0)».
- Els filtres actius ixen com a xips que es poden llevar, i hi ha un botó per a llevar-los tots.

#### Pas a pas: equilibrar la càrrega
1. Mostreu «Col·locacions» i ordeneu-la de menys a més. Dalt hi ha qui ve i no fa res («N sense cap col·locació» de la capçalera).
2. Cliqueu una casella buida d'eixa persona: s'obri l'espai de treball en eixe segment. Poseu-la en algun lloc.
3. Ordeneu de més a menys per a veure qui està sobrecarregat. Compareu-ho amb la mitjana de «Càrrega».
4. En un assaig, mireu «Pròxima actuació»: prioritzeu que assagen els que hi aniran.
5. Torneu a la pestanya: la taula es recarrega en entrar-hi. Si no veieu un canvi, canvieu de pestanya i torneu.

#### Si sou de pinyes
- «Només pinyes» deixa a les caselles només els llocs de pinya, per a veure qui fa molta pinya i qui cap.
- «Sense xicalla» per a centrar-vos en els adults.

#### Si sou de troncs o xicalla
- «Només troncs», més les columnes «Troncs» i «Tronc», per a veure qui puja a cada prova i en quin tronc.
- «Només xicalla» per a repartir la xicalla entre les proves.

  Captura: `![Només troncs](img/17-participacio-troncs.png)`

#### Compte amb
- **«Només troncs» i «Només pinyes» no lleven files:** totes les persones continuen eixint. Les que no tenen res d'eixa àrea mostren «—».
- **La línia «Càrrega» és de tot l'event**, no dels filtres.
- **Una persona assignada que no ve hi ix igualment.** Mireu la columna «Assistència» abans de pensar que està lliure.
- **La columna «Pròxima actuació» només hi és en assajos** i si la temporada té una actuació després.
- **Clicar una casella us porta a l'espai de treball.** Per a tornar, useu la fletxa de dalt a l'esquerra.

#### Relacionat
- [Conflictes](14-conflictes.md)
- [Assignació de troncs](12-assignacio-troncs.md)
- [Assignació de pinyes](13-assignacio-pinyes.md)
- [Assajos i actuacions](07-assajos-i-actuacions.md)
- [Etiquetes](04-etiquetes.md)

- [ ] **Step 1: Escriu la pàgina.**
- [ ] **Step 2: Verifica** al visor i amb la checklist de llengua.
- [ ] **Step 3: Commit:** `git add docs/manual/17-participacio.md && git commit -m "docs(manual): add participation page"`

---

## Notes per a la demo (per a S10)

**Dades:** el mateix event de demostració de S07 (futur, no publicat, preferiblement en preproducció). Per a Participació, feu servir un **assaig real ja passat** amb molts segments i una actuació després: es mira, no es toca, i dona números interessants. Comproveu abans que la columna «Nom» està amagada al navegador que es compartirà.

**Guió (uns 20 min):**

| Min | Pàgina | Què es fa en directe | Qui ho mira |
|---|---|---|---|
| 6 | 15 | Distribució del segment de demo: moure una figura, girar-la, canviar el «Nom». Reduir un cordó d'una figura amb gent → ensenyar «Canvia els cordons» i **cancel·lar**. Avisar que «Completa» i «Peu» s'apliquen en un sol clic i que «Optimitza distribució» no pregunta. | pinyes (sobretot), troncs |
| 3 | 15 | Nodes extra: afegir una «MANS» a una figura, anar a «Pinyes» i assignar-hi algú. Afegir una fletxa de decoració amb nom. | pinyes |
| 4 | 16 | «Previsualitza» → «Projecta» des de la llista → F, ←/→ entre segments, «?» → Esc. Remarcar que es veuen segments no publicats. Si hi ha un mòbil amb la PWA, ensenyar com ho veu un membre (pàgina 19). | tots |
| 7 | 17 | Assaig real: llegir la capçalera «Càrrega», ordenar per «Col·locacions», trobar qui no fa res, clicar una casella i veure on s'obri. «Només troncs» + columna «Troncs». «Pròxima actuació». | tots, sobretot qui reparteix |

**Preguntes probables:**
- «Si canvie la distribució, ho veuen els membres?» Sí, si el segment està publicat, quan tornen a obrir la projecció.
- «Puc desfer "Optimitza distribució" o un canvi de cordons?» No.
- «Per què ix a Participació algú que no ve?» Perquè té un lloc assignat. Llevar-li'l.
- «Es pot veure la participació de tota la temporada?» No: és per event. Per persona hi ha l'«Historial de pinyes» de la fitxa (pàgina 03).
- «Puc fer la distribució des de la tauleta?» No.

Apunteu els trucs de cada tècnic per a `20-preguntes-frequents.md`.

---

## Punts no verificats (comproveu-los en pantalla mentre s'escriu la pàgina)

1. Si el quadre del tronc, un cop arrossegat a part, continua seguint la figura quan es mou la figura. El codi té un mode «enllaçat» (`isLinked`); no s'ha traçat quan es desenllaça.
2. Que els nodes extra tinguen vora discontínua. Ho diu `docs/internal/ad-hoc-nodes-user-guide.md`, que està parcialment desfasat.
3. Què amaga exactament cada mode («Peu» en concret). Feu-ho validar per un tècnic.
4. Si la PWA mostra canvis fets després de publicar sense tancar i obrir l'app (memòria cau del service worker).
5. Que el filtre «Tota l'assistència» de Participació mostre «Assistit» abans de l'event. Segons `attendanceStatusLabel`, és el text de la fase «abans».

## Incidències trobades (per a `docs/DEBT.md` o un issue)

1. **Esc dins de «Previsualitza» surt de l'espai de treball:** `ProjectionViewComponent.handleEscape` no mira `embedded()`. F i ?/H també s'hi activen.
2. **«Optimitza distribució» esborra sense confirmar** ni es pot desfer, i és un botó roig sempre visible.
3. **«Completa» i «Peu» s'apliquen sense confirmar,** mentre que «Remat» i «Neta» sí que pregunten. És coherent (no lleven ningú), però pot sorprendre.
4. **Textos fora de la guia de llengua:**
   - «Aquesta acció no es pot desfer.» a la confirmació de mode (en la de cordons diu «Esta acció»);
   - «Canviar a Figura neta» i «Canviar a Remat», en infinitiu als títols;
   - «Si l'elimines» (tracte de tu) a «Eliminar node manual»;
   - «Obri <segment> l'assignació», a l'acció de fila de Participació, té un ordre estrany.
5. **L'«Ajuda» de l'espai de treball documenta la tecla E a la projecció,** i no existeix (també a S07).
