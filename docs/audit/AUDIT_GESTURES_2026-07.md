# Auditoria — **Gestos tàctils** (canvas de Pinyes)

**Data:** 2026-07-15
**Abast:** superfície d'assignació del workspace de Pinyes (`FigureCanvasComponent`, mode `segment-assignment`), que és el punt amb més interacció tàctil de l'app.
**Eina:** Playwright amb **gestos tàctils reals via CDP** (`Input.dispatchTouchEvent`) sobre perfils tàctils: `mobile` (Pixel 5), `tablet-portrait` 768×1024, `tablet-landscape` 1024×768.
**Reproduir:** `pnpm audit:gestures` (spec `audit-gestures/pinyes-gestures.spec.ts`). Resultats a `apps/dashboard-e2e/audit-results/gestures/`.

> Observació coarse per disseny: l'estat de Konva viu en JS (no al DOM), així que es mesura "el gest produeix un canvi visible / no peta" via diferència de píxels del canvas, valor del selector de zoom i errors de consola.

---

## 1. Resum executiu

El canvas **no ofereix gestos de navegació tàctils natius**. Concretament, a tots els dispositius provats:

| Gest | Resultat |
|------|----------|
| **Pinch-to-zoom** (dos dits) | ❌ no fa res |
| **Wheel-zoom** (roda ratolí) | ❌ no fa res |
| **Pan** amb un dit (drag) | ❌ no fa res |
| **Pan** amb ratolí (drag) | ❌ no fa res |
| **Zoom via desplegable** (`select`) | ✅ funciona (25%–300%) |
| **Assignació per tap** (persona → node) | ✅ tablet · ❌ mòbil |
| Errors de consola durant els gestos | ✅ cap |

**Conclusió:** el zoom depèn exclusivament d'un **desplegable**, i **no hi ha pan ni pinch**. En tablet és treballable (tap per assignar funciona), però en **mòbil el canvas queda a 73px d'ample** i és inservible.

---

## 2. Troballes 🔴 Alta

### GE-H1 — Sense **pinch-to-zoom** ni **wheel-zoom**

`FigureCanvasComponent` no registra cap handler de `wheel` ni de pinch; el zoom només es controla amb el `select.zoom-selector` (opcions fixes 25%–300%) i el botó "ajusta a la pantalla". En una eina orientada a tablet/tàctil, l'absència del gest de zoom més bàsic (pinç) és una mancança important.
- **Mesura:** `pinchChangedZoom=false`, `wheelChangedZoom=false` a `mobile`, `tablet-portrait`, `tablet-landscape`; `zoomDropdownWorks=true`.
- **Recomanació:** afegir pinch-to-zoom (i wheel-zoom en desktop) centrat al punt dels dits, mantenint el desplegable com a alternativa.

### GE-H2 — Sense **pan** (arrossegar el llenç) en mode assignació

Ni el drag amb un dit ni amb ratolí mouen el llenç (`draggable` només actiu en mode editor). Si la figura no cap sencera, no hi ha manera de recórrer-la.
- **Mesura:** `panChangedCanvas=false` i `mouseDragPanChanged=false` a tots els dispositius.
- **Recomanació:** habilitar el pan del stage (drag d'un dit sobre zona buida) en mode `segment-assignment`, o com a mínim quan el contingut excedeix el viewport.

### GE-H3 — Canvas inservible en mòbil (73px d'amplada)

A la pestanya Pinyes en `mobile`, el llenç comparteix els 393px amb el panell "Persones" i queda reduït a **73px d'ample**. L'assignació per tap no arriba a impactar cap node (`assignFlowChangedView=false`), mentre que en tablet sí (`true`).
- **Recomanació:** en mòbil, llenç a amplada completa amb el panell de persones com a drawer/bottom-sheet (coherent amb la recomanació P-M2 de `AUDIT_PINYES_2026-07.md`). Sense pan/zoom + 73px, el flux és impracticable al telèfon.

---

## 3. Aspectes positius

- ✅ **Assignació per tap funciona en tablet:** seleccionar una persona i tocar un node canvia l'estat de la vista (`assignFlowChangedView=true` en tablet-portrait i landscape).
- ✅ **Zoom via desplegable robust** (valor s'actualitza i el llenç re-renderitza) a tots els dispositius.
- ✅ **Zero errors** de consola durant tota la bateria de gestos (un cop descomptat el 403 de bootstrap, aliè).

---

## 4. Límits de la mesura

- No es verifica el **resultat semàntic** de l'assignació (quin node ha quedat assignat), només que la vista canvia — l'estat viu en signals de `AssignmentStateService`, no al DOM. Per a validació semàntica caldria exposar hooks de test o assertir contra el backend.
- No s'han provat gestos multi-touch avançats (rotació) ni el drag específic node-a-node dins del llenç.
- La resta de modes del canvas (`editor`, `composition`) poden tenir pan/zoom diferents (l'editor sí que és `draggable`); aquí només s'audita `segment-assignment`.

---

## 5. Accions proposades

1. 🔴 **GE-H1** — Implementar pinch-to-zoom (+ wheel-zoom en desktop).
2. 🔴 **GE-H2** — Habilitar pan del llenç en mode assignació.
3. 🔴 **GE-H3** — Layout mòbil del workspace (llenç full-width + panell commutable).
4. Afegir tests de gest **semàntics** (amb hooks o verificació al backend) quan s'implementin els gestos anteriors.
