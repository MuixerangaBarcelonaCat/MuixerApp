# P5.1 — Redisseny del Tronc: TroncWidget

> **Data**: 7 de maig de 2026
> **Estat**: Aprovat
> **Fase**: P5.1 (FigureTemplate + Editor Visual)
> **Substitueix**: La implementació del `troncLayer` Konva original de P5.1

---

## 1. Motivació

La implementació original del tronc a P5.1 renderitzava els nodes TRONC com un segon layer Konva lliure posicionat a la dreta del canvas (30-35% de l'ample). Això no encaixava amb la realitat d'una figura:

- El tronc **no és de lliure posicionament** — és una estructura jerarquitzada per **pisos** (z=0, z=1, z=2...).
- Visualitzar el tronc com un canvas lliure igual que la pinya genera confusió i no transmet la lògica d'apilament vertical.
- La pinya ha de ser la **vista principal i dominant**; el tronc és una vista complementària que no ha d'interferir.

---

## 2. Visió General del Canvi

| Abans | Ara |
|-------|-----|
| `troncLayer` Konva dins `figure-canvas` | Widget Angular pur (CSS), separat del canvas |
| Nodes TRONC posicionats lliurement amb x,y | Nodes TRONC agrupats per pis (z), visualitzats com una torre |
| Toggle "Tronc" a la secció Vistes del toolbar | Widget flotant col·lapsable a dalt-esquerra del canvas |
| Toolbar esquerra amb botons "Tronc" i "Pis 1" | Botons per tipus de pis dins del propi widget |
| Canvas = pinya + tronc | Canvas = **pinya-only** |

---

## 3. Model de Dades

**El backend `FigureNode` no canvia.** Els nodes TRONC utilitzen els mateixos camps:

| Camp | Ús per nodes TRONC |
|------|--------------------|
| `zone` | `TRONC` (pisos elevats). Les Bases usen `zone=BASE` (z=0) |
| `z` | Número de pis absolut (0=Bases/zone BASE, 1=Segon, 2=Terç, 3=Quart, 4=Alçadora, 5=Xiqueta) |
| `positionType` | `segon`, `terç`, `quart`, `alcadora`, `xiqueta` (les bases usen `base` amb zone=BASE) |
| `label` | Nom del tipus (sense numeració): "Segon", "Terç"... |
| `sortOrder` | Posició dins del pis (esquerra → dreta) |
| `climbPath` | `(X)` per xiqueta, `(A)` per alçadora, `null` per la resta |
| `x`, `y` | Fixats a 0 (no rellevants per al tronc) |
| `width`, `height` | Fixats a 60×40 (no editables per al tronc) |
| `rotation` | Fixat a 0 (no editable per al tronc) |

### Tipus de pis predefinits

Les **Bases** (`zone=BASE`, z=0) es gestionen a la secció especial "Bases · P1" del widget (editable bidireccional amb el canvas de pinya). Els pisos de tronc (Segon, Terç, Quart) tenen un `z` fix per convenció. Els tipus superiors (Alçadora, Xiqueta) reben `z` **automàtic**: es col·loquen al primer z lliure per sobre del pis existent més alt (`max_z + 1`).

| Secció/Botó al widget | `zone` | `z` | `positionType` | `label` auto |
|---|---|---|---|---|
| Bases (secció especial) | `BASE` | `0` (fix) | `base` | `Base` |
| Segon | `TRONC` | `1` (fix) | `segon` | `Segon` |
| Terç | `TRONC` | `2` (fix) | `terç` | `Terç` |
| Quart | `TRONC` | `3` (fix) | `quart` | `Quart` |
| Alçadora | `TRONC` | `max_z + 1` (auto) | `alcadora` | `Alçadora` |
| Xiqueta | `TRONC` | `max_z + 1` (auto) | `xiqueta` | `Xiqueta` |

Exemples d'assignació automàtica de `z`:
- Xopera (Base+Segon+Terç existents, max_z=2): clicar "Alçadora" → z=3; clicar "Xiqueta" → z=4
- Figure amb Quart (max_z=3): clicar "Alçadora" → z=4; clicar "Xiqueta" → z=5

> En casos no estàndard, el valor de `z` és editable manualment al panel de propietats.

El `sortOrder` del nou node s'assigna automàticament com el nombre de nodes existents al mateix `z` (= posició al final del pis).

### Relació Bases — Pinya i Tronc

Les **Bases** són la **intersecció** entre pinya i tronc. Es defineixen una **sola vegada**:
- Node `zone=BASE`, `z=0`, `positionType='base'` — apareixen al canvas de la pinya (posicionables) **i** a la secció "Bases · P1" del widget de tronc.

L'edició és **bidireccional**: afegir/treure des del canvas de pinya o des del widget es reflecteix immediatament a l'altre. Representen les mateixes persones físiques. La sincronització d'assignació de persones es resoldrà a **P5.4**.

---

## 4. Exemples de Figures

### Pilar de 4 (pd4)
```
P5 (z=4): Quart    × 1
P4 (z=3): Terç     × 1
P3 (z=2): Segon    × 1
──────────────────────
Bases (z=0): Base  × 1
```

### Xopera
```
P6 (z=5): Xiqueta  × 1
P5 (z=4): Alçadora × 1
P4 (z=3): Terç     × 2
P3 (z=2): Segon    × 4
──────────────────────
Bases (z=0): Base  × 4
```

---

## 5. El `tronc-widget` — Component Nou

### Ubicació
```
features/pinyes/components/tronc-widget/
├── tronc-widget.component.ts
├── tronc-widget.component.html
└── tronc-widget.component.scss
```

### Interfície pública

```typescript
// Inputs
troncNodes     = input<FigureNodeItem[]>([]);   // nodes filtrats zone=TRONC (z>=1)
baseNodes      = input<FigureNodeItem[]>([]);   // nodes filtrats zone=BASE (z=0)
mode           = input<'editor' | 'readonly'>('editor');
selectedNodeId = input<string | null>(null);    // per ressaltar el node seleccionat

// Outputs
nodeAdded    = output<{ z: number; positionType: string; label: string; sortOrder: number }>();
nodeRemoved  = output<string>();                // id del node TRONC a eliminar
floorRemoved = output<number>();               // z del pis sencer a eliminar
nodeSelected = output<string | null>();         // sincronitza amb el panel de propietats dret
baseAdded    = output<{ sortOrder: number }>();  // afegir una Base nova (zone=BASE)
baseRemoved  = output<string>();               // id del node BASE a eliminar
```

### Estats del widget

**Col·lapsat** — pill/badge petit sobre el canvas:
```
[ 🏗 Tronc · 4 pisos  ▾ ]
```
Si no hi ha pisos: `[ 🏗 Tronc · sense pisos ▾ ]`

**Expandit** — card amb dues vistes intercanviables:

```
┌─────────────────────────────────────────────────────┐
│  Tronc                        [Torre] [Llista]  ✕   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  P5 ─── [ Xiqueta ] [(X)]                   [🗑]   │
│  P4 ─── [ Alçadora ] [(A)]                  [🗑]   │
│  P4 ─── [ Terç ][ Terç ]                    [🗑]   │
│  P3 ─── [ Seg. ][ Seg. ][ Seg. ][ Seg. ]   [🗑]   │
│ ┌─ Bases · P1 ──────────────────── [-] 4 [+] ─┐  │
│ │  [ Base ][ Base ][ Base ][ Base ]             │  │
│ └───────────────────────────────────────────────┘  │
│                                                     │
│  [+ Afegir P3 ▾]                                   │
│    Segon · Terç · Quart · Alçadora · Xiqueta        │
└─────────────────────────────────────────────────────┘
```

**Vista Torre** (per defecte):
- Pisos ordenats **de dalt (z màxim) cap a baix (z=0)**, reflectint la torre real.
- Dins de cada pis, les persones com a píndoles horitzontals ordenades per `sortOrder`.
- Botó `[(X)]` / `[(A)]` visible i editable als nodes d'Alçadora/Xiqueta (toggle del `climbPath`).
- Botó `[🗑]` per eliminar tots els nodes d'un pis (amb confirmació).
- Click a una píndola → `nodeSelected.emit(nodeId)` — sincronitza el panel de propietats dret.
- Secció **Bases · P1** amb controls `[-] N [+]` per afegir/treure bases (sincronitzat amb el canvas de pinya).

**Vista Llista** (toggle):
```
Pis  │ Tipus      │ Nodes
─────┼────────────┼──────────────────────────────
P5   │ Xiqueta    │ Xiqueta [(X)]
P4   │ Alçadora   │ Alçadora [(A)]
P4   │ Terços     │ Terç · Terç
P3   │ Segons     │ Segon · Segon · Segon · Segon
Bases│ Bases      │ Base · Base · Base · Base
```

**Orientació configurable**: Botó toggle `[▲]` / `[▼]` per invertir l'ordre de lectura (dalt-baix o baix-dalt) — preferència d'usuari, no afecta les dades.

### Propietats editables per node TRONC (panel dret)

Quan un node TRONC és seleccionat, el panel de propietats dret mostra **únicament**:
- `label` — editable
- `climbPath` — visible i editable **només** per `positionType` = `alcadora` o `xiqueta`
- `sortOrder` — editable (botons ← → per reordenar dins del pis)

Els camps `x`, `y`, `width`, `height`, `rotation`, `shape` queden **ocults** quan `zone === TRONC`.

---

## 6. Arquitectura de Components i Connexions

### Diagrama de flux de dades

```
template-editor
    │
    ├─── nodes (signal<FigureNodeItem[]>)  ← estat complet (pinya + tronc)
    │        │
    │        ├── pinyaNodes (computed) ─────────────► figure-canvas
    │        │   (zone !== TRONC)                      [Konva, pinya-only]
    │        │
    │        └── troncNodes (computed) ─────────────► tronc-widget
    │            (zone === TRONC)                       [CSS, torre/llista]
    │
    ├─── selectedNodeId (signal<string|null>)
    │        │
    │        ├────────────────────────────────────────► figure-canvas
    │        │                                          [highlight node pinya]
    │        └────────────────────────────────────────► tronc-widget
    │                                                   [highlight píndola tronc]
    │
    ◄── nodeSelected (output) ──────────────────────── figure-canvas
    ◄── nodeSelected (output) ──────────────────────── tronc-widget
    │        └── selectedNodeId.set(id)
    │
    ◄── nodeAdded (output) ──────────────────────────── tronc-widget
    │        └── addTroncNode(z, positionType, label)
    │
    ◄── nodeRemoved / floorRemoved (output) ─────────── tronc-widget
    │        └── removeNode(id) / removeFloor(z)
    │
    ◄── nodeUpdated (output) ────────────────────────── tronc-widget
             └── updateNode(id, patch)
```

### Regles clau del flux

1. **Una sola font de veritat**: `template-editor.nodes` conté TOTS els nodes (pinya + tronc). Els components fills reben subconjunts filtrats i mai modifiquen l'estat directament.
2. **`figure-canvas` rep `pinyaNodes`**: el canvas Konva ja no veu cap node TRONC. La separació és neta.
3. **`tronc-widget` és pur I/O**: no té estat propi sobre els nodes. Rep `troncNodes[]` i emet canvis cap amunt. El `template-editor` aplica els canvis a `nodes`.
4. **`selectedNodeId` és compartit**: quan cliques un node a la pinya, el tronc-widget pot tenir una píndola ressaltada si coincideix l'id (poc probable, però consistent). Quan cliques una píndola al tronc, el panel de propietats mostra les propietats del node TRONC.
5. **Auto-save**: el `template-editor` continua gestionant el debounce de 2 s. Qualsevol output del `tronc-widget` dispara `scheduleAutosave()`.

### Integració al template HTML del `template-editor`

```html
<main class="editor-canvas" aria-label="Editor visual de la figura">

  <!-- Canvas pinya (Konva) -->
  <app-figure-canvas
    [nodes]="pinyaNodes()"
    [mode]="'editor'"
    [gridEnabled]="gridEnabled()"
    [gridSpacing]="40"
    [snapToGrid]="snapToGrid()"
    [selectedNodeId]="selectedNodeId()"
    (nodeSelected)="onNodeSelected($event)"
    (nodeMoved)="onNodeMoved($event)"
    (nodeRotated)="onNodeRotated($event)"
    (nodeResized)="onNodeResized($event)"
    (nodeLabelChanged)="onNodeLabelChanged($event)"
  />

  <!-- Widget tronc (flotant, dalt-esquerra del canvas) -->
  <app-tronc-widget
    class="tronc-widget-overlay"
    [troncNodes]="troncNodes()"
    [mode]="'editor'"
    [selectedNodeId]="selectedNodeId()"
    (nodeAdded)="onTroncNodeAdded($event)"
    (nodeRemoved)="onTroncNodeRemoved($event)"
    (floorRemoved)="onTroncFloorRemoved($event)"
    (nodeUpdated)="onTroncNodeUpdated($event)"
    (nodeSelected)="onNodeSelected($event)"
  />

</main>
```

Posicionament CSS del widget:
```scss
.tronc-widget-overlay {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 10;
}
```

---

## 7. Canvis als Components Existents

### `figure-canvas` — modificacions

| Element | Acció |
|---------|-------|
| `private troncLayer: Konva.Layer` | Eliminar |
| Input `troncVisible` | Eliminar |
| Lògica renderNodes per zone=TRONC | Eliminar |
| Línia separadora troncLayer | Eliminar |
| `this.stage.add(..., this.troncLayer)` | Eliminar |
| Input `nodes` | Continua igual — el filtre el fa el pare |

> El `figure-canvas` no sap res del tronc. Rep el que rep i renderitza.

### `template-editor` — modificacions

| Element | Acció |
|---------|-------|
| `toggleTronc()` i `troncVisible` del `canvasState` | Eliminar |
| Botó "Tronc" a secció "Vistes" del toolbar | Eliminar |
| Botons "Tronc" i "Pis 1" al toolbar esquerra | Eliminar |
| `[troncVisible]` binding al `figure-canvas` | Eliminar |
| Computed `pinyaNodes` | Afegir |
| Computed `troncNodes` | Afegir |
| Handlers `onTroncNode*` | Afegir |
| Import i ús de `TroncWidgetComponent` | Afegir |

### `canvas-state.service` — modificacions

| Element | Acció |
|---------|-------|
| `troncVisible = signal(true)` | Eliminar |

---

## 8. Actualització del Seed pd4

El seed `seed-pd4.script.ts` actual defineix **35 nodes de pinya i 0 nodes de tronc**. Cal afegir els nodes TRONC del Pilar de 4:

```typescript
// Nodes del pd4
{ zone: 'BASE',  z: 0, positionType: 'base',   label: 'Base',     sortOrder: 0, x: 500, y: 500, width: 80, height: 40, rotation: 0 }, // intersecció pinya-tronc
{ zone: 'TRONC', z: 1, positionType: 'segon',  label: 'Segon',    sortOrder: 0, x: 0,   y: 0,   width: 60, height: 40, rotation: 0 },
{ zone: 'TRONC', z: 2, positionType: 'terç',   label: 'Terç',     sortOrder: 0, x: 0,   y: 0,   width: 60, height: 40, rotation: 0 },
{ zone: 'TRONC', z: 3, positionType: 'quart',  label: 'Quart',    sortOrder: 0, x: 0, y: 0, width: 60, height: 40, rotation: 0 },
```

---

## 9. Decisió Pendent (P5.4)

> **Bases: assignació única**
> Les Bases (`zone=BASE`, z=0) son un sol node per persona que apareix tant a la pinya com al tronc-widget. Quan s'assigna una persona a una Base (P5.4), l'assignació és única — no hi ha duplicació de nodes ni cal sincronitzar dues entitats. Aquesta assignació s'implementa a **P5.4**.

---

## 10. Fora d'Abast d'Aquest Redisseny

- Visualització del tronc en mode assignació (P5.4) — el `tronc-widget` en mode `readonly` es definirà a P5.4
- Indicadors d'alçada relativa (`+3`, `-5` cm) per persona assignada — P5.4
- Visualització del tronc en mode projecció fullscreen — P5.5
