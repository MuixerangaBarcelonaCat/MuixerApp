# MuixerApp — Roadmap de Projecte

> Document viu que manté la **visió general** de tots els sub-projectes. És un mapa, no un arxiu.
> Actualitzar la taula `Estat General` cada vegada que es comenci o completi una fase.
>
> - **Detall tècnic per fase** → docs dedicats (`PINYES_MODULE.md`, `DASHBOARD_UI.md`, `DATA_MODEL.md`…) i specs (enllaçats a la taula).
> - **Història cronològica completa** → [PHASES_LOG.md](PHASES_LOG.md).
> - **Estat actual detallat** → [CURRENT_STATUS.md](CURRENT_STATUS.md).

---

## Estat General

| ID | Sub-projecte | Estat | Spec | Pla | Codi | Notes |
|----|-------------|-------|------|-----|------|-------|
| P0 | Scaffold (Nx + NestJS + Angular + NeonDB) | ✅ Completat | ✅ | ✅ | ✅ | Monorepo funcional |
| P1 | Usuaris + Persones (entitats + CRUD) | ✅ Completat | ✅ | ✅ | ✅ | Entitats i API REST. Model User refactorizat a P4.1 |
| P2 | Data Migration (API legacy → NeonDB) | ✅ Completat | ✅ | ✅ | ✅ | Sync SSE complet, merge strategy implementada |
| P2.1 | Dashboard Persons — UX i funcionalitats avançades | ✅ Completat | ✅ | ✅ | ✅ | Ordenació, alçada relativa, filtres, tests |
| P3 | Temporades + Esdeveniments + Assistència | ✅ Completat | ✅ | — | ✅ | Season + Event + Attendance entities, API, sync + dashboard shell |
| P4.1 | **Auth Layer** — JWT+Passport + refactor User/Person + Dashboard login | ✅ Completat | [`spec`](specs/2026-04-07-p4-1-auth-layer-design.md) | ✅ | ✅ | Login, refresh rotation, guards globals, dashboard login. Detall: [AUTH_FLOW.md](AUTH_FLOW.md) |
| P4.2 | Dashboard Web — Events + Assistència manual | ✅ Completat | [`spec`](specs/2026-04-12-p4-2-dashboard-events-attendance-design.md) | ✅ | ✅ | CRUD events + attendance, persones provisionals, optimistic UI |
| P4.3 | **Dashboard Design Refactor** — Clean slate visual redesign | ✅ Completat | [`spec`](specs/2026-04-20-dashboard-design-refactor-design.md) | ✅ | ✅ | Top nav + tabs, 15+ shared components, Home tab. Detall: [DASHBOARD_UI.md](DASHBOARD_UI.md) |
| P4.4 | **Arquitectura Docker Multi-entorn** | ✅ Completat | [`spec`](specs/2026-05-07-p4-4-docker-local-postgres-design.md) | ✅ | ✅ | Docker local dev + Dockerfile multi-stage + prod VPS. Detall: [DOCKER_ARCHITECTURE.md](DOCKER_ARCHITECTURE.md) |
| P5.1 | **Pinyes** — Templates i Editor Visual | ✅ Completat | [`spec`](specs/2026-05-07-p5-figures-module-overview-design.md) | ✅ | ✅ | Backend CRUD FigureTemplate+FigureNode, Konva editor (pinya+tronc), auto-save |
| P5.2 | **Pinyes** — Composicions | ✅ Completat | [`spec`](specs/2026-05-08-p5-2-compositions-design.md) | ✅ | ✅ | CompositionModule + CompositionEditorComponent (canvas multi-figura). P5.2.1: fixes canvas + UX |
| P5.3 | **Pinyes** — Segments i Instàncies | ✅ Completat | — | — | ✅ | EventSegmentModule + SegmentManagerComponent inline. Pendent: revisió UX (P5.3.1) |
| P5.3.1 | Pinyes — Revisió UX Segments | ⚪ Pendent | — | — | — | Tab dedicat "Pinyes" a event-detail, preview canvas, navegació fluida |
| P5.4 | **Pinyes** — Assignació de Persones | ✅ Completat | [`spec`](specs/2026-05-11-p5-3-event-segments-figure-instances.md) | ✅ | ✅ | NodeAssignment + AssignmentCanvas + PersonPanel, optimistic UI, pick-and-place |
| P5.5 | **Pinyes** — Famílies, Snapshot i Creixement Concèntric | ✅ Completat | [`spec`](specs/2026-05-19-p5-family-snapshot-redesign.md) | — | ✅ | FigureFamily+InstanceNode, lazy snapshot, upgrade de cordó, upsert estable |
| P5.6 | **Pinyes** — Visualització i Assignació de Troncs | ✅ Completat | [`spec`](specs/2026-05-20-p5-tronc-visualization-design.md) | — | ✅ | TroncViewComponent (CSS Grid), unitats relatives 0.5u–8u, variance per pis |
| P5.7 | **Pinyes** — Tronc Nodes a Nivell de Família | ✅ Completat | — | — | ✅ | FigureFamilyNode (TRONC/BASE shared), merge/split transparent, migració idempotent |
| P5.8 | **Pinyes** — Convenció d'ordre de les Bases | ✅ Completat | — | — | ✅ | Convenció CCW, `validateBaseOrdering()`, badge + modal d'ajuda |
| P5.8.1 | **Pinyes** — Vista de Projecció (inicial) | ✅ Completat | [`spec`](specs/2026-05-22-p5-8-1-projection-view-design.md) | — | ✅ | ProjectionView + SegmentCanvas Konva. Substituït per grid CSS a P5.9 |
| P5.9 | **Pinyes** — Vista de Projecció (refinada) | ✅ Completat | — | — | ✅ | Grid CSS responsive, vista Troncs `?view=troncs`, panells flotants, HUD navegació |
| P5.10 | **Pinyes** — Posicions, Lock i Historials | ✅ Completat | [`spec`](specs/2026-05-26-p5-10-positions-lock-history-design.md) | ✅ | ✅ | PositionModule + lock automàtic + filtre per posició + historials (persona/event/família) |
| P5.11 | **Pinyes** — Integració de Rengles | ✅ Completat | [`spec`](specs/2026-05-28-rengles-integration-spec.md) | ✅ | ✅ | Rengla entity, editor de rengles, ghost clone, selector de cordons, projecció filtrada |
| P6 | PWA Mòbil | ⚪ Pendent | — | — | — | Diferit fins al tall. Estén l'auth de P4.1 als membres |
| P7 | Informes + Notificacions + Features avançades | ⚪ Pendent | — | — | — | Reports d'assistència, FCM, estadístiques, notícies |

**Llegenda:** ⚪ Pendent | 🟡 Dissenyant | 🔵 En curs | ✅ Completat | ❌ Cancel·lat

> El detall complet de cada fase del **Mòdul Pinyes (P5.x)** viu a [PINYES_MODULE.md](PINYES_MODULE.md)
> (conceptes de domini, model de dades, cicle de vida, upgrade, API, arquitectura frontend, troncs,
> famílies, convenció de bases, projecció). Vegeu també les specs enllaçades a la taula.

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

## On trobar el detall d'implementació

El roadmap no duplica el detall tècnic. Cada tema té un doc autoritzat:

| Tema | Document |
|------|----------|
| Mòdul Pinyes (P5.x) — domini, model, cicle de vida, API, frontend | [PINYES_MODULE.md](PINYES_MODULE.md) |
| Dashboard UI — design system, components shared, patterns (P4.3) | [DASHBOARD_UI.md](DASHBOARD_UI.md) |
| Model de dades — entitats, camps, relacions, model User/Person | [DATA_MODEL.md](DATA_MODEL.md) |
| Autenticació — login, refresh, guards, variables | [AUTH_FLOW.md](AUTH_FLOW.md) |
| Sincronització legacy | [SYNC_ARCHITECTURE.md](SYNC_ARCHITECTURE.md) |
| Docker (dev + VPS prod) | [DOCKER_ARCHITECTURE.md](DOCKER_ARCHITECTURE.md) · [DOCKER_SETUP.md](DOCKER_SETUP.md) |
| Estat actual del projecte | [CURRENT_STATUS.md](CURRENT_STATUS.md) |
| Història cronològica de fases | [PHASES_LOG.md](PHASES_LOG.md) |

---

## Rols i Permisos

### Model de Rols

| Rol | Àmbit | Descripció |
|-----|-------|-----------|
| `ADMIN` | Futur multi-tenant | Administrador de sistema. Gestió de múltiples colles. Reservat per quan s'implementi multi-tenant |
| `TECHNICAL` | Dashboard + PWA | Tècnic de la colla. Accés complet al Dashboard (inclosa gestió d'usuaris). Funcionalitats extra a la PWA |
| `MEMBER` | PWA | Membre de la colla. Gestió de la pròpia assistència i visualització d'events |

### Jerarquia (actual, pre-multi-tenant)

```
TECHNICAL = accés total (Dashboard + PWA completa)
MEMBER    = PWA només (autogestió + visualització)
ADMIN     ≡ TECHNICAL (fins que s'implementi multi-tenant)
```

> **Nota multi-tenant (futur):** `ADMIN` passarà a ser un super-rol transversal de colles; `TECHNICAL` serà el rol màxim dins d'una colla. Requerirà afegir `collaId` al JWT i un guard de tenant.

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

## Convencions de Codi i UX

| Aspecte | Decisió | Notes |
|---------|---------|-------|
| Idioma UI | Català | Tots els textos, botons, labels, missatges d'error |
| Idioma codi | Anglès | Variables, funcions, enums, endpoints, commits |
| Components Angular | 2 fitxers preferits | `.ts` + `.html` (inline per components petits). `.scss` només si necessari |
| Canvi de detecció | `OnPush` | Tots els components |
| Estat reactiu | Signals (`signal`, `computed`, `effect`) | Evitar `BehaviorSubject` per estat local |
| Estils | DaisyUI v4 + Tailwind v3 | Zero custom CSS, tokens DaisyUI purs (des de P4.3) |
| Alçada d'espatlles | Baseline 140 cm | Display absolut (cm) o relatiu (+/-) configurable per usuari |
| Tema i colors | `generateCollaTheme(primaryHex)` | Un sol color hex → paleta DaisyUI amb contrast WCAG automàtic (P4.3) |
| Navegació | Top navigation bar amb tabs | Desktop: icon+text, Tablet: icon, Mobile: dropdown (des de P4.3) |
| Icones | Lucide Angular | Moderna, consistent, tree-shakeable (des de P4.3) |
| Font | Inter (Google Fonts) | Sans-serif professional per tota l'aplicació (des de P4.3) |

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
| Índex de documentació | [INDEX.md](INDEX.md) | Punt d'entrada a tota la documentació |
| Estat actual | [CURRENT_STATUS.md](CURRENT_STATUS.md) | Estat complet del projecte per mòdul |
| Història de fases | [PHASES_LOG.md](PHASES_LOG.md) | Registre cronològic complet de fites |
| Model de dades | [DATA_MODEL.md](DATA_MODEL.md) | Entitats TypeScript, camps, relacions |
| Auth flow | [AUTH_FLOW.md](AUTH_FLOW.md) | Fluxos d'autenticació, components, variables |
| Dashboard UI | [DASHBOARD_UI.md](DASHBOARD_UI.md) | Design system, components shared, patterns UX (P4.3) |
| Mòdul Pinyes | [PINYES_MODULE.md](PINYES_MODULE.md) | Arquitectura completa del mòdul P5 |
| API legacy | [API_APPSISTENCIA.md](API_APPSISTENCIA.md) | Endpoints de l'app actual per migració |
| PRD complet | `docs/prd/` | Requirements, user stories, security |
| Rules Cursor | `.cursor/rules/` | Regles per l'agent AI |
