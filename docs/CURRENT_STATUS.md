# Estat Actual del Projecte MuixerApp

> **Snapshot del frontier de desenvolupament.** Aquest fitxer respon a una sola pregunta:
> *on som ara mateix?* No duplica el detall — apunta a la font de veritat de cada tema.
>
> - **Pla i estat de cada fase** → [PROJECT_ROADMAP.md](PROJECT_ROADMAP.md) (taula `Estat General`)
> - **Història cronològica** → [PHASES_LOG.md](PHASES_LOG.md)
> - **Detall tècnic** → docs dedicats (vegeu taula al final)
>
> **Branca activa:** `feat/pwa-app-start` · **Frontier:** P5.13 (Figures Netes) completat + UX1 + R4 · **En curs:** P6.0 (PWA App Shell) · **Pendent destacat:** P6.1 (PWA Auth), P5.3.1 (UX segments), Q1 (E2E)

---

## Resum

Projecte en **desenvolupament actiu**. Completat: tot P0–P5.13 + refactors (R1–R4) + UX1 + FIX1 + infra (I1, I2).
El Mòdul Pinyes és operatiu i refinat de punta a punta (templates → composicions → segments → assignació →
snapshot → troncs → projecció → posicions/historials → rengles → nodes ad-hoc → **figures netes**).
Eliminades FigureFamily i ReferenceElement. Entorn PRE desplegat a Hetzner.
**PWA en curs** (P6.0 — App Shell iniciat a `feat/pwa-app-start`).

**Canvis recents (juny 10–18):**
- **P5.13 Figures Netes:** Tronc editor de primera classe per a figures `hasPinya: false`. Propietats de node, selecció per tags, integració completa assignació/projecció.
- **Millores Assignació (UX1):** Fuzzy search amb accents, assignar amb Enter, desassignació, cordons oberts agrupats a final de rengla, nodes decoratius no comptabilitzats, alçada 0 visible.
- **Millores Projecció:** Vista tronc inline, moviment cordó obert al final, millores visuals.
- **Refactor Troncs (R4):** Refactoritzat troncs (#23/#25), eliminat codi mort i utilitats duplicades (#24), refactoritzats cordons/rengles (#12), eliminat diàleg de cordons.
- **Seguretat rols (FIX1):** Guard admin grant (#33) — ADMIN-only per assignar/modificar ADMIN. Ghost clone fix, canvas viewport center, selector zona ocult, presets unificats.
- **PWA iniciat:** Spec P6.0–P6.9 aprovada. Scaffold, Docker health checks, manifest, meta tags, routes bàsiques.

Per a l'estat fase a fase amb enllaços als specs, vegeu la taula `Estat General` del
[roadmap](PROJECT_ROADMAP.md).

---

## Maturitat per Mòdul

### Backend (NestJS — `apps/api/src/modules/`)

| Mòdul | Estat | Àmbit |
|-------|-------|-------|
| `auth` | ✅ | JWT+Passport, refresh rotation, guards globals, rate limiting |
| `user` | ✅ | Entitat amb email + OneToOne Person, gestionat via AuthModule |
| `person` | ✅ | CRUD + filtres + ordenació server-side + provisionals (`~`) |
| `position` | ✅ | CRUD + M:N amb Person |
| `season` | ✅ | CRUD + comptador d'events |
| `event` | ✅ | CRUD events + attendance + recàlcul `attendanceSummary` |
| `sync` | ✅ | Strategy + SSE (Persons / Events / Attendance) |
| `figure` | ✅ | FigureTemplate/Node, save-from-instance, snapshot |
| `composition` | ✅ | CompositionTemplate + Slot |
| `event-segment` | ✅ | EventSegment + FigureInstance + InstanceNode (incl. ad-hoc) + ProjectionService |
| `node-assignment` | ✅ | Assignació, lazy snapshot, upgrade, bulk import, lock, **ad-hoc CRUD** |

> Endpoints en viu i sempre actualitzats → **Swagger: http://localhost:3000/api/docs**

### Dashboard (Angular — `apps/dashboard/src/app/features/`)

| Feature | Estat | Àmbit |
|---------|-------|-------|
| `home` | ✅ | Tab d'inici amb preview d'events |
| `auth` | ✅ | Login + guards + interceptor (401→refresh→retry) |
| `persons` | ✅ | Llista/detall, ordenació, filtres, provisionals, historial pinyes |
| `events` | ✅ | Llista/detall, CRUD, attendance, segments inline |
| `pinyes` | ✅ | Editor templates/composicions, canvas assignació (+ ad-hoc nodes, undo/redo), projecció, troncs, rengles |
| `config` | ✅ | Posicions; skeleton per users/seasons |
| `sync` | ✅ | UI SSE amb progress + log |

### PWA (`apps/pwa/`)

| | Estat | |
|--|-------|--|
| PWA | 🔵 P6.0 en curs | App Shell iniciat (scaffold, routing, tabs, Docker). Spec: [pwa/PWA_SPEC.md](pwa/PWA_SPEC.md) · Roadmap: [pwa/PWA_ROADMAP.md](pwa/PWA_ROADMAP.md) |

---

## En curs i pròxims passos

- **P6.0** 🔵 — PWA App Shell (scaffold, bottom tabs, Docker, manifest). Branca: `feat/pwa-app-start`.
- **P6.1** — PWA Auth (login, guards, interceptor). Pròxim immediat.
- **P6.2** — PWA Events + Assistència (`MeModule`, home, confirmar/declinar). **Alpha 1 cut.**
- **P5.3.1** — Revisió UX dels segments (tab dedicat "Pinyes" a event-detail, preview canvas).
- **Q1** — E2E tests amb Playwright per als fluxos crítics (login → event → assignació → projecció).
- **P8** — Dashboard d'estadístiques (assistència per persona/temporada, participació en figures).

> Vegeu la secció "Pròxims Desenvolupaments" del [roadmap](PROJECT_ROADMAP.md) per al detall complet.

---

## Problemes coneguts

| Àrea | Problema | Prioritat |
|------|----------|-----------|
| Backend sync | N+1 queries (300 persones ≈ 600 queries). Solució: bulk upsert TypeORM | Baixa |
| Dashboard | Cobertura E2E parcial (falten tests de navegació/detall, Playwright/Cypress) | Mitjana |
| PWA | P6.0 en curs — scaffold iniciat, funcionalitat encara buida | Mitjana (actiu) |

---

## On trobar el detall

| Tema | Font de veritat |
|------|-----------------|
| Endpoints API | Swagger → `/api/docs` |
| Estat tests | `nx test api` · `nx test dashboard` |
| Stack tecnològic | [codebase/STACK.md](codebase/STACK.md) |
| Arquitectura i patrons | [codebase/ARCHITECTURE.md](codebase/ARCHITECTURE.md) |
| Convencions de testing | [codebase/TESTING.md](codebase/TESTING.md) |
| Sincronització legacy | [SYNC_ARCHITECTURE.md](SYNC_ARCHITECTURE.md) |
| Model de dades | [DATA_MODEL.md](DATA_MODEL.md) |
| Mòdul Pinyes | [PINYES_MODULE.md](PINYES_MODULE.md) |
| Pla de fases | [PROJECT_ROADMAP.md](PROJECT_ROADMAP.md) |
| Història de fites | [PHASES_LOG.md](PHASES_LOG.md) |
| Com executar | [README.md](../README.md) · [CLAUDE.md](../CLAUDE.md) |
