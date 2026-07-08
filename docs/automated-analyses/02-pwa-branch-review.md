# MuixerApp — Revisió de la branca `feat/pwa-app-start`

> Revisió del codi nou respecte a `main`: la PWA (P6), el mòdul `me` del backend, el rename `position`→`tag`, els canvis de `season`, els nodes ad-hoc, i el gruix de canvis del dashboard (refactor de composicions, distribució, projecció, canvas d'assignació). **No es repeteix cap troballa ja recollida a [01-full-repo-audit.md](01-full-repo-audit.md)** (en curs de correcció). Data: 2026-07-07 · Branca: `feat/pwa-app-start`. Severitat: 🔴 Alta · 🟠 Mitjana · 🟡 Baixa · 🔵 Suggeriment · ⏳ Pendent (WIP conegut).

## Índex

1. [Resum executiu](#0-resum-executiu)
2. [Estat de les suites](#1-estat-de-les-suites)
3. [PWA (apps/pwa)](#2-pwa-appspwa)
4. [Backend (apps/api + libs/shared)](#3-backend-appsapi--libsshared)
5. [Dashboard — composicions i distribució](#4-dashboard--composicions-i-distribució)
6. [Dashboard — events, segments i config](#5-dashboard--events-segments-i-config)
7. [Dashboard — canvas d'assignació i person-panel](#6-dashboard--canvas-dassignació-i-person-panel)
8. [Dashboard — projecció, plantilles i components compartits](#7-dashboard--projecció-plantilles-i-components-compartits)

---

## 0. Resum executiu

**Valoració global: bona.** El codi nou manté (i en alguns punts millora) el nivell del repositori: la PWA és 100% standalone + signals + `OnPush`, amb refresh-token deduplicat, guards que esperen `whenReady()`, pipe de dates timezone-safe coherent amb el backend, i bona accessibilitat. El mòdul `me` del backend és petit, ben delimitat i **sense cap forat d'autorització** (la identitat surt sempre del JWT; no s'hi ha trobat cap IDOR). Els contractes PWA↔API quadren camp a camp perquè els dos costats importen de `@muixer/shared`. Alguns punts de l'auditoria anterior s'han arreglat de debò en aquesta branca (BUG-5 clientType, SEC-7 parcialment amb `assertCanAssignRole`).

**Els problemes greus es concentren en pocs punts:**

| # | Troballa | On |
| --- | --- | --- |
| 1 | 🔴 [PWA-A1](#-pwa-a1) El botó d'assistència no gestiona `ASSISTIT`: el mostra com «Pendent» i un toc el sobreescriu amb `ANIRE` | `attendance-button.component.ts` |
| 2 | 🔴 [CI] `me.service.spec.ts` no compila (usa `noShow`, eliminat d'`AttendanceSummary`) → `nx test api` **falla a la branca** | `me.service.spec.ts:37` |
| 3 | 🔴 [DB-EV1](#-db-ev1) Recompte d'adults incorrecte en events passats (`children` vs `childrenAttended`) | `event-list.component.ts:35` |
| 4 | 🔴 [DB-AC1](#-db-ac1) Preset de decoració «El·lipse» sempre rebutjat per l'API (400) — funcionalitat morta | `node-preset.constants.ts:52` |
| 5 | 🔴 [DB-CD1/CD2](#-db-cd1) Desats concurrents del composition-editor + `syncEntries` esborra-i-recrea sense transacció → risc real de pèrdua de composicions | `composition-editor.component.ts`, `composition.service.ts:181` |
| 6 | 🔴 [DB-AC2](#-db-ac2) Effect del person-panel amb dependències sobre-rastrejades: el filtre «Xicalla» es reverteix sol | `person-panel.component.ts:251` |
| 7 | 🟠 [API-M2](#-api-m2) Les noves UNIQUE de `node_assignments` poden fer petar el desplegament si hi ha duplicats a PRE/PROD | migració `1782300000000` |
| 8 | 🟠 [API-M3](#-api-m3) Canvi de forma del JSONB `attendanceSummary` sense backfill — afecta el que veuen els membres a la PWA | migracions + `me.service.ts:215` |
| 9 | 🟠 [API-M1](#-api-m1) Color hex corrupte `#9E9E9E0DEEA` al sync de posicions, reaplicat a cada sync | `person-sync.strategy.ts:30` |
| 10 | 🟠 [PWA-M1/M2](#-pwa-m1) Interceptor: token a qualsevol URL + logout que rebrà 401 (refresh token mai revocat) | `auth.interceptor.ts` |

**Abans de fer merge/deploy:** arreglar el spec que trenca CI (#2), els tres punts de dades del backend (#7, #8, #9), i les troballes 🔴 de UI (#1, #3, #4, #5, #6). La resta pot anar en seguiment.

*Nota:* la reescriptura d'`applyComposition` conserva exactament el patró del BUG-11 auditat (el `MAX(sortOrder)` es llegeix fora del manager de la transacció → totes les entrades reben el mateix `sortOrder`). No es compta com a troballa nova, però la reescriptura era l'ocasió d'arreglar-ho.

**Estat de la revisió:** totes les àrees s'han revisat llegint el codi real; l'única sense passada dedicada és `figure-canvas.component.ts` (parcialment coberta per les revisions d'assignació i projecció).

---

## 1. Estat de les suites

Executat el 2026-07-06 sobre la branca:

| Suite | Resultat |
| --- | --- |
| `nx test pwa` | ✅ 16 fitxers, 103 tests, tot passa |
| `nx lint pwa` | ✅ net |
| `nx test dashboard` | ✅ 53 fitxers, 965 tests (2 skipped), tot passa |
| `nx test api` | ❌ **FALLA** — 557 tests passen, però la suite `me.service.spec.ts` no compila |

### 🔴 CI — `me.service.spec.ts` no compila

`apps/api/src/modules/me/me.service.spec.ts:37` — el mock usa `noShow: 0`, camp eliminat d'`AttendanceSummary` (substituït per `childrenAttended`). Error TS2353 → tota la suite del mòdul `me` (401 línies de tests) no s'executa i el target `api:test` falla. Mateixa família de drift a `event.controller.spec.ts:17,28` (allà compila perquè són literals sense anotació de tipus, però convé arreglar-ho al mateix commit). Cap altre residu: zero referències vives a `NO_PRESENTAT`, `openCordons` o al mòdul `position` fora de migracions.

---

## 2. PWA (apps/pwa)

Qualitat notablement alta per ser codi P6 en curs. Contractes amb l'API `me` verificats endpoint a endpoint sense cap mismatch (paths, envelope `{data, meta}`, camps, enums, `ClientType.PWA`). Els problemes greus es concentren en tres punts: l'enum `ASSISTIT` oblidat, el scoping de l'interceptor (patró heretat del dashboard) i l'absència de service worker.

### 🔴 PWA-A1 — `ASSISTIT` no gestionat: es mostra com «Pendent» i un toc el sobreescriu

`apps/pwa/src/app/features/events/components/attendance-button/attendance-button.component.ts:17-27,112-113` — `STATUS_CONFIG` i `STATUS_CYCLE` només cobreixen `PENDENT`/`ANIRE`/`NO_VAIG`, però el backend estableix activament `ASSISTIT` (confirmació d'arribada i sync legacy). Si l'estat és `ASSISTIT`, el botó cau al fallback «Pendent»; en fer-hi clic, `indexOf` retorna `-1` i `(-1+1)%3 = 0` → envia `ANIRE`. Com que el backend només bloqueja events amb data **anterior** a avui i `ASSISTIT` es posa el mateix dia, un membre pot sobreescriure sense saber-ho una assistència ja confirmada. Cal estat visual per a `ASSISTIT` i probablement deshabilitar el toggle.

### 🟠 PWA-M1 — Interceptor: scoping per substring i token enviat a QUALSEVOL URL

`apps/pwa/src/app/core/auth/interceptors/auth.interceptor.ts:13-21` — nova instància del patró FE-1 de l'auditoria: (1) `req.url.includes('/auth/')` és match per substring; (2) per a la resta de peticions s'adjunta `Authorization: Bearer` i `withCredentials: true` incondicionalment, sense comprovar que la URL sigui de l'API pròpia. Qualsevol crida futura a un tercer filtraria el token. Scoping per `req.url.startsWith(environment.apiUrl)`.

### 🟠 PWA-M2 — `POST /auth/logout` rebrà 401: el refresh token no es revoca mai

`auth.service.ts:88-96` + `auth.interceptor.ts:13` — el `logout` del backend **no** és `@Public()`, però l'interceptor exclou tot `/auth/` d'adjuntar el Bearer. Quan el logout s'usi, retornarà 401; el `catchError` neteja l'estat local i l'usuari «surt» visualment, però el refresh token no es revoca al servidor ni s'esborra la cookie — la sessió queda viva 7 dies. L'exclusió hauria de ser només per `login`/`refresh`.

### 🟠 PWA-M3 — Estat d'assistència obsolet al calendari

`event-list.component.html:48` — a la vista de llista la targeta s'instancia sense enllaçar `(attendanceChanged)` (la secció calendari sí que ho fa, línia 71). Com que `allSeasonEvents` només es carrega un cop, la seqüència *canviar assistència a la llista → obrir calendari* mostra l'estat antic. Falta el binding a la branca de llista (mateix cas menor a `home.component.html`).

### 🟠 PWA-M4 — Bucle de redirecció latent si `rolesGuard` denega un autenticat

`roles.guard.ts:15` + `already-auth.guard.ts:10` — rol denegat → `/login`; `alreadyAuthGuard` → `/home`; `rolesGuard` → `/login`... bucle infinit. Avui inabastable (les rutes permeten els tres rols), però peta el dia que s'afegeixi un rol o es restringeixi una ruta. La denegació hauria de fer logout o portar a una pàgina «sense accés».

### 🟠 PWA-M5 — L'`effect()` de sincronització pot trepitjar l'estat optimista

`attendance-button.component.ts:81-84` — l'effect fa `localStatus.set(this.status())` a cada canvi d'input: si l'input canvia amb una petició en vol, l'estat optimista o el valor acabat de confirmar es reverteix visualment. Patró idiomàtic: `linkedSignal(() => this.status())` i ignorar la sincronització mentre `isPending()`.

### 🟡 Baixes (PWA)

- **B1** `event-list.component.ts:169,176` — llista `limit: 50` i calendari `limit: 100` sense paginació ni indicació de truncament; una temporada amb assaig setmanal pot superar-ho i el calendari mostraria mesos «buits». Paginar o iterar fins a `meta.total`.
- **B2** `event-card.component.html:29`, `event-detail.component.html:30` — `startTime` interpolat cru (probablement `HH:MM:SS`); el dashboard sempre fa `slice(0,5)`. Helper compartit.
- **B3** `attendance-button.component.ts:54` — l'input `disabled` existeix però cap consumidor l'usa: a «Passats» cada toc fa cicle optimista → error 400 → rollback → toast genèric. Calcular `disabled` als pares (event passat / usuari sense persona).
- **B4** `pull-to-refresh.component.ts:52-56` — no gestiona `touchcancel` (refresh fantasma possible); i els consumidors (`home.loadData`, `loadAllSeasonEvents`) subscriuen sense `switchMap` → respostes concurrents fora d'ordre.
- **B5** `auth.guard.ts:11` + `login.component.ts:44` — sense `returnUrl`: un deep-link a `/events/:id` (cas d'ús clar per a notificacions) perd la destinació en autenticar-se.
- **B6** `splash-screen.component.ts:28` — mostra `logo-placeholder.svg` mentre el login usa `logoMuixe.png`; incoherent amb el commit «Canviats els logos».
- **B7** `auth.interceptor.ts:36-41` — 401 concurrents comparteixen el `refresh()` (bé), però cada `catchError` dispara el seu propi toast i `navigate` → toasts duplicats de «sessió expirada».

### ⏳ Fonaments PWA pendents (WIP conegut)

- **P1 — No hi ha service worker**: sense `ngsw-config.json` ni `@angular/service-worker`. Sense això no hi ha offline, ni cache d'app-shell, ni instal·labilitat completa: és el buit principal per anomenar-la «PWA».
- **P2 — Meta iOS absents** a `index.html`: `apple-touch-icon`, `apple-mobile-web-app-capable`, status-bar-style.
- **P3 — Google Fonts extern** (`index.html:11-13`): trencarà offline i, a més, **la font no s'aplica enlloc** (cap `fontFamily` al Tailwind config la referencia) — ara mateix és pes mort.
- **P4 — Manifest** correcte (icones 192/512/maskable, `start_url`/`scope` compatibles amb `baseHref: /app/`); falta `description` i `orientation` només-portrait és discutible per a tablets.
- Nota menor: `attendanceSummary` arriba a cada `MeEvent` i la PWA no l'usa enlloc — payload innecessari o feature pendent.

---

## 3. Backend (apps/api + libs/shared)

El mòdul `me` és sòlid i sense IDOR; les 20 migracions estan registrades i coincideixen amb les entitats; `RemoveNoPresentat` migra els estats correctament. Tres punts demanen acció abans de desplegar (M1-M3).

### 🟠 API-M1 — Color hex corrupte al mapping de posicions del sync

`apps/api/src/modules/sync/strategies/person-sync.strategy.ts:30` — l'entrada `ALTRES` té `color: '#9E9E9E0DEEA'` (fusió accidental de `#9E9E9E` i `#80DEEA`). El sync escriu directament a l'entitat (sense passar pel `@MaxLength(7)` del DTO), així que el valor invàlid arriba a la BD i al frontend com a color CSS invàlid. A més, la nova branca `else` (~línia 561) sobreescriu `color` i `positionTypes` de tags existents a cada sync: el valor corrupte es reaplica encara que es corregeixi a mà.

### 🟠 API-M2 — Les noves UNIQUE poden fer petar el desplegament

`apps/api/src/migrations/1782300000000-DropOldCompositionTables.ts:13-15` — s'afegeixen `UNIQUE ("figureInstanceId","instanceNodeId")` i `UNIQUE ("figureInstanceId","personId")` sense desduplicar abans. L'esquema antic (uniques triples amb `compositionSlotId` nullable) permetia legalment duplicats amb slot NULL — i l'auditoria documenta curses TOCTOU que en poden haver creat (BUG-17/18). Si n'hi ha cap a PRE/PROD, l'`ADD CONSTRAINT` falla i el desplegament s'atura a mig camí. Cal un `DELETE` de duplicats (conservant el més antic) abans dels `ADD CONSTRAINT`.

### 🟠 API-M3 — Canvi de forma del JSONB `attendanceSummary` sense backfill

S'elimina `noShow` i s'afegeix `childrenAttended` a la interfície, i els recomptes es recalculen en escriure — però cap migració recalcula els JSONB ja desats a `events.attendanceSummary`. La migració `1782100000000-RemoveNoPresentat` converteix estats però no resums: tots els events existents mantenen la forma antiga i comptadors incoherents fins que algú toqui una assistència. Afecta directament la PWA: `MeService.toMeEvent` (`me.service.ts:215`) retorna aquest JSONB tal qual als membres. Cal migració o script de recàlcul massiu.

### 🟠 API-M4 — SEC-7 només parcialment corregit *(nota sobre tema ja auditat)*

`user.service.ts` — el nou `assertCanAssignRole` és correcte, però només s'invoca quan `dto.role` ve informat: un TECHNICAL encara pot desactivar o canviar l'email d'un ADMIN via `PATCH /users/:id`. Si la intenció era tancar SEC-7, el guard hauria d'aplicar-se a qualsevol modificació sobre un ADMIN.

### 🟡 Baixes (backend)

- **B5** `me.service.ts:151-169` — upsert d'assistència amb cursa find-then-save: dos PUT concurrents (doble tap) poden xocar amb la unique `(person, event)` i retornar 500 en lloc de resposta neta. `INSERT ... ON CONFLICT DO UPDATE` o `repository.upsert`.
- **B6** `season.service.ts:46,70,111-112` — «avui» calculat en UTC mentre `MeService.getLocalToday()` usa `Europe/Madrid` (discrepen entre 00:00 i 02:00 locals); i `season.startDate.toString().slice(0,10)` funciona només perquè TypeORM hidrata `date` com a string. Helper únic compartit.
- **B7** `season.service.ts:172-190` — `checkOverlap` és app-level i TOCTOU (les dates no tenen constraint a BD). Un `EXCLUDE USING gist (daterange(...) WITH &&)` ho garantiria. Risc pràctic baix.
- **B8** `node-assignment.service.ts:867-948` — el clonatge de nodes ad-hoc del `bulkImport` fa `save` node a node + `assign` fora de transacció: fallada a mig camí deixa nodes clonats sense assignacions (la idempotència via `originNodeId` mitiga el reintent). També és N+1. El CRUD ad-hoc individual sí que està ben fet (lock check + transacció).
- **B9** `scripts/normalize-pre-enums.sh` — resol el tipus `zone`/`shape` només des d'`instance_nodes`; amb `synchronize:true`, `figure_nodes.zone` pot tenir un tipus separat que ningú renombra ni amplia amb `DECORATION`/`ARROW`/`CIRCLE`. Inofensiu avui, mina latent per a PRE.

### 🔵 Suggeriments (backend)

- **S11** `me.controller.ts:25` — únic controller sense `@Roles` explícit; funcionalment correcte, però afegir la whitelist mantindria la convenció i evitaria que un rol futur hi accedeixi per omissió.
- **S12** `node-assignment.service.ts:1146` — `assertNotComposition` és un stub buit que es continua cridant; o s'elimina o s'hi posa validació real.
- **S13** `tag/dto/create-tag.dto.ts` — `name` i `slug` sense `@IsNotEmpty()`: es poden crear tags buits via API.

---

## 4. Dashboard — composicions i distribució

El refactor és una millora clara d'arquitectura (components petits, signals, serveis prims alineats amb els endpoints). Els problemes greus es concentren en la persistència: «desa-ho tot a cada canvi» sense control de concurrència + backend que esborra i recrea sense transacció.

### 🔴 DB-CD1 — Cursa d'estat per desats concurrents al composition-editor

`composition-editor.component.ts:305-322` (amb `:163-166`, `:267-270`) — cada pulsació al nom i cada `patchEntry` (etiqueta, X, Y, angle, mode, cordons, drag) dispara un `PUT /compositions/:id` immediat amb **totes** les entrades. Sense debounce ni `switchMap`: múltiples PUTs en vol, i cada resposta fa `entries.set(sorted)` substituint tot l'estat local. Una resposta antiga que arribi tard reverteix silenciosament el que l'usuari acaba d'escriure. Cal `debounceTime` + `switchMap` sobre un subject de desat, o descartar respostes obsoletes.

### 🔴 DB-CD2 — `syncEntries` esborra i recrea sense transacció: pèrdua total possible

`apps/api/src/modules/composition/composition.service.ts:181-206` — `delete` de totes les entrades i després, fora de transacció, cerca de cada `figureTemplate` amb `NotFoundException` possible. Si l'excepció salta després del `delete` (p. ex. plantilla suprimida mentrestant), la composició queda buida permanentment amb un sol PUT fallit. Embolcallar delete+save dins `dataSource.transaction` (el patró ja existeix al snapshot de `figure-instance.service.ts`).

### 🟠 Mitjanes (composicions/distribució)

- **CD3** `composition-editor.component.html:160` + `figure-mode-filter.util.ts:16-17` — buidar el camp «Cordons» estableix `0` en lloc de «Tots»: el `NumberValueAccessor` emet `null`, no `''`, i `+null` és `0` → tots els nodes de pinya amb rengla desapareixen del canvas (i el DTO accepta 0: falta `@Min(1)`). Mateix patró `+$event` a X/Y/angle: camp buidat = figura moguda a 0.
- **CD4** `composition-editor.component.ts:196-206,292-303` — doble creació de composició si s'afegeixen dues figures ràpid (el segon `addFigureTemplate` arriba abans que resolgui el primer `POST`): una composició òrfena a BD. Flag «creating».
- **CD5** `figure-instance.service.ts:400-426` (backend) vs `figure-mode-filter.util.ts:17` (frontend) — semàntica inconsistent de `numberOfCordons`: el frontend filtra per `renglaPosition <= n` (profunditat, base 1); la consulta nova de `pinyaCapacity` filtra per `r."sortOrder" < n` (índex de rengla, base 0) i `totalCordons = COUNT(rengles)`. Els comptadors «assignats/capacitat» i «X de Y cordons» seran incoherents amb el que el canvas dibuixa quan nombre de rengles ≠ profunditat.

### 🟡 Baixes (composicions/distribució)

- **CD6** `distribution-editor.component.ts:196-197` — `save()` envia sempre `troncPanelWidth: null, troncPanelHeight: null` i el backend els escriu tal qual: qualsevol valor desat es destrueix al primer arrossegament. Latent avui, però o es preserva el carregat o s'eliminen del payload.
- **CD7** `distribution-editor.component.ts:154-159` — «Esborra distribució» fa el `DELETE` destructiu sense `app-confirm-dialog` (convenció del projecte); a més el mètode és `async` sense cap `await`.
- **CD8** `composition-grid-tab.component.ts:23,42-49` — `searchTimeout` no es neteja a la destrucció: el callback pot executar-se sobre un component destruït. `clearTimeout` a `ngOnDestroy` o RxJS `debounceTime` + `takeUntilDestroyed`.

### 🔵 Suggeriments (composicions/distribució)

- **CD9** `distribution-editor.component.ts:110` — `nodes: filteredNodes as any` amaga la diferència real de tipus amb el canvas; els camps ja són opcionals a `figure-canvas.component.ts:50`, probablement es pot tipar i eliminar el cast.
- **CD10** `figure-picker-modal.component.ts:44` — l'input `open` és redundant (el modal sempre viu dins d'un `@if`).
- **CD11** `composition-grid-tab.component.ts` — paginació i cerca fetes a mà en lloc de compondre amb `app-pagination`/`app-filter-bar` (contravé CLAUDE.md).

*Verificat també:* cap referència penjada als fitxers eliminats; rutes noves i contractes d'endpoints (compositions, duplicate, apply-composition, distribution, reorder) coincideixen amb el backend.

---

## 5. Dashboard — events, segments i config

Contractes frontend↔backend verificats endpoint a endpoint (season, tag, attendance, event-segment) sense cap desajust. Els problemes reals: recompte d'adults i escriptures multi-`sortOrder`.

### 🔴 DB-EV1 — Recompte d'adults incorrecte en events passats

`event-list.component.ts:35-38` — per a events passats, `getAdultsCount()` fa `attended - children`, però `children` compta xicalla amb ANIRE **o** ASSISTIT; el camp correcte és `childrenAttended` (existeix precisament per a això, i la funció mai l'usa). Resultat: es resta xicalla que no va assistir → adults infracomptats. Afecta la columna «Adults» de la llista, l'stat card i la fila «Adults» del detall (`event-detail.component.ts:121-125,431`). Correcció: `isPast ? attended - childrenAttended : confirmed - children`.

### 🟠 Mitjanes (events/segments/config)

- **EV2** `attendance-confirmation.component.ts:103-105` — el botó «Tanca» (i Escape) fa `navigate(['..'])`, que resol a `/events` — ruta inexistent → wildcard → `/home`. Cal `['/events', this.eventId]`.
- **EV3** `segment-manager.component.ts:289-316` — afegir múltiples figures amb `forkJoin` de POSTs paral·lels: el backend calcula `MAX(sortOrder)+1` sense transacció → `sortOrder` duplicats; i si una petició falla, `forkJoin` descarta les que sí han creat → UI desincronitzada, reintent = duplicats. `concatMap` (o endpoint batch) + `loadSegments()` a l'error.

### 🟡 Baixes (events/segments/config)

- **EV4** `segment-manager.component.ts:449-471` — al camí sense confirmació, si el PATCH de mode falla el `<select>` natiu queda mostrant un mode no desat (el binding `[value]` no canvia → Angular no reescriu el DOM). Aplicar el mateix patró optimista+revert del camí amb confirmació.
- **EV5** `season-form-modal.component.ts:78-82` i `tag-form-modal.component.ts:161-167` — `raw.description || undefined` en el payload d'update: buidar un camp opcional no l'esborra mai (el PATCH omet la clau). Enviar `null`/`''` en mode edició.
- **EV6** `tag-form-modal.component.ts:48` — restes del nom antic: input `position`, `this.position()`, tipus `PositionTypeGroup` — cosmètic però confús després del rename.
- **EV7** Codi mort del refactor: `isComposition()` i `ICON_COMPOSITION` (`segment-manager.component.ts:381,58`), `getDeclinedCount`/`formatAttendance` (`event-list.component.ts:371-388`), signal `total` no usat (`attendance-confirmation.component.ts:40,78`), fila «Baixes tardanes» impossible de mostrar (`event-detail.component.ts:455-460`, el backend fixa `lateCancel: 0`).

### 🔵 Suggeriments (events/segments/config)

- **EV8** `event-form-modal.component.ts` (`preselectCurrentSeason`) — `GET /seasons/current` retorna 404 documentat sense temporada vigent i el subscribe no té callback d'error: excepció no capturada a cada obertura del modal. `error: () => {}`.
- **EV9** `segment-manager.component.ts:94-104` — `computed` que retornen funcions (`segmentTotalAssigned`, `displayName`) no memoritzen res; millor mètodes normals.

---

## 6. Dashboard — canvas d'assignació i person-panel

Base raonable (signals coherents, optimistic updates, undo/redo funcional, tests ampliats). Problemes sistèmics: higiene de dependències dels effects i duplicació de camins d'escriptura.

### 🔴 DB-AC1 — Preset «El·lipse» sempre rebutjat per l'API

`assignment-canvas.component.ts:113` + `libs/shared/src/constants/node-preset.constants.ts:52,58` + `create-ad-hoc-node.dto.ts:43-50` — el desplegable de decoració inclou el preset `ellipse`, però `DECORATION_POSITION_TYPES` del DTO és `['rectangle','arrow','circle']` (amb comentari explícit que exclou `ellipse`). Triar «El·lipse» i fer clic al canvas dona sempre 400. Filtrar el preset del picker o afegir `ellipse` a la whitelist.

### 🔴 DB-AC2 — Effect del person-panel sobre-rastrejat: el filtre «Xicalla» es reverteix sol

`person-panel.component.ts:251-265` — l'effect de `selectedNodeId()` crida `onXicallaChange(...)` → `loadPersons()` dins del context de tracking: `showXicalla`, `height`, `heightSortMode`, `heightMode` i `selectedPositionId` esdevenen dependències. Verificat: (a) amb node seleccionat, marcar «Xicalla» a mà re-executa l'effect i **reverteix el filtre** (amb HTTP redundant); (b) canviar Abs/Rel o el filtre d'etiqueta roba el focus cap al cercador. El cos hauria d'anar dins `untracked()` excepte `selectedNodeId`/`selectedNodeZone`.

### 🟠 Mitjanes (assignació)

- **AC3** `assignment-canvas.component.ts:1129` (via `applyCordons`:1365) — després de `PATCH /cordons` (que **no** fa snapshot al backend), `refreshInstanceNodes` marca `snapshotted: true` incondicionalment: apareixen botons que fallarien amb 400 i, pitjor, a la primera assignació real es salta el remapatge `FigureNode`→`InstanceNode` → la persona assignada no es mostra col·locada.
- **AC4** `assignment-operations.service.ts` i `assignment-tab.service.ts` — serveis **morts** (cap injecció fora dels propis specs; tota la lògica viu duplicada al component) que a més han divergit (sense `hasPinya`/`figureMode`, `isNodeVisibleByCordons` sense `cordo-obert`) i s'han continuat modificant en aquesta branca. Eliminar-los o migrar-hi el component.
- **AC5** `ad-hoc-node-properties.component.ts:135-178` + `assignment-canvas.component.ts:1869-1907` — cada canvi de propietat d'un node ad-hoc envia el PATCH **dues vegades** (fill debounced + pare immediat); amb inputs numèrics el pare patcheja per pulsació de tecla (debounce inútil), 2 GETs extra per èxit, dos toasts per error, i la pila d'undo s'omple d'entrades per tecla. Un únic propietari de l'escriptura (idealment el pare, que gestiona l'undo).
- **AC6** `assignment-canvas.component.ts:1041-1261` — rollback optimista restaurant el **snapshot complet** d'`assignments`: si l'operació A falla després que la B hagi tingut èxit (flux encadenat que el propi component fomenta), el `set(snapshot)` esborra localment la B tot i existir al servidor. Treure només l'entrada afectada.
- **AC7** `person-panel.component.ts:305-331` — `loadPersons` sense cancel·lació (`switchMap`): el filtre d'alçada es dispara per tecla; una resposta antiga que resol tard deixa la llista amb el filtre obsolet.

### 🟡 Baixes (assignació)

- **AC8** `assignment-canvas.component.ts:1329-1339` — `confirmCordonsReduction` amb `forkJoin`: fallada parcial → toast i prou; les desassignacions completades al servidor no es reflecteixen. Refrescar estat també a la branca d'error.
- **AC9** `figure-canvas.component.ts:329-337` — el cursor `crosshair` del mode col·locació no es restaura en cancel·lar (l'effect no té branca else).
- **AC10** `assignment-canvas.component.html:414` — panell col·lapsable vestigial: cap control canvia `panelCollapsed`, icones `PanelLeft`/`PanelLeftClose` importades i mai usades.

### 🔵 Suggeriments (assignació)

- **AC11** `assignment-canvas.component.ts:650-657` — `@HostListener('document:mousemove')` permanent per al drag del panell flotant (CD a cada moviment de ratolí); registrar-los dinàmicament al drag start com ja fa el rotation handle.

---

## 7. Dashboard — projecció, plantilles i components compartits

Àrea notablement bona: layout de projecció ben documentat amb cerca binària sòlida, neteja de listeners correcta (`ResizeObserver`, timers i fullscreen es netegen a `ngOnDestroy`). Troballes majoritàriament de polit.

### 🟠 Mitjanes (projecció/shared)

- **PR1** `projection-layout.util.ts:401,432-433` — tres `console.log` de depuració dins `computeProjectionLayout`, cridada des d'un `computed` que es recalcula amb cada `ResizeObserver`: consola inundada a producció. Eliminar abans del merge.
- **PR2** `template-editor.component.ts:515` — la drecera de refer (Cmd/Ctrl+Shift+Z) és codi mort: amb Shift premut el navegador emet `event.key === 'Z'` (majúscula) i la comparació amb `'z'` mai passa. La línia 501 ja fa `toLowerCase()` correctament.
- **PR3** `data-table.component.html:83,3` — s'afegeix `table-zebra` i alhora es treu `bg-base-100` de la primera cel·la sticky del cos: a les files senars la columna fixada queda transparent i el contingut es veu per sota en scroll horitzontal.
- **PR4** `data-table.component.ts:137-140` — el menú d'accions `position: fixed` es tanca amb `window:scroll`, però l'app fa scroll dins d'un contenidor `overflow-y-auto` intern els esdeveniments del qual no bombollegen a `window`: el menú queda flotant desancorat. Escoltar amb `capture` a `document` o al contenidor real.
- **PR5** `projection-view.component.ts:494-500` — `handleEscape()` no comprova `document.fullscreenElement`: sortir del fullscreen del navegador amb Esc també executa `goBack()` i expulsa l'usuari de la projecció. Return early si hi ha fullscreen actiu.

### 🟡 Baixes (projecció/shared)

- **PR6** `tronc-view.component.ts:518-530` — `gridTemplateColumns()` sempre afegeix la columna de 2.5rem del botó d'afegir node, que només existeix en mode editor: en `assignment`/`projection` cada pis arrossega una columna morta de 40px que descentra els nodes i que `computeTroncNaturalSize` no compta.
- **PR7** `projection-layout.util.ts:152-157,268-281` — `rowScale()` no té en compte el floor de `minWidth` de les figures amb pinya: en pantalles estretes amb figures de tronc ample la suma pot excedir `screenW` i la darrera cel·la degenera a 1px.
- **PR8** `data-table.component.html:146` — el menú d'accions resol l'element per índex al clic: si `items()` es refresca amb el menú obert, l'acció pot aplicar-se a la fila equivocada. Desar la referència de l'element en obrir.
- **PR9** `projection.model.ts:12` — `projectionAngle: number` però l'API retorna `number | null`; el codi se salva pels `?? 0` però el tipus menteix.

### 🔵 Suggeriments (projecció/shared)

- **PR10** `tronc-size.util.ts:5-7` — comentaris que contradiuen les constants (48px/32px vs 32/40), i dues calibracions manuals paral·leles del mateix SCSS (amb `projection-layout.util.ts:7-17`) que ja han derivat. Centralitzar en un mòdul compartit.

*Verificacions netes:* cap referència penjada a `floating-panel-drag.directive` ni `figure-projection`; contracte `GET /segments/:id/projection` quadra camp a camp (tret de PR9); icones lucide noves existeixen i estan registrades; `emoji-picker` neteja estat i la dependència és a `package.json`.
