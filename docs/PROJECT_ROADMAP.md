# MuixerApp — Roadmap de Projecte

> Document viu que manté la visió general de tots els sub-projectes.
> Actualitzar cada vegada que es comenci o completi una fase.

---

## Estat General

| ID | Sub-projecte | Estat | Spec | Pla | Codi | Notes |
|----|-------------|-------|------|-----|------|-------|
| P0 | Scaffold (Nx + NestJS + Angular + NeonDB) | ✅ Completat | ✅ | ✅ | ✅ | Monorepo funcional |
| P1 | Usuaris + Persones (entitats + CRUD) | ✅ Completat | ✅ | ✅ | ✅ | Entitats i API REST. Model User refactorizat a P4.1 |
| P2 | Data Migration (API legacy → NeonDB) | ✅ Completat | ✅ | ✅ | ✅ | Sync SSE complet, merge strategy implementada |
| P2.1 | Dashboard Persons — UX i funcionalitats avançades | ✅ Completat | ✅ | ✅ | ✅ | Ordenació, alçada relativa, filtres, tests |
| P3 | Temporades + Esdeveniments + Assistència | ✅ Completat | ✅ | — | ✅ | Season + Event + Attendance entities, API, sync + dashboard shell |
| P4.1 | **Auth Layer** — JWT+Passport + refactor User/Person + Dashboard login | ✅ Completat | [`docs/specs/2026-04-07-p4-1-auth-layer-design.md`](docs/specs/2026-04-07-p4-1-auth-layer-design.md) | ✅ | ✅ | Flux complet: login, refresh rotation, guards globals, dashboard login page |
| P4.2 | Dashboard Web — Events + Assistència manual | ✅ Completat | [`docs/specs/2026-04-12-p4-2-dashboard-events-attendance-design.md`](docs/specs/2026-04-12-p4-2-dashboard-events-attendance-design.md) | ✅ | ✅ | CRUD events + attendance, persones provisionals, optimistic UI |
| P4.3 | **Dashboard Design Refactor** — Clean slate visual redesign | ✅ Completat | [`docs/specs/2026-04-20-dashboard-design-refactor-design.md`](docs/specs/2026-04-20-dashboard-design-refactor-design.md) | [`dashboard_design_refactor_3f8d1aed`](.cursor/plans/dashboard_design_refactor_3f8d1aed.plan.md) | ✅ | Top nav + tabs, 15+ shared components, Home tab, sync UI, Pinyes/Config placeholders |
| **P4.4** | **Arquitectura Docker Multi-entorn** | ✅ Completat | [`docs/specs/2026-05-07-p4-4-docker-local-postgres-design.md`](docs/specs/2026-05-07-p4-4-docker-local-postgres-design.md) | ✅ | ✅ | Docker local dev + Dockerfile multi-stage + docker-compose.prod.yml VPS. NeonDB eliminat del flux de dev |
| **P5.1** | **Mòdul Pinyes — Templates i Editor Visual** | ✅ Completat | [`docs/specs/2026-05-07-p5-figures-module-overview-design.md`](docs/specs/2026-05-07-p5-figures-module-overview-design.md) | [`p5.1_templates_editor_2859060d`](.cursor/plans/p5.1_templates_editor_2859060d.plan.md) | ✅ | Backend CRUD FigureTemplate+FigureNode, NodeShape enum, Konva editor (pinya + tronc), llistat templates, auto-save. TroncWidget: pisos seqüencials P1–P6 amb opcions per pis, +/- posicions per fila, dropdown cap avall, panel propietats simplificat |
| P5.2 | Mòdul Pinyes — Composicions | ⚪ Pendent | — | — | — | CompositionTemplate + CompositionSlot. Editor per agrupar figures amb offsets |
| P5.3 | Mòdul Pinyes — Segments i Instàncies | ⚪ Pendent | — | — | — | EventSegment + FigureInstance. Tab "Pinyes" a event-detail. Segments reordenables |
| P5.4 | Mòdul Pinyes — Assignació de Persones | ⚪ Pendent | — | — | — | NodeAssignment. Canvas d'assignació amb panel lateral, cercador i auto-avançament |
| P5.5 | Mòdul Pinyes — Projecció i Consulta Històrica | ⚪ Pendent | — | — | — | Mode fullscreen TV/projector. Consulta events passats |
| P6 | PWA Mòbil | ⚪ Pendent | — | — | — | Diferit fins al tall. Estén l'auth de P4.1 als membres |
| P7 | Informes + Notificacions + Features avançades | ⚪ Pendent | — | — | — | Reports d'assistència, FCM, estadístiques, notícies |

**Llegenda:** ⚪ Pendent | 🟡 Dissenyant | 🔵 En curs | ✅ Completat | ❌ Cancel·lat

---

## Dependències entre Sub-projectes

```
P0 (Scaffold)
 ├── P1 (Usuaris + Persones) ──┬── P3 (Events + Assistència)
 │                              │
 └── P2 (Data Migration) ───────┤
                                 └── P4.1 (Auth Layer) ← prerequisit seguretat
                                          └── P4.2 (Dashboard Events + Assistència)
                                                  └── P5 (Pinyes i Figures)
                                                          └── P6 (PWA Mòbil)
                                                                  └── P7 (Informes + Notificacions)

Decisions clau d'ordre:
  - P4.1 primer: cal auth per desplegar a servidor sense exposar l'API
  - P5 avançat respecte PWA: dades legacy suficients per validar canvas amb tècnics
  - P6 diferit: membres seguiran usant el legacy fins al tall oficial
  - P6 reutilitza l'AuthModule de P4.1 sense reimplementar-lo
```

---

## Decisions Tecnològiques

| Decisió | Resultat | Data |
|---------|----------|------|
| Backend framework | NestJS | Mar 2026 |
| Frontend framework | Angular 20+ (standalone, signals) | Mar 2026 |
| Mòbil | PWA (sense Ionic) | Mar 2026 |
| Base de dades | PostgreSQL (Docker local dev / VPS prod) | Mar 2026 → Mai 2026 (P4.4) |
| Monorepo | Nx | Mar 2026 |
| Docker en dev | Sí — PostgreSQL en contenidor (dev) + docker-compose.prod.yml (VPS) | Mai 2026 (P4.4) |
| Idioma UI | Català | Mar 2026 |
| Idioma codi | Anglès | Mar 2026 |
| Multi-tenant | Sí (futur, rol ADMIN) | Mar 2026 |
| ORM | TypeORM | Mar 2026 |
| Auth strategy | JWT+Passport (access 15min + refresh 7d). Implementat a P4.1, estès a P6 | Abr 2026 |
| Token storage (Dashboard) | Memòria/signal (access token) + `httpOnly cookie` (refresh token) | Abr 2026 |
| CORS | Array d'orígens via `CORS_ORIGINS` env (Dashboard + PWA) | Abr 2026 |
| Canvas library (pinyes i figures) | `konva` (API imperativa directa, sense `ng2-konva` — incompatible amb Angular 20+) | Mai 2026 (P5.1) |

---

## Decisions sobre el Mòdul Pinyes i Figures (P5)

### P5.1 — Templates i Editor Visual (✅ Completat)

#### Què s'ha implementat

**Backend** (`apps/api/src/modules/figure/`):
- Entitats TypeORM `FigureTemplate` + `FigureNode` (taules `figure_templates` + `figure_nodes`)
- Enum `NodeShape` (`ELLIPSE`, `RECTANGLE`) a `libs/shared/`
- `FigureModule` amb 6 endpoints REST: llistat (cerca + paginació), detall, crear, actualitzar (sync inline de nodes), eliminar, duplicar
- Sync de nodes al `PUT`: crea nous, actualitza existents, elimina els que ja no estan (amb protecció si té `NodeAssignment`s)
- Tests unitaris: `figure-template.service.spec.ts` + `figure-template.controller.spec.ts`

**Frontend** (`apps/dashboard/src/app/features/pinyes/`):
- `TemplateListComponent`: llistat de templates amb tabs "Figures" / "Composicions" (tab Composicions en placeholder per P5.2), cards amb accions Editar / Duplicar / Eliminar (confirm-dialog)
- `FigureCanvasComponent`: canvas Konva reutilitzable amb:
  - **Pinya layer** (zona principal): nodes `PINYA` + nodes `TRONC` z=0 (baixos)
  - **Tronc layer** (panel lateral dret): tots els nodes `TRONC` agrupats per pis (`z`). Toggle "Mostrar/Ocultar vista Tronc" a la toolbar
  - Grid de guia configurable (toggle + mida), snap-to-grid opcional
  - Zoom (scroll wheel) + pan (click drag fons / botó central)
  - Drag de nodes per reposicionar. Resize i rotate via Konva Transformer
  - Edició inline d'etiquetes amb doble-click (input flotant sobre el canvas)
  - Outputs per `nodeMoved`, `nodeResized`, `nodeRotated`, `nodeLabelChanged`, `nodeSelected`
- `TemplateEditorComponent`: editor complet de pàgina amb:
  - Toolbar lateral: afegir nodes per zona (PINYA, TRONC, FIGURE_DIRECTION, XICALLA_DIRECTION) i `positionType`, eliminar node seleccionat, undo
  - Panel de propietats col·lapsable (dreta): label, zona, positionType, color, shape, dimensions, rotació, climbPath
  - Top bar: nom/slug editable, toggle `hasPinya`, botó torn enrere, indicador d'estat de save
  - Auto-save amb debounce 2s: `PUT /api/figure-templates/:id` amb llista completa de nodes
  - Nou template: primer `POST`, després redirect a mode edició amb ID retornat
- `CanvasStateService`: zoom, panOffset, selectedNodeId, gridEnabled, gridSpacing, troncVisible (signals)
- `FigureTemplateService` (dashboard): extends `ApiService`, mètodes `getAll`, `getOne`, `create`, `update`, `delete`, `duplicate`

#### Decisió tècnica clau

`ng2-konva` descartat per incompatibilitat amb Angular 20+. S'usa `konva` directament amb **API imperativa** wrapped dins un component Angular. Els `effect()` de signals disparen re-renders del canvas.

#### Queda pendent a P5

| Fase | Objectiu | Depèn de |
|------|----------|----------|
| **P5.2** | Composicions (`CompositionTemplate` + `CompositionSlot`). Editor per agrupar figures amb offsets | P5.1 |
| **P5.3** | Segments i Instàncies (`EventSegment` + `FigureInstance`). Tab "Pinyes" a event-detail. Segments reordenables drag-handle | P5.1 + P5.2 |
| **P5.4** | Assignació de persones (`NodeAssignment`). Canvas d'assignació, panel lateral, cercador filtrat, auto-avançament | P5.3 |
| **P5.5** | Projecció fullscreen (TV/projector) + consulta historial figures per persona/event | P5.4 |

---

## Decisions sobre el Dashboard Design Refactor (P4.3)

### Objectius del refactor

Refactorització completa de la capa visual del Dashboard, mantenint intacta tota la lògica TypeScript (services, models, signals). Enfocament "clean slate" per crear una UX intuïtiva per usuaris no experts.

### Canvis clau implementats

| Àrea | Abans | Després |
|------|-------|---------|
| **Navegació** | Sidebar drawer amb menú lateral | Top navigation bar amb tabs (Inici, Persones, Assajos, Actuacions, Pinyes, Configuració) |
| **Design System** | CSS vars legacy + tema DaisyUI fix | `generateCollaTheme(primaryHex)` — genera paleta completa des d'un sol color amb contrast WCAG automàtic |
| **Components** | DaisyUI inline en templates | 15+ components reutilitzables (page-header, data-table, pagination, filter-bar, toast, etc.) |
| **Tipografia** | Sistema per defecte | Inter (Google Fonts) a tots els textos |
| **Icones** | SVG inline | Lucide Angular (moderna, consistent) |
| **Layout** | Drawer + sidebar | `flex-col` amb Brand Bar + Tab Bar + content area |
| **Responsive** | Menú lateral col·lapsable | Desktop (icon+text) → Tablet (icon) → Mobile (dropdown) |
| **Home** | Redirect directe a /persons | Pàgina d'inici amb preview de dades, cards de navegació, accés sync legacy |
| **Fullscreen mode** | No disponible | `LayoutService` signal per Pinyes (futur) |

### Artifacts creats

- **Spec completa**: `docs/specs/2026-04-20-dashboard-design-refactor-design.md` (485 línies)
- **Pla d'implementació**: 7 fases seqüencials amb Mermaid diagrams
- **15+ components shared**: `apps/dashboard/src/app/shared/components/{data,feedback,forms}/`
- **3 nous mòduls**: Home, Sync (global), Config (placeholders)
- **Reducció codi**: ~80% menys HTML als templates refactoritzats (421→100 línies person-list)

### Abast del refactor

| Component/Pàgina | Línies abans | Línies després | Reducció |
|------------------|--------------|----------------|----------|
| `person-list.component.html` | 421 | ~100 | 76% |
| `event-list.component.html` | 394 | ~100 | 75% |
| `person-detail.component.html` | 236 | ~120 | 49% |
| `event-detail.component.html` | 410 | ~180 | 56% |
| `login.component.html` | 76 | ~70 | 8% |

### Preparació per futures fases

- **Pinyes (P5)**: Estructura creada, `LayoutService.requestFullscreen()` disponible
- **Config (P7)**: Skeleton amb sub-rutes (users, tags, seasons)
- **Legacy sync**: UI global + per entitat, marcat com a temporal

---

## Decisions sobre Rols i Permisos

### Model de Rols

| Rol | Àmbit | Descripció |
|-----|-------|-----------|
| `ADMIN` | Futur multi-tenant | Administrador de sistema. Gestió de múltiples colles. Reservat per quan s'implementi multi-tenant |
| `TECHNICAL` | Dashboard + PWA | Tècnic de la colla. Accés complet al Dashboard (inclosa gestió d'usuaris). Funcionalitats extra a la PWA |
| `MEMBER` | PWA | Membre de la colla. Gestió de la pròpia assistència i visualització d'events |

### Jerarquia de Permisos (actual, pre-multi-tenant)

```
TECHNICAL = accés total (Dashboard + PWA completa)
MEMBER    = PWA només (autogestió + visualització)
ADMIN     ≡ TECHNICAL (fins que s'implementi multi-tenant)
```

> **Nota multi-tenant (futur):** Quan s'implementi multi-tenant, `ADMIN` passarà a ser un super-rol transversal de colles. `TECHNICAL` serà el rol màxim dins d'una colla concreta. Això requerirà afegir `collaId` al JWT i un guard de tenant.

### Matriu de permisos per funcionalitat

| Funcionalitat | MEMBER | TECHNICAL | ADMIN |
|---|:---:|:---:|:---:|
| **PWA** — veure propis events i assistència | ✅ | ✅ | ✅ |
| **PWA** — confirmar/cancel·lar pròpia assistència | ✅ | ✅ | ✅ |
| **PWA** — veure llista de confirmats per event | ❌ | ✅ | ✅ |
| **PWA** — accedir al mòdul pinyes (visualització) | ❌ | ✅ | ✅ |
| **Dashboard** — gestió de persones | ❌ | ✅ | ✅ |
| **Dashboard** — gestió d'events i assistència | ❌ | ✅ | ✅ |
| **Dashboard** — mòdul pinyes i figures | ❌ | ✅ | ✅ |
| **Dashboard** — gestió d'usuaris (comptes) | ❌ | ✅ | ✅ |
| **Dashboard** — configuració del sistema | ❌ | ❌ | ✅ |

---

## Decisions sobre el Dashboard Design Refactor (P4.3)

### Enfocament: Clean Slate Visual

Refactorització completa de la capa de presentació sense tocar la lògica de negoci. Objectiu: UX intuïtiva per usuaris no experts, disseny escalable per futures funcionalitats (Pinyes, Config).

### Arquitectura del refactor (7 fases seqüencials)

```
F1: Design System → F2: Layout Shell → F3: Shared Components
                                            ├→ F4: Home Tab
                                            ├→ F5: Llistes
                                            └→ F6: Detalls + Sync + Login
                                                    └→ F7: Placeholders + Cleanup
```

### Components Shared creats

**Data** (`shared/components/data/`):
- `page-header` — Títol + badge contador + slot per botons d'acció
- `data-table` — Generic `<T>` amb sort, skeleton, group-separator, row-actions, sticky columns
- `column-toggle` — Collapse amb checkboxes per mostrar/amagar columnes
- `filter-bar` — Container flexible per inputs de filtre + boto "Netejar"
- `active-filters` — Badges dismissibles dels filtres actius
- `pagination` — Join buttons + selector limit + info de registres
- `empty-state` — Card amb icona Lucide + missatge + acció opcional
- `stat-card` — DaisyUI `stat` per mètriques

**Feedback** (`shared/components/feedback/`):
- `skeleton-rows`, `skeleton-cards` — Loading states animats
- `confirm-dialog` — Modal DaisyUI amb confirmació/cancel·lació
- `toast` + `ToastService` — Sistema de notificacions auto-dismiss (4s)

**Forms** (`shared/components/forms/`):
- `form-field` — Wrapper consistent per labels, errors, helper text

**Layout** (`shared/components/layout/`):
- `tab-nav` — Navegació responsive amb tabs
- `header` — Brand bar amb logo + user-chip slot
- `user-chip` — Avatar + dropdown amb logout (mantingut de P4.1)

### Millores UX implementades

| Feature | Implementació |
|---------|---------------|
| **Home page** | Cards de navegació, preview pròxim assaig/actuació amb comptadors d'assistència, bloc sync legacy, accés ràpid a config |
| **Event lists** | Separador visual per events passats, `opacity-60` per files passades, ordenació per data ASC per defecte |
| **Sync pages** | UI unificada amb progress bar, log en temps real, alertes warnings |
| **Mobile UX** | Dropdown DaisyUI per menú, scroll horitzontal en taules |
| **Fullscreen mode** | `LayoutService` amb Escape listener per Pinyes (futur) |

### Breaking changes

- **`data-theme="colla-barcelona"` obligatori** a `<html>` (aplicat automàticament a `index.html`)
- **Color primari dinàmic**: modificar `generateCollaTheme('#HEX')` a `tailwind.config.js` per canviar el tema
- **`SidebarComponent` eliminat** — totes les referències netejades
- **CSS vars legacy eliminades** — tots els estils via tokens DaisyUI

### Build status

✅ Compilació exitosa en 4.2s  
✅ Bundle principal: 181.76 kB (initial)  
✅ Lazy chunks: 124.64 kB (event-detail), 56.95 kB (modals), 34.99 kB (person-list), 33.95 kB (event-list)  
✅ Zero errors TypeScript

---

## Decisions sobre el Model User / Person (P4.1)

### Relació User ↔ Person

Un `User` és el compte d'accés. Un `Person` és el membre real de la colla. Estan desacoblats per disseny:

```
User (compte d'accés)
 ├── pot tenir cap Person linked  → admin/tècnic "de sistema" sense registre físic a la colla
 └── pot tenir un Person linked   → tècnic o membre que també és part de la colla

Person (membre de la colla)
 ├── pot no tenir User            → existeix per planificació de pinyes, pendent d'onboarding
 └── pot tenir User linked        → ha completat l'onboarding, pot gestionar pròpia assistència
```

### Flux d'onboarding d'un membre

```
[Admin/Tècnic crea Person]
        ↓
[Person existeix: planificació de pinyes possible]
        ↓
[Invite link enviat a Person.email]
        ↓
[Membre crea contrasenya → User creat i linked a Person]
        ↓
[Membre accedeix a PWA amb rol MEMBER]
```

### Canvis al model respecte P1 (aplicats a P4.1)

| Camp | Entitat | Canvi | Raó |
|------|---------|-------|-----|
| `email` | `User` | **AFEGIR** | Credencial de login. Font: `Person.email` durant onboarding |
| `person` | `User` | **AFEGIR** `OneToOne Person \| null` | Referència directa al Person del usuari. Nullable (admins sense Person) |
| `user` | `Person` | **AFEGIR** `OneToOne User \| null` (back-ref) | Permet saber si un Person ja té compte |
| `isMainAccount` | `Person` | **ELIMINAR** | Substituït per `User.person` (OneToOne explícit) |
| Import `OneToMany` | `User` | **NETEJAR** | Importat però no usat |

---

## Decisions sobre el Mòdul Assistència (P4 + P6)

### ✅ Edició manual per tècnics (Dashboard — P4.2) — Implementat

El sync des del legacy és unidireccional i no detecta automàticament "va dir que venia però no va aparèixer". Per cobrir-ho:

| Feature | Rol | Estat | Descripció |
|---------|-----|-------|-----------|
| CRUD esdeveniments | Tècnic, Admin | ✅ | Crear, editar (modal), eliminar (protecció 409 si té assistència) |
| Editar estat d'assistència | Tècnic, Admin | ✅ | Modal per canviar estat + notes de qualsevol membre per a un event |
| Afegir registres d'assistència | Tècnic, Admin | ✅ | Cercar persona existent o crear persona provisional inline |
| Eliminar registres d'assistència | Tècnic, Admin | ✅ | Des del modal d'edició amb confirmació |
| Llista de confirmats | Tècnic, Admin | ✅ | Toggle filtre per estat ANIRE/ASSISTIT |
| Persones provisionals | Tècnic, Admin | ✅ | Creació ràpida amb prefix `~`, promoció/democió, filtre al llistat |
| Recàlcul automàtic summary | — | ✅ | `attendanceSummary` es recalcula a cada operació CRUD |

> **Decisió P4.2:** es va descartar el flag `manuallyOverridden` per simplificar el desenvolupament. Es reconsiderarà si cal en futures fases.

### Autogestió per membres (PWA — P6)

| Feature | Descripció |
|---------|-----------|
| Confirmar assistència | Canviar el propi estat a `ANIRE` |
| Cancel·lar assistència | Canviar el propi estat a `NO_VAIG` |
| Marcar com a pendent | Deixar l'estat en `PENDENT` |
| Afegir nota | Afegir context (p.ex. "Arribo tard") |

> Prerequisit: `AuthModule` implementat a P4.1.

---

## Decisions sobre el Mòdul Persones (P2.1)

| Decisió | Resultat |
|---------|----------|
| Filtres de llista | Mantenir "Actius"; eliminar botons "Membres" i "Xicalla" |
| Ordenació | Server-side, whitelist estricta de camps |
| Vista mòbil | Taula sempre (scroll horitzontal) |
| Alçada espatlles | Baseline 140 cm, toggle per sessió, colors per tonalitat |
| Selector de columnes | Col·lapsable per defecte; persistit en `localStorage` |
| Paginació | Opcions 25/50/100 per pàgina |

---

## Flux de Treball per Sub-projecte

```
Brainstorming → Spec Document → Implementation Plan → Codi → Tests → Review
```

Cada sub-projecte genera:
1. **Spec** → `docs/specs/YYYY-MM-DD-<topic>-design.md`
2. **Pla** → Implementation plan amb tasques ordenades
3. **Codi** → Feature branch → PR → merge

---

## Documents de Referència

| Document | Ubicació | Descripció |
|----------|----------|------------|
| Kickoff equip | `TEAM_KICKOFF.md` | Decisions, arquitectura, flux assistència |
| Model de dades | `DATA_MODEL.md` | Entitats TypeScript |
| Auth flow | `AUTH_FLOW.md` | Fluxos d'autenticació, components, variables |
| Dashboard UI | [`DASHBOARD_UI.md`](DASHBOARD_UI.md) | Design system, components shared, patterns UX (P4.3) |
| API legacy | `API_APPSISTENCIA.md` | Endpoints de l'app actual per migració |
| PRD complet | `docs/prd/` | Requirements, user stories, security |
| Rules Cursor | `.cursor/rules/` | Regles per l'agent AI |

---

## Convencions de Codi i UX

| Aspecte | Decisió | Notes |
|---------|---------|-------|
| Idioma UI | Català | Tots els textos, botons, labels, missatges d'error |
| Idioma codi | Anglès | Variables, funcions, enums, endpoints, commits |
| Components Angular | 2 fitxers preferits | `.ts` + `.html` (inline template per components petits). `.scss` només si necessari (des de P4.3: Tailwind/DaisyUI purs) |
| Canvi de detecció | `OnPush` | Tots els components |
| Estat reactiu | Signals (`signal`, `computed`, `effect`) | Evitar `BehaviorSubject` per estat local |
| Estils | DaisyUI v4 + Tailwind v3 | Cap Tailwind v4 fins nova decisió. Des de P4.3: zero custom CSS, tokens DaisyUI purs |
| Alçada d'espatlles | Baseline 140 cm | Display absolut (cm) o relatiu (+/-) configurable per usuari |
| Tema i colors | `generateCollaTheme(primaryHex)` | Un sol color hex → paleta completa DaisyUI amb contrast WCAG automàtic (P4.3) |
| Navegació | Top navigation bar amb tabs | Desktop: icon+text, Tablet: icon, Mobile: dropdown (des de P4.3) |
| Icones | Lucide Angular | Moderna, consistent, tree-shakeable (des de P4.3) |
| Font | Inter (Google Fonts) | Sans-serif professional per tota l'aplicació (des de P4.3) |

---

## Històric

| Data | Acció |
|------|-------|
| Mar 2026 | Inici brainstorming P0. Decisions stack confirmades. |
| 26 Mar 2026 | Spec P0+P1+P2 aprovat (`docs/specs/2026-03-26-p0-p1-p2-vertical-slice-persons-design.md`). |
| 30 Mar 2026 | Spec Sync + Dashboard aprovat. Implementació SSE, merge strategy, Person List/Detail/Sync. |
| 31 Mar 2026 | P2.1 completat: ordenació server-side, alçada relativa, UX persones, tests (34 API + 16 dashboard). |
| 7 Abr 2026 | Reordenació roadmap: P4.1 Auth Layer (prerequisit seguretat), P5 Pinyes avançat, P6 PWA diferit. Decisions rols, model User/Person i estratègia auth documentades. |
| 9 Abr 2026 | Spec P4.1 Auth Layer aprovada i escrita (`docs/specs/2026-04-07-p4-1-auth-layer-design.md`). |
| 9 Abr 2026 | **P4.1 Auth Layer completat**: backend AuthModule (JWT+Passport, refresh rotation, 7 endpoints, guards globals), frontend AuthService (signals), interceptor (401→refresh→retry), guards, login page DaisyUI. Tests backend + frontend. |
| 12 Abr 2026 | Spec P4.2 aprovada (`docs/specs/2026-04-12-p4-2-dashboard-events-attendance-design.md`). |
| 12 Abr 2026 | **P4.2 Dashboard Events + Attendance completat**: CRUD events (POST/PUT/DELETE), CRUD attendance, persones provisionals (`isProvisional` + prefix `~`), Event Form Modal, Attendance Edit Modal, Person Search Input, tabs Cens/Provisionals al llistat, optimistic UI. |
| 20 Abr 2026 | Brainstorming P4.3 Dashboard Design Refactor iniciat. Decisions: top nav, Home tab, Inter font, Lucide icons, theme generator, full-screen mode per Pinyes. |
| 20 Abr 2026 | Spec P4.3 aprovada (`docs/specs/2026-04-20-dashboard-design-refactor-design.md`). |
| 20 Abr 2026 | **P4.3 Dashboard Design Refactor completat** (7 fases): generateCollaTheme() amb WCAG, sidebar→tabs, 15+ components shared (page-header, data-table, pagination, filter-bar, toast, etc), Home tab amb preview events, refactor complet de person-list/event-list/detail/sync/login, Pinyes + Config placeholders. Reducció ~80% HTML. Build OK en 4.2s. |
| 24 Abr 2026 | **CI/CD activat**: GitHub Actions amb lint + test + build (affected per PRs, all per push). Coverage enforçat (`--configuration=ci`). |
| 24 Abr 2026 | **Deute tècnic CONCERNS.md resolt**: temporades dinàmiques (`loadOrCreateSeasons()`), ToastService integrat a event-detail + person-detail, codi mort eliminat (form-field, confirm-dialog, seed), coverage threshold (70%), refresh token cleanup (`@Cron` diari). |
| 27 Abr 2026 | **Documentació de codebase completa**: 8 documents creats (`docs/codebase/`): ARCHITECTURE, STACK, TESTING, CONCERNS, CONVENTIONS, STRUCTURE, INTEGRATIONS. JSDoc inline restaurat. |
| 7 Mai 2026 | **Documentació actualitzada** amb canvis recents. **P4.4 planificada**: Migració a PostgreSQL Docker local. |
| 7 Mai 2026 | **P4.4 Arquitectura Docker Multi-entorn completada**: docker-compose.yml (dev), Dockerfile multi-stage API, docker-compose.prod.yml (VPS), DB_SSL env var, seed-seasons script, docs DOCKER_ARCHITECTURE + DOCKER_SETUP. NeonDB eliminat del flux de dev. |
| 7 Mai 2026 | **Spec P5 aprovada** (`docs/specs/2026-05-07-p5-figures-module-overview-design.md`): Mòdul complet Pinyes amb 5 sub-fases (P5.1→P5.5), model de dades (7 entitats), API (20+ endpoints), arquitectura Konva, UX canvas. Decisió: `konva` API imperativa (sense `ng2-konva`). |
| 7 Mai 2026 | **P5.1 Templates i Editor Visual completat** (7 tasques): Backend — `FigureTemplate`+`FigureNode` entities, `NodeShape` enum, 6 endpoints CRUD+duplicate, tests unitaris. Frontend — `TemplateListComponent` (llistat amb tabs Figures/Composicions, accions CRUD), `FigureCanvasComponent` (Konva stage: pinya layer + tronc layer togglable, grid, zoom/pan, snap-to-grid, drag, resize, rotate, edició inline etiquetes), `TemplateEditorComponent` (toolbar lateral, panel propietats, auto-save 2s debounce, indicador estat). |
| 7 Mai 2026 | **TroncWidget refinat**: icones Lucide registrades (Building2, List, ArrowDown/Up, ChevronUp, Minus). Dropdown "Afegir pis" ara cap avall amb opcions per pis (P1=Baix directe, P2–P6 amb selector Segon/Terç/Quart/Quint/Alçadora/Xiqueta). Màxim 6 pisos, creació seqüencial. Botons +/− per fila per afegir/treure posicions. Panel propietats simplificat per TRONC (zona, positionType, sortOrder, climbPath ocults). Pre-existing test fixes: `role: UserRole[]` array en tests user-list/user-service/login; grantRole URL; role.guard TestBed reset. Tests: ✅ 258 API + 148 dashboard. |
