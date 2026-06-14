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
| P6.0 | Infraestructura i App Shell | Config CORS/port | Scaffold, shell, tabs | ⚪ Pendent | — |
| P6.1 | Auth (bàsic) | — (endpoints existents) | Login, guards, interceptor | ⚪ Pendent | — |
| P6.2 | Events i Assistència | `MeModule` + endpoints | Llista events, Home, attendance | ⚪ Pendent | — |
| P6.3 | Detall d'Event | Segments visibles per MEMBER | Detall, accordion, info figures | ⚪ Pendent | — |
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

**Objectiu:** Admins poden generar enllaços d'accés per als membres.

**Backend:**
- Entitat `MagicLinkToken` + migració
- `POST /api/users/:id/magic-link` — generar (upsert)
- `POST /api/auth/magic-link` — validar token → JWT + cookie (@Public)
- `PATCH /api/users/:id/magic-link` — revocar
- `PATCH /api/auth/change-password` — canvi de contrasenya (autenticat)
- Rate limiting: 10 req/min per IP al endpoint de validació
- Tests

**Frontend (Dashboard):**
- Botó "Generar enllaç d'accés" a la gestió d'usuaris
- Modal amb link copiable + botó copiar al clipboard
- Opció de revocar

**Frontend (PWA):**
- `MagicLinkComponent`: landing page que valida el token automàticament
- Error state: "L'enllaç no és vàlid o ha estat revocat"

**Lliurable:** Un admin genera un link, el comparteix per WhatsApp, i el membre entra sense contrasenya.

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
