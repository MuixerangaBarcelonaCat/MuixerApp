# MuixerApp — Document de Context

> Document de referència per a IA i col·laboradors. Manté la visió global del projecte: arquitectura, estat, decisions i implementació.
> **Última actualització:** 25 de maig de 2026

---

## Taula de continguts

1. [Visió general](#1-visió-general)
2. [Stack tecnològic](#2-stack-tecnològic)
3. [Estructura del monorepo](#3-estructura-del-monorepo)
4. [Roadmap i estat actual](#4-roadmap-i-estat-actual)
5. [Model de dades](#5-model-de-dades)
6. [Backend API — endpoints](#6-backend-api--endpoints)
7. [Frontend dashboard — features i components](#7-frontend-dashboard--features-i-components)
8. [Mòdul de Pinyes (P5) — arquitectura completa](#8-mòdul-de-pinyes-p5--arquitectura-completa)
9. [Autenticació i seguretat](#9-autenticació-i-seguretat)
10. [Patrons i convencions](#10-patrons-i-convencions)
11. [Testing](#11-testing)
12. [DevOps i infraestructura](#12-devops-i-infraestructura)
13. [P5.8.1 — Projecció de Segments (en curs)](#13-p581--projecció-de-segments-en-curs)
14. [Pendents i futur](#14-pendents-i-futur)
15. [Documentació de referència](#15-documentació-de-referència)

---

## 1. Visió general

**MuixerApp** és una aplicació de gestió per a colles muixerangueres (grups de castellers valencians). Permet gestionar persones, assistència a assajos i actuacions, i el disseny/assignació de figures (les construccions humanes que fan).

### Usuaris target

- **Cap de Pinyes** (rol `TECHNICAL`): gestiona figures, assigna persones, visualitza projeccions
- **Membres** (rol `MEMBER`): confirmen la pròpia assistència via PWA (pendent P6)
- **Admin** (rol `ADMIN`): configuració global del sistema

### Flux bàsic

```
Persones (membres) → Temporades → Esdeveniments → Assistència
                                        ↓
                               Segments → Figures → Assignació de persones
                                        ↓
                               Projecció fullscreen (P5.8.1)
```

---

## 2. Stack tecnològic

### Backend (`apps/api`)

| Tecnologia | Versió | Ús |
|-----------|--------|-----|
| **NestJS** | 10.x | Framework principal |
| **TypeORM** | 0.3.x | ORM per a PostgreSQL |
| **PostgreSQL** | 15+ | Base de dades |
| **Passport.js + JWT** | — | Autenticació |
| **Swagger/OpenAPI** | — | Documentació interactiva (`/api/docs`) |
| **Jest** | — | Tests unitaris |

### Frontend (`apps/dashboard`)

| Tecnologia | Versió | Ús |
|-----------|--------|-----|
| **Angular** | 21+ | Framework SPA, standalone components |
| **DaisyUI** | v4.12.24 | Components CSS |
| **Tailwind CSS** | v3.4.19 | Utilitat-first CSS (NO v4) |
| **Angular CDK** | v21.2.4 | Overlays, a11y, drag-drop |
| **Konva** | 10.3 | Canvas imperativa per figures (NO ng2-konva) |
| **Lucide Angular** | — | Icones |
| **Vitest** | — | Tests |

### DevOps / Monorepo

| Tecnologia | Ús |
|-----------|-----|
| **Nx** | 22.6.3 — build orchestration, affected graph |
| **Docker Compose** | Dev local (PostgreSQL) i prod (VPS) |
| **GitHub Actions** | CI/CD: lint + test + build |
| **Node 22 LTS** | Runtime |

### Decisions tecnològiques clau

| Decisió | Resultat | Data |
|---------|----------|------|
| Canvas library | `konva` API imperativa directa (sense `ng2-konva` — incompatible amb Angular 20+) | Mai 2026 |
| Token storage (Dashboard) | Memòria/signal (access token) + `httpOnly cookie` (refresh token) | Abr 2026 |
| BD dev | PostgreSQL en Docker local (eliminat NeonDB) | Mai 2026 (P4.4) |
| Auth | JWT access 15min + refresh 7d, rotació automàtica | Abr 2026 |
| CSS | DaisyUI v4 + Tailwind v3.4 — zero custom CSS als components | Abr 2026 (P4.3) |
| Idioma UI | Català | Mar 2026 |
| Idioma codi | Anglès | Mar 2026 |

---

## 3. Estructura del monorepo

```
MuixerApp/
├── apps/
│   ├── api/                          # Backend NestJS
│   │   └── src/
│   │       └── modules/
│   │           ├── auth/             # JWT, Passport, refresh tokens
│   │           ├── person/           # CRUD persones
│   │           ├── event/            # Events + Attendance
│   │           ├── season/           # Temporades
│   │           ├── figure/           # FigureTemplate + FigureNode + Rengla
│   │           ├── composition/      # CompositionTemplate + CompositionSlot
│   │           ├── event-segment/    # EventSegment + FigureInstance
│   │           ├── node-assignment/  # NodeAssignment + InstanceNode + AvailablePersons
│   │           ├── reference-element/ # ReferenceElement (P5.8.1)
│   │           ├── sync/             # SSE sync del legacy (Strategy pattern)
│   │           └── database/
│   │               └── scripts/      # Migracions i seeds
│   ├── dashboard/                    # Frontend Angular SPA
│   │   └── src/app/
│   │       ├── core/                 # Auth, interceptors, guards
│   │       ├── features/
│   │       │   ├── persons/          # Llistat + detall persones
│   │       │   ├── events/           # Llistat + detall events + assistència
│   │       │   ├── pinyes/           # Tot el mòdul Pinyes (P5)
│   │       │   ├── home/             # Pàgina d'inici
│   │       │   └── sync/             # Sincronització legacy SSE
│   │       └── shared/
│   │           ├── components/       # 15+ components reutilitzables
│   │           └── utils/            # color, date, person, http-params utils
│   ├── pwa/                          # PWA mòbil (scaffold buit, pendent P6)
│   └── *-e2e/                        # Tests Playwright
├── libs/
│   └── shared/                       # Enums compartits (NodeShape, UserRole...)
├── docs/                             # 25+ documents de documentació i specs
│   ├── specs/                        # Specs aprovades per fase
│   └── codebase/                     # ARCHITECTURE, STACK, TESTING, CONVENTIONS...
├── .cursor/
│   ├── rules/                        # Regles per a agents IA
│   └── plans/                        # Plans d'implementació anteriors
└── docker/                           # Configuració Docker
```

---

## 4. Roadmap i estat actual

| ID | Sub-projecte | Estat |
|----|-------------|-------|
| **P0** | Scaffold (Nx + NestJS + Angular + PostgreSQL) | ✅ Completat |
| **P1** | Usuaris + Persones (CRUD) | ✅ Completat |
| **P2** | Data Migration (sync SSE del legacy) | ✅ Completat |
| **P2.1** | Dashboard Persons — UX avançada | ✅ Completat |
| **P3** | Temporades + Esdeveniments + Assistència | ✅ Completat |
| **P4.1** | Auth Layer (JWT + Passport + Dashboard login) | ✅ Completat |
| **P4.2** | Dashboard Events + Assistència manual | ✅ Completat |
| **P4.3** | Dashboard Design Refactor (DaisyUI v4, clean slate) | ✅ Completat |
| **P4.4** | Arquitectura Docker multi-entorn | ✅ Completat |
| **P5.1** | Mòdul Pinyes — Templates i Editor Visual (Konva) | ✅ Completat |
| **P5.2** | Mòdul Pinyes — Composicions multi-figura | ✅ Completat |
| **P5.2.1** | Fixes canvas composicions + millores UX | ✅ Completat |
| **P5.3** | Mòdul Pinyes — Segments i Instàncies | ✅ Completat |
| **P5.4** | Mòdul Pinyes — Assignació de Persones (pick-and-place) | ✅ Completat |
| **P5.5** | Mòdul Pinyes — Famílies, Snapshot Lazy, Upgrade Cordó | ✅ Completat |
| **P5.6** | Mòdul Pinyes — Visualització Troncs (CSS Grid) | ✅ Completat |
| **P5.7** | Mòdul Pinyes — Tronc Nodes a Nivell de Família | ✅ Completat |
| **P5.8.1** | Mòdul Pinyes — Projecció de Segments (fullscreen) | 🔵 En curs |
| **P5.8.2** | Mòdul Pinyes — Consulta Històrica | ⚪ Pendent |
| **P5.3.1** | Revisió UX Segments (tab dedicat "Pinyes" a event-detail) | ⚪ Pendent |
| **P6** | PWA Mòbil (membres) | ⚪ Pendent |
| **P7** | Informes + Notificacions + Features avançades | ⚪ Pendent |

**Branch actual:** `feat/modul-pinyes`

---

## 5. Model de dades

### Entitats principals i relacions

```
Person ──────────────────────────────── User (OneToOne, nullable)
  │                                        role: ADMIN | TECHNICAL | MEMBER
  ├── Attendance (M:N via Event)
  └── NodeAssignment (M:N via InstanceNode)

Season ──► Event ──► Attendance
                │
                ├── EventSegment[] ──► FigureInstance[]
                │                          │ projectionX, projectionY, projectionScale (P5.8.1)
                │                          ├── InstanceNode[] (snapshot lazy)
                │                          └── NodeAssignment[] ──► InstanceNode + Person
                │
                └── ReferenceElement[] (P5.8.1)

FigureTemplate ──► FigureNode[] (PINYA, TRONC, BASE, directions)

CompositionTemplate ──► CompositionSlot[] ──► FigureTemplate
```

### Taules de base de dades

| Taula | Entitat | Fase |
|-------|---------|------|
| `persons` | Person | P1 |
| `positions` | Position | P1 |
| `users` | User | P4.1 |
| `refresh_tokens` | RefreshToken | P4.1 |
| `seasons` | Season | P3 |
| `events` | Event | P3 |
| `attendances` | Attendance | P3 |
| `figure_templates` | FigureTemplate | P5.1 |
| `figure_nodes` | FigureNode (totes les zones) | P5.1 |
| `composition_templates` | CompositionTemplate | P5.2 |
| `composition_slots` | CompositionSlot | P5.2 |
| `event_segments` | EventSegment | P5.3 |
| `figure_instances` | FigureInstance | P5.3 |
| `instance_nodes` | InstanceNode | P5.5 |
| `node_assignments` | NodeAssignment | P5.4 |
| `reference_elements` | ReferenceElement | P5.8.1 |

### Camps clau de les entitats de Pinyes

#### FigureTemplate
- `name`, `slug`, `hasPinya`, `direction`

#### FigureNode
- `zone`: `PINYA | TRONC | BASE | FIGURE_DIRECTION | XICALLA_DIRECTION`
- `positionType`: `agulla | laterals | mans | vents | cordo-obert | crossa | contrafort | tap` (varchar lliure)
- `ringLevel` (int, nullable) — anell concèntric (1 = primer cordó)
- `renglaId`, `renglaPosition` — pertinença a rengla (P5.11)
- `originNodeId` (uuid nullable, no FK) — llinatge opcional en duplicacions/derivacions
- `x`, `y` (pixels per PINYA; unitats relatives per TRONC/BASE)

#### FigureInstance
- `figureTemplate` FK (o `compositionTemplate` — XOR)
- `snapshotted` (boolean) — indica si els nodes ja s'han copiat
- `numberOfCordons`, `openCordons` — selector de cordons visible (P5.11)
- `projectionX`, `projectionY` (float, nullable), `projectionScale` (float, default 1.0) — P5.8.1

#### InstanceNode
- Còpia immutable de FigureNode
- `sourceNodeId` (uuid, no FK) — ID del FigureNode original
- `originNodeId` (uuid, no FK) — copiat de FigureNode.originNodeId

#### NodeAssignment
- FK → `InstanceNode` (RESTRICT) — **mai** a FigureNode
- FK → `Person` (RESTRICT)
- Unique constraint: `[figureInstance, instanceNode]` i `[figureInstance, person]`

#### ReferenceElement (P5.8.1)
- FK → `Event` (CASCADE)
- `type`: `RECTANGLE | ARROW`
- `x, y, width, height, rotation, color`
- `hiddenInSegments`: `string[]` (JSONB) — UUIDs de segments on no es mostra

### Enums (a `libs/shared/`)

- `UserRole`: `ADMIN | TECHNICAL | MEMBER`
- `NodeShape`: `ELLIPSE | RECTANGLE`
- `FigureZone`: `PINYA | TRONC | BASE | FIGURE_DIRECTION | XICALLA_DIRECTION`
- `AttendanceStatus`: `PENDENT | ANIRE | NO_VAIG | ASSISTIT`
- `EventType`: `ASSAIG | ACTUACIO | ASSEMBLEA | ALTRE`
- `ReferenceElementType`: `RECTANGLE | ARROW` (P5.8.1)

---

## 6. Backend API — endpoints

### Auth (`/api/auth`)

| Mètode | Ruta | Descripció | Rol |
|--------|------|-----------|-----|
| POST | `/auth/login` | Login email+password | Públic |
| POST | `/auth/refresh` | Rotar refresh token (cookie httpOnly) | Públic |
| POST | `/auth/logout` | Revocar token actual | Autenticat |
| POST | `/auth/logout-all` | Revocar tots els tokens de l'usuari | Autenticat |
| GET | `/auth/me` | Perfil de l'usuari autenticat | Autenticat |
| POST | `/auth/invite/accept` | Acceptar invitació (onboarding membre) | Públic |
| POST | `/auth/setup/user` | Bootstrap primer usuari (X-Setup-Token) | Públic |

### Persons (`/api/persons`)

| Mètode | Ruta | Descripció |
|--------|------|-----------|
| GET | `/persons` | Llistar (search, isActive, isProvisional, sortBy, page, limit) |
| GET | `/persons/:id` | Detall |
| POST | `/persons` | Crear persona regular |
| POST | `/persons/provisional` | Crear persona provisional (sols àlies) |
| PATCH | `/persons/:id` | Actualitzar |
| DELETE | `/persons/:id` | Soft delete |
| PATCH | `/persons/:id/activate` | Activar |
| PATCH | `/persons/:id/deactivate` | Desactivar |

### Seasons (`/api/seasons`)

| Mètode | Ruta | Descripció |
|--------|------|-----------|
| GET | `/seasons` | Llistar (amb event count) |
| GET | `/seasons/:id` | Detall |
| POST | `/seasons` | Crear |
| PUT | `/seasons/:id` | Actualitzar |

### Events (`/api/events`)

| Mètode | Ruta | Descripció |
|--------|------|-----------|
| GET | `/events` | Llistar (seasonId, eventType, dateFrom/To, search, countsForStatistics, sortBy, page, limit) |
| POST | `/events` | Crear |
| GET | `/events/:id` | Detall (inclou attendanceSummary) |
| PUT | `/events/:id` | Actualitzar |
| DELETE | `/events/:id` | Eliminar (409 si té assistència) |
| GET | `/events/:id/attendance` | Llista assistència (status filter, search, pagination) |
| POST | `/events/:id/attendance` | Crear registre (409 si duplicat) |
| PUT | `/events/:id/attendance/:aid` | Actualitzar assistència |
| DELETE | `/events/:id/attendance/:aid` | Eliminar assistència |

### Sync (`/api/sync`)

| Mètode | Ruta | Descripció |
|--------|------|-----------|
| GET | `/sync/persons` | SSE — sincronitza persones del legacy |
| GET | `/sync/events` | SSE — sincronitza events i assistència |
| GET | `/sync/all` | SSE — sincronització completa (persons → events → attendance) |

### Figure Templates (`/api/figure-templates`)

| Mètode | Ruta | Descripció |
|--------|------|-----------|
| GET | `/figure-templates` | Llistar (search, hasPinya, page, limit) |
| GET | `/figure-templates/:id` | Detall amb nodes |
| POST | `/figure-templates` | Crear |
| PUT | `/figure-templates/:id` | Actualitzar + upsert nodes |
| DELETE | `/figure-templates/:id` | Eliminar (409 si té instàncies o slots) |
| POST | `/figure-templates/:id/duplicate` | Duplicar template |

### Compositions (`/api/composition-templates`)

| Mètode | Ruta | Descripció |
|--------|------|-----------|
| GET | `/composition-templates` | Llistar |
| GET | `/composition-templates/:id` | Detall amb slots i nodes populats |
| POST | `/composition-templates` | Crear |
| PUT | `/composition-templates/:id` | Actualitzar + sync complet de slots |
| DELETE | `/composition-templates/:id` | Eliminar |
| POST | `/composition-templates/:id/duplicate` | Duplicar |

### Event Segments (`/api/events/:eventId/segments`)

| Mètode | Ruta | Descripció |
|--------|------|-----------|
| GET | `/segments` | Llistar segments de l'event |
| POST | `/segments` | Crear segment |
| GET | `/segments/:segmentId` | Detall |
| PUT | `/segments/:segmentId` | Actualitzar |
| DELETE | `/segments/:segmentId` | Eliminar |
| PUT | `/segments/reorder` | Reordenar segments |
| GET | `/segments/:segmentId/instances` | Llistar instàncies del segment |
| POST | `/segments/:segmentId/instances` | Afegir instància |
| DELETE | `/segments/:segmentId/instances/:instanceId` | Eliminar instància |
| PUT | `/segments/:segmentId/instances/reorder` | Reordenar instàncies |
| PUT | `/segments/:segmentId/instances/projection-layout` | Batch update posicions projecció (P5.8.1) |
| GET | `/segments/:segmentId/projection` | Endpoint optimitzat projecció (P5.8.1) |

### Node Assignments (`/api/node-assignments`)

| Mètode | Ruta | Descripció |
|--------|------|-----------|
| GET | `/node-assignments/instances/:id/nodes` | Nodes disponibles (InstanceNodes si snapshotted, FigureNodes si no) |
| GET | `/node-assignments/instances/:id` | Assignacions actuals |
| POST | `/node-assignments/instances/:id/assign` | Assignar persona a node (auto-snapshot en primera crida) |
| DELETE | `/node-assignments/instances/:id/unassign/:nodeId` | Desassignar |
| POST | `/node-assignments/instances/:id/swap` | Intercanviar dues assignacions |
| GET | `/node-assignments/instances/:id/history` | Historial d'assignacions per importar |
| POST | `/node-assignments/instances/:id/bulk-import` | Import massiu des d'instància anterior |
| GET | `/node-assignments/available-persons` | Persones filtrades i ordenades per alçada (search, height±2, isXicalla, excludeAssigned) |
| GET | `/node-assignments/next-performance` | Propera ACTUACIO (per mostrar 🎭 als assajos) |

### Reference Elements (`/api/events/:eventId/reference-elements`) — P5.8.1

| Mètode | Ruta | Descripció |
|--------|------|-----------|
| GET | `/reference-elements` | Llistar elements de l'event |
| POST | `/reference-elements` | Crear element |
| PUT | `/reference-elements/batch` | Batch update posicions/dimensions (auto-save) |
| PUT | `/reference-elements/:id` | Actualitzar propietats |
| DELETE | `/reference-elements/:id` | Eliminar |
| PUT | `/reference-elements/:id/visibility` | Toggle visibilitat per segment |

---

## 7. Frontend dashboard — features i components

### Layout i navegació

- **Top navigation bar** amb tabs: Inici, Persones, Assajos/Actuacions, Pinyes, Configuració
- **Responsive**: Desktop (icon+text) → Tablet (icon) → Mobile (dropdown DaisyUI)
- **Font**: Inter (Google Fonts)
- **Icones**: Lucide Angular
- **Tema**: `generateCollaTheme(primaryHex)` — paleta completa DaisyUI des d'un sol color hex amb contrast WCAG automàtic

### Shared components (`apps/dashboard/src/app/shared/components/`)

| Component | Tipus | Descripció |
|-----------|-------|-----------|
| `page-header` | Data | Títol + badge comptador + slot per botons |
| `data-table` | Data | Generic `<T>`, sort, skeleton, separadors, row-actions, sticky columns |
| `filter-bar` | Data | Container per filtres + botó "Netejar" |
| `active-filters` | Data | Badges dismissibles de filtres actius |
| `pagination` | Data | Join buttons + selector limit + info registres |
| `column-toggle` | Data | Checkboxes per mostrar/amagar columnes |
| `empty-state` | Data | Icona Lucide + missatge + acció opcional |
| `stat-card` | Data | DaisyUI stat per mètriques |
| `skeleton-rows` | Feedback | Loading states animats |
| `confirm-dialog` | Feedback | Modal DaisyUI amb confirmació/cancel·lació |
| `toast` + ToastService | Feedback | Notificacions auto-dismiss (4s) |
| `form-field` | Forms | Wrapper labels + errors + helper text |
| `tab-nav` | Layout | Navegació responsive amb tabs |
| `header` | Layout | Brand bar amb logo + user-chip |
| `user-chip` | Layout | Avatar + dropdown logout |

### Features implementades

#### Persones (`/persons`)
- Taula always-on amb scroll horitzontal
- Filtres: cerca, tabs Cens/Provisionals/Tots, ordenació per columnes (server-side)
- Paginació configurable: 25/50/100 per pàgina
- Toggle alçada d'espatlles absoluta (cm) / relativa (+/- vs 140cm baseline) amb codificació de color
- Badge "provisional" (prefix `~` a l'àlies)
- CRUD inline + toggle visibilitat
- Sync SSE des del legacy

#### Esdeveniments (`/events`)
- Llistat amb tabs Assajos/Actuacions, filtres (temporada, estadística, cerca, rang dates)
- EventDetail inline: info + SegmentManager + llista assistència
- CRUD complet via modal (EventFormModal)
- Attendance CRUD inline: afegir/editar/eliminar amb PersonSearchInput
- AttendanceEditModal: editar estat + notes, eliminació amb confirmació
- Persones provisionals: creació ràpida inline
- Optimistic UI + rollback

#### Pinyes (`/pinyes`)
Veure secció 8 per a la documentació completa del mòdul.

#### Autenticació (`/login`)
- Form DaisyUI, email+password, UI en català
- JWT en memòria/signal + refresh token httpOnly cookie
- Auth interceptor: 401 → refresh → retry automàtic
- Redirect `/login` quan falla la sessió

---

## 8. Mòdul de Pinyes (P5) — arquitectura completa

### Conceptes de domini

| Concepte | Descripció |
|----------|-----------|
| **FigureTemplate** | Blueprint reutilitzable. Conté tots els nodes (PINYA, TRONC, BASE) |
| **FigureNode** | Posició dins d'un template. `ringLevel`, `renglaId`/`renglaPosition`, `originNodeId` opcional |
| **Rengla** | Seqüència radial de nodes de pinya per cordó (P5.11) |
| **FigureInstance** | Presència concreta d'un template en un segment. Lleugera fins la primera assignació |
| **InstanceNode** | Còpia immutable de FigureNode. Creada al primer assign (lazy snapshot) |
| **NodeAssignment** | Persona → InstanceNode. **Sempre a InstanceNode, mai a FigureNode** |
| **EventSegment** | Bloc temporal d'un event (ex: "Bloc 1", "Escalfament") |

### Cicle de vida d'una instància

```
1. Creació (pre-snapshot):
   FigureInstance { snapshotted: false, instanceNodes: [] }
   → Canvas llegeix els FigureNodes vius del template

2. Primera assignació → SNAPSHOT AUTOMÀTIC en transacció:
   a. Copia tots els FigureNodes → InstanceNodes
   b. snapshotted = true
   c. Crea NodeAssignment → InstanceNode (matching per sourceNodeId)

3. Post-snapshot:
   Canvas llegeix InstanceNodes (immutables)
   Canvis al template NO afecten la instància

4. Selector de cordons (P5.11):
   PATCH /figure-instances/:id/cordons
   Filtra nodes visibles per numberOfCordons / openCordons (reversible)

5. Eliminació:
   CASCADE: FigureInstance → InstanceNodes + NodeAssignments
```

### Arquitectura de components frontend (Pinyes)

```
apps/dashboard/src/app/features/pinyes/
├── components/
│   ├── template-list/         # Tab Figures + Composicions
│   ├── template-editor/       # Ruta /pinyes/templates/:id/edit
│   │                          # Konva canvas (pinya) + TroncView floating panel
│   ├── figure-canvas/         # Canvas Konva reutilitzable (modes: editor|assignment|readonly|composition)
│   ├── composition-editor/    # Ruta /pinyes/compositions/:id/edit
│   ├── assignment-canvas/     # Ruta /pinyes/events/:eventId/segments/:segmentId/assign
│   ├── person-panel/          # Panel lateral persones disponibles
│   ├── node-popover/          # Popover node assignat (desassignar)
│   ├── import-pinya-modal/    # Modal importació massiva
│   ├── figure-picker-modal/   # Modal afegir figura/composició al segment
│   ├── tronc-view/            # CSS Grid, modes: editor|assignment|projection (P5.8.1)
│   ├── segment-canvas/        # Konva multi-figura (P5.8.1)
│   ├── figure-projection/     # Fullscreen figura individual (P5.8.1)
│   ├── projection-view/       # Pàgina projecció (P5.8.1)
│   └── pinyes-onboarding-modal/
├── services/
│   ├── figure-template.service.ts
│   ├── node-assignment.service.ts
│   ├── assignment-state.service.ts   # Signals globals del canvas
│   ├── event-segment.service.ts
│   ├── figure-instance.service.ts
│   └── composition-template.service.ts
└── models/ + utils/
```

### Rutes del mòdul Pinyes

```typescript
// pinyes.routes.ts
/pinyes                                                     → TemplateListComponent
/pinyes/templates/:id/edit                                  → TemplateEditorComponent
/pinyes/compositions/:id/edit                               → CompositionEditorComponent
/pinyes/events/:eventId/segments/:segmentId/assign          → AssignmentCanvasComponent
/pinyes/events/:eventId/segments/:segmentId/project         → ProjectionViewComponent (P5.8.1)
```

### TroncViewComponent — sistema d'unitats relatives (P5.6)

- **`x`** i **`width`** per nodes TRONC/BASE: unitats relatives 0–8u, steps 0.5
- **`z`** = pis (P1/BASE=0, P2/TRONC=1, ...)
- Renderitzat amb **CSS Grid** (grid doblejat intern `x*2, width*2` per suportar 0.5u steps)
- **Modes**: `editor` (controls edició) | `assignment` (assignacions + variance) | `projection` (P5.8.1)
- **Floating draggable panel**: movible sobre el canvas, no bloqueja interacció
- **Variance d'alçades per pis**: Δcm per pis, verd ≤5cm, groc 6–10cm, vermell >10cm

### FigureCanvasComponent — modes

| Mode | Descripció |
|------|-----------|
| `editor` | Drag/resize/rotate nodes, edició inline, toolbar propietats |
| `assignment` | Nodes clickables per assignació, no editables |
| `readonly` | Read-only, noms en negreta, fitToScreen automàtic (P5.8.1) |
| `composition` | Renderitza grups de templates amb offsets, drag de grups |

### AssignmentStateService — signals principals

```typescript
selectedNodeId: signal<string | null>
selectedPersonId: signal<string | null>
activeInstanceId: signal<string | null>
assignments: signal<AssignmentDetail[]>
confirmedPersons: signal<AvailablePerson[]>
pendingOperations: signal<PendingOp[]>
freePersonsCount: computed<number>
totalConfirmedCount: computed<number>
```

### Invariants del mòdul de Pinyes

1. `NodeAssignment` apunta **sempre** a `InstanceNode`, mai a `FigureNode`
2. Un cop `snapshotted = true`, els `InstanceNode` NO es modifiquen per canvis al template
3. `FigureInstance` té exactament `figureTemplate` **o** `compositionTemplate` (XOR)
4. Una persona NO pot aparèixer en dues `NodeAssignment` del **mateix segment**
5. Tots els nodes (PINYA, TRONC, BASE) viuen a `figure_nodes` per template
6. Per nodes TRONC/BASE: `x` i `width` = unitats relatives. Per nodes PINYA: pixels (Konva)
7. `FigureNode.id` és **estable entre saves** (upsert per ID, no delete+recreate)

---

## 9. Autenticació i seguretat

### Flux d'autenticació

```
Login (email + password)
  ↓ POST /auth/login
  ← access_token (JWT 15min, en memòria)
  ← refresh_token (JWT 7d, httpOnly cookie)

Cada request autenticat:
  Authorization: Bearer <access_token>

Quan access_token expira (401):
  AuthInterceptor → POST /auth/refresh (amb cookie)
  ← nou access_token
  ← nou refresh_token (rotació)
  → reintenta la request original

Logout:
  POST /auth/logout → revoca refresh_token actual
  POST /auth/logout-all → revoca tots els tokens de l'usuari
```

### Model de rols

| Rol | Àmbit | Accés |
|-----|-------|-------|
| `TECHNICAL` | Dashboard + PWA | CRUD complet (persones, events, pinyes, segments, assignació) |
| `MEMBER` | PWA | Autogestió pròpia assistència, visualització events |
| `ADMIN` | Total | Igual que TECHNICAL + configuració de sistema (futur multi-tenant) |

### Components d'auth (frontend)

- `AuthService` (signals): `currentUser`, `accessToken`, `isAuthenticated`, `userRole`
- `authGuard` (CanActivateFn): protegeix totes les rutes
- `rolesGuard(roles[])`: factory per a rutes amb rol específic
- `AuthInterceptor`: afegeix Bearer header + gestiona 401→refresh→retry

### Seguretat backend

- `AuthGuard` global: protegeix tots els endpoints per defecte
- `@Public()` decorator: marca endpoints públics (login, refresh, invite, setup)
- `RolesGuard`: validació de rol per endpoints específics
- Rate limiting configurable
- Cron job diari: cleanup de refresh tokens expirats

---

## 10. Patrons i convencions

### Convencions de codi

| Aspecte | Decisió |
|---------|---------|
| Idioma UI | Català (tots els textos visibles) |
| Idioma codi | Anglès (variables, funcions, endpoints, commits) |
| Components Angular | Standalone + `OnPush` + Signals |
| Estils | DaisyUI v4 + Tailwind v3 — zero custom CSS |
| Estat reactiu | `signal()`, `computed()`, `effect()` — evitar BehaviorSubject per estat local |
| Icones | Lucide Angular |
| Comments al codi | Mínims — només per WHY no-obvious |
| Tests | Co-ubicats (`.spec.ts`) — vitest al frontend, jest al backend |

### Patrons de disseny implementats

1. **Strategy Pattern**: Sync module (`PersonSyncStrategy`, `EventSyncStrategy`, `AttendanceSyncStrategy`)
2. **Repository Pattern**: TypeORM repositories
3. **DTO Pattern**: Validació + transformació amb class-validator
4. **Signals Pattern**: Estat reactiu Angular (no NgRx)
5. **Optimistic UI + Rollback**: `AssignmentStateService`, `EventDetail`
6. **Lazy Snapshot**: `FigureInstance` — no crea `InstanceNode`s fins la primera assignació
7. **Upsert per ID**: `syncNodes()` — stable IDs entre saves (no delete+recreate)

### Tema i disseny visual

- `generateCollaTheme(primaryHex)` a `tailwind.config.js` genera la paleta completa
- `data-theme="colla-barcelona"` a `<html>`
- Canviar color de la colla: modificar el hex a `tailwind.config.js`

### Workflow de desenvolupament per sub-projecte

```
Brainstorming → Spec (docs/specs/YYYY-MM-DD-<topic>-design.md)
             → Implementation Plan (.cursor/plans/)
             → Codi (feature branch)
             → Tests
             → PR → merge
```

---

## 11. Testing

### Estat actual (branch `feat/modul-pinyes`)

| Capa | Tests | Estat |
|------|-------|-------|
| **API Backend** | 370/370 | ✅ Passing |
| **Dashboard Frontend** | 303/303 | ✅ Passing |
| **Total** | **673/673** | ✅ |

### Cobertura backend destacada

- `PersonService`, `PersonController`, `PersonFilterDto`
- `AuthModule`: login, refresh, logout, guards
- `SeasonService`, `EventService`, `AttendanceService`, `EventController`
- `Sync`: `PersonSyncStrategy`, `EventSyncStrategy`, `AttendanceSyncStrategy`
- `FigureTemplate`: CRUD, upsert nodes, duplicate
- `CompositionTemplate`, `EventSegmentService`, `FigureInstanceService`
- `NodeAssignmentService`: assign, unassign, swap, bulkImport, snapshot
- `AvailablePersonsService`: filtres, proximity sort per alçada

### Cobertura frontend destacada

- `PersonListComponent`, `PersonService`, `EventService`, `AttendanceService`
- `person.util`, `http-params.util`, `floor-variance.util`
- `NodeAssignmentService`, `AssignmentStateService`
- `AssignmentCanvasComponent`, `PersonPanelComponent`, `NodePopoverComponent`
- `ImportPinyaModalComponent`, `SegmentManagerComponent`
- `TroncViewComponent` (grid calculations, floor sorting, variance logic)

### Executar tests

```bash
nx test api           # Backend
nx test dashboard     # Frontend
npm run ci:local      # lint + test + build (tot)
```

---

## 12. DevOps i infraestructura

### Entorns

| Entorn | BD | Com executar |
|--------|-----|-------------|
| **Dev local** | PostgreSQL Docker | `npm run docker:up` + `nx serve api` |
| **Prod (VPS)** | PostgreSQL Docker | `docker-compose.prod.yml` |

### Comandes habituals

```bash
# Setup
npm install
cp .env.example .env
npm run docker:up                    # Arrenca PostgreSQL a Docker

# Dev
nx serve api                         # http://localhost:3000/api (Swagger: /api/docs)
nx serve dashboard                   # http://localhost:4200

# Migracions i seeds
nx run api:seed-seasons              # Importar temporades
nx run api:migrate-tronc-units       # P5.6: Actualitzar unitats relatives TRONC/BASE
nx run api:reset-figure-data         # Neteja dev: esborrar instàncies/nodes/assignacions + re-seed

# Tests
npm run ci:local                     # lint + test + build complet
nx test api                          # Tests backend
nx test dashboard                    # Tests frontend
```

### CI/CD (GitHub Actions)

- **PRs**: `nx affected` (lint + test + build dels projectes afectats)
- **Push a main**: test + build de tots els projectes
- Coverage threshold: 70% (enforçat via `--configuration=ci`)

### Variables d'entorn clau

| Variable | Descripció |
|----------|-----------|
| `DATABASE_URL` | Connection string PostgreSQL |
| `DB_SSL` | `true` (prod) / `false` (dev Docker) |
| `JWT_SECRET` | Secret per als access tokens |
| `JWT_REFRESH_SECRET` | Secret per als refresh tokens |
| `CORS_ORIGINS` | Array d'orígens permesos (Dashboard + PWA) |
| `SETUP_TOKEN` | Token per bootstrap del primer usuari |
| `LEGACY_API_URL` | URL de l'API legacy per al sync |

---

## 13. P5.8.1 — Projecció de Segments (en curs)

### Objectiu

Vista fullscreen per al Cap de Pinyes durant assajos i actuacions:
1. **Mode edició**: Preparar layout (posicionar figures, afegir elements de referència)
2. **Mode projecció**: Fullscreen per projector/TV — figures amb noms assignats, sense controls
3. **Vista figura individual**: Ampliar una sola figura a pantalla completa

### Nou model de dades

- `FigureInstance` + camps `projectionX`, `projectionY`, `projectionScale`
- Nova entitat `ReferenceElement` (RECTANGLE | ARROW) per event, amb `hiddenInSegments` JSONB

### Nous components

| Component | Descripció |
|-----------|-----------|
| `ProjectionViewComponent` | Pàgina principal, gestiona `viewMode` (segment|figure) + `editMode` |
| `SegmentCanvasComponent` | Konva multi-figura: tronc mini + pinya per figura, elements referència |
| `FigureProjectionComponent` | Fullscreen figura individual: TroncView (projection) + FigureCanvas (readonly) |
| `ReferenceElementToolbarComponent` | Panel lateral (mode edició): afegir/editar/eliminar elements |
| `ProjectionHelpModalComponent` | Modal ajuda: explicació mode edició i projecció |

### Extensions de components existents

- **`TroncViewComponent`**: nou mode `projection` (noms grans, sense controls, sense alçades)
- **`FigureCanvasComponent`**: mode `readonly` ara implementat (noms bold, fitToScreen automàtic)

### Controls de teclat (mode projecció)

| Tecla | Acció |
|-------|-------|
| `←` / `→` | Segment anterior / següent |
| `Escape` | Sortir de vista figura → segment (o mode projecció → mode edició) |
| `F` | Toggle fullscreen natiu del navegador |

### Fases d'implementació (P5.8.1)

| Fase | Contingut | Estat |
|------|-----------|-------|
| **A** | Backend: migració projectionX/Y/Scale + ReferenceElement entity+module | Parcial |
| **B** | Backend: endpoint projection-layout batch + /projection optimitzat | Parcial |
| **C** | Frontend: TroncViewComponent mode projection + FigureCanvas readonly | Parcial |
| **D** | Frontend: SegmentCanvasComponent (Konva multi-figura) | Parcial |
| **E** | Frontend: ProjectionViewComponent complet | Parcial |
| **F** | Frontend: ReferenceElementToolbarComponent + Help Modal + botó "Projectar" | Parcial |

**Fitxers modificats a la branca:**
- `assignment-canvas.component.{html,ts}` — refactoring per projecció
- `figure-canvas.component.ts` — mode `readonly` activat
- `figure-projection.component.{html,ts,spec.ts}` — component nova
- `projection-view.component.{html,ts}` — pàgina principal
- `segment-canvas.component.ts` — rendering multi-figura
- `pinyes.routes.ts` — nova ruta `/project`

---

## 14. Pendents i futur

### Pendent immediat

| Item | Fase |
|------|------|
| Completar P5.8.1 (projecció fullscreen) | P5.8.1 |
| Consulta Històrica (figures per persona/event) | P5.8.2 |
| Revisió UX segments (tab "Pinyes" a event-detail) | P5.3.1 |

### Futur

| Item | Fase |
|------|------|
| PWA mòbil per membres (autogestió assistència) | P6 |
| Estendre auth (rol MEMBER a PWA) | P6 |
| Informes d'assistència | P7 |
| Notificacions (FCM) | P7 |
| Estadístiques | P7 |
| Multi-tenant (collaId al JWT, filtres per colla) | Futur |
| Downgrade de cordó (eliminar cordó amb assignacions) | No planificat |

### Deute tècnic conegut

| Issue | Prioritat | Notes |
|-------|-----------|-------|
| N+1 queries al sync (300 persones = 600 queries) | Baixa | Solució futura: bulk upsert TypeORM |
| Cobertura E2E mínima | Mitjana | Falten tests Playwright de navegació/detall |

---

## 15. Documentació de referència

### Documents principals (`docs/`)

| Document | Descripció |
|----------|-----------|
| [`docs/PROJECT_ROADMAP.md`](docs/PROJECT_ROADMAP.md) | Roadmap complet amb decisions tècniques per fase |
| [`docs/CURRENT_STATUS.md`](docs/CURRENT_STATUS.md) | Estat detallat per mòdul (alguns camps desactualitzats) |
| [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) | Diagrama ER + descripció entitats |
| [`docs/PINYES_MODULE.md`](docs/PINYES_MODULE.md) | Arquitectura completa del mòdul P5 |
| [`docs/AUTH_FLOW.md`](docs/AUTH_FLOW.md) | Fluxos d'autenticació, components, env vars |
| [`docs/SYNC_MERGE_STRATEGY.md`](docs/SYNC_MERGE_STRATEGY.md) | Regles de sincronització amb el legacy |
| [`docs/DASHBOARD_UI.md`](docs/DASHBOARD_UI.md) | Design system, components shared, patterns UX |

### Documentació de codebase (`docs/codebase/`)

| Document | Descripció |
|----------|-----------|
| `ARCHITECTURE.md` | Arquitectura del sistema, flux de dades, patrons |
| `STACK.md` | Stack tecnològic detallat |
| `TESTING.md` | Estratègia de testing, cobertura, convencions |
| `CONVENTIONS.md` | Convencions de codi i nomenclatura |
| `STRUCTURE.md` | Estructura de directoris |
| `INTEGRATIONS.md` | Integracions externes (Docker, Legacy API) |
| `CONCERNS.md` | Deute tècnic resolt |

### Specs aprovades (`docs/specs/`)

| Spec | Fase |
|------|------|
| `2026-03-26-p0-p1-p2-vertical-slice-persons-design.md` | P0–P2 |
| `2026-03-30-vertical-slice-completion-sync-dashboard-design.md` | Sync + Dashboard |
| `2026-04-07-p4-1-auth-layer-design.md` | Auth |
| `2026-04-12-p4-2-dashboard-events-attendance-design.md` | Events + Assistència |
| `2026-04-20-dashboard-design-refactor-design.md` | Design Refactor |
| `2026-05-07-p4-4-docker-local-postgres-design.md` | Docker |
| `2026-05-07-p5-figures-module-overview-design.md` | P5.1 Templates |
| `2026-05-08-p5-2-compositions-design.md` | P5.2 Composicions |
| `2026-05-10-p5-2-1-composition-editor-fixes.md` | P5.2.1 Fixes canvas |
| `2026-05-11-p5-3-event-segments-figure-instances.md` | P5.3 Segments |
| `2026-05-12-p5-4-node-assignment-design.md` | P5.4 Assignació |
| `2026-05-19-p5-family-snapshot-redesign.md` | P5.5 Famílies + Snapshot |
| `2026-05-20-p5-tronc-visualization-design.md` | P5.6 Troncs |
| `2026-05-22-p5-8-1-projection-view-design.md` | P5.8.1 Projecció |

### Rules per a IA (`.cursor/rules/`)

Conté regles d'agent per a: estructura de components Angular, patrons de testing, convencions de codi, etc.

---

*Document generat el 25 de maig de 2026. Actualitzar quan canviï l'estat d'una fase o s'afegeixi nova funcionalitat.*
