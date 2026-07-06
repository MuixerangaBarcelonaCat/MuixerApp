# Revisió Tècnica Completa — MuixerApp

> **Data:** 2026-06-18
> **Branca:** `feat/pwa-app-start`
> **Abast:** `apps/api` (NestJS, ~21k LOC), `apps/dashboard` (Angular 21, ~26k LOC), `apps/pwa` (Angular PWA, ~2.4k LOC), `libs/shared`, infra/CI/Docker/docs.
> **Tipus:** Anàlisi de només lectura. Cap fitxer existent ha estat modificat. Aquest document és l'informe.
> **Mètode:** 4 anàlisis paral·leles (backend, dashboard, pwa+shared, infra/tooling). Les referències són `fitxer:línia`.

---

## 0. Resum executiu

El projecte és, en general, **disciplinat i ben estructurat**. El dashboard segueix les convencions Angular gairebé al 100% (standalone + OnPush + signals, zero `@Input/@Output`, zero Material, tots els `@for` amb `track`). El backend té bona cobertura d'autorització i no s'ha trobat SQL injection. La infraestructura Docker de l'API és sòlida (multi-stage, non-root, healthchecks). No hi ha secrets compromesos al repositori.

Els problemes **greus** es concentren en àrees concretes:

| # | Tema | Severitat | Àrea |
|---|------|-----------|------|
| 1 | Secrets JWT amb fallback hardcoded (`'change-me'`) | 🔴 CRÍTICA | api |
| 2 | Backdoor `setup/user` pot crear ADMIN, comparació no constant-time | 🔴 CRÍTICA | api |
| 3 | Race condition al snapshot+assignació de figures (no atòmic) | 🔴 CRÍTICA | api |
| 4 | 25 vulnerabilitats de dependències (axios, xlsx, multer...) | 🔴 CRÍTICA | deps |
| 5 | Drift de registre de migracions (4 de 12 no s'apliquen en dev) | 🟠 ALTA | api |
| 6 | Bug latent `att_respondedAt` (Postgres minúscules → sempre null) | 🔴 CRÍTICA | pwa/api |
| 7 | La PWA NO és una PWA (cap service worker, cap offline) | 🔴 CRÍTICA | pwa |
| 8 | PWA exclosa completament del CI (14 specs sense verificar) | 🟠 ALTA | ci |
| 9 | Fuga de subscripció `route.paramMap` a person-detail | 🔴 CRÍTICA | dashboard |
| 10 | Refactor orfe a assignment-canvas (codi mort + god component) | 🔴 CRÍTICA | dashboard |

---

## 1. Backend — NestJS API (`apps/api/src`, `libs/shared`)

> Autorització generalment correcta (tots els controllers tenen `@Roles`, `grant-role` només ADMIN, `/me` deriva la identitat del JWT). Cap SQL injection (tots els `ORDER BY` passen per whitelist amb `@IsIn`).

### Seguretat

**🔴 CRÍTICA**
- **Secrets JWT amb fallback hardcoded.** Si les env vars no estan, s'usa un valor predictible en comptes de fallar a l'arrencada → falsificació de tokens.
  - `auth/strategies/jwt.strategy.ts:25` — `process.env['JWT_SECRET'] ?? 'change-me'`
  - `auth/auth.module.ts:20` — mateix fallback (secret en dos llocs que han de coincidir)
  - `auth/token.service.ts:57` — `process.env['JWT_REFRESH_SECRET'] ?? 'change-me-refresh'`
  - **Fix:** llançar error a l'arrencada si no estan definides.
- **Backdoor `setup/user`.** `auth.controller.ts:160-173` és `@Public()`, protegit només per un `SETUP_TOKEN` estàtic comparat amb `!==` (no constant-time, `:173`). Pot crear un ADMIN directament (`setup-user.dto.ts:15-18`, `auth.service.ts:170`) i si l'email ja existeix retorna el perfil/rol existent. No hi ha guarda "només si hi ha zero usuaris". Si `SETUP_TOKEN` queda definit en qualsevol entorn → creació remota de comptes privilegiats.

**🟠 ALTA**
- **Rol/estat actiu del JWT confiat durant tota la vida del token** (`jwt.strategy.ts:30`, `roles.guard.ts:24-30`). Una degradació de rol o `isActive=false` no té efecte fins que el token caduca (fins a 15 min).
- **Algorisme JWT no fixat** (`jwt.strategy.ts:15` no posa `algorithms: ['HS256']`).
- **Auth SSE de sync qüestionable** (`sync.controller.ts:27-69`): `EventSource` no pot enviar header `Authorization`; o està trencat o usa el token per query-param (`jwt.strategy.ts:18-22`), que filtra tokens als logs de proxy.
- **Secrets/PII als logs**: token d'invitació en clar (`user.service.ts:167`), cookie de sessió legacy (`legacy-api.client.ts:94,105`), emails/noms de membres (`person-sync.strategy.ts:259,299,315-322,336`).

**🟡 MEDIA**
- Cookie `secure` només en producció (`auth.controller.ts:48-54`) → refresh cookie per HTTP pla en pre/staging.
- Timing oracle d'enumeració d'usuaris al login (`auth.service.ts:34-42`): bcrypt només per usuaris coneguts. Afegir bcrypt fals al camí not-found.
- Tokens d'invitació en clar a la BD (`auth.service.ts:123`, `user.service.ts:156`), a diferència dels refresh tokens (SHA-256). Hashejar-los.
- Rejecció no gestionada al flux d'invitació (`user.service.ts:160-162`): `throw` dins d'un `.catch()` despès del commit → usuari amb token mai entregat.
- `stripHtml` naïf amb regex (`legacy-api.client.ts:322-332`) → risc XSS emmagatzemat si es renderitza com HTML.

> ✅ La rotació de refresh tokens està **ben implementada** (rotació + detecció de reús + revocació de família + hash SHA-256, `token.service.ts:82-105`). bcrypt rounds=12. Rate limiting present (10/min).

### Correctesa

**🔴 CRÍTICA**
- **Race condition de doble snapshot / snapshot+assignació no atòmic.** `node-assignment.service.ts:341-379` llegeix la instància sense lock, comprova `snapshotted`, després `snapshotInstance()` corre en transacció pròpia (`:1223-1257`), i l'insert de l'assignació (`:440`) és **fora** de tota transacció. Dues primeres-assignacions concurrents veuen `snapshotted=false` → dos jocs complets de `InstanceNode`. **No hi ha unique constraint** a `(figureInstance, sourceNodeId)` (`instance-node.entity.ts:19-21`) ni `SELECT FOR UPDATE`. Si l'insert falla després del commit del snapshot → instància `snapshotted=true` amb zero assignacions (estat parcial permanent).
  - **Fix:** envoltar snapshot + comprovació de conflicte + insert en una transacció amb row lock; afegir índex únic parcial.

**🟠 ALTA**
- **`lateCancel` sobreescrit a 0 pel camí `/me`.** `attendance.service.ts:168-190` (`recalculateSummary`) força `lateCancel = 0`, mentre el sync el calcula (`attendance-sync.strategy.ts:344-346`). Un membre que canvia la seva assistència via `/me` (`me.service.ts:171`) reseteja el valor sincronitzat → bug de dades.
- **`bulkImport` no transaccional + N+1** (`node-assignment.service.ts:832-889`): ~7 queries per persona, sense transacció → imports parcials. Errors empassats per `catch {}` (`:886,:965`).
- **`updateCordons` multi-escriptura sense transacció** (`node-assignment.service.ts:982-1021`).
- **`getEventAssignmentSummary` N+1** (`node-assignment.service.ts:721-731`): un `find` amb 5 relacions eager per segment.

**🟡 MEDIA**
- Snapshot llegeix nodes de plantilla fora de la transacció del snapshot (`:1212-1221` vs `:1223`) → snapshot d'un conjunt de nodes obsolet possible.
- `saveFromInstance`, `create`, `update`, `duplicate` multi-escriptura sense transacció a `figure-template.service.ts` (`:336-368`, `:163-169`, `:533-579`).
- UUID feble via `Math.random()` (`figure-template.service.ts:420-426`) → usar `crypto.randomUUID()`.
- `me` event-detail no scoped per temporada (`me.service.ts:96-126`): un membre pot llegir metadades de qualsevol event d'altres temporades.
- Persones soft-deleted accessibles: `findOne/update/deactivate` no filtren `isActive` (`person.service.ts:131,215,327`); `me.resolvePersonId` (`:180-186`) resol membres desactivats que poden escriure assistència.
- `ASSIGNMENT_LOCK_DAYS` sense validar (`node-assignment.service.ts:1031,1048`) → typo dóna `NaN` i desactiva silenciosament el bloqueig.

### Arquitectura / Deute tècnic

**🟠 ALTA**
- **Drift de registre de migracions (footgun operacional).** `database.module.ts:59-68` registra a mà només **8 de 12** migracions. Les 4 més noves (`SimplifyRengles`, `EnableFuzzySearch`, `DropCordonsColumns`, `AddNumberOfCordons`) NO estan a l'array → `migrationsRun: isDevelopment` no les aplica a l'arrencada. Només corren via CLI (`data-source.ts:13`). Les entitats que referencien `numberOfCordons` no coincidiran amb l'esquema en dev.
  - **Fix:** usar glob o mantenir les llistes sincronitzades.

**🟡 MEDIA**
- **`NodeAssignmentService` és un god service** (~1259 línies, ~17 mètodes públics). Descompondre (SnapshotService, AssignmentHistoryService, AdHocNodeService, LockService).
- Contracte fràgil `handleDbError` (`figure-template.service.ts:340,481`): tipat `never`, cridat com a statement i `return`-at de manera inconsistent → `saved!` non-null assertions.
- Lògica d'agregació d'assistència duplicada entre `attendance.service.ts` i `attendance-sync.strategy.ts` amb comportament divergent (el bug de `lateCancel`).
- Flag `isSyncing` en memòria (`person-sync.strategy.ts:44`) no evita syncs concurrents entre instàncies múltiples de l'API.

### Testing
- **Sense specs:** `event-segment/projection.service.ts`, `season/season.controller.ts`, `sync/sync.controller.ts`, `user/user.controller.ts`.
- Casos de risc no provats: cicle de vida del snapshot i concurrència (doble snapshot, escriptura parcial), fallades transaccionals a `figure-instance.service`/`projection.service`.
- El llindar del 70% es compleix però un god service pot arribar-hi deixant branques de race/error sense provar.

### Rendiment
**🟡 MEDIA**
- **Índexs FK que falten.** 11 entitats declaren `@ManyToOne` però només `instance_nodes` i `refresh_tokens` tenen `@Index` explícit. Postgres NO indexa FKs automàticament. Columnes FK a `attendance`, `event`, `node_assignment`, `figure_node`, `rengla`, `composition_slot`, `figure_instance`, `event_segment` fan seq-scan a mesura que creixen les dades.
- N+1 / over-fetch a `getEventAssignmentSummary` i als recàlculs de summary (carreguen totes les files amb relació `person` per comptar per estat → usar `GROUP BY status`).
- Sense timeout a l'axios client legacy (`legacy-api.client.ts:70-81`) amb `validateStatus: () => true` → un servidor penjat manté l'SSE obert indefinidament.

---

## 2. Frontend — Dashboard (`apps/dashboard/src`)

> **Veredicte:** Notablement disciplinat en convencions. Zero `@Input/@Output`, zero Material, zero `*ngFor`, tots els `@for` amb `track`, cap classe Tailwind amb template-literal, `untracked()` ben usat als effects de render imperatiu. Els problemes es concentren al **mòdul Pinyes**.

### Correctesa

**🔴 CRÍTICA**
- **Fuga de subscripció `route.paramMap`** — `persons/components/person-detail/person-detail.component.ts:121`. `this.route.paramMap.subscribe(...)` sense `takeUntilDestroyed`/teardown. És l'única fuga real d'observable (les altres ~70 `.subscribe()` són HTTP fire-and-forget que auto-completen).

**🟡 MEDIA**
- **Acoblament loading/error a `home.component.ts:45-86`.** `loading.set(false)` només viu a la subscripció de persons; les dues crides `eventService.getAll` (rehearsal/performance) no tenen handler d'`error` → fallada empassada en silenci, targetes en blanc sense UI d'error.
- `event-list.component.ts:260/297` i altres llistes subscriuen sense handler d'error en diversos punts → taula buida silenciosa en comptes d'estat d'error.

**🟢 BAIXA**
- Listeners inline dinàmics (`figure-canvas.component.ts:1563-1576`): `keydown`/`blur` afegits i l'element `removeChild`-at sense `removeEventListener`. No és fuga real però és fràgil.

> ✅ El teardown de Konva és correcte (`figure-canvas.component.ts:311-317`, `segment-canvas.component.ts:86-89`: `stage.destroy()`, `disconnect()`, timers nets). Els effects de render llegeixen signals al tracking scope i envolten efectes amb `untracked()` — sense risc de bucle infinit.

### Arquitectura / Deute tècnic

**🔴 CRÍTICA**
- **Extracció de servei orfe i duplicada al canvas d'assignació.** `assignment-canvas/services/assignment-operations.service.ts` (267 LOC) i `assignment-tab.service.ts` (214 LOC) existeixen, es referencien mútuament i usen `takeUntilDestroyed` correctament — però **cap dels dos està injectat ni usat** per `assignment-canvas.component.ts`. El component de 1780 línies reimplementa tota aquesta lògica inline (~74 `.subscribe()`: `:689,840,909,1013,1486,1558,1607`). És el problema més gros: un refactor a mitges deixant codi mort I un god component cobrint el mateix.

**🟠 ALTA**
- **God component `assignment-canvas.component.ts` (1780 LOC)** — 33 mètodes privats, 12 dependències. Hauria de delegar als serveis ja escrits.
- **God component `figure-canvas.component.ts` (1669 LOC)** — render Konva + interacció + edició d'etiquetes + zoom/pan en un fitxer.
- **Estat dividit a template-editor** — `template-editor.component.ts` (1056 LOC, ~95 mètodes) injecta `FigureTemplateService` + `CanvasStateService` i subscriu/desa ell mateix (`:911,986`), mentre `template-editor/services/template-editor-state.service.ts` (440 LOC) **també** carrega/desa la mateixa plantilla (`:112,364`). Dos camins per la mateixa entitat.

**🟡 MEDIA**
- **Diàlegs de confirmació fets a mà** en comptes de `app-confirm-dialog` (usat en **zero** templates): 7 templates fan `<dialog class="modal modal-open">` (`season-list`, `position-list`, `position-form-modal`, `season-form-modal`, `user-form-modal`, `projection-view`, `template-editor`). Markup duplicat i a11y inconsistent.
- **`<table>` cru** en comptes de `app-data-table` a `config/components/season-list.component.html:10` i `position-list`. Defensable on hi ha cel·les custom, però divergeix de la regla.

### Rendiment
- ✅ Tots els `@for` amb `track` per `.id` estable. `computed()` per estat derivat. Renders Konva canalitzats per effects amb `untracked` + `batchDraw()`.
- 🟡 Els cinc effects de render a `figure-canvas.component.ts:234-290` llegeixen conjunts de signals solapats (`nodes()`, `selectedNodeId()`, `mode()`). Un canvi de `mode()` pot disparar diversos effects en un tick. Consolidar per mode reduiria redraws.

### Convencions
- ✅ PASS: standalone + OnPush + signals; sense `@Input/@Output`; sense Material; sense `*ngFor`; sense Tailwind template-literal.
- 🟡 **`.scss`:** 8 fitxers. 6 amb animacions (legítim). Dos qüestionables: `template-list.component.scss` (5 línies, sense keyword d'animació) i **`tronc-view.component.scss` (575 línies!)** — comprovar que no porti layout que correspon a Tailwind.

### Accessibilitat & UX
- Base raonable: 35/44 templates usen `aria-*`/`role`; diàlegs amb `aria-modal`/`role="alertdialog"`.
- 🟡 Backdrop amb `tabindex="0" role="button"` en `<div>` (`season-list.component.html:124`). Consolidar amb `app-confirm-dialog` estandarditzaria el focus-trap/escape.
- 🟡 UX de fallada silenciosa per handlers d'error que falten.

### Testing
- 42 specs / ~120 fitxers. **Tota la llibreria de components compartits sense tests** (`data-table`, `pagination`, `filter-bar`, `page-header`, `empty-state`, `column-toggle`, `active-filters`, `toast`, `header`, `tab-nav`, `user-chip`, `person-search-input`) — són els primitius de cada llista.
- **Els fitxers més complexos sense test:** `figure-canvas.component.ts` (1669), `composition-editor.component.ts` (499), `segment-canvas.component.ts` (400), `person-detail.component.ts` (330).
- Els serveis orfes `assignment-operations`/`assignment-tab` tampoc tenen tests.

---

## 3. PWA (`apps/pwa/src`) & `libs/shared`

> **Estat real:** P6.0/P6.1 completes, i **P6.2 està en gran part implementada** tot i que el roadmap la marca "Dissenyant" (taula d'estat obsoleta).

### PWA Fundamentals — **Això encara NO és una PWA**

**🔴 CRÍTICA**
- **Cap service worker.** Sense `@angular/service-worker`, sense `provideServiceWorker(...)` a `app.config.ts`, sense `ngsw-config.json`, sense flag `serviceWorker` a `project.json`. **Zero capacitat offline, zero app-shell caching, zero flux d'actualització.** És una SPA Angular amb un manifest. (El roadmap difereix l'SW a P6.9, però es prova com a PWA als checklists P6.1/P6.2.)

**🟠 ALTA**
- **Google Fonts externs** (`index.html:11-13`): carrega Inter de `fonts.googleapis.com`/`gstatic.com`. Render-blocking, falla offline, possible violació de CSP estricta. Auto-allotjar.

**🟡 MEDIA**
- Sense prompt d'instal·lació / `beforeinstallprompt`, sense `apple-touch-icon` ni meta `apple-mobile-web-app-*` a `index.html`. Experiència iOS degradada.

**🟢 BAIXA** — Manifest mínim però vàlid (icones 192/512/maskable presents). Positius: rutes lazy, OnPush, `runOutsideAngular` al pull-to-refresh, budgets sensats.

### Alineació amb spec (P6.2)
**🟠 ALTA**
- **Assistència a events passats no desactivada a la UI.** Spec AC#13 / checklist #30. `AttendanceButtonComponent.disabled` defaulta a `false` (`attendance-button.component.ts:51`) i mai es passa des de `event-card.component.html:16` ni `event-detail.component.html:73`. El membre pot fer toggle en events passats; el backend ho rebutja amb 400 → la UI optimista fa flip i revert amb toast d'error (UX confusa).

**🟡 MEDIA**
- `findEventDetail` no scoped a la temporada actual (`me.service.ts:96-126`) — qualsevol membre pot llegir qualsevol event per UUID entre temporades. (Mateix tema reportat al backend.)
- Etiquetes d'assistència divergeixen de l'spec ("Vinc"/"No vinc" vs "Aniré"/"No aniré", `attendance-button.component.ts:16-18`).
- Ordre "Tots" no cronològicament intel·ligent (`me.service.ts:77-79` ordena tot per `date ASC`; spec vol upcoming-first-then-past).

**🟢 BAIXA** — Cicle de toggle difereix de l'spec (entra PENDENT); Home carrega 2 events per tipus (spec diu 1).

### Correctesa (codi nou)
**🔴 CRÍTICA (latent, emmascarat pels tests)**
- **`att_respondedAt` casing de l'àlies raw.** `me.service.ts:63` fa `.addSelect('att.respondedAt', 'att_respondedAt')` i llegeix `raw['att_respondedAt']` (`:211-212`). Postgres plega els identificadors no citats a minúscules → la clau real és `att_respondedat` → `raw['att_respondedAt']` és `undefined` → `respondedAt` sempre `null` en runtime. El test (`me.service.spec.ts:126-128,210`) mockeja amb la clau camelCase, així que **passa mentre la query real està trencada**. `att_id`/`att_status` no afectats (ja minúscules).
  - **Fix:** citar l'àlies o usar mapeig d'entitat; corregir el mock enganyós.

**🟡 MEDIA**
- Revert d'UI optimista depèn d'un `effect` que pot quedar obsolet (`AttendanceButtonComponent:71-75`): si el pare re-renderitza l'input amb una petició en vol, l'effect pot sobreescriure l'estat optimista.
- Subscripcions a `ngOnInit` sense teardown (`home.component.ts:48`, `event-list.component.ts:85`, `event-detail.component.ts:47`).
- `EventCardComponent` instancia el pipe a mà (`event-card.component.ts:14`: `new FormatEventDatePipe()`) en comptes d'usar-lo al template/DI.

**🟢 BAIXA** — `upsertAttendance` no transaccional (`me.service.ts:160-171`); gestió d'error de login genèrica (ja al roadmap).

### Reús de codi & consistència d'interfaces
- ✅ **Compartició backend↔frontend correcta.** `MeService`/`MeController` i la PWA `EventService` importen `MeEvent`, `MeEventDetail`, `AttendanceResponse` de `@muixer/shared` (`libs/shared/src/interfaces/me/`). Font única de veritat.
- 🟡 **Interfície compartida divergeix de l'spec.** `MeEvent` (`me-event.interface.ts:11-20`) afegeix `attendanceSummary` (no a l'spec, era camp futur P6.7) i mou `locationUrl` només a `MeEventDetail`. La llista envia comptes complets d'assistència a cada membre (exposició menor d'info). Decidir si és pull-forward intencional o s'ha de treure.
- 🟢 `MeEventFilters` redefinit al frontend (`event.service.ts:14-19`) en comptes de compartir-se amb `MeEventFilterDto`.

### Testing
- Specs presents per gairebé tot (backend `me.service.spec.ts` 401 línies, frontend event-list/card/attendance-button/detail/home/service/pipe).
- 🟠 **El test del backend emmascara el bug de `att_respondedAt`** (mock amb clau equivocada → falsa confiança). Sense test d'integració contra Postgres real.
- 🟡 Sense test del season-scoping de `findEventDetail` ni del disabling d'events passats (perquè les funcionalitats no existeixen).

---

## 4. Infra / Build / Tooling / Docs

### CI/CD (`.github/workflows/ci.yml`)
> Bons fonaments: job únic, cache Nx, `concurrency` cancel-in-progress, `nx affected` a PRs, `--configuration=ci` per coverage.

**🟠 ALTA**
- **PWA exclosa completament del CI.** Tots els passos usen `--exclude=dashboard-e2e,pwa-e2e,pwa` (`ci.yml:75,79,88,92`). 14 specs i feina activa de branca sense cap CI. (`ci:local` a package.json NO exclou `pwa` → local i CI divergeixen.)

**🟡 MEDIA**
- Cap e2e al CI (`dashboard-e2e`/`pwa-e2e` mai corren, tot i tenir Playwright).
- Cap escaneig de seguretat (sense `pnpm audit`, Dependabot, CodeQL, secret-scanning).

**🟢 BAIXA** — Clau de cache amb `${{ github.sha }}` (poc reús); sense build matrix.

### Dependències
> Alineació de stack **bona**: Angular ~21.2, Nx ^22.6.3, NestJS ^11.1, TS ~5.9, Node 22.

**🔴 CRÍTICA/ALTA**
- **25 vulnerabilitats conegudes** (`pnpm audit --prod`: 1 low, 9 moderate, 15 high; arbre complet inclou un **`shell-quote` crític**):
  - **`axios@1.15.2`** — múltiples HIGH (proxy-auth leak, MITM, ReDoS, prototype pollution). **Fixable ja:** bump a `>=1.18.0` (package.json:117 fixa `^1.6.0`).
  - **`xlsx@0.18.5`** (package.json:135) — HIGH prototype-pollution + ReDoS, **sense fix a npm**. Usat al servidor a `sync/legacy-api.client.ts:3` per parsejar XLSX remot. Migrar a `exceljs` o pinejar el build CDN de SheetJS.
  - **`multer`** (transitiu via `@nestjs/platform-express`) — DoS moderate/high; bump platform-express.
  - `@angular/core` & `@angular/common` HIGH — fixats en patches 21.2.x posteriors.
  - `shell-quote` (crític), `form-data`, `tmp`, `picomatch`, `fast-uri`, `ws`, `vite` — dev/transitius, menor urgència.

**🟡 MEDIA** — `lucide-angular@1.0.0` DEPRECAT (package.json:124).
**🟢 BAIXA** — Lags menors de patch; `pnpm.overrides` fixa `@noble/hashes` 2.2.0 sense documentar.

### Docker & Deploy
> L'**API Dockerfile està molt ben fet**: 4-stage, non-root (uid 1001), `node:22-alpine` pinejat, HEALTHCHECK, migracions a l'entrypoint.

**🟡 MEDIA**
- `postgres:16-alpine` no digest-pinejat (3 compose files) i `caddy:alpine` tag flotant (dashboard/pwa Dockerfiles) → builds no reproduïbles.
- `.env.pre` exposa Postgres a `5432:5432` (`docker-compose.pre.yml:7`). Prod correctament no publica port de postgres. Restringir a `127.0.0.1`.
- Imatges dashboard/pwa corren Caddy com a root (asimetria amb l'API).
- Stage `prod-deps` reinstal·la amb `--no-lockfile` + `pnpm add pg tslib bcrypt typeorm dotenv --no-lockfile` (`apps/api/Dockerfile`) → resol versions sense pinejar al build, anul·la la reproductibilitat per als deps natius més sensibles.

**🟢 BAIXA** — Secrets via `env_file` (no committats). Healthchecks a tots els serveis amb `depends_on: service_healthy`.

### Nx / Build config
- ✅ `nx.json` amb `namedInputs`, cache, `^build` dependsOn. `tsconfig.base.json` `strict: true`.
- 🟢 `eslint.config.mjs:18-25,40` té `depConstraints`/rules buits → els `tags` de project.json (`scope:pwa`...) no s'apliquen. Scaffold sense efecte.
- 🟢 `tsconfig.base.json` només mapeja `@app/*` a dashboard; cap alias per pwa. `nx.json` referencia `.eslintrc.json` inexistent (glob obsolet, inofensiu).

### Repo Hygiene
- ✅ **Cap secret committat** (`git ls-files | grep .env` → només `.example`). `.env`, `.env.pre` gitignorats. `dist/`, `coverage/`, `tmp/` gitignorats. `.dockerignore` complet.
- 🟢 Entrada duplicada `scripts/tunnel-pre.sh` a `.gitignore`.

### Documentació
**🟡 MEDIA**
- `CONCERNS.md` obsolet (datat 23-24/04/2026, ~2 mesos). No menciona els 25 CVEs ni la PWA exclosa del CI.
- **`DB_SYNC` doc enganyós:** `.env.pre.example` documenta `DB_SYNC=true` per sync d'esquema, però `database.module.ts:57` fixa `synchronize: false` sense llegir `DB_SYNC`. El flag és un no-op.
- `PWA_ROADMAP.md` desactualitzat (P6.2 implementat, no "Dissenyant").

---

## 5. Pla d'acció prioritzat (consolidat)

### 🔴 Fase 1 — Crítics de seguretat i correctesa (fer ja)
1. **Eliminar fallbacks de secrets JWT** i fallar a l'arrencada si no estan definits (`jwt.strategy.ts:25`, `auth.module.ts:20`, `token.service.ts:57`).
2. **Blindar `setup/user`**: guarda "zero usuaris", prohibir crear ADMIN, comparació constant-time, documentar retirada de `SETUP_TOKEN` (`auth.controller.ts:160-173`).
3. **Fer atòmica la primera assignació**: transacció + `SELECT FOR UPDATE` + índex únic a `instance_nodes(figureInstance, sourceNodeId)` (`node-assignment.service.ts:341-440`).
4. **Bump `axios` a `>=1.18.0`** i remeiar `xlsx`/`multer`; afegir `pnpm audit` al CI.
5. **Corregir `att_respondedAt`** (Postgres minúscules → sempre null) i el mock enganyós (`me.service.ts:63,211-212`, `me.service.spec.ts:126`).
6. **Corregir la fuga `route.paramMap`** amb `takeUntilDestroyed` (`person-detail.component.ts:121`).

### 🟠 Fase 2 — Deute alt i correctesa de dades
7. **Arreglar el drift de migracions** (`database.module.ts:59-68` → glob).
8. **Corregir `lateCancel`** i deduplicar la lògica de summary entre `attendance.service.ts` i `attendance-sync.strategy.ts`.
9. **Re-validar rol/estat actiu contra la BD** (o TTL més curt + revocació) (`jwt.strategy.ts:30`).
10. **Afegir transaccions** a `bulkImport`, `updateCordons`, i `figure-template` create/update/save; deixar de fer `catch {}`.
11. **Resoldre el refactor orfe** d'assignment-canvas: cablejar o eliminar `assignment-operations.service.ts`/`assignment-tab.service.ts`.
12. **Afegir la PWA al CI** (treure `pwa` dels `--exclude` a `ci.yml`).
13. **Decidir l'estratègia PWA**: afegir service worker + `ngsw-config.json` o deixar de dir-li PWA fins P6.9.
14. **Cablejar `disabled`** a `AttendanceButton` per events passats (spec AC#13).

### 🟡 Fase 3 — Rendiment, arquitectura, testing
15. **Índexs FK** a totes les columnes `@ManyToOne`; reemplaçar summary "load-all-then-count" per `GROUP BY`; timeout a l'axios legacy.
16. **Descompondre god components**: `NodeAssignmentService`, `assignment-canvas`, `figure-canvas`, unificar estat de `template-editor`.
17. **Scope per temporada** a `findEventDetail` (api i pwa) + test.
18. **Tests** per: concurrència del snapshot, reús de refresh token, `setup/user`, season-scoping `/me`, llibreria de components compartits del dashboard, controllers sense spec.
19. **Auto-allotjar Inter** (treure Google Fonts de la PWA `index.html`).
20. **Substituir diàlegs fets a mà** per `app-confirm-dialog`; auditar `tronc-view.component.scss` (575 línies).

### 🟢 Fase 4 — Hygiene i polish
21. Pinejar imatges Docker (postgres/caddy); restringir port Postgres del pre; arreglar reproductibilitat de `prod-deps`.
22. Substituir `lucide-angular` deprecat; hashejar tokens d'invitació; deixar de loggejar PII.
23. Refrescar docs: `CONCERNS.md`, `PWA_ROADMAP.md`, mismatch `DB_SYNC`; aplicar `depConstraints` d'ESLint o documentar que són oberts.
24. Reconciliar etiquetes/cicle d'assistència PWA amb l'spec; meta tags iOS.

---

## 6. Punts forts a preservar
- Disciplina de convencions al dashboard (signals, OnPush, standalone, track).
- Rotació de refresh tokens ben implementada amb detecció de reús.
- Cobertura d'autorització completa als controllers.
- API Dockerfile multi-stage segur (non-root, healthcheck).
- Compartició d'interfaces `@muixer/shared` entre backend i frontend.
- Cap secret al repositori; `.gitignore`/`.dockerignore` complets.
- Documentació extensa (tot i necessitar actualització).

---

*Informe generat per anàlisi automatitzada de només lectura. Cada troballa inclou referència `fitxer:línia` per verificació manual abans d'actuar.*
