# Auditoria — Mòdul **Configuració**

**Data:** 2026-07-15
**Abast:** `apps/dashboard` → feature `config`: portada (`/config`) i subpàgines Usuaris (`/config/users`), Etiquetes (`/config/tags`) i Temporades (`/config/seasons`).
**Eina:** Playwright (Chromium) — `desktop`, `tablet-portrait`, `tablet-landscape`, `mobile`.
**Reproduir:** spec `config-audit.spec.ts`. Resultats a `apps/dashboard-e2e/audit-results/config/`.

---

## 1. Resum executiu

**El mòdul més saludable de l'auditoria.** Cap overflow de document, cap error de consola i la portada usa un **layout de targetes apilades exemplar** que s'adapta perfectament a mòbil i tablet. Les subpàgines reutilitzen els components de llista compartits, per la qual cosa **hereten els mateixos problemes latents** (taules sense reflow, tap targets petits), però amb poques dades gairebé no es manifesten.

---

## 2. Rutes auditades

| Ruta | Estat |
|------|-------|
| `/config` (portada) | ✅ Excel·lent (targetes apilades) |
| `/config/users` | 🟡 patró de llista compartit (tap targets petits) |
| `/config/tags` | ✅ OK |
| `/config/seasons` | 🟡 1 tap target petit |

---

## 3. Troballes 🟡 Baixa

### CF-L1 — Tap targets petits a les subpàgines de llista
`/config/users` (3) i `/config/seasons` (1) presenten controls < 24px: botó "×" dels xips de filtre actiu (11px), carets d'ordenació de columna i checkboxes. Mateix origen que a Persons/Events (components compartits).
- **Captura:** `mobile/users.png`.
- **Recomanació:** es resol globalment normalitzant els tap targets del `app-data-table` / `app-active-filters`.

### CF-L2 — Latència de reflow de taules (heretat)
Les taules d'Usuaris/Temporades usen el mateix `app-data-table`; amb més dades reproduirien el scroll horitzontal de Persons/Events en pantalles estretes. Es resol amb el mode targeta compartit.

---

## 4. Aspectes positius

- ✅ **Portada `/config`:** targetes (Usuaris, Etiquetes, Temporades) amb icona, títol i descripció; apilat net i tap targets grans en mòbil. **Patró de referència** a replicar a les pàgines de llistat. Captura: `mobile/config-home.png`.
- ✅ `/config/users`: filtres (rols com a botons, estat/accés com a checkboxes), xips de filtre actiu, toggle de columnes i paginació — tot funcional i reapilat en mòbil.
- ✅ Zero errors de consola i zero overflow de document a totes les subpàgines i dispositius.

---

## 5. Accions proposades

1. 🟡 Aplicar la normalització global de tap targets (≥24px) — beneficia també Config.
2. 🟡 En adoptar el mode targeta a `app-data-table`, Config se'n beneficia sense canvis propis.
3. Mantenir el patró de targetes de la portada com a guia de disseny per a la resta de llistats.
