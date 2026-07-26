# Auditoria — Mòdul **Events** (Assajos i Actuacions)

**Data:** 2026-07-15
**Abast:** `apps/dashboard` → feature `events`: llistats d'assajos (`/rehearsals`) i actuacions (`/performances`), detall d'event (`/events/:id`) i confirmació d'assistència (`/events/:id/confirmation`).
**Eina:** Playwright (Chromium) — `desktop`, `tablet-portrait`, `tablet-landscape`, `mobile`.
**Dades:** BD dev real (event assaig "ASSAIG GENERAL", actuació "FESTA MAJOR").
**Reproduir:** spec `events-audit.spec.ts`. Resultats a `apps/dashboard-e2e/audit-results/events/`.

---

## 1. Resum executiu

Les **pàgines de detall estan molt ben resoltes** (targetes d'estadístiques, informació ben formatada, botons que fan wrap). El punt feble tornen a ser les **taules que no fan _reflow_**:

- 🔴 La taula d'**Actuacions** (`/performances`) fa **1283px** — desborda **tots** els viewports (fins i tot desktop).
- 🟠 La taula d'**Assajos** (885px) i la de **Resum d'assistència** del detall (557px) desborden en tablet-portrait/mòbil.
- 🟠 Diversos tap targets (enllaços de 17px, badges de 16px) per sota del mínim WCAG.

---

## 2. Rutes auditades

| Ruta | Estat |
|------|-------|
| `/rehearsals` | 🟠 taula 885px (no-reflow en tablet-portrait/mòbil) |
| `/performances` | 🔴 taula 1283px (desborda a tot arreu) |
| `/events/:id` (assaig) | 🟠 taula d'assistència 557px en mòbil + tap targets |
| `/events/:id` (actuació) | 🟠 idem |
| `/events/:id/confirmation` | ✅ OK (cap incidència) |

---

## 3. Troballes 🔴 Alta

### EV-H1 — Taula d'**Actuacions** de 1283px (desborda fins i tot en desktop)

Amb 7 de 10 columnes visibles la taula supera l'amplada de qualsevol pantalla. En mòbil (393) i tablet és una taula minúscula scrollable horitzontalment.
- **Detectat a:** tots els dispositius.
- **Captura:** `mobile/performances-list.png`.
- **Recomanació:** mode targeta responsive (`app-data-table`) + revisar amples de columna / `white-space: nowrap` que inflen la taula.

---

## 4. Troballes 🟠 Mitjana

### EV-M1 — Taula d'assajos (885px) no fa reflow en tablet-portrait/mòbil
Mateix patró que EV-H1 però només afecta pantalles estretes. Es resol amb el mode targeta compartit.

### EV-M2 — Taula "Resum d'assistència" del detall desborda en mòbil (557px)
Al detall d'event, la llista d'assistència és una taula de 557px que scrolleja horitzontalment a 393px.
- **Selector:** `div.card-body > div.overflow-x-auto > table.table.table-sm`.
- **Recomanació:** en mòbil, presentar l'assistència com a llista de fitxes (persona + estat) en lloc de taula.

### EV-M3 — Tap targets petits al detall
Enllaços de lloc/persona a **17px** d'alçada (`a.link`, `span.link.link-hover`), badge d'acció **46×16px**, cerca de la taula.
- **Recomanació:** augmentar l'alçada de línia clicable dels enllaços i l'àrea dels badges a ≥24px.

---

## 5. Aspectes positius

- ✅ **Detall d'event excel·lent en mòbil:** targetes d'estadístiques (Confirmats/Adults/Xicalla), secció *Informació* amb data ben formatada (`Dimecres, 27/01/2027` — dd/mm/yyyy correcte), i barra d'accions (Sincronitza/Confirmació/Edita/Elimina) que **sí que fa wrap**. Captura: `mobile/detail-assaig.png`.
- ✅ Pàgina de **confirmació d'assistència** sense incidències en cap dispositiu.
- ✅ Filtres dels llistats es reapilen en vertical en mòbil.
- ✅ Cap error de consola en tot el mòdul.

---

## 6. Accions proposades

1. 🔴 **EV-H1** — Mode targeta responsive per a `/performances` (i totes les llistes).
2. 🟠 **EV-M2** — Assistència del detall com a llista de fitxes en mòbil.
3. 🟠 **EV-M3** — Tap targets d'enllaços i badges a ≥24px.
4. Reaprofitar la solució de targetes de `app-data-table` (comuna amb Persons).
