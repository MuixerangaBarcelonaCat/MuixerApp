# P5.8.1 — Mòdul Pinyes: Projecció de Segments

> **Data:** 22 de maig de 2026
> **Fase:** P5.8.1 (P5.8.2 — Consulta Històrica, pendent)
> **Depèn de:** P5.1 → P5.7 (completats)
> **Roadmap:** `docs/PROJECT_ROADMAP.md` → P5.8

---

## 1. Objectiu

Implementar una vista de preparació i projecció que permeti al Cap de Pinyes:

1. **Preparar** el layout d'un segment durant la setmana: posicionar les figures al llenç, afegir elements de referència (escenari, fletxes de direcció).
2. **Projectar** el layout en mode fullscreen durant l'assaig o l'actuació: les figures amb els noms de les persones assignades, tronc visible i llegible, sense controls de navegació.
3. **Ampliar** una figura concreta a pantalla completa per mostrar-la en detall.

---

## 2. Abast de P5.8.1

| Funcionalitat | Inclosa |
|---|:---:|
| Vista de segment (llenç multi-figura) | ✅ |
| Mode edició (preparació, drag, elements referència) | ✅ |
| Mode projecció (fullscreen, sense controls) | ✅ |
| Vista de figura individual (fullscreen d'una sola figura) | ✅ |
| Representació del tronc (mini a segment, completa a figura) | ✅ |
| Elements de referència (rectangle + fletxa, per event) | ✅ |
| Visibilitat d'elements de referència per segment | ✅ |
| Persistència de posicions de figures | ✅ |
| Navegació entre segments (prev/next) | ✅ |
| Modals d'ajuda | ✅ |
| Consulta Històrica | ❌ (P5.8.2) |
| Rol tablet per a registre d'assistència in-situ | ❌ (futur, P6+) |

---

## 3. Model de Dades

### 3.1 Canvis a `FigureInstance`

Tres camps nous per a la posició al llenç de projecció. Cap canvi de schema estructural rellevant.

```typescript
// Nous camps a figure_instances
projectionX:     float   | null   // posició X al llenç Konva (pixels). null = sense posicionar
projectionY:     float   | null   // posició Y al llenç Konva (pixels)
projectionScale: float   | 1.0    // escala del bloc figura. Default 1.0
```

Un `null` a `projectionX`/`projectionY` indica que la figura no ha estat posicionada manualment. El frontend la col·loca automàticament en una posició inicial per defecte (distribució horitzontal equidistant).

### 3.2 Nova entitat `ReferenceElement`

Elements de referència visuals associats a un event. Compartits per tots els segments per defecte, amb possibilitat d'ocultar-los per segment concret.

```typescript
@Entity('reference_elements')
export class ReferenceElement {
  @PrimaryGeneratedColumn('uuid') id: string;

  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  event: Event;

  @Column({ type: 'enum', enum: ReferenceElementType })
  type: ReferenceElementType; // 'RECTANGLE' | 'ARROW'

  @Column({ nullable: true })
  label: string | null; // "Escenari", "Església", "Porta", etc.

  @Column({ type: 'float' }) x: number;
  @Column({ type: 'float' }) y: number;
  @Column({ type: 'float' }) width: number;
  @Column({ type: 'float' }) height: number; // per ARROW: longitud
  @Column({ type: 'float', default: 0 }) rotation: number; // graus
  @Column({ nullable: true }) color: string | null;
  @Column({ type: 'int' }) sortOrder: number;

  @Column({ type: 'jsonb', default: [] })
  hiddenInSegments: string[]; // array d'EventSegment UUIDs on NO es mostra
}

enum ReferenceElementType {
  RECTANGLE = 'RECTANGLE',
  ARROW = 'ARROW',
}
```

**Invariant**: `hiddenInSegments` és un array d'UUIDs. Per defecte buit → visible a tots els segments. El backend filtra en retornar les dades de projecció.

### 3.3 Diagrama de relacions (P5.8.1)

```
Event
  ├── EventSegment[] ──────────────────────────── FigureInstance[]
  │                                                   │ projectionX, projectionY, projectionScale
  └── ReferenceElement[]
        │ hiddenInSegments: uuid[]  →  filtra per segmentId
```

---

## 4. API REST

### 4.1 Nou mòdul: `ReferenceElementModule`

Nested sota `/events/:eventId/reference-elements`.

| Mètode | Ruta | Descripció |
|---|---|---|
| `GET` | `/events/:eventId/reference-elements` | Llista tots els elements de l'event |
| `POST` | `/events/:eventId/reference-elements` | Crear element |
| `PUT` | `/events/:eventId/reference-elements/batch` | Batch update posicions/dimensions (auto-save). **Nota**: aquesta ruta ha de registrar-se abans de `/:id` al controlador per evitar conflicte de resolució de rutes. |
| `PUT` | `/events/:eventId/reference-elements/:id` | Actualitzar un element (label, color, etc.) |
| `DELETE` | `/events/:eventId/reference-elements/:id` | Eliminar element |
| `PUT` | `/events/:eventId/reference-elements/:id/visibility` | Toggle visibilitat per segment: `{ segmentId, hidden: boolean }` |

**Batch update payload** (per auto-save eficient — evita N crides individuals):
```typescript
PUT /events/:eventId/reference-elements/batch
{
  elements: Array<{
    id: string;
    x: number; y: number;
    width: number; height: number;
    rotation: number;
  }>
}
```

### 4.2 Extensió `EventSegmentModule`

Batch update de posicions de figures al llenç:

```typescript
PUT /events/:eventId/segments/:segmentId/instances/projection-layout
{
  layouts: Array<{
    instanceId: string;
    x: number;
    y: number;
    scale: number;
  }>
}
```

Un sol endpoint per segment en comptes de N PUT individuals. Es crida via auto-save (debounce 2s) en mode edició quan el tècnic arrrossega figures.

### 4.3 Endpoint optimitzat de projecció

Retorna tot el necessari per a una sola crida HTTP al carregar la vista:

```typescript
GET /events/:eventId/segments/:segmentId/projection

// Response
{
  segment: {
    id, name, sortOrder,
    prevSegmentId: string | null,
    nextSegmentId: string | null,
  },
  instances: Array<{
    id, label, sortOrder,
    projectionX: number | null,
    projectionY: number | null,
    projectionScale: number,
    figureTemplate: {
      id, name,
      nodes: InstanceNodeResponse[], // PINYA + BASE + TRONC
    },
    assignments: AssignmentDetail[],
  }>,
  referenceElements: ReferenceElement[], // ja filtrats: hiddenInSegments no conté segmentId
}
```

El backend fa els JOINs necessaris i retorna les dades aplanades. `prevSegmentId` / `nextSegmentId` permeten la navegació prev/next sense crida addicional.

### 4.4 Proteccions

Tots els endpoints protegits amb `AuthGuard` + `RolesGuard(['TECHNICAL', 'ADMIN'])`.

---

## 5. Arquitectura Frontend

### 5.1 Ruta

```typescript
// pinyes.routes.ts — nova ruta
{
  path: 'events/:eventId/segments/:segmentId/project',
  loadComponent: () => import('./components/projection-view/projection-view.component'),
  canActivate: [authGuard, rolesGuard(['TECHNICAL', 'ADMIN'])],
}
```

Una sola ruta. No hi ha sub-rutes per a figura individual — és un canvi de signal intern.

**Punt d'entrada**: botó "Projectar" al `SegmentManagerComponent` → navega a la ruta de projecció del primer segment (o del segment actual).

### 5.2 Component principal: `ProjectionViewComponent`

Crida `LayoutService.requestFullscreen()` a `ngOnInit` i `exitFullscreen()` a `ngOnDestroy`. El shell del dashboard desapareix completament.

**Signals principals:**

```typescript
// Mode de visualització
viewMode = signal<'segment' | 'figure'>('segment');
editMode = signal<boolean>(true); // true = edició, false = projecció

// Dades carregades
segmentData = signal<ProjectionSegmentData | null>(null);
loading = signal<boolean>(true);

// Selecció
focusedInstanceId = signal<string | null>(null); // per a vista figura
selectedElementId = signal<string | null>(null);  // element referència seleccionat

// Posicions efímeres (sincronitzades amb backend via auto-save)
figurePositions = signal<Map<string, {x: number, y: number, scale: number}>>(new Map());
referenceElements = signal<ReferenceElementItem[]>([]);

// UI
cursorVisible = signal<boolean>(true); // auto-hide 3s en mode projecció
helpModalOpen = signal<boolean>(false);
saveStatus = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');
```

**Computed:**

```typescript
activeFigure = computed(() =>
  focusedInstanceId()
    ? segmentData()?.instances.find(i => i.id === focusedInstanceId())
    : null
);

visibleReferenceElements = computed(() =>
  referenceElements().filter(el =>
    !el.hiddenInSegments.includes(segmentData()?.segment.id ?? '')
  )
);
```

**Layout HTML:**

```
[mode edició]
  ┌─ toolbar-top ──────────────────────────────────────┐
  │  ← Tornar  |  Segment: Bloc 1  |  ◀ ▶ (prev/next) │
  │  [Mode: Edició ↔ Projecció]    |  [?] Ajuda        │
  └────────────────────────────────────────────────────┘
  ┌─ toolbar-lateral ─┐ ┌─ segment-canvas ────────────┐
  │  + Rectangle      │ │                              │
  │  + Fletxa         │ │   [Figura 1]  [Figura 2]    │
  │  ─────────────    │ │                              │
  │  [Element sel.]   │ │   [Figura 3]                │
  │  Label: [___]     │ │                              │
  │  [Eliminar]       │ │   [Rect: Escenari]          │
  └───────────────────┘ └─────────────────────────────┘

[mode projecció — zero controls visibles]
  ┌─ viewport complet, fons negre ─────────────────────┐
  │                                                     │
  │   [🔳 Tronc] [Figura 1 — noms grans]               │
  │   [🔳 Tronc] [Figura 2 — noms grans]               │
  │                                                     │
  │   [Rect: Escenari]                                  │
  │                                           [▶ ←→ ]  │
  │                         (controls mínims, semi-ocultes) │
  └─────────────────────────────────────────────────────┘
```

### 5.3 Sub-components

#### `SegmentCanvasComponent`

Canvas Konva que renderitza el llenç del segment.

**Inputs:**
```typescript
instances = input<ProjectionInstance[]>();
referenceElements = input<ReferenceElementItem[]>();
editMode = input<boolean>();
figurePositions = input<Map<string, {x,y,scale}>>();
selectedElementId = input<string | null>();
```

**Outputs:**
```typescript
figureMoved = output<{instanceId: string, x: number, y: number}>(); // auto-save
figureClicked = output<string>(); // instanceId → vista figura en mode projecció
elementMoved = output<{elementId: string, x: number, y: number, width: number, height: number, rotation: number}>();
elementSelected = output<string | null>();
```

**Renderitzat de cada figura (Konva Group):**

Cada instància és un `Konva.Group` posicionat a `(projectionX, projectionY)`:
- **Tronc mini** (dalt-esquerra del grup): Konva sub-group amb rectangles apilats per pis. Cada rectangle conté l'àlies de la persona. Font llegible en mode projecció (mínim 12–14px a escala natural del grup). Colors neutres (gris fosc sobre blanc/transparent), fons semitransparent.
- **Pinya** (zona dreta/principal): reutilitza la lògica de `renderAssignmentNodes()` de `FigureCanvasComponent`, en mode read-only. Noms en negreta per llegibilitat al projector.
- En **mode edició**: drag habilitat al grup complet, badge "×" per deseleccionar, cursor `grab`.
- En **mode projecció**: drag desactivat, click sobre el grup → `figureClicked` → activa vista figura.

**Renderitzat d'elements de referència (Konva):**
- **RECTANGLE**: `Konva.Rect` amb stroke (color o gris per defecte), `Konva.Text` centrat amb label. En mode edició: draggable, `Transformer` per redimensionar.
- **ARROW**: `Konva.Arrow` amb `rotation`. En mode edició: draggable, handle de rotació.

#### `FigureProjectionComponent`

Vista fullscreen d'una sola figura. S'activa quan `viewMode === 'figure'`.

**Layout:**
```
┌─ viewport complet ──────────────────────────────────────┐
│                                                          │
│  ┌─ Tronc (TroncViewComponent mode 'projection') ─┐     │
│  │  P4: Nom1  Nom2                                 │     │
│  │  P3: Nom3                                       │     │
│  │  P2: Nom4  Nom5  Nom6  Nom7                     │     │
│  │  P1: Nom8  Nom9  Nom10 Nom11                    │     │
│  └─────────────────────────────────────────────────┘     │
│                                                          │
│  ┌─ Pinya (FigureCanvasComponent mode 'readonly') ─┐     │
│  │  [nodes amb noms en negreta, fit-to-screen]      │     │
│  └─────────────────────────────────────────────────┘     │
│                                                          │
│  [← Tornar al segment]    [Nom de la figura]             │
└──────────────────────────────────────────────────────────┘
```

**Comportament:**
- `FigureCanvasComponent` en mode `readonly`: nodes no interactius, noms en negreta, `fitToScreen()` automàtic.
- `TroncViewComponent` amb nou mode `projection`: estructura + noms, font gran, sense controls, sense alçades, sense variance colors.
- Escape → torna a `viewMode = 'segment'`.
- Botó flotant (baix-esquerra, semi-transparent) → torna a vista segment.

#### `ReferenceElementToolbarComponent`

Panel lateral esquerre, visible només en mode edició.

**Accions:**
- "Afegir rectangle" → crea `ReferenceElement` de tipus RECTANGLE al centre del canvas + `POST` al backend
- "Afegir fletxa" → crea `ReferenceElement` de tipus ARROW + `POST`
- Si `selectedElementId` és no-null: mostra propietats de l'element seleccionat:
  - Input label (editable inline)
  - Color picker (opcional, simplificat)
  - Botó "Ocultar en aquest segment" → `PUT .../visibility`
  - Botó "Eliminar" → `DELETE`

#### `ProjectionHelpModalComponent`

Modal informatiu accessible des del botó `?` de la toolbar superior. Explica:
1. **Mode edició**: arrossegar figures, afegir elements de referència, canvi de segment.
2. **Mode projecció**: controls de teclat (←→ canviar segment, clic figura → ampliar, Escape → mode edició).
3. **Vista figura**: com tornar al segment.

### 5.4 Nous modes als components existents

#### `TroncViewComponent` — nou mode `projection`

Afegir `'projection'` al tipus `mode` existent (`'editor' | 'assignment' | 'projection'`).

Comportament en mode `projection`:
- Renderitza pisos amb àlies de persones assignades
- Font gran: mínim 1rem per als àlies
- Sense controls d'edició (+ node, + pis, eliminar)
- Sense badge d'alçada, sense variance Δcm, sense attendance dots
- Sense controls toggle orientació (sempre P1 baix per defecte en projecció)
- Estil: fons semi-transparent, text blanc/fosc depenent del tema

#### `FigureCanvasComponent` — activar mode `readonly`

El mode `readonly` ja estava definit al tipus `CanvasMode` però no implementat. En P5.8.1:
- Mateixa renderització que `assignment` però sense interacció (no click, no popover, no selection)
- Noms en negreta (`fontStyle: 'bold'`) per llegibilitat al projector
- Sense `PersonPanelComponent`, sense `NodePopoverComponent`
- `fitToScreen()` cridat automàticament en inicialitzar

### 5.5 State i persistència

**Auto-save de posicions de figures:**
Debounce de 2s. Quan `figureMoved` emeti, actualitzar `figurePositions` signal localment i programar `PUT .../instances/projection-layout` amb totes les posicions del segment.

**Auto-save d'elements de referència:**
Debounce de 2s. Quan `elementMoved` emeti, actualitzar `referenceElements` signal i programar `PUT .../reference-elements/batch`.

**Posicions per defecte:**
Si `projectionX === null`, el frontend calcula una posició inicial: distribució horitzontal equidistant (`index * (canvasWidth / totalInstances)`), centrat verticalment. Quan el tècnic mogui la figura per primera vegada es persiteix la posició real.

### 5.6 Controls de teclat (mode projecció)

| Tecla | Acció |
|---|---|
| `←` / `→` | Segment anterior / següent |
| `Escape` | Sortir de vista figura → vista segment (si `viewMode === 'figure'`) / Sortir de mode projecció → mode edició |
| `F` | Toggle fullscreen del navegador (natiu `document.requestFullscreen()`) |

### 5.7 Auto-hide del cursor

En mode projecció (`editMode === false`), el cursor s'amaga automàticament 3 segons després de la darrera interacció amb el ratolí. Qualsevol moviment el torna a mostrar.

```typescript
// Implementat al ProjectionViewComponent
private resetCursorTimer(): void {
  this.cursorVisible.set(true);
  clearTimeout(this.cursorTimer);
  this.cursorTimer = setTimeout(() => this.cursorVisible.set(false), 3000);
}
```

El component aplica `cursor: none` al contenidor quan `cursorVisible() === false`.

---

## 6. Punt d'Entrada al Dashboard

**`SegmentManagerComponent`**: afegir botó "Projectar" al costat del botó "Assignar" existent. Navega a `/pinyes/events/:eventId/segments/:segmentId/project` del segment corresponent.

---

## 7. Tests

### Backend
- `ReferenceElementService`: CRUD, batch update, toggle visibilitat (afegir/treure de `hiddenInSegments`)
- `EventSegmentService`: `updateProjectionLayout` — actualització batch de `projectionX/Y/Scale`
- `ProjectionController` (si s'extrau): endpoint de projecció retorna dades correctes per segment (instàncies, elements, prev/next)
- Casos límit: segment sense instàncies, instàncies sense assignar (projectionX null), elements de referència ocults al segment

### Frontend
- `ProjectionStateService` (si s'extrau de component): canvis de `viewMode`, `editMode`, posicions
- `SegmentCanvasComponent`: renderitza grups correctament, emet `figureMoved` en drag
- `FigureProjectionComponent`: crida `fitToScreen()` en inicialitzar, Escape torna a vista segment
- `TroncViewComponent` mode `projection`: sense controls, font gran, rendering correcte

---

## 8. Fases d'implementació

| Fase | Contingut | Depèn de |
|---|---|---|
| **A** | Backend: migració `projectionX/Y/Scale` a `FigureInstance`, `ReferenceElement` entity+module+CRUD+tests | — |
| **B** | Backend: endpoint `projection-layout` batch + endpoint `/projection` optimitzat | Fase A |
| **C** | Frontend: `TroncViewComponent` mode `projection`, `FigureCanvasComponent` mode `readonly` activat | — |
| **D** | Frontend: `SegmentCanvasComponent` (Konva multi-figura amb tronc mini, elements referència, drag) | Fase C |
| **E** | Frontend: `ProjectionViewComponent` complet (mode edició/projecció, vista figura, navegació, auto-save, keyboard shortcuts) | Fases B + D |
| **F** | Frontend: `ReferenceElementToolbarComponent`, `ProjectionHelpModalComponent`, botó "Projectar" al `SegmentManagerComponent` | Fase E |

---

## 9. Decisions tècniques clau

| Decisió | Resultat |
|---|---|
| **Una sola ruta** | `viewMode` signal intern evita serialitzar estat efímer entre rutes i elimina flash de navegació |
| **Tronc mini en Konva** | El grup de cada figura és un bloc draggable complet (pinya + tronc), no es pot separar. El tronc mini es renderitza com sub-group Konva (no `TroncViewComponent`) per ser part del grup arrossegable |
| **`TroncViewComponent` mode `projection`** | Extensió del component existent, no un component nou — reutilitza la lògica de pisos/assignacions |
| **`FigureCanvasComponent` mode `readonly`** | Mode ja definit al tipus, ara implementat. No calien canvis de signatura |
| **Elements referència a nivell Event** | Compartits per tots els segments, `hiddenInSegments` JSONB evita taula pivot. Adequat per al volum (pocs elements per event) |
| **Batch endpoints** | `PUT .../projection-layout` i `PUT .../reference-elements/batch` minimitzen les crides HTTP en cada auto-save (2s debounce), evitant N crides individuals per segment |
| **Posicions per defecte calculades al frontend** | `projectionX === null` → distribució automàtica. No cal cridar el backend fins que el tècnic mogui la figura |
| **Fullscreen natiu (`F`)** | `document.requestFullscreen()` en tecla F, per a projecció real en TV/projector. `LayoutService.requestFullscreen()` segueix ocultant el chrome del dashboard |

---

## 10. Invariants de domini

1. Una `FigureInstance` sense `projectionX/Y` (null) es posiciona automàticament pel frontend; no implica cap error de dades.
2. `ReferenceElement` sempre pertany a un `Event`. Si l'Event s'elimina, els elements s'eliminen en cascada.
3. `hiddenInSegments` conté UUIDs vàlids de segments del mateix event. El backend no valida FK (array JSONB), però sí que filtra correctament a l'endpoint `/projection`.
4. En mode projecció, cap acció de l'usuari modifica dades (read-only). L'única escriptura possible és en mode edició.
5. El mode `projection` de `TroncViewComponent` no mostra alçades ni variance — invariant de privacitat bàsica (les alçades són dades personals).

---

*Spec aprovada el 22 de maig de 2026. Properes fases: implementació per fases A→F tal com descriu la secció 8.*
