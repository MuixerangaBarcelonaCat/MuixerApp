# Seguiment de correccions d'auditoria

Centre de control de tot el que surt dels informes d'auditoria (`docs/audit/*`).
Cada fila és un **work item** de mida PR. Res s'implementa fins que la seva
**Decisió** és ✅ Aprovat. Cada PR va contra `develop` i actualitza aquest fitxer.

_Actualitzat: 2026-07-21_

---

## Com funciona

1. **Decisió primer.** Cada work item comença com 🆕 *Pendent*. Abans d'implementar-lo es marca ✅ *Aprovat* o ❌ *Descartat* (amb motiu). Res es toca sense aprovació.
2. **Una PR per work item.** Branca `fix/audit-<slug>` (o `feat/`) des de `develop` → PR cap a `develop` → revisió dels companys.
3. **Traçabilitat.** Cada work item llista les troballes que cobreix (IDs dels informes). Veure taula de traçabilitat a §4.
4. **Actualització.** En obrir la PR, l'estat passa a 🟣 *En PR*; en fusionar-se, ✔️ *Fet* (amb enllaç a la PR).

### Llegenda

**Decisió:** 🆕 Pendent · ✅ Aprovat · ❌ Descartat · ⏸️ Ajornat
**Estat:** ⬜ Sense començar · 🚧 En curs · 🟣 En PR · ✔️ Fet
**Esforç:** XS (<1h) · S (~mig dia) · M (~1-2 dies) · L (>2 dies)

---

## 1. Work items

| ID | Work item | Àrea | Sev | Esforç | Troballes | Decisió | Estat | PR |
|----|-----------|------|-----|--------|-----------|---------|-------|----|
| WI-01 | Investigar i resoldre el **403 de bootstrap** (crida sense permisos en carregar) | Transversal | 🔴 | S | PE-H1, PW-M1 | 🆕 | ⬜ | — |
| WI-02 | **Mode targeta responsive** a `app-data-table` (`< lg`) | Transversal | 🔴 | L | PE-M1, EV-H1, EV-M1, CF-L2 | 🆕 | ⬜ | — |
| WI-03 | **Normalitzar tap targets ≥24px** (chips, checkboxes, enllaços, badges) | Transversal | 🟠 | M | PE-L1, PE-L2, EV-M3, CF-L1, PW-L3, PW-L4 | 🆕 | ⬜ | — |
| WI-04 | **Localització de dates** (Title-Case a Home; input date ja OK) | Transversal | 🟠 | S | PE-M3(data), UX-L2 | ✅ | ✔️ | [#80](https://github.com/MuixerangaBarcelonaCat/MuixerApp/pull/80) (fusionada a develop) |
| WI-05 | **Formulari Persona**: apilar etiqueta/input en mòbil | Persons | 🟠 | S | PE-M3(layout) | 🆕 | ⬜ | — |
| WI-06 | **Detall Persona**: `flex-wrap` a les barres de botons (no tallar en mòbil) | Persons | 🟠 | S | PE-M2 | 🆕 | ⬜ | — |
| WI-07 | **Detall Persona**: no duplicar àlies a la capçalera | Persons | 🟡 | XS | PE-L3 | ✅ | ✔️ | [#81](https://github.com/MuixerangaBarcelonaCat/MuixerApp/pull/81) (fusionada a develop) |
| WI-08 | **Detall Event**: assistència com a llista de fitxes en mòbil | Events | 🟠 | M | EV-M2 | 🆕 | ⬜ | — |
| WI-09 | **Nav tablet**: etiquetes visibles / tooltip real (no només icones) | Shell | 🟠 | S | UX-M4 | 🆕 | ⬜ | — |
| WI-10 | **Pinyes**: arreglar pestanya **Distribució** en mòbil (`aside w-70` fluid + canvas mai 0px) | Pinyes | 🔴 | M | P-H1 | 🆕 | ⬜ | — |
| WI-11 | **Pinyes**: blindar `ProjectionViewComponent.ngAfterViewInit` (`nativeElement`) | Pinyes | 🔴 | S | P-H2 | ✅ | ✔️ | [#78](https://github.com/MuixerangaBarcelonaCat/MuixerApp/pull/78) (fusionada a develop) |
| WI-12 | **Pinyes**: barra de 5 pestanyes scrollable en mòbil | Pinyes | 🟠 | S | P-M1 | 🆕 | ⬜ | — |
| WI-13 | **Pinyes**: layout mòbil del workspace (canvas full-width + panell drawer) | Pinyes | 🔴 | L | P-M2, GE-H3 | 🆕 | ⬜ | — |
| WI-14 | **Pinyes gestos**: pinch-to-zoom (+ wheel-zoom desktop) | Pinyes | 🔴 | M | GE-H1 | 🆕 | ⬜ | — |
| WI-15 | **Pinyes gestos**: pan del llenç en mode assignació | Pinyes | 🔴 | M | GE-H2 | 🆕 | ⬜ | — |
| WI-16 | **PWA**: contenidor `max-w` centrat en tablet/desktop | PWA | 🟡 | XS | PW-L1 | ✅ | 🟣 | `fix/audit-pwa-max-width` |
| WI-17 | **PWA**: amplada del toggle "Vinc/No vinc" (no trencar en 2 línies) | PWA | 🟡 | XS | PW-L2 | 🆕 | ⬜ | — |
| WI-18 | **PWA offline**: verificar en desplegament real + endurir el test | PWA | ⚠️ | S | PB-offline | 🆕 | ⬜ | — |
| WI-19 | **PWA manifest**: confirmar icones 192px i 512px | PWA | 🟡 | XS | PB-icons | 🆕 | ⬜ | — |
| WI-20 | **Estabilitzar tests flaky de components de canvas** (`nodes-tab`, `troncs-tab`, `template-editor`, `person-panel`) — bloquegen el flux de PR del dashboard | Dashboard/CI | 🔴 | M | CI-flaky | ✅ | 🟣 | `fix/audit-flaky-canvas-tests` |

> **Nota d'ordre de treball:** la infra d'auditoria + informes + aquest seguiment ja són a `develop` (PR #79). La **PWA** també s'hi ha integrat (PR #82) amb els scripts `pwa:*` i les deps `@angular/animations` + `@angular/service-worker` → els WI de PWA (16-19) ja es poden treballar. Els fixes es branquegen des de `develop` amb `fix/audit-<slug>`.

---

## 2. Decisions preses

_(Buit — s'omple a mesura que es decideix cada work item, amb data i motiu.)_

| Data | Work item | Decisió | Motiu |
|------|-----------|---------|-------|
| 2026-07-17 | WI-11 | ✅ Aprovat → ✔️ Fet | Quick win: error JS real, risc baix, bon primer PR per rodar el flux. Implementat amb `viewChild()` + `effect` i verificat en mòbil (Previsualitza sense error, projecció renderitza). **Fusionada a develop via PR #78 (2026-07-17).** |
| 2026-07-19 | WI-04 | ✅ Aprovat → ✔️ Fet | Fix del Title-Case de dates a Home (capitalitzar només la 1a lletra a `formatDate`, treure la classe CSS `capitalize`). **L'input de data no necessita canvi**: `<html lang="ca">` ja hi és i el format del natiu `<input type="date">` el marca el locale del navegador (el `mm/dd/yyyy` era artefacte de l'entorn de test). **Fusionada a develop via PR #80.** |
| 2026-07-19 | WI-07 | ✅ Aprovat → ✔️ Fet | Detall Persona: no repetir l'àlies com a subtítol de la capçalera (`headerSubtitle` computat que només mostra el nom complet si difereix de l'àlies). **Fusionada a develop via PR #81.** |
| 2026-07-20 | PWA (integració) | ✅ Integrada | S'ha baixat la PWA (`feat/pwa-app-start` + story) a `develop` de forma additiva (PR #82): `apps/pwa`, `libs/shared` (`me/` + `LoginRequest`/`AuthResponse`), scripts `pwa:*` i deps `@angular/animations` + `@angular/service-worker`. Build/test/serve verds. ⚠️ Els endpoints de membre (`/auth/me`, me-events) encara no són a l'api de develop → algunes crides faran 404 fins que el backend aterri. |
| 2026-07-21 | WI-20 | ✅ Aprovat → 🟣 En PR | Estabilitzar els 4 specs flaky. **Arrel:** timers reals sense cleanup + IDs basats en `Date.now()` (no Konva; el canvas fill està stubejat a tots). **Fixes:** (producció) netejar el timer idle de 2.5s a `TemplateEditorComponent.ngOnDestroy`; `onCleanup` de l'`effect` de focus a `PersonPanelComponent`; IDs únics amb `generateUUID()` a `troncs-tab` (temp/op). (test) fake timers deterministes a template-editor + person-panel; reset del comptador `assignmentSeq` a nodes-tab. Verificat amb 5 execucions consecutives del suite dashboard sense fallades. Branca `fix/audit-flaky-canvas-tests`. |

---

## 3. Preguntes obertes de procés

- **Aterratge de la infra d'auditoria a `develop`:** ✅ Decidit (2026-07-17) — branca neta `feat/audit-suite` des de `develop` amb només els lliurables d'auditoria (docs + specs e2e + scripts), sense el codi de feature barrejat de `story/playwrite-test`. Les PR de fix branquegen des de `develop`.
- **Rol MEMBER:** cap troballa s'ha validat amb un usuari MEMBER real (tot amb ADMIN). Decidir si es fa una passada abans de tancar certs work items (sobretot PWA).

---

## 4. Traçabilitat troballa → work item

| Informe | Troballa | Work item |
|---------|----------|-----------|
| PERSONS | PE-H1 (403 llistat) | WI-01 |
| PERSONS | PE-M1 (taula sense reflow) | WI-02 |
| PERSONS | PE-M2 (botons detall tallats) | WI-06 |
| PERSONS | PE-M3 (data US / formulari comprimit) | WI-04 / WI-05 |
| PERSONS | PE-L1 (chip × 11px, checkbox 16px) | WI-03 |
| PERSONS | PE-L2 (badges/toggles ~16px) | WI-03 |
| PERSONS | PE-L3 (àlies duplicat capçalera) | WI-07 |
| EVENTS | EV-H1 (taula Actuacions 1283px) | WI-02 |
| EVENTS | EV-M1 (taula assajos 885px) | WI-02 |
| EVENTS | EV-M2 (assistència detall 557px) | WI-08 |
| EVENTS | EV-M3 (tap targets detall) | WI-03 |
| PINYES | P-H1 (Distribució trencada mòbil) | WI-10 |
| PINYES | P-H2 (Previsualitza nativeElement) | WI-11 |
| PINYES | P-M1 (barra pestanyes desborda) | WI-12 |
| PINYES | P-M2 (canvas assignació massa petit) | WI-13 |
| CONFIG | CF-L1 (tap targets subpàgines) | WI-03 |
| CONFIG | CF-L2 (reflow heretat) | WI-02 |
| PWA | PW-M1 (403 login) | WI-01 |
| PWA | PW-L1 (sense max-width desktop) | WI-16 |
| PWA | PW-L2 ("No vinc" trenca) | WI-17 |
| PWA | PW-L3 / PW-L4 (inputs/enllaços ~20px) | WI-03 |
| GESTOS | GE-H1 (sense pinch/wheel zoom) | WI-14 |
| GESTOS | GE-H2 (sense pan) | WI-15 |
| GESTOS | GE-H3 (canvas 73px mòbil) | WI-13 |
| PWA-BEHAVIOR | offline no confirmat | WI-18 |
| PWA-BEHAVIOR | icones 192/512 | WI-19 |
| UX (general) | UX-M4 (nav tablet només icones) | WI-09 |
| UX (general) | UX-L2 (dates Title-Case Home) | WI-04 |
| CI (observació) | CI-flaky (tests de canvas no deterministes) | WI-20 |
