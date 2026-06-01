# Estat Actual del Projecte MuixerApp

> **Snapshot del frontier de desenvolupament.** Aquest fitxer respon a una sola pregunta:
> *on som ara mateix?* No duplica el detall — apunta a la font de veritat de cada tema.
>
> - **Pla i estat de cada fase** → [PROJECT_ROADMAP.md](PROJECT_ROADMAP.md) (taula `Estat General`)
> - **Història cronològica** → [PHASES_LOG.md](PHASES_LOG.md)
> - **Detall tècnic** → docs dedicats (vegeu taula al final)
>
> **Branca activa:** `feat/modul-pinyes` · **Frontier:** P5.11 completat · **Pendent destacat:** P5.3.1 (UX segments), P6 (PWA)

---

## Resum

Projecte en **desenvolupament actiu**. Completat: tot P0–P5.11. El Mòdul Pinyes és operatiu
de punta a punta (templates → composicions → segments → assignació → famílies/snapshot →
troncs → projecció → posicions/historials → rengles). Pendent principal: la PWA mòbil (P6).

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
| `figure` | ✅ | FigureTemplate/Node/Family/FamilyNode, merge/split, snapshot |
| `composition` | ✅ | CompositionTemplate + Slot |
| `event-segment` | ✅ | EventSegment + FigureInstance + ProjectionService |
| `node-assignment` | ✅ | Assignació, lazy snapshot, upgrade, bulk import, lock |
| `reference-element` | ✅ | Elements de referència per projecció (P5.8.1) |

> Endpoints en viu i sempre actualitzats → **Swagger: http://localhost:3000/api/docs**

### Dashboard (Angular — `apps/dashboard/src/app/features/`)

| Feature | Estat | Àmbit |
|---------|-------|-------|
| `home` | ✅ | Tab d'inici amb preview d'events |
| `auth` | ✅ | Login + guards + interceptor (401→refresh→retry) |
| `persons` | ✅ | Llista/detall, ordenació, filtres, provisionals, historial pinyes |
| `events` | ✅ | Llista/detall, CRUD, attendance, segments inline |
| `pinyes` | ✅ | Editor templates/composicions, canvas assignació, projecció, troncs, rengles |
| `config` | ✅ | Posicions; skeleton per users/seasons |
| `sync` | ✅ | UI SSE amb progress + log |

### PWA (`apps/pwa/`)

| | Estat | |
|--|-------|--|
| PWA | 🔲 Scaffold buit | Pendent (P6) — reutilitzarà l'AuthModule de P4.1 |

---

## En curs i pròxims passos

- **P5.3.1** — Revisió UX dels segments (tab dedicat "Pinyes" a event-detail, preview canvas).
- **P6** — PWA mòbil per a membres (autogestió d'assistència, visualització de pinyes).
- **P7** — Informes, notificacions FCM, estadístiques.

---

## Problemes coneguts

| Àrea | Problema | Prioritat |
|------|----------|-----------|
| Backend sync | N+1 queries (300 persones ≈ 600 queries). Solució: bulk upsert TypeORM | Baixa |
| Dashboard | Cobertura E2E parcial (falten tests de navegació/detall, Playwright/Cypress) | Mitjana |
| PWA | No implementada (scaffold buit) | Baixa (post-P5) |

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
