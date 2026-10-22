# S06: segments i figures (l'esquelet de l'event)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Escriure la pàgina del manual de la pestanya «Pinyes i Figures» del detall d'un event. És la pantalla on tots els tècnics munten l'esquelet de l'event:
- segments i figures;
- comprovar si hi ha prou gent;
- cordons i mode de cada figura;
- publicar als membres.

També porta les captures generades amb la suite del manual.

**Pàgina:**

| Fitxer | Títol a `MANUAL_PAGES` | Rutes (comentari de la primera línia) |
|---|---|---|
| `docs/manual/11-segments-i-figures.md` | Segments i figures | `<!-- rutes: /events/:id?tab=pinyes -->` |

**Depèn de:** pla arrel, Tasks 2 (visor) i 3 (suite de captures).

**Spec:** `docs/superpowers/specs/2026-10-21-manual-us-dashboard-design.md` · **Pla arrel:** `00-general.md`

## Fonts verificades

- `apps/dashboard/src/app/features/events/components/segment-manager/segment-manager.component.{html,ts}`: tot el que hi ha a la pantalla, incloent-hi:
  - `segmentPeopleLabel`, `figurePinyaLabel`, `cordonsDisplay`, `figureModeLabel`, `removeSegment` (amb `confirm()` natiu);
  - el moviment de figures entre segments (`moveInstanceAcrossSegments`);
  - la navegació d'«Assigna» i «Projecta».
- `apps/dashboard/src/app/features/events/components/segment-conflict-pill/segment-conflict-pill.component.html`
- `apps/dashboard/src/app/features/pinyes/components/figure-picker-modal/figure-picker-modal.component.{html,ts}`
- `apps/dashboard/src/app/features/pinyes/components/figure-mode-change/figure-mode-change.component.{html,ts}` i `.../cordons-change/cordons-change.component.{html,ts}`. Només demanen confirmació si hi ha persones afectades.
- `apps/dashboard/src/app/features/pinyes/services/figures-view-mode.service.ts`: «Pinyes»/«Troncs» es recorda per navegador (`muixer.pinyes.viewMode`).
- `apps/dashboard/src/app/features/pinyes/services/segment-figure-add.service.ts`: missatges d'afegir figures i d'aplicar una composició.
- `apps/dashboard/src/app/features/events/components/event-detail/event-detail.component.{html,ts}`:
  - «Pinyes i Figures» és la pestanya per defecte (`activeTab = 'pinyes'`);
  - insígnia «Assignacions bloquejades»;
  - targetes d'estadística, l'etiqueta de les quals depén de la fase.
- `libs/shared/src/utils/segment-title.util.ts`:
  - nom automàtic del segment («Segment sense nom», «2 Pilar + Torre»);
  - prefixos «Peu de …», «Remat de …», «… neta/net»;
  - numeració «Pilar 1», «Pilar 2».
- `libs/shared/src/utils/tronc-summary.util.ts`: resum del tronc en mode Troncs («Pepet - ? - Maria // Joan - ?»).
- `libs/shared/src/constants/assignment-area.constants.ts` (`isNodeVisibleByModeAndCordons`) i `apps/api/src/modules/node-assignment/node-assignment.service.ts` (`computeInstanceAreaSummary`). Defineixen què compten les insígnies:
  - **pinya:** llocs de pinya visibles segons els cordons, els cordons oberts i el mode;
  - **troncs:** tronc i bases (les bases no compten en Remat);
  - **total:** pinya + tronc + direccions;
  - els elements decoratius no compten.
- `apps/api/src/modules/node-assignment/node-assignment.service.ts` (`getLockStatus`): l'event es bloqueja 2 dies després de la data de l'event (`ASSIGNMENT_LOCK_DAYS`, per defecte 2).
- `apps/api/src/modules/event-segment/event-segment.service.ts` (`update`): publicar i despublicar funciona encara que l'event estiga bloquejat; canviar el nom, no.
- `apps/api/src/modules/event-segment/figure-instance.service.ts` (`applyComposition`): afig les figures al final **i canvia el nom del segment** pel de la composició.
- `libs/shared/src/utils/event-phase.util.ts`: etiquetes per fase («Ve» abans, «Ha arribat» el dia, «Va vindre» després).

### Correccions a l'inventari de pantalles (no les documenteu)

- **Hora i notes del segment:** la llista les mostra si existeixen (rellotge `HH:MM–HH:MM` i icona de nota), però **cap pantalla del Dashboard no les edita**: `startTime`, `endTime` i `notes` només els toca l'API. El manual no explica com posar-les. Com a molt, a «Compte amb» diu que, si n'hi ha, es veuen davall del nom.
- «x/y pinya (N cor.), x/y total» és per figura, a la vista Pinyes. «(N cor.)» només apareix quan es fan menys cordons dels que té la plantilla.
- Les dues accions de fila de les llistes d'events, «Veure detall» i «Gestionar pinyes», obrin el mateix: el detall, a la pestanya «Pinyes i Figures».

### Textos de l'app que no s'han de copiar al manual (vegeu també l'informe)

- La confirmació d'eliminar un segment és un `confirm()` del navegador que tracta de «tu»: «Segur que vols eliminar "…" i totes les seues figures? Esta acció no es pot desfer.». El manual diu «apareix un avís del navegador» sense citar-lo.
- `segmentDotacioTooltip()` («N al tronc · N a la pinya · N en conflicte») és al `.ts`, però cap plantilla no el fa servir. No es documenta.

---

### Task A: captures (`apps/dashboard-e2e/src/manual/shots/s06.ts`)

**Dades necessàries.** No s'han pogut comprovar perquè Docker no corria quan es va escriure el pla. Cal un event que:
- **no estiga bloquejat**, és a dir, amb data de fa menys de 2 dies o futura. Si està bloquejat, s'amaguen «Segment nou», «+ Figura», copiar i eliminar, i els cordons i el mode queden desactivats;
- tinga **almenys dos segments**, perquè «Copia la figura al segment:» tinga destins;
- tinga una figura amb rengles i cordons oberts, i alguna persona assignada.

És millor si a més té un segment amb conflictes, que és el que necessita `11-segments-conflictes`. `TARGETS.workspaceEventId` pot ser antic. Per a buscar-ne un:

```sql
select e.id, e.title, e.date, count(distinct s.id) as segments, count(fi.id) as figures
from events e
join event_segments s on s."eventId" = e.id
left join figure_instances fi on fi."segmentId" = s.id
where e.date >= current_date - 1
group by e.id
having count(distinct s.id) >= 2
order by e.date
limit 10;
```

Poseu l'ID trobat a `MANUAL_SEGMENTS_EVENT_ID`. Per a la captura de l'event bloquejat, poseu a `MANUAL_LOCKED_EVENT_ID` un event amb segments i data de fa més de 2 dies (per defecte, `TARGETS.eventActuacioId`).

**Regles:**
- Res no s'alça. `guardReadOnly` avorta tota petició que no siga GET a `/api/events/*/segments…` (segments, figures, copiar, moure, aplicar composició).
- No es fa mai clic a «Eliminar segment», «Treure … del segment», ni a cap «Confirma» o «Aplica». Tampoc es canvia cap selector de mode ni de cordons.
- Cada captura torna a carregar la pàgina (`freshEvent`). El router no fa res si es torna a la mateixa URL, i un modal obert o la vista Troncs de la captura anterior quedarien a la següent. La vista Pinyes/Troncs es tria amb un clic a cada captura perquè queda guardada al navegador.

- [ ] **Step 1: Crea `s06.ts`**

```ts
import { Locator, Page } from '@playwright/test';
import type { ManualShot } from '../manual-shot';
import { TARGETS } from '../../audit/audit-targets';
import { spaGoto } from '../../audit/audit-core';

const EVENT_ID = process.env['MANUAL_SEGMENTS_EVENT_ID'] || TARGETS.workspaceEventId;
const LOCKED_EVENT_ID = process.env['MANUAL_LOCKED_EVENT_ID'] || TARGETS.eventActuacioId;
const EVENT = `/events/${EVENT_ID}?tab=pinyes`;
const LOCKED_EVENT = `/events/${LOCKED_EVENT_ID}?tab=pinyes`;
const SEGMENTS = '[role="list"][aria-label="Llista de segments"]';
const FIRST_SEGMENT = `${SEGMENTS} > [role="listitem"]:first-child`;
const MARK = '[data-manual-hl]';
const guarded = new WeakSet<Page>();

/** Blocks every write to segments/figures: shots must never change a real event. */
async function guardReadOnly(page: Page): Promise<void> {
  if (guarded.has(page)) return;
  guarded.add(page);
  await page.route('**/api/events/*/segments**', (route) =>
    route.request().method() === 'GET' ? route.continue() : route.abort(),
  );
}

/** Tags an element without a stable CSS hook so `highlight: MARK` can outline it. */
async function mark(locator: Locator): Promise<void> {
  await locator.first().evaluate((el) => el.setAttribute('data-manual-hl', ''));
}

/** Reloads the event page (fresh component, no leftover modal) and picks the Pinyes/Troncs view. */
async function freshEvent(page: Page, url: string, view: 'Pinyes' | 'Troncs' = 'Pinyes'): Promise<void> {
  await guardReadOnly(page);
  await spaGoto(page, '/home');
  await spaGoto(page, url);
  await page.locator(SEGMENTS).waitFor();
  await page
    .locator('div[role="group"][aria-label="Mode de visualització"]')
    .getByRole('button', { name: view, exact: true })
    .click();
  await page.waitForLoadState('networkidle').catch(() => {});
}

export const s06: ManualShot[] = [
  {
    file: '11-segments-llista.png',
    app: 'dashboard',
    path: EVENT,
    prepare: (page) => freshEvent(page, EVENT),
    highlight: 'button[aria-label="Afegir segment nou"]',
    settle: 800,
  },
  {
    file: '11-segments-comptadors.png',
    app: 'dashboard',
    path: EVENT,
    prepare: async (page) => {
      await freshEvent(page, EVENT);
      // Segment badge «x/y pinyes, x/y total» (lib-badge is display:contents → mark its <span>).
      await mark(page.locator(`${FIRST_SEGMENT} lib-badge > span`).filter({ hasText: 'total' }));
    },
    highlight: MARK,
    settle: 800,
  },
  {
    file: '11-segments-fila.png',
    app: 'dashboard',
    path: EVENT,
    prepare: (page) => freshEvent(page, EVENT),
    clip: FIRST_SEGMENT,
    highlight: `${FIRST_SEGMENT} button[aria-label^="Visible als membres"], ${FIRST_SEGMENT} button[aria-label^="Ocult als membres"]`,
  },
  {
    file: '11-segments-cordons.png',
    app: 'dashboard',
    path: EVENT,
    prepare: (page) => freshEvent(page, EVENT),
    clip: FIRST_SEGMENT,
    highlight: `${FIRST_SEGMENT} div[role="group"][aria-label^="Cordons de "]`,
  },
  {
    file: '11-segments-figura-picker.png',
    app: 'dashboard',
    path: EVENT,
    prepare: async (page) => {
      await freshEvent(page, EVENT);
      await page.locator(`${FIRST_SEGMENT} button[aria-label="Afig una figura o composició al segment"]`).click();
      const list = page.locator('ul[aria-label="Figures disponibles"]');
      await list.waitFor();
      // Local selection only — «Confirma (N)» is never clicked.
      await list.locator('li:nth-child(1) button').click();
      await list.locator('li:nth-child(2) button').click();
    },
    highlight: 'ul[aria-label="Figures seleccionades"]',
  },
  {
    file: '11-segments-composicio-picker.png',
    app: 'dashboard',
    path: EVENT,
    prepare: async (page) => {
      await freshEvent(page, EVENT);
      await page.locator(`${FIRST_SEGMENT} button[aria-label="Afig una figura o composició al segment"]`).click();
      const dialog = page.getByRole('dialog', { name: 'Afegir figures al segment' });
      await dialog.getByRole('tab', { name: 'Composicions', exact: true }).click();
      // Selecting is local; «Aplica «…»» is never clicked.
      await dialog.locator('ul[aria-label="Composicions disponibles"] li:first-child button').click();
    },
  },
  {
    file: '11-segments-copia.png',
    app: 'dashboard',
    path: EVENT,
    prepare: async (page) => {
      await freshEvent(page, EVENT);
      await page.locator(`${FIRST_SEGMENT} button[aria-label$=" a un altre segment"]`).first().click();
      await page.getByRole('dialog', { name: 'Copia la figura al segment:' }).waitFor();
    },
  },
  {
    // Needs a segment with conflicts in EVENT_ID; otherwise this shot fails and is listed at the end.
    file: '11-segments-conflictes.png',
    app: 'dashboard',
    path: EVENT,
    prepare: async (page) => {
      await freshEvent(page, EVENT);
      await page.locator('[data-testid="segment-conflict-pill"]').first().hover();
      await page.locator('[data-testid="segment-conflict-popover"]').waitFor();
    },
    highlight: '[data-testid="segment-conflict-pill"]',
  },
  {
    // Last on purpose: the view mode is remembered; later sections pick their own.
    file: '11-segments-troncs.png',
    app: 'dashboard',
    path: EVENT,
    prepare: (page) => freshEvent(page, EVENT, 'Troncs'),
    highlight: `${FIRST_SEGMENT} select[aria-label^="Mode de "]`,
    settle: 1200,
  },
  {
    file: '11-segments-bloquejat.png',
    app: 'dashboard',
    path: LOCKED_EVENT,
    prepare: async (page) => {
      await freshEvent(page, LOCKED_EVENT);
      await mark(page.locator('lib-badge > span').filter({ hasText: 'Assignacions bloquejades' }));
    },
    highlight: MARK,
    settle: 800,
  },
];
```

- [ ] **Step 2: Afig `...s06` a `MANUAL_SHOTS`** a `apps/dashboard-e2e/src/manual/shots/index.ts`.

- [ ] **Step 3: Executa-ho**

Run: `pnpm run dev:up && MANUAL_SEGMENTS_EVENT_ID=… E2E_EMAIL=… E2E_PASSWORD=… SHOTS=11 pnpm run docs:manual-shots`
Expected: 10 PNG `docs/manual/img/11-segments-*.png`. Si l'event no té conflictes, `11-segments-conflictes` pot fallar.

- [ ] **Step 4: Revisa els PNG**
  - `11-segments-llista` i `11-segments-comptadors`: dalt de tot es veuen les targetes «Ve», «Adults» i «Xicalla» i, davall, els segments amb les insígnies.
    - Si a 1280×800 no hi caben totes dues coses, feu `11-segments-comptadors` amb `clip: 'main'`. Si no, mostreu el comptador a la pàgina amb dues imatges.
  - `11-segments-fila` i `11-segments-cordons`: el segment té figures i la figura mostra «Tots» o «N/M».
    - Si mostra «Sense rengles», trieu un event amb una figura que tinga rengles.
  - `11-segments-figura-picker`: es veu «Seleccionades (2)» i «Confirma (2)».
  - `11-segments-troncs`: es veu el resum dels pisos («… - ? - …») i el selector «Completa».
  - `11-segments-bloquejat`: insígnia «Assignacions bloquejades» i, en lloc de l'icona de persona, «Assigna» amb un cadenat.
  - Comproveu a l'app que l'event no ha canviat.
  - Si `11-segments-conflictes` falla per falta de dades, esborreu-la de `s06.ts` i descriviu la píndola amb text a la pàgina. **No en creeu cap conflicte a la BD de dev per a la captura.**

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard-e2e/src/manual/shots/s06.ts apps/dashboard-e2e/src/manual/shots/index.ts docs/manual/img/11-*.png
git commit -m "docs(manual): add segments and figures screenshots"
```

---

### Task B: `docs/manual/11-segments-i-figures.md`

**Esquema:**

```
<!-- rutes: /events/:id?tab=pinyes -->
# Segments i figures
## Per a què serveix
## On és
![…](img/11-segments-llista.png)
## Pas a pas
### Crear els segments
### Afegir figures a un segment
### Ordenar, moure i copiar
### Hi ha prou gent? Llegir els comptadors
### Cordons i cordons oberts
### Mode de la figura: Completa, Peu, Remat, Neta
### Publicar als membres
### Anar a assignar o a projectar
## Si sou de pinyes
## Si sou de troncs o xicalla
## Compte amb
## Relacionat
```

- [ ] **Step 1: «Per a què serveix»** (2-3 frases)
  - És l'esquelet de l'event: quins segments (proves, rondes o moments de l'actuació) hi haurà i quines figures es fan en cada un.
  - Les figures d'un mateix segment es fan alhora. Per tant, una persona només pot estar en un lloc de cada segment.
  - Des d'ací també es veu si hi ha prou gent, es trien els cordons i es decideix què veuen els membres a l'app.

- [ ] **Step 2: «On és»:**
  - «Assajos» o «Actuacions» → feu clic en l'event. Tant «Veure detall» com «Gestionar pinyes» porten ací.
  - El detall s'obri ja a la pestanya «Pinyes i Figures».

- [ ] **Step 3: «Pas a pas», crear els segments**
  1. «Segment nou» afig un segment buit al final. No demana res.
  2. Mentre no té nom, el segment es diu com les figures que porta, amb «(automàtic)» al costat:
     - «Segment sense nom», si encara no en té cap;
     - «Pilar de 4 + Torre», per exemple, quan en té;
     - «2 Pilar», si hi ha dues figures iguals.
  3. Per a posar-li un nom, feu clic al nom. Escriviu-lo a «Nom del segment (opcional)» i premeu «Alça» o `Intro`.
     - `Escape` o «Cancel·la» ho deixen com estava.
     - Si l'esborreu i alceu, el segment torna al nom automàtic.
  4. Per a canviar l'ordre, arrossegueu la nansa (sis punts) de l'esquerra. El número quadrat és la posició del segment.
  5. «Desplega» i «Plega» obrin o tanquen tots els segments. La fletxa de cada segment obri o tanca només eixe.
  6. Per a eliminar un segment, feu clic a la paperera de la dreta. El navegador demana confirmació. S'esborra amb totes les figures i les persones assignades, i no es pot desfer.

- [ ] **Step 4: Afegir figures** (captures `11-segments-figura-picker.png` i `11-segments-composicio-picker.png`)
  1. «+ Figura» al segment → s'obri «Afegir figures al segment».
  2. Pestanya «Figures»:
     - cerqueu amb «Cerca figura...» i feu clic en una o més figures. Es pot repetir la mateixa;
     - van a «Seleccionades (N)», en l'ordre en què les heu triades. La «×» en lleva una;
     - «Confirma (N)» les afig.

     Les figures que no tenen pinya porten la insígnia «Tronc».
  3. Pestanya «Composicions»: trieu-ne una i premeu «Aplica «nom»».
     - S'afigen totes les figures de la composició ja col·locades, amb el mode i els cordons que s'hi van triar.
     - El segment pren el nom de la composició.
  4. Si al segment hi ha dues figures que es diuen igual, l'app les numera: «Pilar 1», «Pilar 2».
     - Per a posar-li un nom propi a una figura, feu clic al llapis («Nom personalitzat (opcional)»).

- [ ] **Step 5: Ordenar, moure i copiar** (captura `11-segments-copia.png`)
  - **Ordenar dins del segment:** arrossegueu la nansa de la figura.
  - **Moure a un altre segment:** arrossegueu la figura fins a l'altre segment. Se'n va amb les persones assignades.
    - Si alguna persona ja estava en eixe segment, queda en dos llocs alhora. Ho avisa el missatge «N persones han quedat en conflicte en este segment. Resoleu-ho des de l'assignació.» (pàgina 14).
  - **Copiar a un altre segment:** amb la icona de copiar s'obri «Copia la figura al segment:». Trieu el segment i apareix «Figura copiada al segment.».
  - **Treure una figura:** la «×» de la figura obri «Eliminar figura del segment».
    - Si té gent assignada, avisa: «N assignacions es perdran.».
    - Confirmeu amb «Elimina». No es pot desfer.

- [ ] **Step 6: Hi ha prou gent? Llegir els comptadors** (captura `11-segments-comptadors.png`). **No hi ha cap comptador que diga «falten N persones».** Es calcula amb dues peces.
  1. **El que necessiteu.** Mireu la insígnia de cada segment, a la vista «Pinyes»: «23/35 pinyes, 29/45 total».
     - El número de la dreta de cada parell (35, 45) són els **llocs** que té el segment:
       - «pinyes»: llocs de pinya, només dels cordons que es fan;
       - «total»: pinya + tronc + bases + direccions.
     - El de l'esquerra (23, 29) són els llocs que ja tenen algú.
     - En la vista «Troncs», la mateixa insígnia diu «4/10 troncs, 29/45 total».
     - Cada figura també té el seu: «12/20 pinya (2 cor.), 15/24 total».
  2. **El que teniu.** Dalt de tot, la targeta de l'esquerra diu quanta gent ve:
     - «Ve» abans del dia de l'event;
     - «Ha arribat» el mateix dia.

     Al costat hi ha «Adults» i «Xicalla». A la pestanya «Resum» hi ha també els «Pendents».
  3. **Com es compara.** Com que en un segment cada persona fa un sol lloc:
     - si el «total» d'un segment és més gran que la gent que ve, no hi ha prou gent per a fer-lo tal com està;
     - per a la pinya, compteu els adults que no aniran al tronc.

     Cada segment es mira per separat, perquè la mateixa gent torna a estar disponible en el segment següent.
  4. **Si no n'hi ha prou:** reduïu els cordons, desactiveu els cordons oberts, canvieu el mode o traieu una figura. La insígnia s'actualitza a l'instant.
  5. **A l'hora d'assignar,** el panell de persones mostra «N lliures · N elegibles per a pinya» (pàgina 13).

- [ ] **Step 7: Cordons i cordons oberts** (captura `11-segments-cordons.png`, vista «Pinyes»)
  - A la dreta de cada figura hi ha «−» i «+» amb «Tots» o «2/4»: quants cordons de pinya es fan dels que té la plantilla.
    - «+» des de l'últim cordó torna a «Tots».
    - Només funciona si la plantilla té rengles (pàgina 09). Si no en té, la figura diu «Sense rengles».
  - El botó de cordons oberts activa o desactiva els llocs «CORDÓ OBERT». Si el passeu per damunt, diu «Cordons oberts: activats» o «desactivats».
  - Si el canvi deixa fora persones ja assignades, l'app avisa abans:
    - «Canvia els cordons» o «Desactiva els cordons oberts»;
    - «Esta acció eliminarà N assignacions… Les persones assignades quedaran lliures.» → «Elimina-les».

    Si no hi ha ningú afectat, es fa directament.
  - Si la figura no té pinya o està en Remat o Neta, no hi ha comptador: es veu la insígnia «Neta» o «Remat».

- [ ] **Step 8: Mode de la figura** (captura `11-segments-troncs.png`)
  - **El mode només es canvia en la vista «Troncs»:** és el selector de la dreta de cada figura.
    - «Completa»: tota la figura.
    - «Peu»: el nom passa a «Peu de …». Es fa la part de baix; en el resum del tronc no ixen els pisos de dalt que no tenen ningú.
    - «Remat»: «Remat de …». Ni pinya ni bases.
    - «Neta»: «… neta» o «… net». Sense pinya.
  - Passar a «Remat» o a «Neta» lleva la gent de la pinya, i en el cas de «Remat», també la de les bases. Si hi havia algú, l'app ho demana abans: «Canviar a Remat» / «Canviar a Figura neta» → «Canvia a …». No es pot desfer.
    - «Completa» i «Peu» s'apliquen sense preguntar.
  - En la vista «Troncs», davall de cada figura es veu:
    - el resum del tronc per pisos, de baix a dalt, amb «?» als llocs buits. Si encara no hi ha ningú, «Sense assignacions al tronc» o «Sense assignacions»;
    - les direccions entre claudàtors.

    En la vista «Pinyes» només es veu la direcció de pinya.

- [ ] **Step 9: Publicar als membres** (captura `11-segments-fila.png`)
  - L'ull de cada segment:
    - verd: «Visible als membres — cliqueu per ocultar»;
    - gris: «Ocult als membres — cliqueu per publicar».
  - Un membre només veu a l'app els segments publicats: el segment, on va ell i la projecció (pàgina 19). Els que no estan publicats no els veu.
  - El botó «Publicat» / «No publicat» de dalt fa tots alhora:
    - si cap no està publicat, els publica tots;
    - si n'hi ha **algun** de publicat, els oculta tots.
  - Recomanació: publiqueu quan l'assignació del segment estiga acabada i revisada.

- [ ] **Step 10: Anar a assignar o a projectar**
  - «Assigna» (en un segment amb figures) obri l'espai de treball del segment.
    - En la vista «Troncs», s'obri directament la pestanya Troncs (pàgina 12). En la vista «Pinyes», la pestanya Pinyes (pàgina 13).
    - Fer clic al nom d'una figura obri l'espai de treball amb eixa figura triada.
  - «Projecta» obri la projecció a pantalla completa (pàgina 16).
  - La vista «Pinyes» o «Troncs» queda recordada en eixe navegador fins que la canvieu.

- [ ] **Step 11: «Si sou de pinyes»:**
  - Mireu les insígnies «x/y pinyes» de cada segment contra els «Adults» que vénen. Ajusteu els cordons i els cordons oberts **abans** que es comence a assignar: després, reduir-los lleva gent.
  - La direcció de pinya de cada figura es veu entre claudàtors en la vista «Pinyes».

- [ ] **Step 12: «Si sou de troncs o xicalla»:**
  - Treballeu en la vista «Troncs». S'hi veu el resum de cada tronc i les direccions, i s'hi tria el mode de la figura (Peu, Remat...).
  - «Assigna» des d'esta vista obri l'assignació directament a la pestanya Troncs.
  - Assigneu primer vosaltres: pinyes omplirà després amb la gent que quede.

- [ ] **Step 13: «Compte amb»**
  - **Aplicar una composició canvia el nom del segment** pel de la composició, encara que ja n'hi hàgeu posat un.
  - **Les insígnies compten llocs, no persones.** Si algú està en dos llocs del mateix segment, compta dues vegades. La píndola roja «N conflictes» del segment avisa d'això. Si la passeu per damunt, diu qui està en dos llocs i on, i acaba amb «Resoleu-los des de l'assignació.» (captura `11-segments-conflictes.png`, pàgina 14).
  - **«Publicat» de dalt oculta tot** si hi ha algun segment publicat. Per a publicar-ne només un, feu servir l'ull d'eixe segment.
  - **Event bloquejat.** Dos dies després de la data de l'event apareix la insígnia «Assignacions bloquejades» (captura `11-segments-bloquejat.png`).
    - Ja no es poden afegir, eliminar, moure ni canviar de nom segments ni figures, ni canviar els cordons o el mode.
    - Encara es pot publicar o ocultar i obrir «Assigna» (amb un cadenat) i «Projecta».
  - **En pantalles estretes (mòbil)** s'amaguen:
    - «Segment nou», «+ Figura» i la paperera del segment;
    - les insígnies i els cordons;
    - el selector de mode, copiar i treure.

    Munteu l'esquelet des de l'ordinador o la tauleta.
  - Si un segment té hora o notes, es veuen davall del nom. Des del Dashboard no es poden posar ni canviar.
  - Canviar una plantilla no canvia les figures d'este event que ja tenen gent assignada (pàgina 08).

- [ ] **Step 14: «Relacionat»:**
  - `07-assajos-i-actuacions.md` (crear l'event i les xifres d'assistència);
  - `08-plantilles.md`;
  - `09-plantilles-pinya.md` (rengles i cordons);
  - `12-assignacio-troncs.md`;
  - `13-assignacio-pinyes.md`;
  - `14-conflictes.md`;
  - `16-previsualitza-i-projeccio.md`;
  - `19-pwa.md` (què veu un membre).

- [ ] **Step 15: Verificació**
  - Obriu `/config/manual/11-segments-i-figures`: les imatges carreguen i els enllaços naveguen.
  - Passeu la checklist de llengua.
  - `grep -n "instància\|snapshot\|node" docs/manual/11-segments-i-figures.md` només pot trobar «node» si va explicat.
  - Torneu a comprovar els textos entre «» contra `segment-manager.component.html`.

- [ ] **Step 16: Commit**

```bash
git add docs/manual/11-segments-i-figures.md
git commit -m "docs(manual): write segments and figures page"
```

---

## Notes per a la demo (bloc 0:40-0:50 de S10, 10 min)

**Dades:**
- L'event «Assaig de demo» creat en el bloc 07. Té data futura, així que no està bloquejat.
- Dues plantilles amb rengles i cordons oberts.
- Una composició.
- Per a les insígnies d'assistència, cal que hi haja alguna resposta «Ve». Si l'event és nou i ningú no ha respost, mostreu les xifres en un assaig real pròxim. Només s'hi mira: no s'hi toca res.

| Min | Què es fa | Qui mira |
|---|---|---|
| 0-3 | «Segment nou» dues vegades. Nom automàtic → posar «Primera ronda». «+ Figura» amb dues figures → «Confirma (2)». Al segon segment, «Composicions» → «Aplica «…»». Fer notar que el segment pren el nom de la composició. | tothom |
| 3-6 | **Hi ha prou gent?** Llegir «x/y pinyes, x/y total» del segment al costat de la targeta «Ve» / «Adults». Reduir un cordó amb «−» i veure baixar la insígnia. Desactivar els cordons oberts. | pinyes sobretot |
| 6-8 | Vista «Troncs»: resum del tronc, direccions i selector «Completa»/«Peu»/«Remat»/«Neta». «Assigna» des d'ací obri la pestanya Troncs. Recordar l'ordre de treball: primer troncs i xicalla, després pinyes. | troncs/xicalla |
| 8-10 | Copiar una figura a l'altre segment. Publicar un segment amb l'ull i ensenyar a la PWA (pestanya en mida de mòbil) que ara apareix. Avís sobre el botó «Publicat» de dalt. Ensenyar la insígnia «Assignacions bloquejades» en un event antic. | tothom |

**Preguntes probables:**
- *«On veig quantes mans em falten?»* No hi ha cap comptador directe. Resteu la gent que ve (targeta «Ve») del «total» del segment. Per a la pinya, mireu «pinyes» contra els adults.
- *«Puc posar l'hora de cada segment?»* Ara mateix no, des del Dashboard. Si ve donada, es veu.
- *«Per què no puc canviar els cordons d'esta figura?»* La plantilla no té rengles («Sense rengles»), la figura està en Remat o Neta, o l'event està bloquejat.
- *«He mogut una figura i diu que hi ha conflictes.»* Algú de la figura ja estava en l'altre segment. Resoleu-ho a l'assignació (pàgina 14).
- *«Els membres veuen el que estic fent?»* Només els segments publicats, amb l'ull verd.
- *«Per què no trobe el selector Completa/Peu?»* Només està en la vista «Troncs».
