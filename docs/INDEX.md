# MuixerApp — Índex de Documentació

> Última actualització: 9 d'abril de 2026

---

## Comença aquí

| Document | Descripció |
|----------|------------|
| [README.md](../README.md) | Introducció i setup del projecte |
| [CURRENT_STATUS.md](CURRENT_STATUS.md) | **Estat actual complet del projecte** ⭐ |
| [NEXT_STEPS.md](NEXT_STEPS.md) | Pròxims passos immediats |
| [PROJECT_ROADMAP.md](PROJECT_ROADMAP.md) | Visió general i fases P0–P7 |

---

## Documentació Tècnica

### Model de Dades

| Document | Descripció |
|----------|------------|
| [DATA_MODEL.md](DATA_MODEL.md) | Entitats, camps, relacions i enums actuals |

### Autenticació

| Document | Descripció |
|----------|------------|
| [AUTH_FLOW.md](AUTH_FLOW.md) | Fluxos d'autenticació (login, refresh, logout), components, variables d'entorn |

### Sistema de Sincronització

| Document | Descripció |
|----------|------------|
| [SYNC_MERGE_STRATEGY.md](SYNC_MERGE_STRATEGY.md) | Regles de merge (CREATE vs UPDATE) — referència canònica |

### API REST

| Document | Descripció |
|----------|------------|
| [API_PERSON_ENDPOINTS.md](API_PERSON_ENDPOINTS.md) | Endpoints de Person (CRUD + sync + activate/deactivate) |
| [API_APPSISTENCIA.md](API_APPSISTENCIA.md) | API legacy (PHP) — per scripts de migració |

### QA i Operacions

| Document | Descripció |
|----------|------------|
| [VALIDATION_CHECKLIST.md](VALIDATION_CHECKLIST.md) | Checklist de validació manual (20 punts) |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Solucions a problemes comuns |

---

## Specs Tècniques Aprovades

| Document | Estat | Descripció |
|----------|-------|------------|
| [specs/2026-03-26-p0-p1-p2-vertical-slice-persons-design.md](specs/2026-03-26-p0-p1-p2-vertical-slice-persons-design.md) | ✅ Implementat | Disseny original del vertical slice P0+P1+P2 |
| [specs/2026-03-30-vertical-slice-completion-sync-dashboard-design.md](specs/2026-03-30-vertical-slice-completion-sync-dashboard-design.md) | ✅ Implementat | Sync + dashboard UI complet |
| [specs/2026-04-07-p4-1-auth-layer-design.md](specs/2026-04-07-p4-1-auth-layer-design.md) | ✅ Implementat | P4.1 Auth Layer (JWT+Passport, Dashboard login) |

---

## Regles i Skills de l'Agent

### Regles (`.cursor/rules/`)

| Regla | Descripció |
|-------|------------|
| `muixer-project.mdc` | Context general del projecte |
| `muixer-language.mdc` | Convencions d'idioma (codi EN, UI CA) |
| `angular-component-structure.mdc` | Estructura obligatòria de 3 fitxers |
| `typeorm-patterns.mdc` | Patrons TypeORM (entitats, relacions) |
| `muixer-security.mdc` | GDPR i seguretat |
| `nx-workspace.mdc` | Convencions del monorepo Nx |

### Skills (`.agents/skills/`)

| Skill | Descripció |
|-------|------------|
| `angular-component/` | Crear components Angular moderns |
| `angular-signals/` | Gestió d'estat amb signals |
| `nestjs-best-practices/` | Patrons NestJS |
| `brainstorming/` | Exploració i disseny abans d'implementar |
| `systematic-debugging/` | Debugging sistemàtic |
| `test-driven-development/` | TDD workflow |

---

## Quick Links

- **Swagger API:** http://localhost:3000/api/docs
- **Dashboard:** http://localhost:4200
- **Roadmap:** [PROJECT_ROADMAP.md](PROJECT_ROADMAP.md)

---

**Última actualització:** 9 d'abril de 2026  
**Estat del projecte:** 🟢 Actiu — P0 a P4.1 completats
