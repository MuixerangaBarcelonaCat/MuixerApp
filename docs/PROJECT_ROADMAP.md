# MuixerApp — Roadmap de Projecte

> Document viu que manté la visió general de tots els sub-projectes.
> Actualitzar cada vegada que es comenci o completi una fase.

---

## Estat General

| ID | Sub-projecte | Estat | Spec | Pla | Codi | Notes |
|----|-------------|-------|------|-----|------|-------|
| P0 | Scaffold (Nx + NestJS + Angular + NeonDB) | ✅ Completat | ✅ | ✅ | ✅ | Monorepo funcional |
| P1 | Auth + Usuaris + Persones (entitats + CRUD, sense login) | ✅ Completat | ✅ | ✅ | ✅ | Entitats i API REST funcionant |
| P2 | Data Migration (API legacy → NeonDB) | ✅ Completat | ✅ | ✅ | ✅ | Sync SSE complet, merge strategy implementada |
| P2.1 | Dashboard Persons — UX i funcionalitats avançades | ✅ Completat | ✅ | ✅ | ✅ | Ordenació, alçada relativa, filtres, tests |
| P3 | Temporades + Esdeveniments + Assistència | ✅ Complet | [`docs/specs/2026-03-31-p3-seasons-events-attendance-sync-design.md`](docs/specs/2026-03-31-p3-seasons-events-attendance-sync-design.md) | — | `apps/api/src/modules/season/`, `event/`, `sync/strategies/event-sync.strategy.ts` | Season + Event + Attendance entities, API, sync + dashboard |
| P4 | Dashboard Web (Angular) — resta de features | 🔵 En curs | — | — | 🔵 | P4 persons complet, falta Events/Assistència manual/Reports |
| P5 | PWA Mòbil | ⚪ Pendent | — | — | — | Inclou autogestió assistència per membres |
| P6 | Mòdul Figures/Canvas | ⚪ Pendent | — | — | — | Part més complexa |
| P7 | Notificacions + Features avançades | ⚪ Pendent | — | — | — | FCM, reports, notícies |

**Llegenda:** ⚪ Pendent | 🟡 Dissenyant | 🔵 En curs | ✅ Completat | ❌ Cancel·lat

---

## Decisions Tecnològiques

| Decisió | Resultat | Data |
|---------|----------|------|
| Backend framework | NestJS | Mar 2026 |
| Frontend framework | Angular 20+ (standalone, signals) | Mar 2026 |
| Mòbil | PWA (sense Ionic) | Mar 2026 |
| Base de dades | PostgreSQL (NeonDB) | Mar 2026 |
| Monorepo | Nx | Mar 2026 |
| Docker en dev | No (directe local) | Mar 2026 |
| Idioma UI | Català | Mar 2026 |
| Idioma codi | Anglès | Mar 2026 |
| Multi-tenant | Sí (futur) | Mar 2026 |
| ORM | TypeORM | Mar 2026 |
| Auth strategy | Pre-registre massiu + invite link (JWT+Passport pendent) | Mar 2026 |
| Canvas library (figures) | ⚪ Pendent | — |

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

## Dependències entre Sub-projectes

```
P0 (Scaffold)
 ├── P1 (Auth + Persones) ──┬── P3 (Events + Assistència)
 │                          │    ├── P4 (Dashboard)
 │                          │    ├── P5 (PWA)
 │                          │    └── P6 (Figures) ← pot començar en paral·lel
 └── P2 (Data Migration) ───┘
                                  P7 (Notificacions) ← últim
```

---

## Documents de Referència

| Document | Ubicació | Descripció |
|----------|----------|------------|
| Kickoff equip | `TEAM_KICKOFF.md` | Decisions, arquitectura, flux assistència |
| Model de dades | `DATA_MODEL.md` | Entitats TypeScript |
| Schema resum | `DATA_MODEL_SCHEMA.md` | Relacions i tipus |
| API legacy | `API_APPSISTENCIA.md` | Endpoints de l'app actual per migració |
| PRD complet | `../docs/prd/` | Requirements, user stories, security |
| Rules Cursor | `.cursor/rules/` | Regles per l'agent AI |

---

## Convencions de Codi i UX

| Aspecte | Decisió | Notes |
|---------|---------|-------|
| Idioma UI | Català | Tots els textos, botons, labels, missatges d'error |
| Idioma codi | Anglès | Variables, funcions, enums, endpoints, commits |
| Components Angular | 3 fitxers obligatoris | `.ts` + `.html` + `.scss` (cap template inline) |
| Canvi de detecció | `OnPush` | Tots els components |
| Estat reactiu | Signals (`signal`, `computed`, `effect`) | Evitar `BehaviorSubject` per estat local |
| Estils | DaisyUI v4 + Tailwind v3 | Cap Tailwind v4 fins nova decisió |
| Alçada d'espatlles | Baseline 140 cm | Display absolut (cm) o relatiu (+/-) configurable per usuari |

---

## Decisions sobre el Mòdul Assistència (P4 + P5)

### Edició manual per admins i tècnics (Dashboard — P4)

El sync des del legacy és unidireccional i no pot detectar automàticament el cas "va dir que venia però no va aparèixer" (el legacy no té check-in real). Per cobrir-ho:

| Feature | Rol | Descripció |
|---------|-----|-----------|
| Editar estat d'assistència | Admin, Tècnic | Canviar l'estat de qualsevol membre per a un event donat (p.ex. `ASSISTIT` → `NO_PRESENTAT`) |
| Afegir/eliminar registres | Admin, Tècnic | Gestionar membres que no consten al legacy o events nous |
| Editar notes | Admin, Tècnic | Afegir context per a cada registre d'assistència |
| Llista de confirmats | Admin, Tècnic | Vista per planificar pinyes i figures amb els membres confirmats |

**Regla de protecció:** quan un admin edita manualment un registre, s'activarà la flag `manuallyOverridden = true` a l'entitat `Attendance`. El sync no sobreescriurà registres amb aquesta flag activa.

> Pendent: afegir columna `manuallyOverridden boolean DEFAULT false` a la migració de BD.

### Autogestió per membres (PWA — P5)

Els membres podran gestionar la seva pròpia assistència des de la PWA mòbil:

| Feature | Descripció |
|---------|-----------|
| Confirmar assistència | Canviar el propi estat a `ANIRE` |
| Cancel·lar assistència | Canviar el propi estat a `NO_VAIG` |
| Marcar com a pendent | Deixar l'estat en `PENDENT` si no sap encara |
| Afegir nota | Afegir context (p.ex. "Arribo tard") |

Això permet que l'equip tècnic tingui la llista de confirmats actualitzada en temps real per organitzar les pinyes i figures.

> Prerequisit: sistema d'autenticació (JWT + Passport) pendent de P1.

---

## Decisions sobre el Mòdul Persones (P2.1)

Decisions preses durant la implementació de millores del dashboard de persones:

| Decisió | Resultat |
|---------|----------|
| Filtres de llista | Mantenir "Actius"; eliminar botons "Membres" i "Xicalla" (filtrables via API si cal) |
| Ordenació | Server-side, whitelist estricta de camps (protecció SQL injection) |
| Vista mòbil | Taula sempre (scroll horitzontal), mai transformar en llista de targetes |
| Alçada espatlles | Baseline 140 cm, toggle per sessió (no persistit), colors per tonalitat |
| Selector de columnes | Col·lapsable per defecte; persistit en `localStorage` |
| Paginació | Opcions 25/50/100 per pàgina |

---

## Històric

| Data | Acció |
|------|-------|
| Mar 2026 | Inici brainstorming P0. Decisions stack confirmades. |
| 26 Mar 2026 | Spec P0+P1+P2 aprovat (`docs/specs/2026-03-26-p0-p1-p2-vertical-slice-persons-design.md`). |
| 30 Mar 2026 | Spec Sync + Dashboard aprovat. Implementació SSE, merge strategy, Person List/Detail/Sync. |
| 31 Mar 2026 | P2.1 completat: ordenació server-side, alçada relativa, UX persones, tests complets (34 API + 16 dashboard). |
