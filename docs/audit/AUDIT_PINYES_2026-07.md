# Auditoria — Mòdul **Pinyes**

**Data:** 2026-07-15
**Abast:** `apps/dashboard` → feature `pinyes`. Rutes de llistat, editors de figura/composició i **workspace de segment** (5 pestanyes) + projecció.
**Eina:** Playwright (Chromium) sobre 4 perfils: `desktop` 1280×800, `tablet-portrait` 768×1024, `tablet-landscape` 1024×768, `mobile` 393×851.
**Dades:** BD de dev real (figura "Branca", segment amb 99 confirmats).
**Reproduir:** `pnpm audit:responsive` (spec `pinyes-audit.spec.ts`). Resultats a `apps/dashboard-e2e/audit-results/pinyes/`.

> Aquest és el mòdul amb **més superfície de gestos tàctils** (canvas Konva + drag d'assignació), i el punt crític per a l'estratègia mòbil/tablet.

---

## 1. Resum executiu

El **workspace de segment i els editors de figura estan ben resolts en tablet (el dispositiu objectiu) i desktop**, però **es degraden o es trenquen en amplada de telèfon (393px)**. Com que la PWA i part del dashboard s'orienten a tablet, el veredicte és:

- ✅ **Tablet-portrait / landscape / desktop:** experiència completa i usable (canvas sencer, pestanyes visibles, panell de persones al costat).
- 🔴 **Mòbil (telèfon):** la pestanya **Distribució es trenca** (layout desplaçat fora de pantalla + error de render de canvas), **Previsualitza llança un error de JS**, la barra de pestanyes desborda i el canvas d'assignació queda massa petit per treballar-hi amb gestos.

**Recomanació d'estratègia:** declarar el workspace de Pinyes com a **tablet-first (≥768px)** i, en telèfon, o bé mostrar un avís "millor en tablet" o dissenyar un layout mòbil dedicat (canvas a pantalla completa amb panells commutables, no costat a costat).

---

## 2. Rutes auditades

| Ruta | `name` | Estat |
|------|--------|-------|
| `/pinyes` | template-list | ✅ OK a tots els dispositius |
| `/pinyes/templates/:id/edit` | template-editor | ✅ OK |
| `/pinyes/templates/new` | template-new | ✅ OK |
| `/pinyes/compositions/new` | composition-new | ✅ OK (no hi ha composicions a la BD; només s'ha auditat "new") |
| `.../assign?tab=pinyes` | workspace-pinyes | 🟠 OK en tablet/desktop; atapeït en mòbil |
| `.../assign?tab=troncs` | workspace-troncs | 🟠 idem |
| `.../assign?tab=distribucio` | workspace-distribucio | 🔴 **trencat en mòbil** |
| `.../assign?tab=nodes` | workspace-nodes | 🟠 OK tablet/desktop |
| `.../assign?tab=previsualitza` | workspace-previsualitza | 🔴 **error JS en mòbil** |
| `.../project` (standalone) | projection | ⚠️ no assolible de forma fiable per navegació SPA (vegeu §6) |

---

## 3. Troballes 🔴 Alta

### P-H1 — Pestanya **Distribució** trencada en mòbil

A 393px, el contingut de la pestanya Distribució es **desplaça fora de pantalla per l'esquerra** (etiquetes tallades: "...ats", "...pleta", camps de coordenades X/Y parcialment visibles) i el canvas **no arriba a renderitzar-se**.

- **Error de consola:** `InvalidStateError: Failed to execute 'drawImage' on 'CanvasRenderingContext2D': The image argument is a canvas element with a width or height of 0` (Konva intenta dibuixar sobre un canvas de mida 0).
- **Causa d'arrel:** layout de dues columnes amb un `aside` d'**amplada fixa `w-70` (280px)** (`app-figure-properties-panel`) que no cap en 393px i empeny la resta fora del viewport; el contenidor del canvas queda a 0px i Konva peta.
- **Captura:** `audit-results/pinyes/screenshots/mobile/workspace-distribucio.png`
- **No es reprodueix** en tablet-portrait/landscape/desktop (0 errors, 0 overflow).
- **Recomanació:** en `< md`, apilar el panell de propietats sota/sobre el canvas (o convertir-lo en drawer), amb amplada fluida en lloc de `w-70` fix; garantir que el canvas mai rep mida 0.

### P-H2 — **Previsualitza** llança un error de JS en mòbil

- **Error:** `TypeError: Cannot read properties of undefined (reading 'nativeElement') at ProjectionViewComponent.ngAfterViewInit`.
- El `@ViewChild` del contenidor de projecció és `undefined` a `ngAfterViewInit` quan s'incrusta (`[embedded]="true"`) en amplada de telèfon (probablement l'element no es renderitza sota un `@if`/mida 0).
- **Captura:** `mobile/workspace-previsualitza.png`
- **Recomanació:** protegir l'accés a `nativeElement` (comprovar existència / `viewChild` signal + `afterNextRender`) i assegurar que el contenidor existeix abans de mesurar-lo.

---

## 4. Troballes 🟠 Mitjana

### P-M1 — La barra de 5 pestanyes del workspace desborda en mòbil

`nav.tabs` fa **455px** > 393px: en telèfon les pestanyes queden tallades ("Distribució" es veu a mitges). No hi ha scroll ni col·lapse.
- **Recomanació:** en mòbil, fer la barra scrollable horitzontalment (`overflow-x-auto`) o convertir-la en selector compacte (segmented/dropdown).

### P-M2 — Canvas d'assignació massa petit per a gestos en mòbil

A la pestanya Pinyes en telèfon, el canvas i el panell "Persones" es reparteixen 393px → el canvas queda a ~200px i **tallat per l'esquerra**. Assignar arrossegant persones a posicions és impracticable a aquesta mida.
- **Captura:** `mobile/workspace-pinyes.png`
- **Recomanació:** en mòbil, canvas a amplada completa amb el panell de persones com a drawer/bottom-sheet commutable, en lloc de costat a costat.

---

## 5. Aspectes positius

- ✅ **Tablet-portrait (dispositiu objectiu):** el workspace es veu complet i usable — canvas sencer de la figura, 5 pestanyes visibles amb icona, panell de persones lateral amb cerca i deltes d'alçada. Captura: `tablet-portrait/workspace-pinyes.png`.
- ✅ Editors de figura (`template-editor`, `template-new`) i `composition-new`: sense overflow ni errors en cap dispositiu.
- ✅ Llistat `/pinyes` amb modal d'onboarding de 3 passos, correcte en mòbil.
- ✅ Zero errors de consola en tablet/desktop a tot el workspace.
- ✅ Cap overflow horitzontal **de document** (els desbordaments són interns, contenidors amb `overflow`).

---

## 6. Límits de la mesura

- **Ruta standalone `/pinyes/.../project`:** no s'ha pogut assolir de forma fiable per navegació client-side (redirigeix / no resol). La **renderització de la projecció sí que queda coberta** per la pestanya *Previsualitza*, que incrusta el mateix `ProjectionViewComponent`. Cal una passada específica amb navegació completa (o des de la UI) per auditar la vista de projecció a pantalla completa.
- **Gestos reals** (pinch-zoom, drag d'assignació, pan del canvas) **no s'han exercitat** — l'auditoria mesura layout estàtic + errors. Recomanat com a següent fase: tests de gest amb `page.touchscreen` / `dispatchEvent` sobre `tablet` i `mobile`.
- **Composicions:** la BD de dev no en té cap; només s'ha auditat el formulari de creació.

---

## 7. Accions proposades (prioritzades)

1. 🔴 **P-H1** — Layout responsive de la pestanya Distribució (`aside w-70` → fluid/drawer en `< md`); evitar canvas de mida 0.
2. 🔴 **P-H2** — Blindar `ProjectionViewComponent.ngAfterViewInit` contra `nativeElement` undefined.
3. 🟠 **P-M1/P-M2** — Barra de pestanyes scrollable + canvas full-width amb panells commutables en mòbil.
4. Definir el **contracte de dispositiu**: si el workspace és tablet-first, afegir un *empty state* "Obre en tablet per a una millor experiència" per sota de `sm`.
5. Afegir tests de **gestos** per validar assignació tàctil abans de donar per bo el flux en tablet/PWA.
