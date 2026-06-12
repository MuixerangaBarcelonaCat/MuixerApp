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
| P3.1 | **Temporades — CRUD complet** | ✅ Completat | [`spec`](specs/2026-06-10-seasons-crud-design.md) | ✅ | ✅ | CRUD `/config/seasons`, validació solapament, auto-assign temporada actual a events, pre-selecció als formularis |
| P4.1 | **Auth Layer** — JWT+Passport + refactor User/Person + Dashboard login | ✅ Completat | [`spec`](specs/2026-04-07-p4-1-auth-layer-design.md) | ✅ | ✅ | Login, refresh rotation, guards globals, dashboard login. Detall: [AUTH_FLOW.md](AUTH_FLOW.md) |
| P4.2 | Dashboard Web — Events + Assistència manual | ✅ Completat | [`spec`](specs/2026-04-12-p4-2-dashboard-events-attendance-design.md) | ✅ | ✅ | CRUD events + attendance, persones provisionals, optimistic UI |
| P4.3 | **Dashboard Design Refactor** — Clean slate visual redesign | ✅ Completat | [`spec`](specs/2026-04-20-dashboard-design-refactor-design.md) | ✅ | ✅ | Top nav + tabs, 15+ shared components, Home tab. Detall: [DASHBOARD_UI.md](DASHBOARD_UI.md) |
| P4.4 | **Arquitectura Docker Multi-entorn** | ✅ Completat | [`spec`](specs/2026-05-07-p4-4-docker-local-postgres-design.md) | ✅ | ✅ | Docker local dev + Dockerfile multi-stage + prod VPS. Detall: [DOCKER_ARCHITECTURE.md](DOCKER_ARCHITECTURE.md) |
| P5.1 | **Pinyes** — Templates i Editor Visual | ✅ Completat | [`spec`](specs/2026-05-07-p5-figures-module-overview-design.md) | ✅ | ✅ | Backend CRUD FigureTemplate+FigureNode, Konva editor (pinya+tronc), auto-save |
| P5.2 | **Pinyes** — Composicions | ✅ Completat | [`spec`](specs/2026-05-08-p5-2-compositions-design.md) | ✅ | ✅ | CompositionModule + CompositionEditorComponent (canvas multi-figura). P5.2.1: fixes canvas + UX |
| P5.3 | **Pinyes** — Segments i Instàncies | ✅ Completat | — | — | ✅ | EventSegmentModule + SegmentManagerComponent inline. Pendent: revisió UX (P5.3.1) |
| P5.3.1 | Pinyes — Revisió UX Segments | ⚪ Pendent | — | — | — | Tab dedicat "Pinyes" a event-detail, preview canvas, navegació fluida. Inclou mètriques d'adults i stat cards (parcialment fet) |
| P5.4 | **Pinyes** — Assignació de Persones | ✅ Completat | [`spec`](specs/2026-05-11-p5-3-event-segments-figure-instances.md) | ✅ | ✅ | NodeAssignment + AssignmentCanvas + PersonPanel, optimistic UI, pick-and-place |
| P5.5 | **Pinyes** — Famílies, Snapshot i Creixement Concèntric | ✅ Completat | [`spec`](specs/2026-05-19-p5-family-snapshot-redesign.md) | — | ✅ | FigureFamily+InstanceNode, lazy snapshot, upgrade de cordó, upsert estable |
| P5.6 | **Pinyes** — Visualització i Assignació de Troncs | ✅ Completat | [`spec`](specs/2026-05-20-p5-tronc-visualization-design.md) | — | ✅ | TroncViewComponent (CSS Grid), unitats relatives 0.5u–8u, variance per pis |
| P5.7 | **Pinyes** — Tronc Nodes a Nivell de Família | ✅ Completat | — | — | ✅ | FigureFamilyNode (TRONC/BASE shared), merge/split transparent, migració idempotent |
| P5.8 | **Pinyes** — Convenció d'ordre de les Bases | ✅ Completat | — | — | ✅ | Convenció CCW, `validateBaseOrdering()`, badge + modal d'ajuda |
| P5.8.1 | **Pinyes** — Vista de Projecció (inicial) | ✅ Completat | [`spec`](specs/2026-05-22-p5-8-1-projection-view-design.md) | — | ✅ | ProjectionView + SegmentCanvas Konva. Substituït per grid CSS a P5.9 |
| P5.9 | **Pinyes** — Vista de Projecció (refinada) | ✅ Completat | — | — | ✅ | Grid CSS responsive, vista Troncs `?view=troncs`, panells flotants, HUD navegació |
| P5.10 | **Pinyes** — Posicions, Lock i Historials | ✅ Completat | [`spec`](specs/2026-05-26-p5-10-positions-lock-history-design.md) | ✅ | ✅ | PositionModule + lock automàtic + filtre per posició + historials (persona/event/família) |
| P5.11 | **Pinyes** — Integració de Rengles | ✅ Completat | [`spec`](specs/2026-05-28-rengles-integration-spec.md) | ✅ | ✅ | Rengla entity, editor de rengles, ghost clone, selector de cordons, projecció filtrada. UX simplificada a R3 |
| P5.12 | **Pinyes** — Nodes Ad-Hoc a Instàncies | ✅ Completat | [`spec`](specs/2026-06-10-ad-hoc-instance-nodes-design.md) | ✅ | ✅ | 5 fases: PINYA ad-hoc, DECORATION, DIRECTION, undo/redo, save-as-template. Substitueix `ReferenceElement` |
| R1 | **Refactor** — Eliminació de FigureFamily | ✅ Completat | — | — | ✅ | Migració DB, simplificació model (FamilyNode → FigureNode directe), cleanup frontend |
| R2 | **Refactor** — Eliminació de ReferenceElement | ✅ Completat | — | — | ✅ | Mòdul eliminat, substituït per nodes DECORATION ad-hoc (P5.12) |
| R3 | **Refactor** — Simplificació de Rengles i templates | ✅ Completat | — | — | ✅ | Auto-nom/slug, creació de rengles sense formulari, eliminació `startPosition`, desassignació al reduir cordons. Migració `1781300000000`. Detall: [PINYES_REFACTOR_TRACKING.md](PINYES_REFACTOR_TRACKING.md) |
| I1 | **Infra** — Entorn PRE (Hetzner VPS) | ✅ Completat | — | — | ✅ | Caddy reverse proxy, Docker Compose pre, scripts deploy, cookie secure condicional |
| I2 | **Infra** — Migració a pnpm | ✅ Completat | — | — | ✅ | pnpm workspace, lockfile, CI adaptat |
| P6 | PWA Mòbil | ⚪ Pendent | — | — | — | Diferit fins al tall. Estén l'auth de P4.1 als membres |
| P7 | Informes + Notificacions + Features avançades | ⚪ Pendent | — | — | — | Reports d'assistència, FCM, estadístiques, notícies |

**Llegenda:** ⚪ Pendent | 🟡 Dissenyant | 🔵 En curs | ✅ Completat | ❌ Cancel·lat

> **Prefixos:** `P` = producte, `R` = refactor, `I` = infraestructura
>
> El detall complet de cada fase del **Mòdul Pinyes (P5.x)** viu a [PINYES_MODULE.md](PINYES_MODULE.md)
> (conceptes de domini, model de dades, cicle de vida, upgrade, API, arquitectura frontend, troncs,
> convenció de bases, projecció, nodes ad-hoc). Vegeu també les specs enllaçades a la taula.

---

## Pròxims Desenvolupaments (proposta)

### Curt termini (juliol 2026)

| ID | Proposta | Esforç | Impacte | Justificació |
|----|----------|--------|---------|--------------|
| P5.3.1 | **Revisió UX Segments** — Tab "Pinyes" a event-detail, preview canvas inline, navegació fluida entre segments | M | Alt | UX fragmentada: els tècnics han de navegar massa clics per arribar al canvas d'assignació |
| P5.13 | **Editor de Templates v2** — Reordenar nodes drag-and-drop, duplicar template, importar nodes d'altra plantilla | S | Mitjà | Feedback tècnics: crear templates similars és repetitiu |
| Q1 | **Qualitat** — E2E tests (Playwright) per a fluxos crítics: login → crear event → assignar → projectar | M | Alt | Cobertura E2E = 0%. Risc de regressions en fluxos multi-pàgina |

### Mitjà termini (agost–setembre 2026)

| ID | Proposta | Esforç | Impacte | Justificació |
|----|----------|--------|---------|--------------|
| P6.1 | **PWA — Auth + Visualització** — Login membre, veure events propis, confirmar assistència, veure pinyes (readonly) | L | Molt alt | Desbloqueig per a tots els membres de la colla. Prerequisit: res (reutilitza AuthModule P4.1) |
| P6.2 | **PWA — Notificacions push** — FCM/Web Push per a convocatòries i recordatoris | M | Alt | Complementa P6.1 — sense push la PWA perd adopció |
| P8 | **Dashboard d'Estadístiques** — Assistència per persona/temporada, ranking, participació en figures, gràfics | M | Alt | Dades ja disponibles. Valor per a junta i tècnics |

### Llarg termini (Q4 2026+)

| ID | Proposta | Esforç | Impacte | Justificació |
|----|----------|--------|---------|--------------|
| P9 | **Multi-tenant** — `collaId` al JWT, guard de tenant, branding dinàmic (logo, colors), onboarding colla | XL | Estratègic | Permet oferir l'app a altres colles. Prerequisit: P6 estable |
| P10 | **Exportació i Impressió** — PDF de pinyes (canvas → imatge), llistats d'assistència imprimibles, CSV | S | Mitjà | Tècnics demanen imprimir les pinyes per als assajos |
| P11 | **Historial i Auditoria** — Log d'accions (qui va canviar què), versionat de templates, rollback d'assignacions | L | Mitjà | Traçabilitat per a decisions tècniques |

**Llegenda esforç:** S = 1-3 dies | M = 1-2 setmanes | L = 3-4 setmanes | XL = 1-2 mesos

> **Recomanació:** Prioritzar **P5.3.1 → Q1 → P6.1** com a camí crític. La PWA és el multiplier de valor
> més gran (passa de ~5 tècnics a ~40 membres actius). E2E tests abans de P6 redueixen el risc de
> regressions durant el desenvolupament mòbil.

---

## Dependències entre Sub-projectes

```
P0 (Scaffold)
 ├── P1 (Usuaris + Persones) ──┬── P3 (Events + Assistència + Seasons CRUD)
 │                              │
 └── P2 (Data Migration) ───────┤
                                 └── P4.1 (Auth Layer) ← prerequisit seguretat
                                     ├── I1 (PRE Hetzner) ← deploy continu
                                     └── P4.2 (Dashboard Events + Assistència)
                                             └── P5 (Pinyes: P5.1→P5.12 + R3) ← ✅ completat
                                                 ├── P5.3.1 (UX Segments) ← pendent
                                                 ├── P5.13 (Editor Templates v2)
                                                 ├── Q1 (E2E tests) ← recomanat abans P6
                                                 └── P6 (PWA Mòbil: P6.1 Auth+View → P6.2 Push)
                                                     ├── P8 (Dashboard Estadístiques)
                                                     └── P9 (Multi-tenant) ← estratègic

Decisions clau d'ordre:
  - P5 complet (P5.1→P5.12 + R3): mòdul operatiu de punta a punta amb tècnics
  - P5.3.1 immediat: UX polish necessari abans d'obrir als membres
  - Q1 (E2E) abans P6: xarxa de seguretat contra regressions multi-pàgina
  - P6 diferit: membres seguiran usant el legacy fins al tall oficial
  - P6 reutilitza l'AuthModule de P4.1 sense reimplementar-lo
  - P9 (multi-tenant) requereix P6 estable i validació amb 1a colla
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
| Package manager | `pnpm` (migrat des de npm per velocitat i espai disc) | Juny 2026 |
| Entorn PRE | Hetzner VPS + Caddy reverse proxy + Docker Compose | Juny 2026 (I1) |
| Ad-hoc nodes strategy | Single-table extension (`isAdHoc` discriminator a `InstanceNode`), no taules noves | Juny 2026 (P5.12) |

---

## On trobar el detall d'implementació

El roadmap no duplica el detall tècnic. Cada tema té un doc autoritzat:

| Tema | Document |
|------|----------|
| Mòdul Pinyes (P5.x) — domini, model, cicle de vida, API, frontend | [PINYES_MODULE.md](PINYES_MODULE.md) |
| Refactors Pinyes (R1–R3) — auditoria i seguiment | [PINYES_REFACTOR_TRACKING.md](PINYES_REFACTOR_TRACKING.md) |
| Nodes Ad-Hoc (P5.12) — spec general, 5 fases | [`spec`](specs/2026-06-10-ad-hoc-instance-nodes-design.md) · [`plans/`](specs/plans/) |
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
