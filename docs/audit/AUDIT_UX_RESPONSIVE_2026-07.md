# Auditoria d'usabilitat i responsive — Dashboard

**Data:** 2026-07-15
**Abast:** `apps/dashboard` (web). PWA i editor de canvas de Pinyes queden fora (vegeu [§7 Cobertura](#7-cobertura-i-buits)).
**Eina:** Playwright 1.59.1 — auditoria automatitzada multi-dispositiu.
**Autenticació:** ADMIN real (`lvaquer87@gmail.com`) sobre la BD de dev amb dades reals (282 persones, 15 actuacions).

> Com reproduir-ho: `E2E_EMAIL=... E2E_PASSWORD=... pnpm audit:responsive` i després `pnpm audit:report`.
> Els resultats crus (mètriques + captures full-page per dispositiu) es desen a `apps/dashboard-e2e/audit-results/`.

---

## 1. Resum executiu

L'estat general del responsive és **bo**: cap pàgina provoca overflow horitzontal del document, no hi ha errors de consola en cap ruta ni dispositiu, i les pàgines basades en **targetes apilades** (Home, Configuració) s'adapten de manera exemplar a mòbil i tablet.

El problema transversal principal és que les **pàgines de llistat basades en taula no fan _reflow_**: en pantalles estretes la taula simplement es fa scrollejable horitzontalment dins del seu contenidor en lloc de reorganitzar-se. Com que l'app es planteja **per a tablet**, aquest patró afecta el cas d'ús principal (tablet portrait, 768px) i és greu en mòbil.

| Severitat | Nº | Resum |
|-----------|----|-------|
| 🔴 Alta   | 2  | Taula d'Actuacions més ampla que qualsevol pantalla; taules sense reflow en tablet/mòbil |
| 🟠 Mitjana| 5  | Tap targets per sota del mínim WCAG, format de data US, nav només-icones en tablet, formulari comprimit |
| 🟡 Baixa  | 5  | Detalls de poliment visual i i18n |

---

## 2. Metodologia

- **Dispositius auditats** (perfils Playwright):
  | Perfil | Viewport | Notes |
  |--------|----------|-------|
  | `desktop` | 1280×800 | Chromium escriptori |
  | `tablet-portrait` | 768×1024 | tàctil — **cas d'ús principal** |
  | `tablet-landscape` | 1024×768 | tàctil |
  | `mobile` | 393×851 | Pixel 5, tàctil |

- **Rutes:** `/login`, `/home`, `/persons`, `/persons/new`, `/rehearsals`, `/performances`, `/pinyes`, `/config`.
- **Mètriques objectives per ruta × dispositiu:**
  - Overflow horitzontal del document (`scrollWidth − clientWidth`).
  - Elements més amples que el viewport (taules/panels que forcen scroll intern).
  - Tap targets < 24px (mínim WCAG 2.5.8 AA; recomanat 44px per 2.5.5).
  - Errors de consola i `pageerror`.
  - Captura full-page.
- **Estratègia d'auth:** login únic per dispositiu + navegació client-side (SPA), per respectar el rate-limit del backend (`@Throttle` 10 req/60s a `/api/auth`) i evitar refreshos de token per recàrrega.

---

## 3. Troballes 🔴 Alta

### H1 — La taula d'**Actuacions** (`/performances`) és més ampla que qualsevol pantalla

La taula fa **1283px** amb 7 de 10 columnes visibles. Desborda el contenidor **fins i tot en desktop (1280px)** i, en mòbil (393px) i tablet, esdevé una taula minúscula amb scroll horitzontal.

- **Detectat a:** tots els dispositius (desktop, tablet-portrait/landscape, mobile).
- **Selector:** `app-data-table > div.overflow-x-auto > table.table.table-sm` (1283px).
- **Captura:** `audit-results/screenshots/mobile/performances.png`
- **Recomanació:** reduir columnes per defecte segons amplada, o (millor) activar el mode targeta en pantalles estretes (vegeu H2). Revisar per què amb 7 columnes ja se supera 1280px (amples de columna massa generosos / `white-space: nowrap`).

### H2 — Les taules de dades no fan _reflow_ en tablet/mòbil

`/persons` (785px) i `/rehearsals` (885px) caben en desktop i tablet-landscape, però **desborden en tablet-portrait (768px) i mòbil (393px)**, quedant scrollejables horitzontalment. En tablet-portrait la darrera columna (**Accions**) queda tallada a `/persons` (785 > 768).

- **Detectat a:** `mobile`, `tablet-portrait` (persons, rehearsals, performances).
- **Captures:** `mobile/persons-list.png`, `tablet-portrait/persons-list.png`, `mobile/rehearsals.png`.
- **Recomanació:** afegir un **mode targeta/stacked** al component compartit `app-data-table` per a breakpoints `< lg`, de manera que cada fila es renderitzi com una fitxa (àlies + nom + posicions + estat + accions). Home i Config ja demostren que aquest patró funciona molt bé a l'app. Un sol canvi al component compartit beneficia totes les llistes.

---

## 4. Troballes 🟠 Mitjana

### M1 — Botó "×" de xip de filtre actiu massa petit (11×20px)

El botó per treure un filtre actiu (`app-active-filters > div.badge.badge-outline > button`) fa **11×20px**, molt per sota del mínim de 24px. Present a `rehearsals`, `performances` (tots els dispositius, també desktop).
- **Recomanació:** augmentar l'àrea tàctil a ≥24px (idealment 44px) amb padding/`min-w`/`min-h`, mantenint la icona petita.

### M2 — Checkbox de filtres 16×16px

El checkbox "Sols actius" i els de posicions (`input.checkbox.checkbox-xs`) fan **16×16px**. Per sota del mínim tàctil.
- **Recomanació:** en vistes tàctils, pujar a `checkbox-sm`/24px o ampliar la zona clicable amb el `<label>` envoltant.

### M3 — Camp de data en format US `mm/dd/yyyy`

A `/persons/new`, l'`<input type="date">` es renderitza com `mm/dd/yyyy` (locale en-US) en lloc de `dd/mm/yyyy`.
- **Captura:** `mobile/persons-new.png`.
- **Recomanació:** el format d'un input de data natiu depèn del locale del navegador; per garantir dd/mm/yyyy cal fixar `lang="ca"` a l'`<html>` (o al camp) o usar un date-picker propi. Verificar que l'app declara `lang="ca"`.

### M4 — Navegació només-icones en tablet (sense etiquetes visibles)

Entre `sm` i `lg`, la `tab-nav` amaga les etiquetes (`hidden lg:inline`) i el "tooltip" és `sr-only` (només lectors de pantalla, no apareix al hover/tap). En el **dispositiu principal (tablet)** la navegació queda reduïda a icones sense text.
- **Captura:** `tablet-portrait/persons-list.png` (barra superior).
- **Recomanació:** mostrar etiquetes també en `md`, o afegir un tooltip visible real; en tàctil no hi ha hover, així que les etiquetes visibles són preferibles.

### M5 — Formulari `Persona nova` comprimit en mòbil

El layout etiqueta-esquerra / input-dreta fa que etiquetes llargues ("Data de naixement", "Alçada espatlles (cm)", "Primer cognom") trenquin en 2-3 línies i estrenyin l'input.
- **Captura:** `mobile/persons-new.png`.
- **Recomanació:** apilar etiqueta sobre input en `< sm` (`flex-col`), guanyant amplada per al camp.

---

## 5. Troballes 🟡 Baixa (poliment)

- **L1** — Badges de posició i toggles del formulari ~16-20px d'alçada (`button.badge.badge-sm`, `input.toggle.toggle-sm`) a `/persons/new`.
- **L2** — Dates en Title-Case: "Dimecres, 15 **De Juliol Del** 2026" (Home). Un `text-transform: capitalize` sobre la data; hauria de ser "de juliol del".
- **L3** — Text de xip redundant: "Temporada: **Temporada** 2025-2026" a `/performances`.
- **L4** — Columna "Accions" tallada a `tablet-portrait/persons` (785 vs 768px) — es resol amb H2.
- **L5** — Els `<input>` es mesuren a 20px d'alçada perquè el control real és dins d'un wrapper `.input-bordered` més gran; visualment correcte, però el focus recau en un element petit.

---

## 6. Aspectes positius

- ✅ **Cap overflow horitzontal de document** en cap ruta ni dispositiu (bona contenció amb `overflow-x-auto`).
- ✅ **Zero errors de consola / pageerror** a les 32 combinacions.
- ✅ **Home i Configuració**: layout de targetes apilades, excel·lent en mòbil i tablet (patró a replicar).
- ✅ Login, menú hamburguesa mòbil ("Navegar") i modal d'onboarding de Pinyes funcionen i es veuen bé.
- ✅ Filtres de llista es reapilen correctament en vertical en mòbil.

---

## 7. Cobertura i buits

Aquesta primera passada cobreix **navegació + mesura estàtica** de les rutes de nivell superior. Queda pendent (recomanat per a properes iteracions):

- 🎯 **Editor de Pinyes / canvas Konva i `SegmentWorkspace`** — la superfície amb més **gestos tàctils** (pan, zoom, drag d'assignació). L'auditoria només ha arribat al **llistat** `/pinyes`, no a l'editor (requereix un id de figura). Cal un joc de tests de **gestos** dedicat (pinch-zoom, drag, tap) sobre `tablet` i `mobile`.
- Detall de persona (`/persons/:id`), modals (invitació, vincular usuari), i el flux de sync SSE.
- Interaccions dins de pàgina (obrir dropdowns, toggle de columnes, ordenació) — no s'han exercitat.
- iPad real amb **WebKit/Safari** (aquí s'ha usat Chromium amb viewport d'iPad), phone landscape i desktop gran (1920px).

---

## 8. Pla d'iteració proposat (mòdul **Persons** primer)

Segons la prioritat acordada, començar per Persons i propagar al component compartit:

1. **`app-data-table` → mode targeta responsive** (`< lg`): resol H1, H2 i L4 d'una sola vegada per a totes les llistes.
2. **Tap targets tàctils** (M1, M2, L1): normalitzar botons de xip, checkboxes i toggles a ≥24px en vistes tàctils.
3. **Formulari de persona** (M5): apilar etiqueta/input en mòbil.
4. **Localització de dates** (M3, L2): fixar `lang="ca"` i revisar el `capitalize` de dates.
5. Un cop validat a Persons, aplicar el mateix a `rehearsals`/`performances` i afegir tests de gestos per a Pinyes.

---

## 9. Infraestructura afegida

| Fitxer | Funció |
|--------|--------|
| `apps/dashboard-e2e/playwright.audit.config.ts` | Config d'auditoria (4 perfils de dispositiu, arrenca el dashboard) |
| `apps/dashboard-e2e/src/audit/responsive-audit.spec.ts` | Test: recorre rutes client-side i mesura mètriques + captures |
| `apps/dashboard-e2e/src/audit/login-helper.ts` | Login via UI (credencials per env, mai hardcodejades) |
| `apps/dashboard-e2e/src/audit/paths.ts` | Rutes de sortida compartides |
| `package.json` | Scripts `audit:responsive` i `audit:report` |

Els artefactes (`.auth/`, `audit-results/`, `playwright-report*/`) estan al `.gitignore`.
