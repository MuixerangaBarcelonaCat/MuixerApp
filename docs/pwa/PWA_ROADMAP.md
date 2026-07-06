# PWA MuixerApp — Roadmap

> Roadmap específic per al desenvolupament de la PWA mòbil (P6).
> Per a la visió general del projecte, vegeu [PROJECT_ROADMAP.md](../PROJECT_ROADMAP.md).
>
> **Convencions:** Cada fase és un lliurable independent i testable.
> Les fases es poden abordar seqüencialment o en paral·lel (backend + frontend).

---

## Estat General

| Fase | Nom | Backend | Frontend | Estat | Spec/Notes |
|------|-----|---------|----------|-------|------------|
| P6.0 | Infraestructura i App Shell | Config CORS/port | Scaffold, shell, tabs | ✅ Completat | Branca: `feat/pwa-app-start` |
| P6.1 | Auth (bàsic) | Fix clientType refresh | Login, guards, interceptor | ✅ Completat | Branca: `feat/pwa-app-start` |
| P6.2 | Events i Assistència | `MeModule` + endpoints | Llista events, Home, attendance | ✅ Completat | [Spec](specs/P6.2-events-attendance-spec.md) |
| P6.3 | Home Refactor | — | Home: 1 card/tipus, avatar, pull-to-refresh | ✅ Completat | [Spec](specs/P6.3-home-spec.md) |
| P6.3.1 | Calendar View | — | Vista calendari mensual a Events tab | 🔵 En curs | [Spec](specs/P6.4-calendar-spec.md) |
| P6.4 | Gestió Familiar | `PersonGuardian` entity | Person selector, attendance gestionada | ⚪ Pendent | — |
| P6.5 | Canvas Pinyes | Relaxar endpoint projecció | Konva readonly, touch, highlight | ⚪ Pendent | — |
| P6.6 | Perfil i Configuració | Endpoint estadístiques | Perfil, logout, stats | ⚪ Pendent | — |
| P6.7 | Funcionalitats TECHNICAL | Enrichment respostes per rol | Llista assistents, gestió | ⚪ Pendent | — |
| P6.8 | Magic-Link Auth | `MagicLinkToken` entity + endpoints | Landing page + Dashboard UI | ⚪ Pendent | — |
| P6.9 | Notificacions Push | FCM tokens, notification service | Registre dispositiu, preferències | ⚪ Pendent | — |

**Llegenda:** ⚪ Pendent | 🟡 Dissenyant | 🔵 En curs | ✅ Completat

---

## Detall per Fase

### P6.0 — Infraestructura i App Shell

**Objectiu:** PWA operativa amb navegació bàsica, sense funcionalitat de negoci.

**Backend:**
- Afegir PWA origin a `CORS_ORIGINS` (`.env`, `.env.pre`)
- Verificar que `clientType: PWA` funciona al login existent

**Frontend:**
- Port 4300 a `project.json` (serve + serve-static)
- `proxy.conf.json` → `localhost:3000/api`
- `environment.ts` + `environment.pre.ts` amb `apiUrl`
- `index.html`: `lang="ca"`, `data-theme="colla-barcelona"`, viewport meta, manifest link
- `manifest.webmanifest` bàsic (nom, icones placeholder, theme color)
- `app.config.ts`: `provideHttpClient(withInterceptors([...]))`, `provideRouter(appRoutes)`
- `AppShellComponent` amb bottom tab bar (3 tabs: Inici, Events, Perfil)
- Placeholder components per cada tab (empty state)
- Shared components bàsics: `BottomTabBarComponent`, `MobileHeaderComponent`
- Docker: `Dockerfile` multi-stage per a la PWA
- `docker-compose.pre.yml`: afegir servei `pwa`
- Caddy/nginx: ruta per servir la PWA des del servidor PRE

**Lliurable:** L'app carrega al mòbil amb tabs navegables (contingut placeholder).

**Esforç estimat:** S (2-3 dies)

---

### P6.1 — Auth (Bàsic)

**Objectiu:** Membres poden fer login amb email/contrasenya.

**Frontend:**
- `AuthService` (adaptat de Dashboard): signals, silent refresh, `clientType: PWA`
- `authInterceptor`: Bearer header, 401 → refresh → retry
- `authGuard`: protegeix rutes autenticades
- `LoginComponent`: formulari email + contrasenya, mobile-optimized
- Redirect a `/home` post-login
- Auto-redirect si ja autenticat

**Backend:** Cap canvi necessari (endpoints existents suporten PWA).

**Lliurable:** Un membre pot fer login i veure la Home (buida).

**Esforç estimat:** S (2-3 dies)

---

### P6.2 — Events i Assistència

**Objectiu:** Membres veuen els seus events i confirmen assistència.

**Backend:**
- `MeModule` amb `MeController` i `MeService`
- `GET /me/events` — events de la temporada actual amb assistència pròpia
- `PUT /me/events/:id/attendance` — confirmar/cancel·lar assistència (només PENDENT/ANIRE/NO_VAIG)
- `GET /me/events/:id` — detall bàsic de l'event
- DTOs: `MeEventFilterDto`, `UpdateMyAttendanceDto`
- Tests unitaris per `MeService`

**Frontend:**
- `EventService` consumint `/me/events`
- `HomeComponent`: cards pròxim assaig + pròxima actuació amb botó d'assistència
- `EventListComponent`: llista de cards amb filtre (Tots/Assajos/Actuacions)
- `EventCardComponent`: diferenciació visual assaig vs actuació
- `AttendanceButtonComponent`: toggle vinc/no vinc amb feedback optimista
- Pull-to-refresh a la llista
- Loading skeletons durant càrrega
- Tests unitaris per components i serveis

**Lliurable:** Un membre pot veure events, confirmar assistència des de Home o llista.

**Esforç estimat:** M (1-2 setmanes)

---

### P6.3 — Detall d'Event

**Objectiu:** Membres veuen informació completa d'un event amb segments i figures.

**Backend:**
- Afegir segments visibles a la resposta de `GET /me/events/:id`
- Incloure info d'assignació del membre per cada figura
- Filtre `isVisible: true` per a MEMBER

**Frontend:**
- `EventDetailComponent` amb info bàsica, botó d'assistència, mapa
- `SegmentAccordionComponent`: segments expandibles amb llista de figures
- Indicador "Ets a aquesta pinya" amb zona i posició
- Link a canvas per cada figura (navegable a P6.5)
- Tests unitaris

**Lliurable:** Un membre obre un event i veu en quines figures va assignat.

**Esforç estimat:** S-M (3-5 dies)

---

### P6.4 — Gestió Familiar

**Objectiu:** Un membre pot gestionar l'assistència de les persones que té al seu càrrec.

**Backend:**
- Entitat `PersonGuardian` + migració
- Enum `GuardianRelationship` a `@muixer/shared`
- `GET /me/managed-persons`
- Validació a `PUT /me/events/:id/attendance` amb `personId`
- `PersonGuardianService` + tests

**Frontend (PWA):**
- `PersonSelectorComponent`: selector radio-style (Jo + persones gestionades)
- Integrar selector a: Home cards, Event list cards, Event detail
- Canvi de persona recarrega estat d'assistència

**Frontend (Dashboard):**
- Secció "Persones gestionades" a la fitxa de persona
- Afegir/eliminar relacions de guardianship

**Lliurable:** Un pare/mare pot confirmar l'assistència dels seus fills des de la PWA.

**Esforç estimat:** M (1-2 setmanes)

---

### P6.5 — Canvas Pinyes (Readonly)

**Objectiu:** Membres veuen les pinyes assignades al mòbil amb la seva posició destacada.

**Backend:**
- Relaxar `@Roles()` de l'endpoint de projecció per incloure MEMBER
- Guard: MEMBER pot accedir només si segment `isVisible: true`

**Frontend:**
- `FigureViewerComponent` amb Konva en mode readonly
- Touch: pinch-zoom + pan (Konva natiu)
- Auto-fit al viewport
- Highlight pròpia posició: animació pulsant + color primary
- Persones sense entrada (assaig): vora taronja
- Toggle tronc (si la figura en té)
- Navegació entre figures del segment
- Tests unitaris (renderitzat, highlight)

**Lliurable:** Un membre veu la seva posició a la pinya al mòbil.

**Esforç estimat:** M (1-2 setmanes)

---

### P6.6 — Perfil i Configuració

**Objectiu:** Membres veuen les seves estadístiques i gestionen la sessió.

**Backend:**
- `GET /me/profile/stats` — taxa d'assistència, events assistits/totals

**Frontend:**
- `ProfileComponent`: info personal, stats, settings
- Estadístiques: percentatge d'assistència, events de la temporada
- Logout: neteja tokens → redirect a login
- Preferències de notificacions (preparació per P6.9, toggles guardats localment)
- Versió de l'app

**Lliurable:** Un membre veu les seves estadístiques i pot tancar sessió.

**Esforç estimat:** S (2-3 dies)

---

### P6.7 — Funcionalitats TECHNICAL a la PWA

**Objectiu:** Els tècnics tenen accés a informació i accions addicionals des del mòbil.

**Backend:**
- Enrichment de respostes a `/me/events`: `attendanceSummary`, `attendees[]` per a TECHNICAL/ADMIN
- Endpoint per gestionar assistència d'altres: validar rol TECHNICAL

**Frontend:**
- `rolesGuard` per amagar/mostrar seccions segons rol
- Event detail: secció "Assistents" (llista expandible amb status)
- Event list: badge amb recompte d'assistents confirmats
- Opció de gestionar assistència d'altres membres (selector de persona + status)

**Lliurable:** Un tècnic veu la llista d'assistents i pot gestionar assistències des del mòbil.

**Esforç estimat:** S-M (3-5 dies)

---

### P6.8 — Magic-Link Auth

**Objectiu:** Admins poden generar enllaços d'accés temporals i d'un sol ús per als membres.

**Backend:**
- Entitat `MagicLinkToken` + migració (camps: `id`, `userId`, `tokenHash`, `expiresAt`, `consumedAt`, `createdAt`, `lastUsedAt`, `revokedAt`, `createdByUserId`)
- Config: `MAGIC_LINK_TTL_HOURS` env var (default 72h)
- `POST /api/users/:id/magic-link` — generar (upsert, sets `expiresAt = now + TTL`)
- `POST /api/auth/magic-link` — validar token (@Public):
  - Validation order: revoked → expired → consumed → bcrypt match → user active
  - On success: issue JWT + set `consumedAt` + `lastUsedAt` in transaction
  - On failure: generic 401 "L'enllaç no és vàlid o ha caducat"
- `PATCH /api/users/:id/magic-link` — revocar
- `GET /api/users/:id/magic-link/status` — retorna estat del token (actiu/caducat/consumit/revocat + dates)
- `PATCH /api/auth/change-password` — canvi de contrasenya (autenticat)
- Rate limiting: 10 req/min per IP al endpoint de validació
- Tests: token vàlid, expirat, consumit, revocat, usuari inactiu, rate limit

**Frontend (Dashboard):**
- Botó "Generar enllaç d'accés" a la gestió d'usuaris
- Modal amb link copiable + botó copiar al clipboard + info caducitat ("Vàlid durant 72h")
- Badge d'estat del token: actiu (verd) / caducat (gris) / consumit (blau) / revocat (vermell)
- Dates visibles: creació + caducitat
- Opció de revocar
- Opció de regenerar (invalida l'anterior, genera nou amb TTL fresc)

**Frontend (PWA):**
- `MagicLinkComponent`: landing page que valida el token automàticament
- Error state genèric: "L'enllaç no és vàlid o ha caducat. Contacta amb l'equip tècnic." (cobreix: expirat, consumit, revocat, invàlid)

**Lliurable:** Un admin genera un link temporal (72h, un sol ús), el comparteix per WhatsApp, i el membre entra sense contrasenya.

**Esforç estimat:** M (1 setmana)

---

### P6.9 — Notificacions Push

**Objectiu:** Membres reben notificacions push al mòbil.

**Backend:**
- Entitat `DeviceToken` (userId, token FCM, platform, lastUsedAt)
- `POST /me/devices` — registrar dispositiu
- `DELETE /me/devices/:id` — eliminar dispositiu
- Servei de notificacions (FCM Web Push)
- Triggers: nou event creat, recordatori d'assistència, segment publicat

**Frontend:**
- Service worker configurat (`@angular/pwa`)
- Permisos de notificació: sol·licitar amb explicació clara
- Registre automàtic del token FCM al login
- Preferències de notificació al perfil

**Lliurable:** Membres reben push quan es crea un event o hi ha un recordatori.

**Esforç estimat:** L (2-3 setmanes)

---

## Dependències entre Fases

```
P6.0 (Shell)
 └── P6.1 (Auth bàsic)
      └── P6.2 (Events + Attendance)
           ├── P6.3 (Event Detail)
           │    └── P6.5 (Canvas Pinyes)
           ├── P6.4 (Gestió Familiar)
           └── P6.6 (Perfil)
      └── P6.7 (TECHNICAL extras) ← requereix P6.2 + P6.3
      └── P6.8 (Magic-Link) ← independent, post-P6.1

P6.9 (Push) ← independent, requereix P6.0 + P6.1
```

**Camí crític:** P6.0 → P6.1 → P6.2 → P6.3 → P6.5

**Paral·lelitzable:**
- P6.4 (family) es pot fer en paral·lel amb P6.3 (detail)
- P6.6 (profile) es pot fer en paral·lel amb P6.3/P6.4
- P6.8 (magic-link) es pot fer en qualsevol moment post-P6.1

---

## Estimació Total

| Esforç | Fases |
|--------|-------|
| S (2-3 dies) | P6.0, P6.1, P6.6 |
| S-M (3-5 dies) | P6.3, P6.7 |
| M (1-2 setmanes) | P6.2, P6.4, P6.5, P6.8 |
| L (2-3 setmanes) | P6.9 |

**Total estimat:** 8-12 setmanes (desenvolupament seqüencial). Amb paral·lelisme backend/frontend: 6-8 setmanes.

---

## Fites de Prova

| Fita | Fases completades | Què es pot provar |
|------|-------------------|-------------------|
| **Alpha 1** | P6.0 + P6.1 + P6.2 | Login + veure events + confirmar assistència |
| **Alpha 2** | + P6.3 + P6.4 | Detall events + gestió familiar |
| **Beta** | + P6.5 + P6.6 + P6.7 | Canvas pinyes + perfil + extras tècnics |
| **RC** | + P6.8 | Magic-link per a onboarding massiu |
| **GA** | + P6.9 | Notificacions push |

> **Alpha 1** és el punt on la comissió pot començar a provar amb membres reals.
> Recomanem arribar a Alpha 1 abans de cap altra funcionalitat.

---

## Proves Manuals — Post-P6.1 (Pre-P6.2 Checklist)

Proves a executar contra el backend local (`nx serve api`) + PWA (`nx serve pwa`) amb la DB amb seed data.

### Prerequisits

- [ ] Backend en marxa a `:3000` amb CORS habilitat per `localhost:4300`
- [ ] PWA servida a `:4300` amb proxy configurat
- [ ] Almenys 1 usuari MEMBER amb `person` vinculada a la DB
- [ ] Almenys 1 usuari MEMBER sense `person` vinculada
- [ ] Almenys 1 usuari TECHNICAL amb `person` vinculada

### Login — Happy Path

| # | Prova | Resultat esperat |
|---|-------|------------------|
| 1 | Accedir a `localhost:4300` sense sessió | Redirect a `/login` |
| 2 | Introduir email + password correctes (MEMBER) | Redirect a `/home`, splash desapareix |
| 3 | Veure la Home amb tab bar visible | 3 tabs: Inici (actiu), Events, Perfil |
| 4 | Verificar que el NoPersonBanner NO apareix (user amb person) | Banner ocult |
| 5 | Login amb usuari MEMBER sense person | Banner groc "Compte no vinculat" visible |
| 6 | Login amb usuari TECHNICAL | Accés concedit, funciona igual que MEMBER |

### Login — Error Handling

| # | Prova | Resultat esperat |
|---|-------|------------------|
| 7 | Submit amb camps buits | Botó desactivat, no es fa request |
| 8 | Email invàlid (ex: `foo@`) + tocar camp | Missatge "Correu electrònic no vàlid" sota el camp |
| 9 | Credencials incorrectes | Alert vermell: "Correu electrònic o contrasenya incorrectes." |
| 10 | Reintentar després d'error | Alert desapareix, loading spinner actiu |
| 11 | Backend aturat (network error) | Mostra missatge d'error (nota: mostra el genèric de credencials) |

### Session Refresh

| # | Prova | Resultat esperat |
|---|-------|------------------|
| 12 | Recarregar pàgina (F5) estant autenticat | Splash → silent refresh OK → Home (sense login) |
| 13 | Esperar > 15 min (access token expirat), fer acció | Interceptor fa refresh transparent, acció completa |
| 14 | Invalidar cookie manualment (DevTools), fer acció | Toast "La sessió ha expirat", redirect a `/login` |
| 15 | Múltiples requests simultànies amb token expirat | Només 1 request de refresh (deduplication) |

### Guards i Routing

| # | Prova | Resultat esperat |
|---|-------|------------------|
| 16 | Navegar a `/home` sense sessió | Redirect a `/login` |
| 17 | Navegar a `/events` sense sessió | Redirect a `/login` |
| 18 | Navegar a `/login` amb sessió activa | Redirect a `/home` (alreadyAuthGuard) |
| 19 | URL inexistent (ex: `/foo`) | Redirect a `/home` (wildcard `**`) |
| 20 | Tab navigation (Inici → Events → Perfil) | Canvi de vista, tab actiu canvia |

### Cookies i Seguretat

| # | Prova | Resultat esperat |
|---|-------|------------------|
| 21 | Inspeccionar cookie `muixer_refresh` (DevTools > Application) | httpOnly=true, path=/api/auth, SameSite=Lax |
| 22 | Login des de PWA → verificar `clientType: PWA` al request body | Visible a Network tab |
| 23 | Refresh des de PWA → cookie amb maxAge 7 dies | Verificable a Response headers |
| 24 | Access token NO és a localStorage ni cookies | Només en memòria (signals) |

### UX i Accessibilitat

| # | Prova | Resultat esperat |
|---|-------|------------------|
| 25 | Tab + Enter al formulari de login | Navegable per teclat, submit funciona |
| 26 | Splash screen durant init | Logo + spinner visible brevment, desapareix un cop `isReady` |
| 27 | Toast container funcional | (Trigger manual via DevTools) Toast apareix i desapareix en 3-5s |
| 28 | Responsive: obrir en viewport mòbil (375px) | Layout correcte, no overflow horitzontal |
| 29 | `autocomplete="email"` i `autocomplete="current-password"` | Navegador ofereix autocompletar |
| 30 | Screen reader: labels linkats als inputs | `for`/`id` correctes, ARIA roles presents |

### Backend — Refresh Token Fix

| # | Prova | Resultat esperat |
|---|-------|------------------|
| 31 | Login PWA (TECHNICAL user) → refresh → verificar cookie TTL | Cookie TTL = 7d (no 8h de Dashboard) |
| 32 | Login Dashboard (TECHNICAL user) → refresh → verificar cookie TTL | Cookie TTL = 8h |
| 33 | Reutilitzar un refresh token ja usat | 401 "Token reutilitzat detectat", tota la família revocada |
| 34 | Usar un refresh token revocat | 401 "Token revocat" |
| 35 | Usar un refresh token expirat | 401 "Token caducat" |

### Known Issues (deute tècnic a adreçar)

- `hasLinkedPerson` retorna `true` quan `currentUser` és `null` (bug menor, no afecta runtime perquè shell viu darrere guard)
- Error de login genèric per a errors de xarxa (hauria de diferenciar 401 vs network failure)
- Import no usat de `DataSource` a `auth.service.ts` backend
- `cleanupExpiredTokens` fa una query redundant (la 2a DELETE és subset de la 1a)

---

## Proves Manuals — Post-P6.2 (Pre-P6.3 Checklist)

Proves a executar contra el backend local (`nx serve api`) + PWA (`nx serve pwa`) amb la DB amb seed data.

### Prerequisits

- [ ] Backend en marxa a `:3000` amb `MeModule` registrat
- [ ] PWA servida a `:4300`
- [ ] Sessió activa (login completat — P6.1 provat)
- [ ] Temporada actual amb almenys 5 events (3 ASSAIG + 2 ACTUACIÓ)
- [ ] Almenys 2 events futurs i 2 events passats a la temporada
- [ ] Almenys 1 event amb assistència ja registrada per l'usuari (via Dashboard)
- [ ] Almenys 1 usuari MEMBER sense `person` vinculada

### Home — Contingut

| # | Prova | Resultat esperat |
|---|-------|------------------|
| 1 | Obrir Home (tab Inici) | Salutació "Hola, {nom}" visible |
| 2 | Home amb events futurs | Card del pròxim assaig visible |
| 3 | Home amb events futurs | Card de la pròxima actuació visible |
| 4 | Card d'assaig mostra data formatada | "Dilluns 16 de juny" (dia setmana + dia + mes) |
| 5 | Card d'actuació mostra títol | Títol de l'event (no data com a títol) |
| 6 | Cards mostren ubicació i hora | Icones MapPin + Clock amb dades |
| 7 | Home sense events futurs | Missatge "No hi ha events programats." |
| 8 | Login amb user sense person | Home mostra llista buida (sense error) |

### Home — Navegació

| # | Prova | Resultat esperat |
|---|-------|------------------|
| 9 | Tocar card d'assaig | Navega a `/events/:id` (event detail) |
| 10 | Tocar card d'actuació | Navega a `/events/:id` (event detail) |

### Home — Skeleton Loading

| # | Prova | Resultat esperat |
|---|-------|------------------|
| 11 | Recarregar Home (o throttle a Slow 3G) | 2-3 skeleton cards visibles durant càrrega |
| 12 | Skeleton desapareix quan dades arriben | Cards reals substitueixen skeletons |

### Llista Events — Visualització

| # | Prova | Resultat esperat |
|---|-------|------------------|
| 13 | Obrir tab Events | Llista de cards d'events propers visible |
| 14 | Cards d'ASSAIG | `border-secondary` esquerra (4px), títol = data formatada |
| 15 | Cards d'ACTUACIÓ | `border-primary` esquerra (4px), títol = títol event |
| 16 | Cada card mostra botó d'assistència | Botó amb estat actual (Pendent/Vinc/No vinc) |
| 17 | Scroll per la llista | Llista scorrejable sense problemes |

### Llista Events — Filtres

| # | Prova | Resultat esperat |
|---|-------|------------------|
| 18 | Tab "Propers" actiu per defecte | Events futurs visibles, ordenats ASC |
| 19 | Tocar tab "Passats" | Events passats visibles, ordenats DESC |
| 20 | Tocar tab "Tots" | Tots els events (propers primer, després passats) |
| 21 | Tornar a "Propers" | Només events futurs de nou |
| 22 | Filtre sense resultats | Empty state "No hi ha events per mostrar." |

### Llista Events — Pull-to-Refresh

| # | Prova | Resultat esperat |
|---|-------|------------------|
| 23 | Tirar cap avall a la llista (touch) | Spinner apareix, dades es recarreguen |
| 24 | Pull-to-refresh completa | Spinner desapareix, llista actualitzada |

### Assistència — Toggle

| # | Prova | Resultat esperat |
|---|-------|------------------|
| 25 | Tocar botó "Pendent" | Canvia a "Vinc" (verd) immediatament (optimistic) |
| 26 | Tocar botó "Vinc" | Canvia a "No vinc" (vermell) immediatament |
| 27 | Tocar botó "No vinc" | Canvia a "Vinc" (verd) immediatament |
| 28 | Després de canvi exitós | Toast "Assistència actualitzada." visible (3s) |
| 29 | Error d'API (backend aturat) | Botó reverteix a estat anterior + toast error |

### Assistència — Validacions

| # | Prova | Resultat esperat |
|---|-------|------------------|
| 30 | Event passat: tocar botó assistència | Botó disabled, no es pot canviar |
| 31 | User sense person: tocar botó | No es mostra botó (o mostra disabled) |
| 32 | Assistència existent (via Dashboard): veure estat | Estat correcte reflectit al botó |
| 33 | Canviar assistència i recarregar | Nou estat persistit correctament |

### Detall Event (Placeholder)

| # | Prova | Resultat esperat |
|---|-------|------------------|
| 34 | Tocar card → detall | Pàgina amb data, hora, ubicació visible |
| 35 | Botó d'assistència al detall | Funcional, mateix comportament que a la llista |
| 36 | Descripció de l'event | Visible si l'event en té |
| 37 | Botó enrere | Torna a la vista anterior |

### API — Backend MeModule

| # | Prova | Resultat esperat |
|---|-------|------------------|
| 38 | `GET /me/events` (Swagger o curl) | Retorna `{ data: MeEvent[], meta }` |
| 39 | `GET /me/events?type=ASSAIG` | Només assajos |
| 40 | `GET /me/events?timeFilter=past` | Només events passats |
| 41 | `PUT /me/events/:id/attendance { status: "ANIRE" }` | 200, crea o actualitza |
| 42 | `PUT /me/events/:id/attendance { status: "ASSISTIT" }` | 400, status no permès |
| 43 | `PUT /me/events/:id/attendance` (event passat) | 400, "L'event ja ha passat" |
| 44 | `GET /me/events` sense sessió | 401 |
| 45 | `GET /me/events` amb JWT d'un user sense person | `{ data: [], meta: { total: 0 } }` |

### UX i Accessibilitat

| # | Prova | Resultat esperat |
|---|-------|------------------|
| 46 | Viewport mòbil (375px) | Cards full-width, no overflow horitzontal |
| 47 | Viewport tablet (768px) | Layout adaptat, cards centrades |
| 48 | Tab navigation (teclat) | Cards i botons focusables amb Tab |
| 49 | Enter sobre card focusada | Navega al detall |
| 50 | Screen reader: botó assistència | `aria-label` llegible (ex: "Canviar assistència a Vinc") |
| 51 | Colors: botó Vinc vs No vinc | Contrast ≥ 4.5:1 (success/error sobre fons) |
| 52 | Estat assistència expressat amb text | No depèn només del color (icona + text) |

### Performance

| # | Prova | Resultat esperat |
|---|-------|------------------|
| 53 | Temps de càrrega Home (Network Normal) | < 2s fins a cards visibles |
| 54 | Temps de càrrega Event List (20 events) | < 2s fins a cards visibles |
| 55 | Canvi de filtre (Propers → Passats) | < 1s amb skeleton transició |
