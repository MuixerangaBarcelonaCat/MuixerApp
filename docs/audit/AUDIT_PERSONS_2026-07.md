# Auditoria — Mòdul **Persons** (prioritari)

**Data:** 2026-07-15
**Abast:** `apps/dashboard` → feature `persons`: llistat (Cens/Provisionals/Tots), formulari de creació i detall de persona.
**Eina:** Playwright (Chromium) — `desktop` 1280×800, `tablet-portrait` 768×1024, `tablet-landscape` 1024×768, `mobile` 393×851.
**Dades:** BD dev real (282 persones; persona de detall: "PERSIANA").
**Reproduir:** spec `persons-audit.spec.ts`. Resultats a `apps/dashboard-e2e/audit-results/persons/`.

---

## 1. Resum executiu

El mòdul és **funcional i net a tots els dispositius** (cap overflow de document), però arrossega els patrons transversals del dashboard i té **un error d'API i un problema de clipping de botons en mòbil**:

- 🔴 **Error 403 (Forbidden)** en carregar el llistat (alguna crida d'API falla, fins i tot com a ADMIN).
- 🟠 La **taula del cens no fa reflow** en tablet-portrait/mòbil (785px) — scroll horitzontal; la columna *Accions* queda tallada en tablet-portrait.
- 🟠 Al **detall**, els botons d'acció es **tallen per la dreta en mòbil** (no fan wrap).
- 🟠 Formulari amb layout etiqueta/camp comprimit + data en format US.

---

## 2. Rutes auditades

| Ruta | Estat |
|------|-------|
| `/persons` (Cens) | 🟠 taula no-reflow + 403 |
| `/persons` (Provisionals) | ✅ OK |
| `/persons/new` | 🟠 formulari comprimit en mòbil |
| `/persons/:id` (detall) | 🟠 botons tallats en mòbil |

---

## 3. Troballes 🔴 Alta

### PE-H1 — Error **403 Forbidden** en carregar el llistat de persones

En obrir `/persons` es registra a consola: `Failed to load resource: the server responded with a status of 403 (Forbidden)`. Es reprodueix en **desktop i mòbil** (l'usuari autenticat és ADMIN).
- **Impacte:** alguna dada/recurs del llistat no es carrega; cal identificar l'endpoint (probablement un filtre auxiliar: posicions, etiquetes o comptadors) i el motiu del 403.
- **Recomanació:** revisar `PersonService`/interceptors i els `@Roles` de l'endpoint implicat; si és una crida opcional, degradar-la amb gràcia sense error a consola.

---

## 4. Troballes 🟠 Mitjana

### PE-M1 — La taula del cens no fa _reflow_ (785px)

En tablet-portrait (768) i mòbil (393) la taula esdevé scrollable horitzontalment; en tablet-portrait la columna **Accions** queda tallada (785 > 768).
- **Captures:** `tablet-portrait/list.png`, `mobile/list.png`.
- **Recomanació:** mode targeta responsive al component compartit `app-data-table` (`< lg`). Vegeu el pla global a `AUDIT_UX_RESPONSIVE_2026-07.md` §8.

### PE-M2 — Botons d'acció del detall tallats en mòbil

Al detall (`/persons/:id`), la fila de botons de la capçalera ("Marcar provisional", **"Edita"**) i la de la secció *Informació de la colla* (**"Enllaça amb usuari extern"**) sobreïxen l'amplada i queden **retallats per la dreta** a 393px (no fan wrap).
- **Captura:** `mobile/detail.png`.
- **Recomanació:** `flex-wrap` a les barres de botons i/o icones-only en mòbil.

### PE-M3 — Formulari `Persona nova` comprimit + data en format US

Layout etiqueta-esquerra/input-dreta que trenca etiquetes llargues en mòbil; l'`<input type="date">` es mostra com `mm/dd/yyyy` (locale en-US).
- **Captura:** `mobile/new.png`.
- **Recomanació:** apilar etiqueta sobre camp en `< sm`; fixar `lang="ca"` per al format de data.

---

## 5. Troballes 🟡 Baixa

- **PE-L1** — Botó "×" dels xips de filtre actiu **11×20px** i checkboxes de filtre **16×16px** (< 24px WCAG). Comú a totes les llistes.
- **PE-L2** — Badges de posició (`badge-sm`) i toggles ~16px d'alçada al formulari.
- **PE-L3** — Àlies duplicat visualment a la capçalera del detall ("PERSIANA" com a títol i subtítol) quan nom i àlies coincideixen.

---

## 6. Aspectes positius

- ✅ Detall amb layout de **targetes** ben apilades (Informació personal / de la colla), badges d'estat clars.
- ✅ Pestanya **Provisionals** i filtres es reapilen correctament en vertical en mòbil.
- ✅ Cap overflow de document; cap error de consola tret del 403 del llistat.
- ✅ Capçalera de llista amb comptador (282) i accions primàries visibles.

---

## 7. Accions proposades

1. 🔴 **PE-H1** — Diagnosticar i resoldre el 403 del llistat.
2. 🟠 **PE-M1** — Mode targeta responsive a `app-data-table` (impacte global).
3. 🟠 **PE-M2** — `flex-wrap` a les barres de botons del detall.
4. 🟠 **PE-M3** — Apilat del formulari + locale de data.
5. 🟡 Normalitzar tap targets tàctils (chips, checkboxes, toggles) a ≥24px.
