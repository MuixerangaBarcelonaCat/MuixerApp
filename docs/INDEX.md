# MuixerApp — Índex de Documentació

> Última actualització: 30 de març de 2026

---

## 🎯 Comença aquí

| Document | Descripció |
|----------|------------|
| [README.md](../README.md) | Introducció i setup del projecte |
| [CURRENT_STATUS.md](CURRENT_STATUS.md) | **Estat actual complet del projecte** ⭐ |
| [NEXT_STEPS.md](NEXT_STEPS.md) | Pròxims passos immediats |
| [PROJECT_ROADMAP.md](PROJECT_ROADMAP.md) | Visió general i fases del projecte |

---

## 📋 Documentació Tècnica

### Implementació i Estat

| Document | Descripció |
|----------|------------|
| [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) | Estat detallat de la implementació P0-P2 |
| [VALIDATION_CHECKLIST.md](VALIDATION_CHECKLIST.md) | Checklist de validació manual (20 punts) |

### Sistema de Sincronització

| Document | Descripció |
|----------|------------|
| [SYNC_MERGE_STRATEGY.md](SYNC_MERGE_STRATEGY.md) | Regles de sincronització (CREATE vs UPDATE) |
| [SYNC_IMPROVEMENTS_2026-03-30.md](SYNC_IMPROVEMENTS_2026-03-30.md) | Millores implementades (lastSyncedAt, soft delete, etc.) |
| [SYNC_IMPLEMENTATION_SUMMARY.md](SYNC_IMPLEMENTATION_SUMMARY.md) | Resum executiu de la implementació de sync |

### API REST

| Document | Descripció |
|----------|------------|
| [API_PERSON_ENDPOINTS.md](API_PERSON_ENDPOINTS.md) | Documentació completa dels endpoints de Person |
| [API_APPSISTENCIA.md](API_APPSISTENCIA.md) | Documentació de l'API legacy per migració |
| [API_DOCUMENTATION.md](API_DOCUMENTATION.md) | Documentació general de l'API |

### Frontend (Angular + DaisyUI)

| Document | Descripció |
|----------|------------|
| [DAISYUI_MIGRATION.md](DAISYUI_MIGRATION.md) | Migració de Spartan UI a DaisyUI v4 |
| [ANGULAR_COMPONENT_STRUCTURE_MIGRATION.md](ANGULAR_COMPONENT_STRUCTURE_MIGRATION.md) | Migració a estructura de 3 fitxers |
| [TAILWIND_VERSION.md](TAILWIND_VERSION.md) | Decisió d'usar Tailwind v3 vs v4 |

### Troubleshooting

| Document | Descripció |
|----------|------------|
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Solucions a problemes comuns |

---

## 📐 Specs Tècniques Aprovades

| Document | Estat | Descripció |
|----------|-------|------------|
| [specs/2026-03-26-p0-p1-p2-vertical-slice-persons-design.md](specs/2026-03-26-p0-p1-p2-vertical-slice-persons-design.md) | ✅ Aprovat | Disseny original del vertical slice P0+P1+P2 |
| [specs/2026-03-30-vertical-slice-completion-sync-dashboard-design.md](specs/2026-03-30-vertical-slice-completion-sync-dashboard-design.md) | ✅ Aprovat | Disseny complet de sync + dashboard UI |

---

## 🗂️ Arxiu

Documentació històrica que ja no és rellevant (moguda a `archive/`):

| Document | Descripció | Motiu |
|----------|------------|-------|
| `archive/DATA_MODEL.md` | Model de dades inicial | Substituït per specs aprovades |
| `archive/TEAM_KICKOFF.md` | Kickoff inicial del projecte | Informació històrica |

---

## 🔧 Regles i Skills de l'Agent

### Regles (`.cursor/rules/`)

| Regla | Descripció |
|-------|------------|
| `muixer-project.mdc` | Context general del projecte |
| `muixer-language.mdc` | Convencions d'idioma (codi EN, UI CA) |
| `angular-component-structure.mdc` | Estructura obligatòria de 3 fitxers |
| `daisyui-cdk.mdc` | Patrons DaisyUI + Angular CDK |
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

## 📊 Mètriques del Projecte

### Backend

- **Tests:** 10/10 passing
- **Cobertura:** PersonService, PositionService, Sync
- **Endpoints:** 8 (CRUD + activate/deactivate + sync)
- **Entitats:** 3 (Person, Position, User)

### Frontend

- **Components:** 6 (App, Sidebar, Header, PersonList, PersonDetail, PersonSync)
- **Arquitectura:** Standalone + Signals + OnPush
- **UI:** DaisyUI v4 (55 components) + Angular CDK
- **Tests:** Pendents d'implementar

### Documentació

- **Documents actius:** 15
- **Specs aprovades:** 2
- **Regles:** 5
- **Skills:** 6

---

## 🚀 Quick Links

- **Swagger API:** http://localhost:3000/api/docs
- **Dashboard:** http://localhost:4200
- **Roadmap:** [PROJECT_ROADMAP.md](PROJECT_ROADMAP.md)

---

**Última actualització:** 30 de març de 2026  
**Estat del projecte:** 🟢 Actiu i saludable
