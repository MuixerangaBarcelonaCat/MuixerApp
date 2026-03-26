# MuixerApp — Punt actual i pròxims passos

> Última actualització: 26 de març de 2026

---

## On estem?

### Fase completada: Brainstorming + Spec del primer vertical slice

S'ha completat el procés de brainstorming per al primer bloc del projecte (P0+P1+P2).
El spec està aprovat i escrit a:

```
docs/specs/2026-03-26-p0-p1-p2-vertical-slice-persons-design.md
```

### Què s'ha decidit?

- **Stack:** NestJS + Angular 20+ + TypeORM + PostgreSQL (NeonDB) + Nx monorepo
- **Enfocament:** Vertical Slice — una entitat completa (Person) de punta a punta
- **Model de dades:** Person, Position, User (entitats definides i aprovades)
- **Importació:** Script Python d'extracció ja creat (`scripts/appsistencia_extractor.py`)
- **Dashboard:** Angular Material, tema amb CSS variables (multi-colla ready)
- **Idioma:** Català UI, anglès codi. Terminologia: "membre" (mai "casteller"), "xicalla" (mai "canalla")

### Què existeix al repo?

| Fitxer/Carpeta | Estat |
|---|---|
| `docs/specs/2026-03-26-p0-p1-p2-vertical-slice-persons-design.md` | ✅ Spec complet aprovat |
| `PROJECT_ROADMAP.md` | ✅ Visió general de tots els sub-projectes |
| `API_APPSISTENCIA.md` | ✅ Documentació API legacy |
| `scripts/appsistencia_extractor.py` | ✅ Script d'extracció de dades |
| `.cursor/rules/muixer-project.mdc` | ✅ Context del projecte per l'agent |
| `.cursor/rules/muixer-language.mdc` | ✅ Convencions d'idioma |
| `.cursor/rules/muixer-security.mdc` | ✅ Seguretat i GDPR |
| `DATA_MODEL.md` / `DATA_MODEL_SCHEMA.md` | ⚠️ Versió antiga — el spec té el model actualitzat |
| `TEAM_KICKOFF.md` | ℹ️ Context inicial (algunes decisions ja superades) |

### Què NO existeix encara?

- Cap codi d'aplicació (ni NestJS, ni Angular, ni Nx)
- Cap `package.json` ni scaffold
- Dades extretes (cal executar l'extractor)
- Pla d'implementació detallat

---

## Pròxim pas: Escriure el Pla d'Implementació

El que cal fer a la pròxima sessió:

### 1. Generar el pla d'implementació

Demanar a l'agent que generi el pla d'implementació a partir del spec:

```
Continua amb el projecte MuixerApp. L'spec del primer vertical slice (P0+P1+P2)
està aprovat a docs/specs/2026-03-26-p0-p1-p2-vertical-slice-persons-design.md.

El pròxim pas és escriure el pla d'implementació detallat amb tasques ordenades
per poder començar a codificar.
```

### 2. Executar l'extractor de dades

Si no s'ha fet encara, executar:

```bash
cd scripts
python appsistencia_extractor.py
```

Això generarà `data/extracted/castellers.json` amb les 258 persones reals.

### 3. Començar a implementar

Un cop tinguem el pla, el flux serà:

1. Scaffold Nx monorepo (`npx create-nx-workspace`)
2. Crear apps (api, dashboard, pwa) i lib shared
3. Configurar TypeORM + NeonDB
4. Crear entitats (Person, Position, User)
5. Build CRUD API Person + Position
6. Build seed/import command
7. Build dashboard shell + person list view
8. Verificar amb dades reals

---

## Documents de referència clau

Per a qualsevol nova sessió, l'agent hauria de llegir:

1. **`PROJECT_ROADMAP.md`** — visió general i estat
2. **`docs/specs/2026-03-26-p0-p1-p2-vertical-slice-persons-design.md`** — spec tècnic aprovat
3. **`.cursor/rules/`** — s'apliquen automàticament
4. **`API_APPSISTENCIA.md`** — per a la migració de dades
5. **`NEXT_STEPS.md`** — aquest document (on estem)
