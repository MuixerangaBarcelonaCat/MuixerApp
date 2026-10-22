# S09 · Comunicació i l'app dels membres (PWA): pla de secció

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objectiu:** escriure les pàgines `18-comunicacio.md` i `19-pwa.md` del manual, amb les seues captures. La 18 explica com publicar notícies i enviar o programar notificacions des del Dashboard, i què arriba al mòbil dels membres. La 19 **només** ha d'ajudar els tècnics a entendre què veu un membre a l'app i què hi veu un tècnic, per a poder respondre dubtes. El manual no apareix dins de la PWA.

**Pàgines:** `docs/manual/18-comunicacio.md`, `docs/manual/19-pwa.md`

**Rutes cobertes:**
- 18 (Dashboard): `/communication`, `/communication/news`, `/communication/news/new`, `/communication/news/:id/edit`, `/communication/notifications`, `/communication/notifications/schedules`, `/communication/notifications/schedules/new`, `/communication/notifications/schedules/:id/edit`, `/communication/notifications/history`, `/communication/notifications/devices`
- 19 (PWA, amb prefix `pwa:` per a no confondre-les amb les del Dashboard): `pwa:/login`, `pwa:/forgot-password`, `pwa:/activate`, `pwa:/home`, `pwa:/news/:id`, `pwa:/events`, `pwa:/events/past`, `pwa:/events/:id`, `pwa:/events/:id/roll-call`, `pwa:/events/:eventId/segments/:segmentId`, `pwa:/profile`, `pwa:/profile/settings`, `pwa:/pending-dependents`

> Decisió d'este pla: el comentari de rutes de la 19 usa el prefix `pwa:`. Així, `grep -rl "rutes:.*pwa:/events" docs/manual` troba la 19 i no la 07. Si el pla arrel adopta una altra convenció, canvieu-ho.

**Spec:** `docs/superpowers/specs/2026-10-21-manual-us-dashboard-design.md`
**Pla arrel:** `docs/superpowers/plans/2026-10-21-manual/00-general.md` (cal que les tasques 1-4 estiguen fetes: visor, `ManualShot`, `manual-shots.spec.ts`, `loginViaUi(page, creds?)`)

---

## Fonts verificades

Tots els textos entre «» d'este pla s'han copiat de les fonts següents (21-10-2026). Si un text no hi és, es marca com a **no verificat**.

**Dashboard: Comunicació** (`apps/dashboard/src/app/features/communication/`)
- `communication.routes.ts`: rutes i títols de pàgina.
- `communication.component.html`: centre de comunicació. Targetes «Notícies» i «Notificacions».
- `components/news-list/news-list.component.html` i `shared/utils/news.util.ts`: llista de notícies i estats «Esborrany» / «Programada» / «Publicada».
- `components/news-editor/news-editor.component.html` i `.ts`: editor de notícies («Esborrany» / «Publica ara» / «Programa», casella «Envia notificació», botó «Desa»).
- `components/notification-send/notification-send.component.html` i `.ts`: formulari per a enviar o programar. Títols de pàgina i botó d'enviar a `pageTitle`/`submitLabel`.
- `components/notification-event-picker/…html`, `notification-link-picker/…html`, `notification-target-picker/…html` i `.ts`: opcions d'esdeveniment, enllaç i destinataris. El filtre d'assistència usa `attendanceStatusLabel(status, 'before')` de `libs/shared/src/utils/event-phase.util.ts`: «Ve», «No ve», «Pendent», «Assistit».
- `components/notification-schedule-list/…html` i `.ts`: llista de programades, amb `ruleSummary`, `statusLabel` i `targetSummary`.
- `components/notification-history/…html` i `.ts`: historial (`SOURCE_LABELS`).
- `components/device-list/device-list.component.html`: dispositius subscrits.
- `utils/weekday-names.ts`: noms dels dies.
- `apps/dashboard/src/app/shared/components/layout/tab-nav/tab-nav.component.ts`: entrada «Comunicació» del menú.

**API (comportament que explica el text)** (`apps/api/src/modules/`)
- `push-notification/push-notification-cron.service.ts`: cada minut envia la notificació de les notícies publicades amb `sendPush`. Com a títol posa el de la notícia, com a text els 200 primers caràcters del cos (Markdown tal qual) i l'enllaç és `/home`. **No passa per l'historial.**
- `push-notification/push-notification.service.ts`: resolució de destinataris. «Tots» són tots els comptes actius. «Segons assistència» «Pendent» inclou les persones sense resposta. «Persones concretes» arriba **només al compte propi** de cada persona, no als seus delegats. `recipientCount` (columna «Abast») és el nombre de comptes, no de mòbils. Enllaços: «Pàgina d'inici» → `/home`, «Esdeveniment vinculat» → `/events/<id>`.
- `push-notification/notification-schedule-cron.service.ts`: les programacions es revisen cada minut.
- `news/news.service.ts`: la PWA mostra totes les notícies publicades, de la més nova a la més antiga, sense límit.

**PWA** (`apps/pwa/src/`)
- `custom-sw.js`: com es mostra la notificació i què passa en tocar-la.
- `app/app.routes.ts`: rutes i guardes (`roll-call` amb `rolesGuard([TECHNICAL, ADMIN])`).
- `app/core/layout/app-shell/app-shell.component.ts`: avís «Compte no vinculat», bàners i modal de consentiment.
- `app/shared/components/push-permission-banner/…html` i `app/core/services/push-subscription.service.ts`: bàner «Activa les notificacions» («Ara no» l'amaga 7 dies).
- `app/shared/components/install-prompt-banner/install-prompt-banner.component.ts`: «Instal·la l'app».
- `app/shared/components/bottom-tab-bar/bottom-tab-bar.component.ts`: «Inici», «Agenda», «Perfil».
- `app/features/auth/login/login.component.html` i `activate/activate.component.html`.
- `app/features/home/home.component.html`: salutació «Hola, X!», «Pròxim assaig», «Pròxima actuació», «Notícies», bàner de xicalla pendent.
- `app/features/events/event-list/event-list.component.html`: «Actuacions», «Assajos», «Passats», calendari.
- `app/features/events/components/calendar-view/calendar-view.component.ts`: llegenda (`LEGEND`).
- `app/features/events/components/event-card/event-card.component.html` i `.ts`: targeta, comptador de tècnic i una fila de botons per persona gestionada.
- `app/features/events/components/attendance-button/attendance-button.component.ts`: «Vaig» / «No vaig» / «He assistit». Tornar a tocar el botó marcat el deixa en Pendent.
- `app/features/events/event-detail/event-detail.component.html` i `.ts`: caixa d'estadístiques, segments, «Passa llista» i la línia `ponytail:` F13.
- `libs/shared/src/utils/own-position.util.ts`: resum «on sou», text de diverses posicions alhora i «No teniu cap posició en este segment.».
- `app/features/events/roll-call/roll-call.component.html` i `.ts`: Passa llista (pestanyes, botons, «+ Persona nova», modal «Canvi fora de termini»).
- `app/features/events/segment-projection/segment-projection.component.html` i `.ts`, i `libs/pinyes-render/src/lib/components/own-position-banner/…`: projecció, «Troba'm» / «On està», «Cerca una persona».
- `app/features/profile/profile.component.html` i `.ts`, `delegations-modal/…html` i `.ts`, `settings/settings.component.html`, `components/push-settings/push-settings.component.html`.
- `app/features/dependents/pending-dependents/pending-dependents.component.html`.
- `libs/ui/src/lib/components/theme-picker/theme-picker.component.ts`: «Sistema», «Clar» i «Fosc».
- `apps/api/src/common/utils/lock.util.ts` i `.env.example` (`ASSIGNMENT_LOCK_DAYS=2`): termini per a canviar l'assistència.
- `apps/api/src/modules/me/me.service.ts`: per a afegir una delegació, l'àlies ha de tindre compte («No existeix cap compte associat a aquest àlies»).

**No verificat en el codi (són coses del navegador o de les dades):**
- A l'iPhone, les notificacions només funcionen si l'app s'ha afegit a la pantalla d'inici. Al codi només hi ha que, si el navegador no té `PushManager`, Configuració mostra «No disponibles en aquest dispositiu».
- Si les dades de desenvolupament tenen els segments publicats i el compte tècnic de proves té persona vinculada i alguna posició (vegeu Task A).

**Errors de l'inventari de pantalles corregits ací** (no els copieu de l'inventari):
- Les pestanyes de Passa llista són «Tots» / «Ha vingut» / «Vindrà» / «No vindrà». No hi ha pestanya «Pendent».
- El botó per a afegir una persona provisional es diu «+ Persona nova».
- El filtre de «Notificacions programades» és un desplegable «Pendents» / «Totes», no pestanyes.
- «Envia notificació» de l'editor de notícies és una casella, no un interruptor.
- Les rajoles de Perfil es diuen «Assajos», «Actuacions» i «Assistència». El valor (x/y o %) va a part.
- A l'Agenda, «Passats» és un botó que obri «Esdeveniments passats», no un filtre.
- «Dispositius subscrits» no té cap enllaç des del Dashboard. Només s'hi arriba escrivint l'URL.

---

### Task A: captures (`s09.ts`)

**Files:**
- Create: `apps/dashboard-e2e/src/manual/shots/s09.ts`
- Modify: `apps/dashboard-e2e/src/manual/shots/index.ts` (afig `...s09` a `MANUAL_SHOTS`)

**Comprovació de `loginViaUi` amb la PWA (feta):**
- El formulari de `apps/pwa/src/app/features/auth/login/login.component.html` fa servir `lib-input type="email"`, `lib-input type="password"` i `lib-button type="submit"`.
- `libs/ui` passa el `type` a l'`<input>` real (`[type]="effectiveType()"`) i al `<button>` real (`[type]="type()"`).
- Per tant, `input[type="email"]`, `input[type="password"]` i `button[type="submit"]` funcionen. La ruta és `/login`. Després d'entrar, la PWA va a `/home`, i `not.toHaveURL(/\/login/)` es compleix.
- La suite `apps/dashboard-e2e/src/audit-pwa/pwa-audit.spec.ts` ja entra a la PWA amb `loginViaUi`.
- **`loginViaUi` no necessita cap canvi per a la PWA**, a part del paràmetre `creds?` que ja afig la Task 3 del pla arrel (per a `pwa-member`).

**Coses que cal saber dels selectors:**
- `lib-card`, `lib-button` i `lib-button-group` tenen l'amfitrió en `display: contents`. Un contorn posat a l'amfitrió **no es veu**, i per això els `highlight` apunten a un element real: el fill (`lib-card[...] > *`) o un `div[role="group"]`.
- Este mateix problema afecta la captura de prova del pla arrel (`highlight: 'lib-card[title="Manual"]'`). Cal canviar-la per `'lib-card[title="Manual"] > *'`.
- Els atributs estàtics `id` i `data-testid` d'un `lib-*` es copien a l'amfitrió. Per això s'escriu `select#linked-event-kind` i `input#send-push`, no només `#…`.
- Tots els selectors de `ready`, `highlight` i `mask` són CSS pur, sense pseudoclasses de Playwright. Així funcionen tant amb `page.locator` com amb `document.querySelector`. Si n'hi ha més d'un, es ressalta el primer.
- A la PWA, `app-push-permission-banner` («Activa les notificacions») ix a totes les pantalles d'un context nou de Playwright perquè el permís és `default`. La primera captura el mostra a propòsit. La resta el tanquen amb «Ara no», que només escriu `localStorage` i no envia res al servidor.

**Dades necessàries (BD local de desenvolupament, `TARGETS` d'`audit-targets.ts`):**
- `TARGETS.workspaceEventId` / `workspaceSegmentId`: el segment ha d'estar **publicat**. Si no ho està, la projecció de la PWA torna 404.
  - No el publiqueu des de la suite: feu-ho a mà al Dashboard, o passeu `AUDIT_WS_EVENT_ID` / `AUDIT_WS_SEGMENT_ID` d'un segment publicat.
- El compte tècnic de proves (`E2E_EMAIL`) necessita una persona vinculada per a veure els botons «Vaig» / «No vaig» i el ressaltat de la projecció.
  - Si no en té, apareix «Compte no vinculat» i el bàner diu «No teniu cap posició en este segment.».
  - La captura és vàlida igualment, però el text de la pàgina s'ha d'escriure a partir del codi.
- Si el compte encara no ha acceptat la política de privacitat, apareix `app-consent-modal` i tapa la pantalla. Accepteu-la a mà una vegada abans d'executar la suite.

**Regla:** cap captura no envia, no crea ni canvia res. Només es navega i s'obrin o es tanquen pestanyes, desplegables i modals. No s'escriu en cap camp de text.

- [ ] **Step 1: Crea `s09.ts`**

```ts
import { Page } from '@playwright/test';
import { ManualShot } from '../manual-shot';
import { TARGETS } from '../../audit/audit-targets';

const ws = `/events/${TARGETS.workspaceEventId}`;
const projection = `${ws}/segments/${TARGETS.workspaceSegmentId}`;
const assaig = `/events/${TARGETS.eventAssaigId}`;

/** Clicks «Ara no» on the PWA push banner if it is showing (writes localStorage only). */
async function dismissPushBanner(page: Page): Promise<void> {
  const later = page.getByRole('button', { name: 'No activar ara' });
  if (await later.isVisible().catch(() => false)) await later.click();
}

export const s09: ManualShot[] = [
  // ── 18 · Comunicació (Dashboard) ──────────────────────────────────────────
  {
    file: '18-comunicacio-centre.png',
    app: 'dashboard',
    path: '/communication',
    ready: 'lib-card[title="Notificacions"]',
  },
  {
    file: '18-comunicacio-noticia-nova.png',
    app: 'dashboard',
    path: '/communication/news/new',
    ready: 'div[role="group"][aria-label="Quan es publica la notícia"]',
    prepare: (page) => page.getByRole('button', { name: 'Programa', exact: true }).click(),
    highlight: 'div[role="group"][aria-label="Quan es publica la notícia"]',
    settle: 800, // Tiptap editor is @defer'd
  },
  {
    file: '18-comunicacio-noticia-avis.png',
    app: 'dashboard',
    path: '/communication/news/new',
    ready: 'input#send-push',
    highlight: '.form-control:has(input#send-push)',
    settle: 800,
  },
  {
    file: '18-comunicacio-noticies.png',
    app: 'dashboard',
    path: '/communication/news',
    ready: 'table',
  },
  {
    file: '18-comunicacio-envia.png',
    app: 'dashboard',
    path: '/communication/notifications',
    ready: 'select#linked-event-kind',
    prepare: async (page) => {
      await page.selectOption('select#linked-event-kind', 'NEXT_ASSAIG');
      await page.getByRole('button', { name: 'Segons assistència' }).click();
    },
    highlight: 'div[role="group"][aria-label="Tipus de destinataris"]',
  },
  {
    file: '18-comunicacio-enllac.png',
    app: 'dashboard',
    path: '/communication/notifications',
    ready: 'div[role="group"][aria-label="Enllaç de la notificació"]',
    highlight: 'div[role="group"][aria-label="Enllaç de la notificació"]',
  },
  {
    file: '18-comunicacio-programa.png',
    app: 'dashboard',
    path: '/communication/notifications/schedules/new',
    ready: 'div[role="group"][aria-label="Tipus de programació"]',
    prepare: (page) => page.getByRole('button', { name: "Abans d'un esdeveniment" }).click(),
    highlight: 'div[role="group"][aria-label="Tipus de programació"]',
  },
  {
    file: '18-comunicacio-programades.png',
    app: 'dashboard',
    path: '/communication/notifications/schedules',
    ready: 'app-page-header h1',
  },
  {
    file: '18-comunicacio-historial.png',
    app: 'dashboard',
    path: '/communication/notifications/history',
    ready: 'app-page-header h1',
  },
  {
    file: '18-comunicacio-dispositius.png',
    app: 'dashboard',
    path: '/communication/notifications/devices',
    ready: 'app-page-header h1',
    mask: ['table tbody td:first-child'], // full first name + surname
  },

  // ── 19 · PWA, compte tècnic ───────────────────────────────────────────────
  {
    file: '19-pwa-avis-notificacions.png',
    app: 'pwa',
    path: '/home',
    ready: 'div.fixed[role="alert"]',
    highlight: 'div.fixed[role="alert"]',
  },
  {
    file: '19-pwa-inici.png',
    app: 'pwa',
    path: '/home',
    ready: 'app-event-card, lib-empty-state',
    prepare: dismissPushBanner,
  },
  {
    file: '19-pwa-agenda.png',
    app: 'pwa',
    path: '/events',
    ready: 'app-event-card',
    prepare: dismissPushBanner,
    highlight: 'app-event-card div.items-end.shrink-0', // Vaig / No vaig of the first card
  },
  {
    file: '19-pwa-agenda-calendari.png',
    app: 'pwa',
    path: '/events',
    ready: 'button[aria-label="Mostra el calendari"]',
    prepare: async (page) => {
      await dismissPushBanner(page);
      await page.click('button[aria-label="Mostra el calendari"]');
      await page.waitForSelector('[data-testid="calendar-legend"]');
    },
    highlight: '[data-testid="calendar-legend"]',
  },
  {
    file: '19-pwa-detall-tecnic.png',
    app: 'pwa',
    path: assaig,
    ready: '[data-testid="attendance-stats-box"]',
    prepare: dismissPushBanner,
    highlight: '[data-testid="attendance-stats-box"] > *',
  },
  {
    file: '19-pwa-detall-segments.png',
    app: 'pwa',
    path: ws,
    ready: '.segments-section',
    prepare: dismissPushBanner,
    highlight: '.segments-section',
  },
  {
    file: '19-pwa-projeccio.png',
    app: 'pwa',
    path: projection,
    ready: 'lib-pinya-projection canvas',
    settle: 2000, // camera flies to the caller's placement
  },
  {
    file: '19-pwa-projeccio-cerca.png',
    app: 'pwa',
    path: projection,
    ready: 'button[aria-label="Cerca una persona"]',
    prepare: async (page) => {
      await page.click('button[aria-label="Cerca una persona"]');
      await page.waitForSelector('[data-testid="participant-filter"]');
    },
    settle: 500,
  },
  {
    file: '19-pwa-passa-llista.png',
    app: 'pwa',
    path: `${assaig}/roll-call`,
    ready: '[data-testid="roll-call-row"], lib-empty-state',
    prepare: dismissPushBanner,
    highlight: '[data-testid="roll-call-filters"]',
  },
  {
    file: '19-pwa-passa-llista-provisional.png',
    app: 'pwa',
    path: `${assaig}/roll-call`,
    ready: '[data-testid="roll-call-add-person"] button',
    prepare: async (page) => {
      await dismissPushBanner(page);
      await page.click('[data-testid="roll-call-add-person"] button'); // opens the form only
    },
    highlight: 'div.card.bg-base-200',
  },
  {
    file: '19-pwa-perfil.png',
    app: 'pwa',
    path: '/profile',
    ready: '[data-testid="profile-stat-tile"]',
    prepare: dismissPushBanner,
    highlight: 'div.grid.grid-cols-3',
    mask: ['section h2 + p'], // name + first surname under the alias
  },
  {
    file: '19-pwa-delegacions.png',
    app: 'pwa',
    path: '/profile',
    ready: '[data-testid="profile-stat-tile"]',
    prepare: async (page) => {
      await dismissPushBanner(page);
      await page.getByRole('button', { name: /delegaci/ }).click();
      await page.waitForSelector('#add-delegate-form');
    },
    mask: ['dialog li .truncate'], // delegate alias, or email when it has no person
  },
  {
    file: '19-pwa-configuracio.png',
    app: 'pwa',
    path: '/profile/settings',
    ready: '[data-testid="appearance-row"]',
    prepare: dismissPushBanner,
    highlight: '[data-testid="notifications-row"] > div',
  },

  // ── 19 · PWA, compte de membre (només amb E2E_MEMBER_EMAIL/PASSWORD) ───────
  {
    file: '19-pwa-membre-agenda.png',
    app: 'pwa-member',
    path: '/events',
    ready: 'app-event-card',
    prepare: dismissPushBanner,
  },
  {
    file: '19-pwa-membre-detall.png',
    app: 'pwa-member',
    path: assaig,
    ready: 'app-event-card',
    prepare: dismissPushBanner,
  },
];
```

- [ ] **Step 2: Afig-ho a `shots/index.ts`.** `import { s09 } from './s09';` i `...s09` a `MANUAL_SHOTS`.

- [ ] **Step 3: Executa-ho**

Run: `pnpm run dev:up api dashboard pwa && E2E_EMAIL=… E2E_PASSWORD=… E2E_MEMBER_EMAIL=… E2E_MEMBER_PASSWORD=… SHOTS=18,19 pnpm run docs:manual-shots`

Expected: 24 PNG nous a `docs/manual/img/`, o 22 si no hi ha credencials de membre (`pwa-member` queda `skipped`). Revisa'ls a mà:
- `18-comunicacio-dispositius.png`: la columna «Membre» està tapada.
- `19-pwa-perfil.png`: el nom i el cognom davall de l'àlies estan tapats.
- `19-pwa-delegacions.png`: els noms o els correus dels delegats estan tapats.
- `19-pwa-detall-tecnic.png`: es veu el botó «Passa llista». Ara mateix ix tots els dies (F13), i és correcte: la pàgina explica el comportament previst.
- `19-pwa-projeccio.png`: es veu la figura. Si el segment no està publicat, la captura falla amb «No s'ha pogut carregar la projecció.». Si passa, reviseu les dades, no el selector.
- Cap captura no mostra el bàner «Activa les notificacions», excepte `19-pwa-avis-notificacions.png`.

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard-e2e/src/manual/shots/s09.ts apps/dashboard-e2e/src/manual/shots/index.ts docs/manual/img/18-*.png docs/manual/img/19-*.png
git commit -m "docs(manual): add screenshots for communication and members app pages"
```

---

### Task B: pàgina `18-comunicacio.md`

**Files:**
- Create: `docs/manual/18-comunicacio.md`

**Esquema** (encapçalaments literals; el text, en valencià i parlant de «vós»):

```markdown
<!-- rutes: /communication /communication/news /communication/news/new /communication/news/:id/edit /communication/notifications /communication/notifications/schedules /communication/notifications/schedules/new /communication/notifications/schedules/:id/edit /communication/notifications/history /communication/notifications/devices -->
# Comunicació

## Per a què serveix
## On és
![…](img/18-comunicacio-centre.png)
## Pas a pas
### Publicar una notícia
### Programar una notícia per a més avant
### Corregir o retirar una notícia
### Enviar una notificació ara
### Programar una notificació
### Revisar què s'ha enviat i què està programat
### Veure qui té les notificacions activades
## Què rep el membre al mòbil
## Compte amb
## Relacionat
```

No hi ha blocs «Si sou de pinyes» / «Si sou de troncs o xicalla»: la feina és la mateixa per a tots.

**Per a què serveix** (2-3 frases):
- Les **notícies** són textos que els membres llegeixen a l'app, a «Inici» → «Notícies».
- Les **notificacions** són avisos curts que arriben al mòbil, com un missatge.
- Una notícia pot enviar també una notificació en publicar-se.

**On és:** menú principal → «Comunicació». La pantalla té dues targetes:
- «Notícies»: botó «Notícia nova», les llistes «Recents» i «Programades» (3 de cada), l'enllaç «Totes les notícies» i el resum «N publicades · N programades · N esborranys».
- «Notificacions»: botons «Envia notificació» i «Programa notificació», la llista «Pròxims enviaments» (els 3 següents), els enllaços «Totes les notificacions programades» i «Historial», i el resum «N programacions actives».

**Pas a pas:**

1. **Publicar una notícia** (captures `18-comunicacio-noticia-nova.png` i `18-comunicacio-noticia-avis.png`)
   1. A la targeta «Notícies», feu clic a «Notícia nova».
   2. Ompliu «Títol» i «Cos». El cos té un editor amb format: negreta, llistes i enllaços.
   3. A «Publicació», trieu «Publica ara». Davall diu «Es publicarà en alçar-la.».
   4. Deixeu marcada «Envia notificació» si voleu avisar al mòbil. En una notícia nova ja ve marcada, amb el text «S'enviarà quan es publique la notícia.».
   5. Feu clic a «Desa». El botó no s'activa fins que hi ha títol i cos. En acabar, torneu a la llista «Notícies».
2. **Programar una notícia**
   1. Trieu «Programa» i indiqueu el dia i l'hora («Data i hora de publicació»). Davall diu «Es publicarà automàticament en esta data.».
   2. Fins a eixe moment, la notícia surt com a «Programada» i els membres no la veuen. La notificació, si està marcada, s'envia en el moment de publicar-se.
   3. «Esborrany» alça la notícia sense publicar-la («Es desarà sense publicar-la a l'app.»).
3. **Corregir o retirar una notícia** (captura `18-comunicacio-noticies.png`)
   - Obriu «Totes les notícies». Hi ha la taula «Títol / Estat / Publicació / Notificació / Accions».
   - La columna «Notificació» pot dir:
     - «🔔 Enviada»: ja s'ha enviat;
     - «🔔 Pendent»: s'enviarà quan es publique;
     - «—»: sense notificació.
   - Per a corregir-la, feu clic a «Edita». Una notícia ja publicada s'obri amb «Programa» i la data original, perquè la data no canvie. Si la notificació ja s'ha enviat, la casella queda bloquejada («Enviada el …») i no es torna a enviar.
   - Per a amagar-la als membres sense esborrar-la, canvieu-la a «Esborrany» i feu clic a «Desa».
   - Per a esborrar-la, feu clic a «Elimina» i confirmeu amb «Elimina» al diàleg «Eliminar notícia».
4. **Enviar una notificació ara** (captures `18-comunicacio-envia.png` i `18-comunicacio-enllac.png`)
   1. A la targeta «Notificacions», feu clic a «Envia notificació».
   2. Ompliu el bloc «Contingut»: «Títol» (màxim 100 caràcters) i «Missatge» (màxim 500).
   3. Al bloc «Esdeveniment i enllaç», ompliu «Esdeveniment vinculat (opcional)». Les opcions són «Cap», «Pròxima actuació», «Pròxim assaig», «Pròxima actuació o assaig» i «Esdeveniment específic...». Amb l'última, trieu-lo a «Seleccioneu un assaig o actuació...».
   4. A «Enllaç», trieu on porta la notificació quan el membre la toca:
      - «Pàgina d'inici»;
      - «Esdeveniment vinculat»: només es pot triar si heu vinculat un esdeveniment. Si no, ix l'avís «Per vincular a l'esdeveniment, seleccioneu-ne un a «Esdeveniment vinculat».»;
      - «Un altre lloc»: una ruta de l'app o una adreça web completa.
   5. Al bloc «Destinataris», trieu:
      - «Tots»: «S'enviarà a tots els membres amb subscripció activa.»;
      - «Segons assistència»: només apareix si hi ha un esdeveniment vinculat. Al «Filtre d'assistència» trieu «Ve», «No ve», «Pendent» o «Assistit». Per exemple, per a recordar l'assaig a qui encara no ha contestat, trieu «Pendent»;
      - «Persones concretes»: busqueu-les a «Cerca persones...». Cada persona triada apareix com una etiqueta amb una ✕ per a llevar-la.
   6. Feu clic a «Envia notificació». Ix «Notificació acceptada» i «L'enviament s'ha processat correctament.». «Nova notificació» buida el formulari, i «Reinicia» també el buida abans d'enviar.
5. **Programar una notificació** (captura `18-comunicacio-programa.png`)
   1. Feu clic a «Programa notificació». El formulari és el mateix, amb un bloc més, «Programació».
   2. A «Programació», trieu una d'estes opcions:
      - «Puntual»: una sola vegada, a «Data i hora d'enviament».
      - «Setmanal»: «Dia de la setmana» i «Hora d'enviament». Si cal, «Data d'inici (opcional)» i «Data de fi (opcional)», per exemple de setembre a juny.
      - «Abans d'un esdeveniment»: «Tipus d'esdeveniment» («Actuació» o «Assaig») i «Amb quina antelació» (un número i «dies abans» o «hores abans»). Amb «dies abans» també cal l'«Hora d'enviament». També té dates d'inici i de fi opcionals. Servix per a fer un recordatori automàtic de cada assaig.
   3. En programar, l'esdeveniment vinculat es tria de manera relativa: «Següent actuació», «Següent assaig» o «Següent actuació o assaig». Amb «Abans d'un esdeveniment» hi ha també «Aquest esdeveniment», que vincula cada enviament a l'esdeveniment que el dispara. Per a enllaçar al mateix assaig i enviar «Segons assistència», trieu esta opció.
   4. Feu clic a «Programa notificació». Ix «Notificació programada» i «La notificació s'enviarà a l'hora programada.».
6. **Revisar què s'ha enviat i què està programat** (captures `18-comunicacio-programades.png` i `18-comunicacio-historial.png`)
   - «Totes les notificacions programades» obri «Notificacions programades».
     - El desplegable té «Pendents» i «Totes».
     - Columnes: «Pròxim enviament», «Programació» (per exemple, «Cada Dijous a les 20:00» o «2 dies abans de cada Assaig, a les 19:00», amb la majúscula tal com ix a la UI), «Títol», «Destinataris» («Tothom», «N persones», «Esdeveniment») i «Estat».
     - L'«Estat» és «Pendent» per a les puntuals, «Activa» per a les que es repeteixen i «Inactiva» per a les cancel·lades o acabades.
     - Accions: «Edita» (s'alça amb «Desa els canvis») i «Cancel·la», que es confirma al diàleg «Cancel·la la notificació programada» amb «Cancel·la» («Torna» no fa res).
   - «Historial» obri «Historial de notificacions».
     - Filtre per origen: «Tots els orígens», «Manual», «Programada», «Setmanal», «Abans de l'esdeveniment».
     - Columnes: «Data», «Títol», «Origen», «Destinataris», «Abast».
7. **Veure qui té les notificacions activades** (captura `18-comunicacio-dispositius.png`)
   - Esta pantalla no té cap enllaç al menú. Escriviu l'adreça del Dashboard acabada en `/communication/notifications/devices`.
   - Mostra «Dispositius subscrits»: «Total: N dispositius actius», el cercador «Cerca per nom...» i l'ordre «Dispositius» o «Darrer ús».
   - Columnes: «Membre», «Dispositius actius» i «Darrera notificació» («Mai» si encara no n'ha rebut cap).
   - Si està buida, diu «Cap dispositiu subscrit. Quan els membres activen les notificacions apareixeran ací.».

**Què rep el membre al mòbil:**
- Només rep notificacions qui compleix les tres condicions:
  1. té compte a l'app (vegeu [Persones](03-persones.md), «Crea enllaç d'invitació»);
  2. ha entrat a l'app **en eixe mòbil**;
  3. hi ha activat les notificacions. Pot fer-ho al bàner «Activa les notificacions» → «Activa», o a «Perfil» → engranatge → «Notificacions push».
- L'activació va per dispositiu: si el membre fa servir dos mòbils, ha d'activar-la en tots dos.
- El mòbil mostra el títol i el missatge, amb la icona de l'app. En tocar-la, s'obri l'app a la pàgina de l'«Enllaç» que heu triat.
- Una notícia amb «Envia notificació» arriba amb el títol de la notícia i els 200 primers caràcters del cos. En tocar-la, s'obri «Inici», no la notícia.
- Si el membre ha tocat «Ara no» al bàner, el bàner no torna a eixir fins al cap de 7 dies. Mentrestant, la pot activar des de Configuració.
- A l'iPhone, primer cal afegir l'app a la pantalla d'inici (**no verificat al codi**, és cosa del navegador). Si no, Configuració diu «No disponibles en aquest dispositiu».

**Compte amb:**
- «Tots» vol dir tota la colla amb les notificacions activades. No l'useu per a fer proves: per a provar, envieu-vos-la a vosaltres amb «Persones concretes».
- «Persones concretes» arriba només al compte propi de cada persona. A la xicalla i a qui no té compte no els arriba res, ni tampoc a l'adult responsable. Per a avisar una família, trieu l'adult.
- «Notificació acceptada» no vol dir que haja arribat a algú. Si cap destinatari no té les notificacions activades, l'app també diu «acceptada».
- La columna «Abast» de l'historial compta comptes, no mòbils que l'han rebuda. Amb «Tots», l'abast és tota la colla amb compte, encara que només uns quants tinguen les notificacions activades.
- Les notificacions de les notícies **no** apareixen a l'historial. Per a saber si s'ha enviat, mireu la columna «Notificació» de la llista de notícies.
- Les notícies i les notificacions programades s'envien en el minut següent a l'hora triada, no a l'instant exacte.
- Una notícia publicada es queda a «Inici» de l'app per sempre, a la llista «Notícies» (de la més nova a la més antiga). Quan ja no siga útil, retireu-la amb «Esborrany» o «Elimina».
- El cos de la notícia té format, però la notificació mostra el text tal qual: poden aparéixer símbols com `**` o `#`. Escriviu els 200 primers caràcters en text pla.
- «Un altre lloc» proposa `/noticies/123` com a exemple, però eixa ruta no existeix a l'app: la ruta d'una notícia és `/news/<id>`. Una ruta que no existeix porta a «Inici». Si teniu dubtes, useu «Pàgina d'inici» o «Esdeveniment vinculat».
- El botó d'alçar les notícies es diu «Desa» (en altres pantalles és «Alça»). És el mateix.

**Relacionat:**
- [L'app dels membres (PWA)](19-pwa.md): què veu el membre quan obri la notificació.
- [Persones](03-persones.md): «Crea enllaç d'invitació», perquè el membre tinga compte.
- [Assajos i actuacions](07-assajos-i-actuacions.md): l'assistència que fa servir «Segons assistència».

- [ ] **Step 1: Escriu la pàgina** seguint l'esquema. Posa cada captura on toca, amb un text alternatiu descriptiu en valencià.
- [ ] **Step 2: Verificació.** Obri `/config/manual/18-comunicacio`: les imatges carreguen i els enllaços a 03, 07 i 19 naveguen dins del visor. Passa la checklist de llengua del pla arrel. Comprova a les fonts verificades cada text entre «».
- [ ] **Step 3: Commit**

```bash
git add docs/manual/18-comunicacio.md
git commit -m "docs(manual): add communication page"
```

---

### Task C: pàgina `19-pwa.md`

**Files:**
- Create: `docs/manual/19-pwa.md`

**Esquema:**

```markdown
<!-- rutes: pwa:/login pwa:/forgot-password pwa:/activate pwa:/home pwa:/news/:id pwa:/events pwa:/events/past pwa:/events/:id pwa:/events/:id/roll-call pwa:/events/:eventId/segments/:segmentId pwa:/profile pwa:/profile/settings pwa:/pending-dependents -->
# L'app dels membres (PWA)

## Per a què serveix
## On és
![…](img/19-pwa-inici.png)
## Pas a pas
### Entrar per primera vegada
### Inici
### Agenda: dir si hi aneu
### Persones que gestioneu (xicalla i delegacions)
### Detall d'un assaig o actuació
### On em toca? La projecció
### Perfil i delegacions
### Configuració
### Dades de la xicalla pendents
## Què hi veu un tècnic de més
### Passa llista
## Compte amb
## Relacionat
```

No hi ha blocs per perfil: pinyes, troncs i xicalla hi veuen el mateix. El que canvia és entre **membre** i **tècnic**, i va a «Què hi veu un tècnic de més».

**Per a què serveix:**
- L'app dels membres és l'app del mòbil de la colla. Els membres hi diuen si van als assajos i a les actuacions, hi veuen on els toca a cada figura, hi reben avisos i hi llegeixen les notícies.
- Esta pàgina serveix perquè sabeu què hi veuen i pugueu respondre els seus dubtes. Els tècnics hi tenen alguna eina més («Passa llista»).
- Este manual no és dins de l'app dels membres.

**On és:**
- És una adreça web diferent de la del Dashboard. Es pot instal·lar com una app: el bàner «Instal·la l'app» → «Instal·la» a Android, o «Compartir» → «Afegeix a l'inici» a l'iPhone.
- Es navega amb la barra de baix: «Inici», «Agenda» i «Perfil».

**Pas a pas** (cada apartat, 3-6 línies, amb l'ull posat en «què li direu a un membre»):

1. **Entrar per primera vegada**
   - El tècnic crea l'enllaç des del Dashboard: fitxa de la persona → «Crea enllaç d'invitació». L'enllaç es copia al porta-retalls i l'envieu vosaltres, per exemple per WhatsApp: **l'app no envia cap correu d'invitació**.
   - L'enllaç caduca al cap de 72 hores.
   - L'enllaç obri «Activa el teu compte». El correu ja ve posat. El membre tria «Contrasenya» i «Confirmeu la contrasenya», omple «Dades personals», accepta la «Política de privacitat» («He llegit i accepte la política de privacitat») i fa clic a «Activa el compte».
   - Si l'enllaç ha caducat o ja s'ha fet servir, ix «Este enllaç d'invitació no és vàlid o ha caducat.». Cal crear-ne un altre.
   - Les vegades següents s'entra a «Correu electrònic» i «Contrasenya» → «Entra».
   - Si s'oblida la contrasenya, hi ha «Heu oblidat la contrasenya?». El correu de recuperació obri una pàgina del Dashboard per a triar-ne una de nova. Després es torna a entrar a l'app normalment.
   - Sense captura (la suite ja ha entrat). Expliqueu-ho amb text.
2. **Inici** (captures `19-pwa-inici.png` i `19-pwa-avis-notificacions.png`)
   - Mostra «Hola, <àlies>!», les targetes «Pròxim assaig» i «Pròxima actuació» (amb els botons per a dir si hi van) i la llista «Notícies». Una notícia s'obri en tocar-la.
   - Per a actualitzar, s'estira la pantalla cap avall.
   - El primer dia ix el bàner «Activa les notificacions» («Per saber quan hi ha assaig o actuació») amb «Ara no» i «Activa».
3. **Agenda: dir si hi aneu** (captures `19-pwa-agenda.png` i `19-pwa-agenda-calendari.png`)
   - Hi ha els filtres «Actuacions» i «Assajos», el botó «Passats» (obri «Esdeveniments passats») i el botó del calendari («Mostra el calendari» / «Mostra la llista»).
   - Cada targeta té «Vaig» i «No vaig». Si es toca un altre cop el botó que ja està marcat, la resposta torna a «Pendent» (sense resposta).
   - Quan algú ja consta que hi ha anat, els botons es canvien per l'etiqueta «He assistit». Passa en estos casos:
     - a l'assaig, quan l'han marcat a la tauleta d'arribada o a «Passa llista»;
     - a l'actuació, a les 3 de la matinada del mateix dia, per a tots els que havien dit «Vaig».
   - Quan l'assaig o l'actuació ja ha passat, els botons queden desactivats.
   - Llegenda del calendari: «Vaig», «No vaig», «Pendent», «Assaig» i «Actuació». Un dia s'obri en tocar-lo.
4. **Persones que gestioneu (xicalla i delegacions)**
   - Qui gestiona altres persones (fills de la xicalla o delegacions) veu, a cada targeta, una fila de «Vaig» / «No vaig» per a cada persona. Davant de cada fila hi ha el nom de la persona.
   - Si només es gestiona a si mateix, no hi ha cap nom.
   - Al «Perfil», un selector permet canviar de persona per a veure les dades de cadascuna.
5. **Detall d'un assaig o actuació** (captura `19-pwa-detall-segments.png`)
   - Mostra la targeta, la descripció i la informació, i una llista numerada de proves (segments).
   - Davall de cada prova hi ha on li toca a la persona, per exemple «VENT (C1) a Roscana».
   - Si li toca estar en dos llocs alhora, ix en roig: «Sou en més d'un lloc alhora. La comi sanitària no recomana partir-se pel mig. Parleu amb la tècnica.».
   - **Només hi surten les proves publicades.** Si un membre diu que no veu la pinya, el primer que cal mirar és si la prova té l'ull obert al Dashboard ([Segments i figures](11-segments-i-figures.md), «Ocult als membres — cliqueu per publicar»).
   - Els botons «Vaig» / «No vaig» també són ací.
6. **On em toca? La projecció** (captures `19-pwa-projeccio.png` i `19-pwa-projeccio-cerca.png`)
   - Una prova s'obri en tocar-la. Ocupa tota la pantalla, amb la pinya i els troncs.
   - La càmera va directament al lloc de la persona, que queda marcat. Una frase diu on és («Sou …»), amb el botó «Troba'm» per a tornar-hi.
   - Si no té lloc en eixa prova, diu «No teniu cap posició en este segment.».
   - La lupa («Cerca una persona») obri el diàleg «Cerca una persona». S'escriu «Nom o àlies» i es tria la persona. Aleshores la frase parla d'eixa persona i el botó es diu «On està». La ✕ torna a la posició pròpia.
   - Les fletxes de baix passen a la prova anterior o a la següent. La fletxa de l'esquerra torna a l'esdeveniment.
7. **Perfil i delegacions** (captures `19-pwa-perfil.png` i `19-pwa-delegacions.png`)
   - Mostra l'àlies, el nom i tres xifres de la temporada: «Assajos» (x/y), «Actuacions» (x/y) i «Assistència» (%).
   - El botó «N delegacions» obri «Delegacions». La llista diu qui pot confirmar l'assistència d'esta persona: «Pare/Mare», «Tutor/a» o «Altres». El responsable principal porta l'etiqueta «Primari» i no es pot eliminar.
   - Per a afegir-ne una, s'omplin «Àlies de la persona» i «Tipus de relació» i es fa clic a «Afegeix una delegació». La persona de l'àlies ha de tindre compte. Si no en té, ix «No existeix cap compte associat a aquest àlies».
   - L'engranatge porta a Configuració.
8. **Configuració** (captura `19-pwa-configuracio.png`)
   - «Contrasenya»: s'obri i es canvia amb «Actualitza la contrasenya».
   - «Aparença»: «Sistema», «Clar» o «Fosc».
   - Notificacions:
     - «Notificacions push» té una casella per a activar-les o desactivar-les en eixe mòbil, amb el text «Actives en N dispositiu(s)» o «Rebràs avisos d'assaigs i actuacions».
     - «Notificacions bloquejades» vol dir que s'han bloquejat al navegador. Cal desbloquejar-les a la configuració del navegador.
     - «No disponibles en aquest dispositiu» vol dir que el navegador no permet notificacions.
   - També hi ha «Sobre l'app» (amb «Contacte» i «Política de privacitat») i «Tancar sessió».
9. **Dades de la xicalla pendents**
   - L'adult principal d'un infant que encara és provisional veu a «Inici» l'avís «Encara no heu completat el registre de <àlies>» → «Completa».
   - S'obri «Completeu les dades de la xicalla» («Completant dades: N de M»), amb «Nom», cognoms, «Gènere», «Data de naixement»… i el botó «Desa i continua».
   - Sense captura (depén de les dades). Enllaceu a [Persones](03-persones.md), «Defineix adult responsable».

**Què hi veu un tècnic de més** (captures `19-pwa-agenda.png` i `19-pwa-detall-tecnic.png`, comparades amb `19-pwa-membre-agenda.png` i `19-pwa-membre-detall.png` si existeixen):
- Una taula de dues columnes, «Membre» i «Tècnic»:

  | | Membre | Tècnic |
  |---|---|---|
  | «Vaig» / «No vaig», projecció, Perfil, Configuració | sí | sí |
  | Comptador a cada targeta: «N total» i «N adults · N xicalla» | no | sí |
  | Caixa de xifres al detall: «Vindran», «Assistit» (només assajos), «No vindran» i «Pendents», amb adults i xicalla | no | sí |
  | «Passa llista» | no | sí |

- Cada xifra de la caixa obri «Passa llista» filtrat per eixe estat. «Pendents» l'obri sense filtre.
- Si no hi ha captures de membre, digueu-ho amb text: «Un membre veu les mateixes pantalles, sense el comptador ni la caixa de xifres ni "Passa llista"».

**Passa llista** (captures `19-pwa-passa-llista.png` i `19-pwa-passa-llista-provisional.png`):
- **Comportament previst:** l'enllaç «Passa llista» apareix al detall de l'esdeveniment **només el dia de l'esdeveniment**, davall dels botons propis. Ara mateix ix tots els dies per una prova temporal (`docs/DEBT.md` F13). Les captures poden ensenyar-lo un dia que no és el de l'event. Digueu-ho en una nota curta, sense explicar el perquè tècnic.
- La pantalla mostra el títol i la data de l'event, «Cerca persona...», el botó «+ Persona nova» i les pestanyes «Tots», «Ha vingut», «Vindrà» i «No vindrà».
- Cada persona té tres botons: «Ha vingut», «Vindrà» i «No vindrà». Primer van les persones que s'han apuntat. Davall, en gris, la secció «No s'han apuntat».
- Una persona no canvia de grup fins que torneu a obrir la pantalla.
- **Persona provisional** (algú que ve per primera vegada):
  1. Feu clic a «+ Persona nova».
  2. Escriviu «Nom o àlies...» i feu clic a «Crea».
  3. Es crea com a persona provisional i queda marcada com a present. Després es completa al Dashboard ([Persones](03-persones.md)).
- **«Canvi fora de termini»:** si canvieu l'assistència d'un event que ja fa més de 2 dies que ha passat, l'app ho demana. Amb «Força el canvi», el canvi es fa igualment i queda registrat. «Cancel·la» no fa res.
- Un membre no pot entrar a «Passa llista» encara que tinga l'adreça.

**Compte amb** (dubtes habituals dels membres i què respondre):
- «No veig la pinya / no sé on em toca»: la prova no està publicada, o la persona no té lloc en eixa prova.
- «No em deixa canviar l'assistència»: l'event ja ha passat i els botons queden desactivats. També pot ser que ja conste «He assistit». Un tècnic ho pot canviar des del Dashboard o des de «Passa llista».
- «Em diu "Compte no vinculat"»: el compte no està enllaçat amb cap persona. Cal enllaçar-lo des del Dashboard ([Usuaris i accés](06-usuaris-i-acces.md)).
- «No em arriben les notificacions»: cal que les active en cada mòbil (vegeu [Comunicació](18-comunicacio.md), «Què rep el membre al mòbil»). A l'iPhone, primer cal afegir l'app a la pantalla d'inici.
- Un pare o una mare veu a la projecció el seu lloc, no el del fill. Per a trobar el fill, ha de buscar-lo amb «Cerca una persona».
- Els tècnics veuen comptadors i «Passa llista» que els membres no tenen. Si compartiu pantalla amb un membre, ho veurà diferent.

**Relacionat:**
- [Comunicació](18-comunicacio.md)
- [Persones](03-persones.md): invitació, adult responsable i delegacions al Dashboard.
- [Usuaris i accés](06-usuaris-i-acces.md)
- [Assajos i actuacions](07-assajos-i-actuacions.md): confirmació d'arribada amb la tauleta.
- [Segments i figures](11-segments-i-figures.md): publicar les proves.
- [Previsualitza i projecció](16-previsualitza-i-projeccio.md)

- [ ] **Step 1: Escriu la pàgina** seguint l'esquema. Les captures de membre, amb un text alternatiu que diga «vista de membre». Si `19-pwa-membre-*.png` no existeixen, no les referencieu.
- [ ] **Step 2: Verificació.** Obri `/config/manual/19-pwa` i passa la checklist de llengua. Comprova que cap paraula tècnica («PWA», «push», «segment») no queda sense explicar la primera vegada que apareix. «Segment» es pot explicar com «prova (segment al Dashboard)».
- [ ] **Step 3: Commit**

```bash
git add docs/manual/19-pwa.md
git commit -m "docs(manual): add members app page"
```

---

## Notes per a la demo

**Temps:** uns 15 minuts al final de la demo (bloc «PWA/comunicació»), 6 per a Comunicació i 9 per a l'app dels membres.

**Comunicació (6 min), al Dashboard, pàgina 18 oberta al visor:**
1. Ensenyeu el centre «Comunicació» i les dues targetes.
2. Feu una «Notícia nova» en «Esborrany» i ensenyeu «Publica ara» i «Programa» sense publicar.
   - En acabar, elimineu-la.
   - **No marqueu «Envia notificació» ni publiqueu**: arribaria a tota la colla.
3. Obriu «Programa notificació» → «Abans d'un esdeveniment». És la funció que més estalvia feina (recordatori automàtic de cada assaig). Ompliu-la per a ensenyar-la i feu clic a «Reinicia»: no la programeu.
4. Si voleu ensenyar com arriba al mòbil, envieu una notificació **només a vosaltres** («Persones concretes» → el vostre àlies). Ensenyeu el mòbil per càmera o el bàner a la pantalla compartida.
5. Ensenyeu «Historial» i la columna «Abast», i expliqueu que compta comptes, no mòbils.

**App dels membres (9 min):**
- Com ensenyar-la: Chrome → eines per a desenvolupadors (F12) → mode dispositiu (icona del mòbil) → «iPhone 12 Pro» (390×844), i compartiu eixa finestra. Una altra opció és duplicar la pantalla del mòbil. No cal instal·lar res.
- Entreu amb un compte de tècnic. Si teniu un compte de membre de proves, obriu-lo en una finestra d'incògnit per a comparar-los un al costat de l'altre.
- Ordre:
  1. «Inici» i el bàner de notificacions.
  2. «Agenda»: «Vaig» / «No vaig» (**no canvieu cap resposta d'una altra persona**) i el calendari.
  3. Detall d'un assaig: caixa de xifres (només tècnics) i proves amb «on sou».
  4. Projecció: «Troba'm» i «Cerca una persona».
  5. «Passa llista»: les pestanyes i «+ Persona nova», sense crear-ne cap. Digueu que el dia de l'event és quan apareix.
  6. «Perfil» → «Delegacions» i Configuració → «Aparença» i les notificacions.
- Què ha de mirar cada perfil:
  - pinyes i troncs: la projecció i el resum «on sou», que és el que els membres pregunten més;
  - xicalla: les files de botons per persona gestionada, l'avís «Encara no heu completat el registre…» i que la projecció mostra el lloc de l'adult, no el del fill.

**Preguntes que segurament eixiran:**
- «Per què un membre no veu la pinya?» → la prova no està publicada.
- «Puc enviar un avís només als qui no han contestat?» → «Segons assistència» → «Pendent», amb un esdeveniment vinculat.
- «Els pares reben les notificacions dels fills?» → no. «Persones concretes» arriba només al compte de cada persona: trieu l'adult.
- «Com sé qui té les notificacions activades?» → `/communication/notifications/devices` (no té enllaç al menú).
- «L'app envia el correu d'invitació?» → no. L'enllaç es copia i l'envieu vosaltres. Caduca al cap de 72 hores.
- «Per què ara veig "Passa llista" i abans no?» → només hauria d'eixir el dia de l'event (vegeu la nota de la pàgina).
- «Es pot posar una notícia fixa a dalt?» → no. Van de la més nova a la més antiga.

Apunteu les preguntes noves per a `20-preguntes-frequents.md` (S10).
