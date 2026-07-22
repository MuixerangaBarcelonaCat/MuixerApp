# Seguiment de correccions d'auditoria

Centre de control de tot el que surt dels informes d'auditoria (`docs/audit/*`).
Cada fila és un **work item** de mida PR. Res s'implementa fins que la seva
**Decisió** és ✅ Aprovat. Cada PR va contra `develop` i actualitza aquest fitxer.

_Actualitzat: 2026-07-21_ (revisió de decisions pendents)

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
| WI-01 | Investigar i resoldre el **403 de bootstrap** (crida sense permisos en carregar) | Transversal | 🔴 | S | PE-H1, PW-M1 | ✅ | ✔️ | [#87](https://github.com/MuixerangaBarcelonaCat/MuixerApp/pull/87) (fusionada a develop) |
| WI-02 | **Mode targeta responsive** a `app-data-table` (`< lg`) | Transversal | 🔴 | L | PE-M1, EV-H1, EV-M1, CF-L2 | ✅ | ✔️ | [#86](https://github.com/MuixerangaBarcelonaCat/MuixerApp/pull/86) (fusionada a develop) |
| WI-03 | **Normalitzar tap targets ≥24px** (chips, checkboxes, enllaços, badges) | Transversal | 🟠 | M | PE-L1, PE-L2, EV-M3, CF-L1, PW-L3, PW-L4 | ✅ | ⬜ | — |
| WI-04 | **Localització de dates** (Title-Case a Home; input date ja OK) | Transversal | 🟠 | S | PE-M3(data), UX-L2 | ✅ | ✔️ | [#80](https://github.com/MuixerangaBarcelonaCat/MuixerApp/pull/80) (fusionada a develop) |
| WI-05 | **Formulari Persona**: apilar etiqueta/input en mòbil | Persons | 🟠 | S | PE-M3(layout) | ✅ | ⬜ | — |
| WI-06 | **Detall Persona**: `flex-wrap` a les barres de botons (no tallar en mòbil) | Persons | 🟠 | S | PE-M2 | ✅ | ✔️ | `fix/audit-person-detail-buttons` (pendent de push/PR) |
| WI-07 | **Detall Persona**: no duplicar àlies a la capçalera | Persons | 🟡 | XS | PE-L3 | ✅ | ✔️ | [#81](https://github.com/MuixerangaBarcelonaCat/MuixerApp/pull/81) (fusionada a develop) |
| WI-08 | **Detall Event**: assistència com a llista de fitxes en mòbil | Events | 🟠 | M | EV-M2 | ✅ | ⬜ | — |
| WI-09 | **Nav tablet**: etiquetes visibles / tooltip real (no només icones) | Shell | 🟠 | S | UX-M4 | ✅ | ⬜ | — |
| WI-10 | **Pinyes**: arreglar pestanya **Distribució** en mòbil (`aside` fluid + canvas mai 0px) | Pinyes | 🔴 | M | P-H1 | ✅ | ✔️ | `fix/audit-pinyes-distribucio-mobile` (pendent de push/PR) |
| WI-11 | **Pinyes**: blindar `ProjectionViewComponent.ngAfterViewInit` (`nativeElement`) | Pinyes | 🔴 | S | P-H2 | ✅ | ✔️ | [#78](https://github.com/MuixerangaBarcelonaCat/MuixerApp/pull/78) (fusionada a develop) |
| WI-12 | **Pinyes**: barra de 5 pestanyes scrollable en mòbil | Pinyes | 🟠 | S | P-M1 | ✅ | 🟣 | `fix/audit-pinyes-tab-scroll` (pendent d'obrir PR) |
| WI-13 | **Pinyes**: en mòbil, missatge "no disponible" al workspace d'assignació (abast reduït — abans: canvas full-width + drawer) | Pinyes | 🟠 | S | P-M2, GE-H3 | ✅ | ⬜ | — |
| WI-14 | **Pinyes gestos**: pinch-to-zoom (+ wheel-zoom desktop) | Pinyes | 🔴 | M | GE-H1 | ⏸️ | ⬜ | — |
| WI-15 | **Pinyes gestos**: pan del llenç en mode assignació | Pinyes | 🔴 | M | GE-H2 | ⏸️ | ⬜ | — |
| WI-16 | **PWA**: contenidor `max-w` centrat en tablet/desktop | PWA | 🟡 | XS | PW-L1 | ✅ | ✔️ | [#84](https://github.com/MuixerangaBarcelonaCat/MuixerApp/pull/84) (fusionada a develop) |
| WI-17 | **PWA**: amplada del toggle "Vinc/No vinc" (no trencar en 2 línies) | PWA | 🟡 | XS | PW-L2 | ✅ | ✔️ | [#85](https://github.com/MuixerangaBarcelonaCat/MuixerApp/pull/85) (fusionada a develop) |
| WI-18 | **PWA offline**: verificar en desplegament real + endurir el test | PWA | ⚠️ | S | PB-offline | ⏸️ | ⬜ | — |
| WI-19 | **PWA manifest**: confirmar icones 192px i 512px | PWA | 🟡 | XS | PB-icons | ✅ | ✔️ | verificat (sense codi) |
| WI-20 | **Estabilitzar tests flaky de components de canvas** (`nodes-tab`, `troncs-tab`, `template-editor`, `person-panel`) — bloquegen el flux de PR del dashboard | Dashboard/CI | 🔴 | M | CI-flaky | ✅ | ✔️ | [#83](https://github.com/MuixerangaBarcelonaCat/MuixerApp/pull/83) (fusionada a develop) |

> **Nota d'ordre de treball:** la infra d'auditoria + informes + aquest seguiment ja són a `develop` (PR #79). La **PWA** també s'hi ha integrat (PR #82) amb els scripts `pwa:*` i les deps `@angular/animations` + `@angular/service-worker` → els WI de PWA (16-19) ja es poden treballar. Els fixes es branquegen des de `develop` amb `fix/audit-<slug>`.

---

## 2. Decisions preses

| Data | Work item | Decisió | Motiu |
|------|-----------|---------|-------|
| 2026-07-17 | WI-11 | ✅ Aprovat → ✔️ Fet | Quick win: error JS real, risc baix, bon primer PR per rodar el flux. Implementat amb `viewChild()` + `effect` i verificat en mòbil (Previsualitza sense error, projecció renderitza). **Fusionada a develop via PR #78 (2026-07-17).** |
| 2026-07-19 | WI-04 | ✅ Aprovat → ✔️ Fet | Fix del Title-Case de dates a Home (capitalitzar només la 1a lletra a `formatDate`, treure la classe CSS `capitalize`). **L'input de data no necessita canvi**: `<html lang="ca">` ja hi és i el format del natiu `<input type="date">` el marca el locale del navegador (el `mm/dd/yyyy` era artefacte de l'entorn de test). **Fusionada a develop via PR #80.** |
| 2026-07-19 | WI-07 | ✅ Aprovat → ✔️ Fet | Detall Persona: no repetir l'àlies com a subtítol de la capçalera (`headerSubtitle` computat que només mostra el nom complet si difereix de l'àlies). **Fusionada a develop via PR #81.** |
| 2026-07-20 | PWA (integració) | ✅ Integrada | S'ha baixat la PWA (`feat/pwa-app-start` + story) a `develop` de forma additiva (PR #82): `apps/pwa`, `libs/shared` (`me/` + `LoginRequest`/`AuthResponse`), scripts `pwa:*` i deps `@angular/animations` + `@angular/service-worker`. Build/test/serve verds. ⚠️ Els endpoints de membre (`/auth/me`, me-events) encara no són a l'api de develop → algunes crides faran 404 fins que el backend aterri. |
| 2026-07-21 | WI-20 | ✅ Aprovat → ✔️ Fet | Estabilitzar els 4 specs flaky. **Arrel:** timers reals sense cleanup + IDs basats en `Date.now()` (no Konva; el canvas fill està stubejat a tots). **Fixes:** (producció) netejar el timer idle de 2.5s a `TemplateEditorComponent.ngOnDestroy`; `onCleanup` de l'`effect` de focus a `PersonPanelComponent`; IDs únics amb `generateUUID()` a `troncs-tab` (temp/op). (test) fake timers deterministes a template-editor + person-panel; reset del comptador `assignmentSeq` a nodes-tab. Verificat amb 5 execucions consecutives del suite dashboard sense fallades. **Fusionada a develop via PR #83.** |
| 2026-07-21 | WI-16 | ✅ Aprovat → ✔️ Fet | PWA sense max-width en tablet/desktop (PW-L1). `mx-auto max-w-2xl` al `<main>` del `AppShellComponent` + fila de pestanyes del `bottom-tab-bar` centrada. **Fusionada a develop via PR #84.** |
| 2026-07-21 | WI-17 | ✅ Aprovat → ✔️ Fet | Toggle "Vinc/No vinc" trencava en 2 línies (PW-L2). `whitespace-nowrap` als dos botons de l'`AttendanceButtonComponent`. **Fusionada a develop via PR #85.** |
| 2026-07-21 | WI-19 | ✅ Aprovat → ✔️ Fet | `manifest.webmanifest` ja declara icones 192, 512 i 512 maskable (fitxers a `public/icons/`). Cap canvi de codi; només verificació. |
| 2026-07-21 | WI-18 | ⏸️ Ajornat | El SW només s'activa en build de producció i PB-offline demana validació en desplegament real. S'ajorna fins que hi hagi un entorn de prod desplegat; llavors s'endurirà el test (localitzador `app-shell`, assert dur d'offline). |
| 2026-07-21 | WI-01 | ✅ Aprovat → 🟣 En PR | **403/401 de bootstrap** (PE-H1 dashboard + PW-M1 PWA). **Arrel:** `provideAppInitializer → AuthService.silentRefresh()` cridava `/auth/refresh` incondicionalment a cada càrrega; sense sessió el backend retorna 401/403 i el navegador el registra a consola (no suprimible des de JS). **Fix (als dos clients):** hint `muixer_has_session` a localStorage (es posa al login/refresh OK, es treu a `clearState`); `silentRefresh` omet la crida si no hi ha hint → cap soroll a la pantalla de login ni en primera visita. Verificat: unit tests (dashboard 1296 + pwa 108, amb test nou "skips refresh") i E2E al navegador (càrrega neta de `/login` = 0 crides `/api`; login → hint + `/home`). Branca `fix/audit-bootstrap-403`. |
| 2026-07-21 | WI-02 | ✅ Aprovat → ✔️ Fet | Mode targeta responsive a `app-data-table` sota `lg` (PE-M1, EV-H1, EV-M1, CF-L2). **Disseny:** camp additiu `primary?` a `ColumnDef` (marca la columna-títol; fallback 1a); senyal `cardMode` per `matchMedia('(max-width:1023.98px)')` amb fallback a taula quan no hi ha `matchMedia` (jsdom) → els specs existents no canvien; render `@if (cardMode())` targetes `@else` taula (mai doble DOM). Targeta = títol + menú d'accions + files etiqueta→valor (respecta badge/pills/colorBadges), amb `groupSeparator` i `opacity-60` de grup secundari. Marcada `primary` a alias/title/email dels 3 consumidors. Seasons/Tags (taules fetes a mà) queden fora d'abast. Verificat: suite dashboard 1295 tests OK (+5 card-mode), lint 0 errors, i captures Playwright mobile (Persons+Actuacions) mostren targetes sense overflow. **Nota:** l'aspecte desktop d'EV-H1 (Actuacions 1283px) es manté en taula (< lg és card); follow-up d'amplada de columnes. **Fusionada a develop via PR #86.** |
| 2026-07-21 | WI-01 | 🟣 En PR → ✔️ Fet | **Fusionada a develop via PR #87.** |
| 2026-07-21 | WI-03 | ✅ Aprovat | Fix transversal d'accessibilitat (WCAG tap targets <24px): xips de filtre, checkboxes, enllaços de taula, badges d'acció, inputs/enllaços PWA. Esforç M perquè toca components compartits entre Persons/Events/Config/PWA. **Es fa l'últim de la tanda actual** (després de WI-05/06/08/09/10/12) per minimitzar risc de conflicte amb la resta de branques obertes que toquen els mateixos components compartits. |
| 2026-07-21 | WI-05 | ✅ Aprovat | Apilar etiqueta sobre input en mòbil al formulari Persona nova (PE-M3, part de layout — el fix de format de data ja es va tancar amb WI-04). Esforç S, aïllat al mòdul Persons. |
| 2026-07-22 | WI-06 | ✅ Aprovat → ✔️ Fet | Detall Persona (PE-M2): la fila de botons de capçalera ("Marcar provisional"/"Edita") i la de la secció "Informació de la colla" ("Envia correu d'invitació"/"Enllaça amb usuari existent") es tallaven per la dreta a 393px. **Fix:** `flex-wrap` a les 3 files implicades (capçalera exterior, grup de botons de capçalera, fila de botons de la colla); de pas, corregit `items-left` (classe Tailwind inexistent) → `items-start` a la mateixa fila. TDD: 3 tests nous a `person-detail.component.spec.ts`, vermell→verd. Verificat: suite dashboard verda, lint 0 errors, build ✓, confirmació visual a 393px (botons apilats sense tallar) i 1280px (sense regressió, mateixa disposició d'abans). Branca `fix/audit-person-detail-buttons`. |
| 2026-07-21 | WI-08 | ✅ Aprovat | Llista d'assistència com a targetes en mòbil al detall d'Event (EV-M2): la taula de 557px scrollejava horitzontalment a 393px. Esforç M, aïllat al mòdul Events. |
| 2026-07-21 | WI-09 | ✅ Aprovat | Etiquetes de navegació visibles en tablet (UX-M4): entre `sm` i `lg` el tooltip és `sr-only` (mai visible en tàctil, no hi ha hover). Esforç S, aïllat al shell/nav. |
| 2026-07-21 | WI-10 | ✅ Aprovat → ✔️ Fet | Severitat Alta: `aside` d'amplada fixa no cap a 393px i empeny el canvas fora de pantalla → Konva llança `InvalidStateError` (canvas amb amplada/alçada 0). **Fix de layout:** contenidor `flex flex-col sm:flex-row` (abans sempre fila); `aside` `w-full max-h-[45vh]` en mòbil, `sm:w-[280px]` en tablet/desktop. **Fix defensiu:** `FigureCanvasComponent.resizeStage()` ignora resize a 0×0 (mai crida `stage.width(0)`/`height(0)`), com a xarxa de seguretat independent del layout. **Troballa col·lateral:** la classe original `w-70` no existeix a l'escala d'espaiat per defecte de Tailwind (salta de 64 a 72) i mai havia generat CSS — confirmat buidant `dist/apps/dashboard/browser/styles-*.css` després d'un build net; per això calia `w-[280px]` (sintaxi arbitrària) en lloc de `w-70`. El mateix patró trencat existeix a `composition-editor.component.html` (2 asides) — fora d'abast d'aquest WI, delegat com a tasca separada. TDD: 2 tests nous a `distribucio-tab.component.spec.ts` (classes responsive del contenidor i de l'aside), vermell→verd. Verificat: suite dashboard 1298/1298 ✓, lint 0 errors, build ✓, i confirmació visual al navegador (393px apilat sense error de consola; 1024px fila costat a costat amb aside de 280px, sense regressió). Branca `fix/audit-pinyes-distribucio-mobile`. |
| 2026-07-22 | WI-12 | ✅ Aprovat → 🟣 En PR | Barra de 5 pestanyes desborda en mòbil (P-M1): `nav.tabs` (455px de contingut) no tenia scroll ni col·lapse, i "Distribució" quedava tallada a mitges. **Fix:** `flex-nowrap overflow-x-auto min-w-0` al `nav`, `shrink-0` al grup de navegació prev/next (perquè sigui el `nav` qui s'encongeixi i faci scroll, no els controls de segment). Sense breakpoint: a desktop/tablet ja cap sencer, `overflow-x-auto` és inert. TDD: 2 tests nous a `segment-workspace.component.spec.ts`, vermell→verd. Verificat: suite dashboard verda, lint 0 errors, build ✓, confirmació visual+JS a 393px (scrollWidth 454 > clientWidth 52, `scrollLeft` revela "Distribució") i 1280px (les 5 pestanyes senceres, sense regressió). Branca `fix/audit-pinyes-tab-scroll`. |
| 2026-07-21 | WI-13 | ✅ Aprovat (abast reduït) | **Canvi de disseny respecte al pla original:** en lloc del redisseny complet (canvas full-width + drawer, esforç L), es mostrarà un missatge "no disponible en mòbil, encara no optimitzat — disponible en tablet/desktop" quan es detecti viewport mòbil al workspace d'assignació. Tablet/desktop es mantenen sense canvis. Esforç baixat de L a S. **Pendent abans d'implementar:** re-mesurar amb Playwright la discrepància entre P-M2 (~200px de canvas) i GE-H3 (73px) per fixar bé el llindar del guard mòbil. |
| 2026-07-21 | WI-14 | ⏸️ Ajornat | Pinch/wheel zoom (GE-H1) és una feature nova (no bugfix), esforç M. S'ajorna a més endavant, coherent amb WI-15 (mateix subsistema de gestos del canvas). |
| 2026-07-21 | WI-15 | ⏸️ Ajornat | Pan del llenç (GE-H2), esforç M. S'ajorna junt amb WI-14: pan i zoom són gestos relacionats del mateix `FigureCanvasComponent` i té sentit abordar-los junts en un futur increment de gestos. |

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
