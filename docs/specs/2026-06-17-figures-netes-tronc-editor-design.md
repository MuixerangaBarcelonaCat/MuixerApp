# Figures Netes — Tronc Editor de Primera Classe

> **Data:** 17 de juny de 2026  
> **Estat:** Reviewed  
> **Prerequisits:** P5.6 (tronc visualization), P5.11 (rengles)  
> **Scope:** Template editor, assignment canvas, projection, figure picker

---

## 1. Resum executiu

Les **figures netes** són figures sense pinya (ex: Piló, Castell de Peníscola, Branca). Actualment el model ho suporta (`hasPinya = false`) però l'UX no ofereix un flux de creació ni edició adequat. Aquesta spec converteix el `TroncViewComponent` en un editor autònom de primera classe, amb propietats de node, selecció per tags, i integració completa en assignació i projecció.

**Principi rector:** "Figura neta = Tronc". No existeix el concepte de "prova". Totes les figures sense pinya són figures netes amb el mateix tractament.

---

## 2. Canvis al model de dades

### 2.1 Cap canvi d'esquema

El model actual cobreix tots els casos:

| Concepte | Representació |
|----------|---------------|
| Figura neta | `FigureTemplate { hasPinya: false }` |
| Baixos (terra) | `FigureNode { zone: BASE, z: 0 }` |
| Segons, terçes, etc. | `FigureNode { zone: TRONC, z: 1+ }` |
| Xiqueta (posició superior) | `FigureNode { zone: TRONC, positionType: 'xiqueta' }` |
| Direcció de figura (completa) | `FigureNode { zone: FIGURE_DIRECTION }` → snapshot a `InstanceNode` |
| Direcció de figura (neta) | `InstanceNode { zone: FIGURE_DIRECTION, isAdHoc: true, sourceNodeId: null }` — creat ad-hoc a l'assignació |
| Direcció de xicalla (completa) | `FigureNode { zone: XICALLA_DIRECTION }` → snapshot a `InstanceNode` |
| Direcció de xicalla (neta) | `InstanceNode { zone: XICALLA_DIRECTION, isAdHoc: true, sourceNodeId: null }` — creat ad-hoc a l'assignació |

### 2.2 Nous `positionType` (varchar lliure — no cal migració)

Nous valors convencionals per a nodes de tronc:

| positionType | Label (Catalan) | Color | Descripció |
|-------------|-----------------|-------|------------|
| `puntal` | Puntal | `#795548` | Baix amb funció de contrafort |
| `alçadora` | Alçadora | `#00ACC1` | Persona que alça la xiqueta |
| `xiqueta` | Xiqueta | `#E53935` | Posició superior de la figura |

S'afegeixen als presets existents (`segones`, `terceres`, `quartes`, `quintes`).

### 2.3 Constant `TRONC_NODE_PRESETS` (shared lib)

```typescript
// libs/shared/src/constants/tronc-node-presets.ts
export interface TroncNodePreset {
  positionType: string;
  label: string;
  color: string;
}

export const TRONC_NODE_PRESETS: TroncNodePreset[] = [
  { positionType: 'segones', label: 'Segones', color: '#1E88E5' },
  { positionType: 'terceres', label: 'Terçes', color: '#43A047' },
  { positionType: 'quartes', label: 'Quartes', color: '#FB8C00' },
  { positionType: 'quintes', label: 'Quintes', color: '#8E24AA' },
  { positionType: 'puntal', label: 'Puntal', color: '#795548' },
  { positionType: 'alçadora', label: 'Alçadora', color: '#00ACC1' },
  { positionType: 'xiqueta', label: 'Xiqueta', color: '#E53935' },
];
```

---

## 3. Template Listing — Creació i filtratge

### 3.1 Nou botó "Figura neta"

A `FigureListTabComponent`, al costat del botó "Figura nova":

- **Botó primari**: "Figura nova" → navega a `/pinyes/templates/new` (hasPinya = true per defecte)
- **Botó secundari**: "Figura neta" → navega a `/pinyes/templates/new?hasPinya=false`

Ambdós botons visibles, estil diferenciat (primary vs outline).

### 3.2 Toggle filtre `hasPinya`

Un grup de botons-check (no dropdown) amb 3 estats:

```
[✓ Totes] [  Amb pinya  ] [  Figures netes  ]
```

- Per defecte: "Totes" actiu
- Es passa `hasPinya: true | false | undefined` al servei
- L'API ja suporta el query param `?hasPinya=true|false`

### 3.3 Badge visual

A cada card de figura al llistat:
- Si `hasPinya = false`: badge `<span class="badge badge-xs badge-info">Tronc</span>`

---

## 4. Template Editor — TroncView enhanced

### 4.1 Comportament per a figures netes (`hasPinya = false`)

Quan el `TemplateEditorComponent` carrega un template amb `hasPinya = false`:

1. **El tronc panel s'obre automàticament** al carregar (no cal clic)
2. **Mida ampliada**: El panel floating ocupa ~70% del viewport, centrat
3. **El canvas Konva mostra els nodes BASE** — els baixos es col·loquen al canvas per visualitzar la seva disposició espacial (circular, línia, etc.). Això és important per validar que les bases estan ben posicionades. El canvas no mostra cap node PINYA.
4. **La toolbar esquerra** s'adapta:
   - Secció "Pinya" → **oculta**
   - Secció "Base" → **visible** (es poden afegir i posicionar al canvas)
   - Botó "Rengles" → **ocult**
5. Si l'usuari tanca el panel, un botó prominent "Tronc" el reobre

**Dualitat BASE per a figures netes**: Els nodes BASE apareixen tant al canvas Konva (posicionament espacial, x/y en pixels) com al TroncView (com a fila P1 del grid). Ambdues vistes mostren els mateixos nodes — el canvas per la disposició visual i el TroncView per l'estructura de pisos. Seleccionar una base al canvas la selecciona també al TroncView i viceversa.

### 4.2 Propietats dels nodes de tronc — dins TroncViewComponent

**Decisió clau:** Les propietats dels nodes de tronc es configuren dins del propi `TroncViewComponent` (part inferior del panel), NO al panel de propietats dret. Cada component (pinya ↔ tronc) gestiona les propietats dels seus nodes.

Quan un node de tronc està seleccionat, a la part inferior del TroncView es mostra:

```
┌──────────────────────────────────────────────────┐
│ ▲ TRONC (grid de pisos)                         │
│ [P3] [ Xiqueta          ]                       │
│ [P2] [ Alçadora ][ Segona ]                     │
│ [P1] [ Baix 1 ][ Baix 2 ][ Baix 3 ]           │
├──────────────────────────────────────────────────┤
│ ▼ PROPIETATS DEL NODE SELECCIONAT               │
│                                                  │
│  Etiqueta: [___Segones 1___]                    │
│                                                  │
│  Tipus:  [Segones] [Terçes] [Puntal] [Alçadora]│
│          [Xiqueta] [Quartes] [Quintes]          │
│                                                  │
│  Amplada: ──●────── 1.5u                        │
│  Posició X: ──●──── 2.0u                        │
│                                                  │
│  Color: [●] (mostra color actual, click=picker) │
└──────────────────────────────────────────────────┘
```

**Selecció de `positionType` per tags** (no dropdown):
- Tags clickables, wrap-friendly
- El tag actiu es mostra amb fons del color corresponent
- Click a un tag → canvia el positionType + actualitza label i color per defecte (si el label encara no ha estat customitzat)

### 4.3 Nodes de direcció (FIGURE_DIRECTION, XICALLA_DIRECTION)

**Decisió:** Les direccions **NO existeixen a nivell de template** per a figures netes. S'instancien exclusivament des de la vista d'assignació de persones. No tenen x/y significatiu — passen del canvas Konva al TroncView.

- **En mode editor (figures netes):** Cap secció de direccions. No es creen FigureNodes de direcció al template.

- **En mode editor (figures completes):** Sense canvis — les direccions al canvas Konva com fins ara.

- **En mode assignment (figures netes):** El TroncView mostra una secció col·lapsible "Direccions" a la part superior:

```
┌──────────────────────────────────────────────────┐
│ ▶ Direccions (col·lapsible, tancat per defecte)  │
│ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄  │
│ [🎯 Direcció figura: [+ Afegir / Persona]]      │
│ [🎯 Direcció xicalla: [+ Afegir / Persona]]     │
├──────────────────────────────────────────────────┤
│ TRONC                                           │
│ ...                                             │
```

  - **Tancat per defecte** si cap direcció té persona assignada
  - L'usuari expandeix → clica "Afegir" → crea un `InstanceNode` (zone `FIGURE_DIRECTION` o `XICALLA_DIRECTION`) directament sobre la instància amb `isAdHoc = true`, `sourceNodeId = null`
  - Un cop creat, funciona com qualsevol altre slot d'assignació (pick-and-place des del PersonPanel)

- **En mode projection:** Visible si té una persona assignada. Ocult si no.

**Implicació sobre el model:** La infraestructura ja existeix. `InstanceNode` té `isAdHoc: boolean` i `sourceNodeId: string | null`. La constant `AD_HOC_ALLOWED_ZONES` (a `libs/shared`) ja inclou `FIGURE_DIRECTION` i `XICALLA_DIRECTION`. Per a figures netes, els InstanceNodes de direcció es creen amb `isAdHoc = true`, `sourceNodeId = null`. Cap canvi d'esquema necessari.

### 4.4 Usabilitat del TroncView en mode editor

Millores UX:

| Interacció | Acció |
|------------|-------|
| Click a un node | Selecciona → mostra propietats a sota |
| Doble click | Edita label inline |
| Nodes pintats amb color del `positionType` | Feedback visual immediat |
| Badge petit del tipus | Mostrar `positionType` abreujat dins el node |
| Click fora del panel de propietats | Deselecciona |

---

## 5. Assignment Canvas — Tronc-first per figures netes

### 5.1 Detecció

```typescript
readonly isActiveTabTroncOnly = computed(() => {
  const tab = this.activeTab();
  if (!tab) return false;
  return tab.hasPinya === false;
});
```

> **Nota**: S'utilitza `hasPinya` del template (disponible via `FigureInstance.template.hasPinya`) en lloc d'inferir-ho dels nodes. Això evita falsos positius amb figures incompletes.

### 5.2 Comportament per figures netes

Quan `isActiveTabTroncOnly = true`:

1. **TroncView en mode assignment** s'obre automàticament, centrat i gran (~70% viewport)
2. El canvas Konva mostra els **nodes BASE** (disposició dels baixos) amb assignació habilitada
3. **PersonPanel** es manté al costat dret (pick-and-place funciona igual, tant per nodes tronc com base)
4. **Direccions** — secció col·lapsible al TroncView (tancat per defecte). L'usuari pot expandir-la per crear i assignar `InstanceNode`s de direcció ad-hoc. Si ja tenen persona assignada, la secció s'obre automàticament.
5. La **variance d'alçades per pis** és visible i prominent per cada fila

### 5.3 Suggeriment d'alçada

La lògica existent de filtre per alçada al PersonPanel ja funciona. Millora específica per troncs:

- Quan es selecciona un node de tronc, el PersonPanel mostra primer les persones amb alçada similar als altres assignats del **mateix pis** (minimitzar variance intra-pis)
- Indicador visual de variance actualitzat en temps real quan es passa el cursor sobre una persona candidata

---

## 6. Projecció — Convivència

### 6.1 Vista "Pinyes" (default)

Mostra **totes** les figures del segment (completes + netes). Per a figures netes:
- Es renderitza el `TroncViewComponent` en mode `projection` directament dins la cel·la del grid
- Opcionalment, els nodes BASE es poden representar sota el tronc com a punts/cercles (indicant la disposició)
- La cel·la es centra mostrant el tronc

### 6.2 Vista "Troncs"

Mostra totes les figures (completes + netes) amb la seva representació de tronc. Sense canvis respecte al comportament actual.

### 6.3 Vista individual (`/project/:instanceId`)

Per a figures netes:
- `FigureProjectionComponent` detecta que no hi ha nodes pinya
- Mostra **només el TroncView** centrat (sense el canvas Konva buit al costat)
- Les **direccions** es mostren al TroncView **només si tenen persona assignada** (invisible si el slot està buit)

---

## 7. Figure Picker Modal — Selecció múltiple amb feedback

### 7.1 Badge "Tronc"

A cada element de la llista del picker, si `hasPinya = false`:
```html
<span class="badge badge-xs badge-info ml-1">Tronc</span>
```

### 7.2 Llista de figures seleccionades (nou)

**Problema actual:** Quan es tria una figura del modal, el modal es tanca i no hi ha feedback del total ni de quines figures s'han afegit al segment.

**Solució:** Convertir el picker en un modal de selecció múltiple:

```
┌──────────────────────────────────────────────────────────┐
│ Afegir figures al segment                        [X]    │
├──────────────────────────────────────────────────────────┤
│ ┌─ Cerca ──────────────────────────────────────────────┐│
│ │ [🔍 Cerca figures...                                ]││
│ └──────────────────────────────────────────────────────┘│
│                                                          │
│ FIGURES DISPONIBLES                                      │
│ ┌────────────────────────────────────────────────────┐  │
│ │ Pilar de 5                             [+ Afegir]  │  │
│ │ Morera                    [Tronc]      [+ Afegir]  │  │
│ │ Piló                      [Tronc]      [+ Afegir]  │  │
│ │ Branca                    [Tronc]      [+ Afegir]  │  │
│ │ Torre de 6                             [+ Afegir]  │  │
│ └────────────────────────────────────────────────────┘  │
│                                                          │
│ ─── SELECCIONADES (3) ───────────────────────────────── │
│ ┌────────────────────────────────────────────────────┐  │
│ │ 1. Pilar de 5                               [🗑️]   │  │
│ │ 2. Piló  [Tronc]                            [🗑️]   │  │
│ │ 3. Branca  [Tronc]                          [🗑️]   │  │
│ └────────────────────────────────────────────────────┘  │
│                                                          │
│                          [Cancel·la]  [Confirma (3)]     │
└──────────────────────────────────────────────────────────┘
```

**Flux:**
1. L'usuari obre el picker
2. Pot afegir múltiples figures clicant "Afegir" (no es tanca el modal)
3. La secció inferior mostra les seleccionades amb possibilitat d'eliminar-les
4. "Confirma" → crea totes les `FigureInstance` d'un cop
5. El comptador del botó confirma mostra el total

**Canvi de contracte:**
- Antic: `selected = output<InstanceSelection>()` (un sol element)
- Nou: `confirmed = output<InstanceSelection[]>()` (array)

L'API `POST /event-segments/:id/instances` ja accepta crear instàncies una a una. Per a múltiple selecció, el frontend crida N vegades en paral·lel (o s'afegeix un endpoint batch al backend com a millora futura).

---

## 8. Components afectats

| Component | Canvi principal |
|-----------|----------------|
| `TroncViewComponent` | Node properties panel (part inferior), selecció per tags, color nodes, doble-click label. En assignment: secció direccions col·lapsible amb creació ad-hoc d'InstanceNodes |
| `TemplateEditorComponent` | Auto-open tronc centrat per `hasPinya=false`, canvas mostra BASE nodes, toolbar adaptativa. Sense secció direccions per figures netes |
| `AssignmentCanvasComponent` | Auto-open tronc centrat per figures netes, canvas mostra BASE amb assignació, creació ad-hoc de direccions dins TroncView |
| `FigureCanvasComponent` | Per figures netes: renderitza només nodes BASE (no PINYA), mode editor + assignment |
| `FigureListTabComponent` | Botó "Figura neta", toggle filtre `hasPinya` |
| `FigurePickerModalComponent` | Selecció múltiple, llista seleccionades, badge "Tronc" |
| `ProjectionViewComponent` | Renderitzar TroncView inline per figures netes a la vista Pinyes |
| `FigureProjectionComponent` | Detectar figures netes → només tronc centrat |
| `libs/shared` | `TRONC_NODE_PRESETS` constants, export des d'index |

---

## 9. Casos límit i error handling

| Situació | Comportament |
|----------|-------------|
| Crear figura neta sense nodes | Permès (template buit, l'editor guia l'usuari) |
| Afegir node pinya a una figura neta | Toolbar amagada, no accessible |
| Canviar `hasPinya` true→false amb nodes pinya existents | Warning toast: "Els nodes de pinya es mantindran però no seran visibles a l'editor. Elimineu-los manualment si cal." |
| Canviar `hasPinya` false→true | Permès sense restriccions (simplement s'habilita la toolbar de pinya) |
| Figure picker: seleccionar la mateixa figura 2 cops | Permès (crear dues instàncies del mateix template és un cas vàlid) |
| Figure picker: confirmar amb 0 seleccionades | Botó "Confirma" disabled |
| Crear direcció ad-hoc a l'assignació | Crea `InstanceNode` amb `isAdHoc = true`, `sourceNodeId = null`, `zone = FIGURE_DIRECTION/XICALLA_DIRECTION` |
| Eliminar direcció ad-hoc sense assignació | Permès (es pot afegir i treure lliurement mentre no tingui persona) |
| Direcció ad-hoc amb persona assignada | No es pot eliminar fins que es tregui l'assignació |

---

## 10. Invariants nous

Afegir a la secció 14 del `PINYES_MODULE.md`:

16. **Tronc node properties (P5.14)**: Els nodes TRONC/BASE poden tenir `positionType` dels presets de tronc (`segones`, `terceres`, `puntal`, `alçadora`, `xiqueta`, etc.) i `color` custom. El `positionType` és varchar lliure; els presets són suggeriments, no restriccions.

17. **Direction nodes are assignment-only for figures netes**: Per a figures amb `hasPinya = false`, els nodes `FIGURE_DIRECTION` i `XICALLA_DIRECTION` NO existeixen al template. Es creen com a `InstanceNode` ad-hoc durant l'assignació (`isAdHoc = true`, `sourceNodeId = null`). Utilitza la infraestructura existent `AD_HOC_ALLOWED_ZONES`. Es representen dins el `TroncViewComponent` en mode assignment (col·lapsible) i projection (visible si assignat).

18. **Projection coexistence**: La vista "Pinyes" de projecció mostra totes les figures del segment. Les figures netes es representen amb el `TroncViewComponent` inline (no canvas Konva buit).

19. **BASE nodes on canvas for figures netes**: Per a figures amb `hasPinya = false`, els nodes BASE es posicionen al canvas Konva (coordenades x/y en pixels) per visualitzar la disposició espacial dels baixos. El TroncView mostra els mateixos nodes com a fila del grid.

---

## 11. Testing strategy

### Unit tests
- `TroncViewComponent`: selecció de node, emissió de propietats, tags positionType
- `TRONC_NODE_PRESETS`: constant amb valors esperats
- `FigurePickerModalComponent`: selecció múltiple, eliminar selecció, output confirmat
- `ProjectionViewComponent`: figures netes renderitzades com a tronc inline

### Integration tests
- `TemplateEditorComponent`: auto-open flow per `hasPinya=false`, toolbar adaptativa
- `AssignmentCanvasComponent`: tronc-first per figures netes, creació ad-hoc de direccions
- `NodeAssignmentService`: crear/eliminar InstanceNode ad-hoc de direcció per figures netes

### E2E (manual o futur Playwright)
- Crear figura neta → afegir baixos + pisos → assignar persones → veure a projecció
- Figure picker: seleccionar 3 figures, eliminar 1, confirmar

---

## 12. Fases d'implementació suggerides

| Fase | Scope | Dependència |
|------|-------|-------------|
| F1 | `TRONC_NODE_PRESETS` + propietats a TroncView (tags, color, label) | Cap |
| F2 | Template listing (botó "Figura neta" + toggle filtre) | F1 |
| F3 | Template editor (auto-open centrat, toolbar adaptativa) | F1 |
| F4 | Assignment canvas (tronc-first, direccions ad-hoc col·lapsibles dins TroncView) | F1 |
| F5 | Figure picker (selecció múltiple + feedback) | Cap |
| F6 | Projecció (tronc inline per figures netes) | F1 |

F1 és el building block. F2-F6 poden fer-se en paral·lel un cop F1 està llesta. F5 és independent.

---

*Spec creada el 17 de juny de 2026.*
