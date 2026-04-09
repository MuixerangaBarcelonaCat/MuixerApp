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
| P4.2 | Dashboard Web — Events + Assistència manual | ⚪ Pendent | — | — | — | Depèn de P4.1 (guards actius) |
| P5 | Mòdul Pinyes i Figures | ⚪ Pendent | — | — | — | Canvas, templates reutilitzables, col·laboració tècnics |
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
| Base de dades | PostgreSQL (NeonDB) | Mar 2026 |
| Monorepo | Nx | Mar 2026 |
| Docker en dev | No (directe local) | Mar 2026 |
| Idioma UI | Català | Mar 2026 |
| Idioma codi | Anglès | Mar 2026 |
| Multi-tenant | Sí (futur, rol ADMIN) | Mar 2026 |
| ORM | TypeORM | Mar 2026 |
| Auth strategy | JWT+Passport (access 15min + refresh 7d). Implementat a P4.1, estès a P6 | Abr 2026 |
| Token storage (Dashboard) | Memòria/signal (access token) + `httpOnly cookie` (refresh token) | Abr 2026 |
| CORS | Array d'orígens via `CORS_ORIGINS` env (Dashboard + PWA) | Abr 2026 |
| Canvas library (pinyes i figures) | 🟡 Pendent decisió final | — |

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

### Edició manual per tècnics (Dashboard — P4.2)

El sync des del legacy és unidireccional i no detecta automàticament "va dir que venia però no va aparèixer". Per cobrir-ho:

| Feature | Rol | Descripció |
|---------|-----|-----------|
| Editar estat d'assistència | Tècnic, Admin | Canviar l'estat de qualsevol membre per a un event (p.ex. `ASSISTIT` → `NO_PRESENTAT`) |
| Afegir/eliminar registres | Tècnic, Admin | Gestionar membres que no consten al legacy o events nous |
| Editar notes | Tècnic, Admin | Afegir context per a cada registre d'assistència |
| Llista de confirmats | Tècnic, Admin | Vista per planificar pinyes amb els membres confirmats |

**Regla de protecció:** quan s'edita manualment, `manuallyOverridden = true` a `Attendance`. El sync no sobreescriu registres amb aquesta flag.

> Pendent: afegir columna `manuallyOverridden boolean DEFAULT false` a la migració de BD.

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
| API legacy | `API_APPSISTENCIA.md` | Endpoints de l'app actual per migració |
| PRD complet | `docs/prd/` | Requirements, user stories, security |
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
