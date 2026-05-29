# Mòdul de Pinyes — Documentació Tècnica

> Última actualització: 28 de maig de 2026  
> Fases implementades: P5.1 → P5.11 (rengles: F1–F5)  
> Specs de referència:
> - `docs/specs/2026-05-19-p5-family-snapshot-redesign.md` (P5.5)
> - `docs/specs/2026-05-20-p5-tronc-visualization-design.md` (P5.6)
> - `docs/specs/2026-05-22-p5-8-1-projection-view-design.md` (P5.8.1)

---

## Índex

1. [Propòsit i abast](#1-propòsit-i-abast)
2. [Conceptes de domini](#2-conceptes-de-domini)
3. [Model de dades](#3-model-de-dades)
4. [Cicle de vida d'una instància](#4-cicle-de-vida-duna-instància)
5. [Upgrade de cordó](#5-upgrade-de-cordó)
6. [Estabilitat de nodes al template](#6-estabilitat-de-nodes-al-template)
7. [API REST — endpoints](#7-api-rest--endpoints)
8. [Arquitectura frontend](#8-arquitectura-frontend)
9. [Flux d'assignació pas a pas](#9-flux-dassignació-pas-a-pas)
10. [Import massiu (bulk import)](#10-import-massiu-bulk-import)
11. [Visualització i assignació de troncs (P5.6)](#11-visualització-i-assignació-de-troncs-p56)
12. [Tronc nodes a nivell de família (P5.7)](#12-tronc-nodes-a-nivell-de-família-p57)
13. [Convenció d'ordre de les Bases (P5.8)](#13-convenció-dordre-de-les-bases-p58)
14. [Vista de projecció (P5.8.1 → P5.9)](#14-vista-de-projecció-p581--p59)
15. [Invariants de domini](#15-invariants-de-domini)
16. [Gestió d'errors i casos límit](#16-gestió-derrors-i-casos-límit)
17. [Guia per futures implementacions](#17-guia-per-futures-implementacions)
18. [Rengles — Integració (P5.11)](#18-rengles--integració-p511)
19. [Ghost Clone — Creació radial de nodes (P5.11 F3)](#19-ghost-clone--creació-radial-de-nodes-p511-f3)
20. [Selector de cordons a l'assignació (P5.11 F4)](#20-selector-de-cordons-a-lassignació-p511-f4)

---

## 1. Propòsit i abast

El mòdul de Pinyes permet al **Cap de Pinyes** (tècnic de la colla) dissenyar figures muixerangueres, organitzar-les per events i assignar persones a cada posició.

### Funcionalitats principals

- **Disseny de figures**: Editor visual (canvas Konva) per crear templates amb posicions de pinya, tronc i base.
- **Famílies i variants**: Agrupa templates que representen la mateixa figura a mides diferents (ex: "Pilar de 4" amb 1, 2 i 3 cordons).
- **Composicions**: Agrupa múltiples figures en una disposició espacial (ex: "Altar" = 2 pilars + 1 morera).
- **Segments d'event**: Cada event es divideix en blocs temporals; cada bloc conté figures a realitzar.
- **Assignació**: Canvas d'assignació pick-and-place on el Cap de Pinyes assigna membres a cada posició.
- **Projecció**: Vista fullscreen per assajos/actuacions amb grid de pinyes o resum de troncs (P5.9).
- **Creixement concèntric**: Afegir un cordó a una figura en curs sense perdre les assignacions existents.

---

## 2. Conceptes de domini

### FigureFamily (Família)

Una família agrupa templates que representen la **mateixa figura** a mides diferents (cordons). Per exemple:

```
FigureFamily: "Pilar de 4"
  ├── FigureTemplate: "Pilar de 4 — 1 cordó"  (variantOrder = 1, ~12 nodes pinya)
  ├── FigureTemplate: "Pilar de 4 — 2 cordons" (variantOrder = 2, ~20 nodes pinya)
  └── FigureTemplate: "Pilar de 4 — 3 cordons" (variantOrder = 3, ~28 nodes pinya)
```

Els templates sense família (dades legacy pre-P5.5) apareixen a la secció "Altres" del llistat.

### FigureTemplate (Template / Variant)

Un template és el **blueprint reutilitzable** d'una figura. Conté:
- Metadades: `name`, `slug`, `hasPinya`, `direction`
- Una llista de **FigureNode**s que defineixen les posicions físiques
- Referència a la seva `FigureFamily` + `variantOrder`

Els templates es dissenyen a l'**editor visual**. Cada save fa un **upsert** de nodes per ID (no delete+recreate), garantint que els IDs siguin estables.

### FigureNode (Node de template)

Cada posició dins d'un template. Camps clau:

| Camp | Propòsit |
|------|----------|
| `zone` | `PINYA`, `TRONC`, `BASE`, `FIGURE_DIRECTION`, `XICALLA_DIRECTION` |
| `positionType` | Tipus semàntic: `agulla`, `laterals`, `mans`, `vents`, `cordo-obert`, `crossa`, `contrafort`, `tap` |
| `ringLevel` | Anell concèntric al qual pertany (1 = primer cordó). `null` per no-pinya i `cordo-obert` |
| `originNodeId` | ID de l'ancestre arrel dins la família. Permet traçar el llinatge entre variants derivades |

### FigureInstance (Instància)

Una instància és la **presència concreta** d'un template en un segment d'event. No és una còpia; inicialment és una referència lleugera. Conté:
- Referència a `figureTemplate` (o `compositionTemplate`)
- `snapshotted: boolean` — indica si els nodes ja s'han copiat
- `sourceVariantOrder` — variant en el moment del snapshot (per calcular upgrades)

### InstanceNode (Node d'instància)

Còpia immutable d'un `FigureNode`, propietat d'una `FigureInstance`. Creada en bloc en la primera assignació (**lazy snapshot**). A partir d'aquí, els canvis al template no afecten la instància.

Camps addicionals respecte `FigureNode`:
- `sourceNodeId` — ID del `FigureNode` original en el moment del snapshot (no FK)
- `originNodeId` — copiat de `FigureNode.originNodeId` per facilitar el matching en upgrades

### NodeAssignment (Assignació)

Enllaça un `InstanceNode` + una `Person`. La FK és a `InstanceNode`, **mai** a `FigureNode`. Això és el canvi central de P5.5: desacobla completament les assignacions dels templates.

### EventSegment (Segment)

Bloc temporal dins d'un event (ex: "Escalfament", "Bloc 1"). Cada segment conté múltiples `FigureInstance`s. Restricció: una persona no pot aparèixer en dues instàncies del **mateix** segment.

---

## 3. Model de dades

### Diagrama de relacions (mòdul pinyes)

```
FigureFamily
    │ 1:N (RESTRICT)
    ├──► FigureTemplate ──── 1:N (CASCADE) ────► FigureNode
    │         │                                       │
    │         │ 1:N                             ringLevel, originNodeId
    │         ▼
    │   FigureInstance ─── snapshotted, sourceVariantOrder
    │         │
    │         ├─ 1:N (CASCADE) ────► InstanceNode ◄──── originNodeId, sourceNodeId
    │         │                           │
    │         └─ 1:N (CASCADE) ────► NodeAssignment ───► InstanceNode (RESTRICT)
    │                                                 └──► Person (RESTRICT)
    │
    └──► FigureFamilyNode (P5.7) ─── zone: TRONC/BASE only, shared across variants
              │ x, width (relative units 0.5u–8u), z (floor), sortOrder
```

### Taules de base de dades

| Taula | Descripció | Fase |
|-------|-----------|------|
| `figure_families` | Famílies de figures | P5.5 |
| `figure_templates` | Templates reutilitzables | P5.1 |
| `figure_nodes` | Nodes d'un template (només PINYA) | P5.1 / P5.7 |
| `figure_family_nodes` | Nodes TRONC/BASE compartits per família | P5.7 |
| `composition_templates` | Agrupació de templates | P5.2 |
| `composition_slots` | Slot dins d'una composició | P5.2 |
| `event_segments` | Blocs temporals d'un event | P5.3 |
| `figure_instances` | Instàncies en un segment | P5.3 |
| `instance_nodes` | Snapshot de nodes per instància | P5.5 |
| `node_assignments` | Assignació persona→posició | P5.4 |

---

## 4. Cicle de vida d'una instància

### Estat 1 — Pre-snapshot (`snapshotted = false`)

Quan s'afegeix una figura a un segment, es crea una `FigureInstance` lleugera:

```json
{
  "id": "abc-123",
  "figureTemplate": { "id": "template-456" },
  "snapshotted": false,
  "sourceVariantOrder": null,
  "instanceNodes": []
}
```

En carregar el canvas d'assignació per a aquesta instància, el backend retorna els **nodes vius del template** (via `GET /node-assignments/instances/:id/nodes`). L'usuari veu els nodes actuals del template, però encara no existeixen còpies.

### Estat 2 — Primera assignació → Snapshot automàtic

Quan el Cap de Pinyes fa la primera assignació:

```
POST /node-assignments/instances/:id/assign
{ nodeId: "figure-node-id", personId: "person-id" }
```

El backend executa el **lazy snapshot** en transacció:

1. Llegeix tots els `FigureNode`s del template referit per la instància
2. Crea N `InstanceNode`s (còpies) amb `sourceNodeId = figureNode.id` i `originNodeId = figureNode.originNodeId`
3. Actualitza la instància: `snapshotted = true`, `sourceVariantOrder = template.variantOrder`
4. Crea la `NodeAssignment` apuntant a l'`InstanceNode` corresponent (matching per `sourceNodeId = nodeId`)
5. Retorna el detall de l'assignació creada

A partir d'aquí, els canvis al template **no afecten** aquesta instància.

### Estat 3 — Post-snapshot

```
GET /node-assignments/instances/:id/nodes
→ retorna els InstanceNodes (isSnapshotted: true)
```

Totes les assignacions posteriors fan un lookup directe per `InstanceNode.id` (o per `sourceNodeId` per compatibilitat amb el canvas si envia un `figureNode.id`).

### Estat 4 — Eliminació

- **Pre-snapshot**: simplement s'elimina la `FigureInstance` (sense nodes a cascadar)
- **Post-snapshot**: `CASCADE` elimina els `InstanceNode`s i les `NodeAssignment`s

---

## 5. Upgrade de cordó

L'upgrade permet afegir les posicions del **cordó exterior** a una instància ja assignada, sense tocar les assignacions existents.

### Quan és possible

El botó "Afegir cordó" apareix quan:
- La instància pertany a una família (via `figureTemplate.family`)
- Existeix un template amb `variantOrder = instance.sourceVariantOrder + 1` a la mateixa família
- L'instància no ja està a la variant màxima

### Algorisme d'upgrade

```
POST /node-assignments/instances/:id/upgrade
```

1. Troba el template de la instància: `instance.figureTemplate`
2. Obté la família: `template.family`
3. Troba la variant superior: `family.templates` on `variantOrder = instance.sourceVariantOrder + 1`
4. Carrega els nodes de la variant superior
5. Per cada node de la variant superior, calcula el **canonical ID**: `originNodeId ?? node.id`
6. Per cada `InstanceNode` existent, calcula el seu canonical: `originNodeId ?? sourceNodeId`
7. Els nodes amb canonical que ja existeix → **no s'afegeixen** (ja estan assignables)
8. Els nodes sense match → **nous `InstanceNode`s** creats amb geometria de la variant superior
9. Actualitza: `instance.sourceVariantOrder = variantSuperior.variantOrder`, `instance.figureTemplate = variantSuperior`

El resultat és un `UpgradeResult`:
```typescript
{
  addedNodes: number;       // nous InstanceNodes creats
  updatedNodes: number;     // 0 (no es toquen els existents)
  totalNodes: number;       // total InstanceNodes post-upgrade
  newTemplateId: string;
  newTemplateName: string;
  newVariantOrder: number;
}
```

### Exemple visual

```
Instància post-snapshot (2C): 20 InstanceNodes, 15 assignats
                    ↓  upgrade
Instància post-upgrade (3C): 20 InstanceNodes existents (15 assignats) + 8 nous
                              → 28 InstanceNodes, 8 lliures a assignar
```

---

## 6. Estabilitat de nodes al template

Abans de P5.5, el `PUT /figure-templates/:id` feia un **delete-all + recreate** de tots els nodes. Això generava nous UUIDs a cada save i, si hi havia assignacions, bloquejava l'operació amb 409.

Ara el backend fa un **upsert** per `FigureNode.id`:

```
Per cada node al payload:
  - Si existeix (mateixa id): UPDATE (coords, label, color, ringLevel...)
  - Si és nou (sense id al payload però retornat pel frontend com a nou): CREATE
  - Si existia però no apareix al payload: DELETE
```

Això garanteix:
- **IDs estables** entre saves (útil per bulk import, analytics, references externes)
- **Edició lliure del template** independentment de si té instàncies snapshotted (ja no hi ha guard per assignacions)
- El guard de 409 per `figureNode` → `NodeAssignment` **ha estat eliminat** (ja no és necessari)

---

## 7. API REST — endpoints

### Famílies (`/figure-families`)

| Mètode | Ruta | Descripció |
|--------|------|-----------|
| `GET` | `/figure-families` | Llista paginada amb `search`, `page`, `limit`. Inclou `variantCount` |
| `GET` | `/figure-families/:id` | Detall amb llista de variants (id, name, slug, variantOrder, nodeCount) |
| `POST` | `/figure-families` | Crea família (name, slug, description, metadata) |
| `PUT` | `/figure-families/:id` | Actualitza metadades |
| `DELETE` | `/figure-families/:id` | Elimina (409 si té templates) |

### Templates (`/figure-templates`)

| Mètode | Ruta | Descripció |
|--------|------|-----------|
| `GET` | `/figure-templates` | Llista paginada amb `familyId`, `search`, `hasPinya` |
| `GET` | `/figure-templates/:id` | Detall amb nodes |
| `POST` | `/figure-templates` | Crea template (+ `familyId` opcional, `variantOrder`) |
| `PUT` | `/figure-templates/:id` | Actualitza template + upsert de nodes |
| `DELETE` | `/figure-templates/:id` | Elimina (409 si té instàncies o slots) |
| `POST` | `/figure-templates/:id/duplicate` | Duplica template (nova família o mateixa, nou variantOrder) |

### Instàncies i nodes (`/node-assignments`)

| Mètode | Ruta | Descripció |
|--------|------|-----------|
| `GET` | `/node-assignments/instances/:id/nodes` | Nodes disponibles (InstanceNodes si snapshotted, FigureNodes si no) |
| `GET` | `/node-assignments/instances/:id` | Assignacions actuals de la instància |
| `POST` | `/node-assignments/instances/:id/assign` | Assigna persona a node (auto-snapshot en primera crida) |
| `DELETE` | `/node-assignments/instances/:id/unassign/:nodeId` | Desassigna node |
| `POST` | `/node-assignments/instances/:id/swap` | Intercanvia dues assignacions |
| `POST` | `/node-assignments/instances/:id/upgrade` | Afegeix cordó (variant superior) |
| `GET` | `/node-assignments/instances/:id/history` | Historial d'assignacions per importar |
| `POST` | `/node-assignments/instances/:id/bulk-import` | Import massiu des d'una instància anterior |

### Persones disponibles

| Mètode | Ruta | Descripció |
|--------|------|-----------|
| `GET` | `/node-assignments/available-persons` | Membres filtrats per `search`, `height±2`, `isXicalla`, `excludeAssigned`, ordenats per proximitat d'alçada |
| `GET` | `/node-assignments/next-performance` | Propera `ACTUACIO` (per als assajos, mostra 🎭) |

### Projecció (`/events/:eventId/segments/:segmentId`)

| Mètode | Ruta | Descripció |
|--------|------|-----------|
| `GET` | `/events/:eventId/segments/:segmentId/projection` | Dades agregades per a la vista de projecció: instàncies amb nodes, assignacions, elements de referència, navegació prev/next segment |
| `PUT` | `/events/:eventId/segments/:segmentId/instances/projection-layout` | Actualitza posicions Konva legacy (`projectionX`, `projectionY`, `projectionScale`) — ja no s'utilitza des de la grid CSS (P5.9) |

---

## 8. Arquitectura frontend

### Estructura de fitxers

```
apps/dashboard/src/app/features/pinyes/
├── components/
│   ├── template-list/           # Llistat principal: tab Famílies / Figures / Composicions
│   ├── template-editor/         # Editor Konva de template (pinya + tronc)
│   ├── figure-canvas/           # Canvas Konva reutilitzable
│   ├── composition-editor/      # Editor de composicions multi-figura
│   ├── assignment-canvas/       # Canvas d'assignació (pàgina principal)
│   ├── person-panel/            # Panel lateral de persones disponibles
│   ├── node-popover/            # Popover de node assignat (acció desassignar)
│   ├── import-pinya-modal/      # Modal d'importació massiva
│   ├── figure-picker-modal/     # Modal per afegir figura/composició al segment
│   ├── tronc-view/              # Visualització i assignació de troncs (P5.6)
│   ├── projection-view/         # Projecció de segment (pinyes + troncs) (P5.9)
│   ├── figure-projection/       # Projecció d'una sola figura en pantalla completa (P5.9)
│   └── pinyes-onboarding-modal/ # Modal d'introducció al mòdul (P5.5)
├── services/
│   ├── figure-template.service.ts
│   ├── figure-family.service.ts    # P5.5
│   ├── node-assignment.service.ts
│   ├── assignment-state.service.ts # Signals: estat global del canvas
│   ├── event-segment.service.ts
│   ├── figure-instance.service.ts
│   ├── projection.service.ts       # P5.9
│   └── composition-template.service.ts
└── models/
    ├── figure-template.model.ts
    ├── figure-family.model.ts      # P5.5
    ├── figure-node.model.ts
    ├── assignment.model.ts
    ├── segment.model.ts
    ├── projection.model.ts         # P5.9
    └── composition.model.ts
└── utils/
    └── floor-variance.util.ts      # P5.6
```

### TemplateListComponent

Vista principal del mòdul de pinyes, accessible via `/pinyes`.

**Tres tabs**:
- **Famílies** (defecte, P5.5): Llistat de `FigureFamily` amb variants expandibles. Botons: "Nova Família" (modal), "Nova Variant" (navega a editor), "Editar", "Eliminar".
- **Figures**: Llistat pla de `FigureTemplate`s, per gestionar templates orfes o pre-família.
- **Composicions**: Llistat de `CompositionTemplate`s.

### TemplateEditorComponent

Editor de pàgina complet accessible via `/pinyes/templates/:id/edit`.

- **FigureCanvasComponent** (Konva): canvas pinya amb nodes PINYA renderitzats
- **TroncViewComponent** (P5.6): Floating draggable panel amb visualització CSS Grid del tronc, mode `editor`
- **Toolbar lateral**: afegir nodes per zona + positionType, eliminar node seleccionat, **botó "Tronc"** (obre floating panel)
- **Panel propietats**: label, zona, positionType, color, shape, ringLevel (P5.5), climbPath
- **Auto-save** amb debounce 2s + indicador d'estat
- **Upsert de nodes**: envia el payload complet al `PUT`; el backend fa upsert per ID (P5.7: split TRONC/BASE a family nodes)

### AssignmentCanvasComponent

Pàgina d'assignació accessible via `/pinyes/events/:eventId/segments/:segmentId/assign`.

**Flux de dades**:
1. Carrega les instàncies del segment
2. Per cada instància activa: `GET /node-assignments/instances/:id/nodes` → `InstanceNodeResponse[]`
3. `GET /node-assignments/instances/:id` → assignacions actuals
4. Renderitza al canvas Konva: nodes buits (click per assignar) + nodes ocupats (popover)

**Pick-and-place**:
- Selecció desacoblada: es pot seleccionar primer node o primer persona
- Si l'altre element ja estava seleccionat → assignació automàtica
- Si el node destí ja estava assignat → **swap** automàtic
- Auto-advance: après d'assignar, cursor avança al primer node buit (`sortOrder`)

**Optimistic UI + rollback**: l'`AssignmentStateService` actualitza els signals immediatament; si l'HTTP falla, reverteix l'estat.

### AssignmentStateService

Servei singleton de signals per al canvas d'assignació:

```typescript
// Signals principals
selectedNodeId: signal<string | null>
selectedPersonId: signal<string | null>
activeInstanceId: signal<string | null>
assignments: signal<AssignmentDetail[]>
confirmedPersons: signal<AvailablePerson[]>
pendingOperations: signal<PendingOp[]>

// Computed
freePersonsCount: computed<number>
totalConfirmedCount: computed<number>
```

### PinyesOnboardingModalComponent (P5.5)

Modal informatiu que explica conceptes al Cap de Pinyes:
1. **Famílies**: agrupació de variants de la mateixa figura
2. **Variants**: representació de la figura a mides (cordons) diferents
3. **Snapshot**: quan s'assigna per primera vegada, els nodes es "fixen" per a l'event
4. **Afegir cordó**: creixement de la figura sense perdre assignacions

Es mostra a la primera visita del mòdul i es pot reobrir des d'una icona `?`.

---

## 9. Flux d'assignació pas a pas

```
Cap de Pinyes navega a /pinyes/events/:eventId/segments/:segmentId/assign
        │
        ▼
AssignmentCanvasComponent inicialitza:
  1. GET /events/:eventId/segments/:segmentId → instàncies del segment
  2. Per cada instància: GET /node-assignments/instances/:id/nodes
  3. Per cada instància: GET /node-assignments/instances/:id → assignacions
  4. GET /node-assignments/available-persons → persones disponibles
        │
        ▼
Renderitza canvas Konva:
  - Nodes buits: color de zona, clickables
  - Nodes ocupats: foto/alias de persona, popover en click
  - PersonPanel lateral: llista persones filtrades (ANIRE/PENDENT/NO_VAIG)
        │
  [Click node buit] ────────────────────────────────────────►
  [Click persona]   ──────────────────────────────────────►  │
        │                                                     │
        ▼ (si ambdós seleccionats)                           │
  POST /node-assignments/instances/:id/assign
  { nodeId, personId }
        │
        ▼ [Si instància NO snapshotted]
  Backend: snapshotInstance() → N InstanceNodes creats
  Backend: matching sourceNodeId → InstanceNode per l'assignació
        │
        ▼ [Si instància JA snapshotted]
  Backend: lookup InstanceNode per id o sourceNodeId
        │
        ▼
  NodeAssignment creat → AssignmentDetail retornat
        │
        ▼
  Frontend: signals actualitzats → canvas re-renderitzat (OnPush)
  Auto-advance → node buit següent seleccionat
```

---

## 10. Import massiu (bulk import)

Permet importar assignacions d'una instància anterior (d'un altre event) cap a la instància actual.

### Endpoint

```
POST /node-assignments/instances/:id/bulk-import
{ sourceInstanceId: "uuid" }
```

### Algorisme de remapeig (P5.5)

Amb el nou model, les assignacions d'origen apunten a `InstanceNode`s. El remapeig es fa via `sourceNodeId`:

```
Per cada assignació de la instància origen:
  origen_sourceNodeId = assignment.instanceNode.sourceNodeId

Per cada InstanceNode de la instància destí (post-snapshot):
  destí_sourceNodeId = instanceNode.sourceNodeId

Match: origen_sourceNodeId == destí_sourceNodeId
  → Si match: crea NodeAssignment a la instància destí
  → Si no match: registra com a conflicte
```

### Resultat (`BulkImportResult`)

```typescript
{
  created: AssignmentDetail[];
  conflicts: {
    nodeId: string;
    nodeLabel: string;
    personAlias: string;
    reason: string;  // "node_not_found" | "person_already_assigned" | "node_already_occupied"
  }[];
}
```

---

## 11. Visualització i assignació de troncs (P5.6)

### El problema resolt

Pre-P5.6, els nodes `TRONC` es renderitzaven al canvas Konva amb coordenades `(0,0)`, fent-los invisibles i inutilitzables. El `TroncWidget` al template editor només permetia afegir/eliminar posicions però no representava la topologia real.

### Sistema d'unitats relatives

Els nodes `TRONC` i `BASE` ara usen **unitats relatives** (no pixels) per representar la seva posició horitzontal i amplada:

- **`x`** (0–8, steps 0.5): posició horitzontal d'inici en unitats relatives
- **`width`** (0.5–8, steps 0.5): amplada en unitats relatives (1u = amplada d'una persona)
- **`z`** (integer): pis (P1 = z:0 per `BASE`, P2+ = z:1+ per `TRONC`)

Exemple visual (Pilar de 4):
```
P5: [x:1, w:1]                                      → 1 node
P4: [x:0, w:2]                                      → 1 node spanning 2
P3: [x:0, w:2] [x:2, w:2]                           → 2 nodes spanning 2 each
P2: [x:0, w:1] [x:1, w:1] [x:2, w:1] [x:3, w:1]    → 4 nodes
P1: [x:0, w:1] [x:1, w:1] [x:2, w:1] [x:3, w:1]    → 4 bases (z=0)
```

**Convenció**: `x` i `width` són **pixels** per nodes `PINYA` (canvas Konva) i **unitats relatives** per nodes `TRONC`/`BASE`.

### TroncViewComponent

Component Angular standalone reutilitzable que renderitza el tronc amb **CSS Grid**:

**Modes d'operació**:
- **`editor`**: Controls per editar posició X, amplada, afegir/eliminar nodes, afegir pisos
- **`assignment`**: Visualització d'assignacions amb àlies, alçada, attendance status, variance per pis

**Característiques clau**:
- **Toggle orientació**: P1 dalt (ascendent) ↔ P1 baix (descendent)
- **Variance d'alçades per pis**: Mostra `Δ Xcm` amb color-coding:
  - Verd: ≤5cm
  - Groc: 6–10cm
  - Vermell: >10cm
- **Floating draggable panel**: Panell movible sobre el canvas (no modal), arrossegable amb mouse
- **Grid doblejat intern**: Usa `x*2` i `width*2` internament per suportar 0.5u steps amb CSS Grid (que només accepta enters)
- **Inline styling per colors**: `[style.color]` i `[style.background-color]` per evitar problemes de CSS specificity
- **Add floor/node UX**: Botó `+` inline dins cada pis, dropdown per afegir qualsevol pis faltant
- **Columna extra grid**: Dedicada al botó + per evitar line-break quan totes les posicions estan ocupades

**Integració**:
- `TemplateEditorComponent`: Botó "Tronc" a topbar → floating panel en mode editor
- `AssignmentCanvasComponent`: Botó floating "Tronc" sobre canvas → floating panel en mode assignment

**Lògica de variance**:
```typescript
// floor-variance.util.ts
export function floorVariance(z: number, assignments: Map<...>): number | null {
  // Calcula la diferència entre altura màxima i mínima del pis
  const heights = [...]; // assignacions del pis z
  return heights.length >= 2 ? Math.max(...heights) - Math.min(...heights) : null;
}

export function varianceLevel(variance: number): 'success' | 'warning' | 'error' {
  if (variance <= 5) return 'success';
  if (variance <= 10) return 'warning';
  return 'error';
}
```

**Migració de dades**:
Script `migrate-tronc-units.script.ts` actualitza valors existents de `x`/`width` per nodes TRONC/BASE a unitats relatives (defecte: `x=0..3`, `width=1`).

---

## 12. Tronc nodes a nivell de família (P5.7)

Pre-P5.7, cada variant d'una família tenia la seva pròpia còpia dels nodes `TRONC`/`BASE`. Això causava:
- Inconsistències quan s'editava el tronc d'una sola variant
- Workflow tediós (editar totes les variants manualment)
- Conceptualment incorrecte (el tronc és la **mateixa estructura** per tota la família)

### Entitat FigureFamilyNode

Nova taula `figure_family_nodes` que emmagatzema nodes `TRONC`/`BASE` compartits a nivell de `FigureFamily`:

```typescript
@Entity('figure_family_nodes')
export class FigureFamilyNode {
  @PrimaryGeneratedColumn('uuid') id: string;
  @ManyToOne(() => FigureFamily, { onDelete: 'CASCADE' }) family: FigureFamily;
  @Column() label: string;
  @Column({ type: 'enum', enum: FigureZone }) zone: FigureZone; // TRONC | BASE
  @Column() positionType: string;
  @Column({ type: 'float' }) x: number;           // unitats relatives
  @Column({ type: 'float' }) width: number;       // unitats relatives
  @Column({ type: 'int' }) z: number;             // pis
  @Column({ type: 'int' }) sortOrder: number;
  @Column({ nullable: true }) color?: string;
  @Column({ type: 'enum', enum: NodeShape }) shape: NodeShape;
  @Column({ type: 'jsonb', nullable: true }) climbPath?: any;
  // No té originNodeId (no deriva, és l'origen)
}
```

### Estratègia merge/split transparent

El frontend **no canvia**: segueix enviant/rebent nodes com abans. El backend fa la separació internament:

**GET `/figure-templates/:id`** → **merge**:
1. Carrega `FigureNode`s del template (només PINYA)
2. Carrega `FigureFamilyNode`s de la família (TRONC/BASE)
3. Combina les dues llistes
4. Marca FamilyNodes amb `isShared: true` al DTO de sortida

**PUT `/figure-templates/:id`** → **split**:
1. Rep el payload amb nodes combinats
2. Separa per `zone`:
   - `TRONC`/`BASE` → `syncFamilyNodes()` (upsert a `figure_family_nodes`)
   - `PINYA` / directions → `syncTemplateLevelNodes()` (upsert a `figure_nodes`)
3. Upsert idempotent per ID (update si existeix, create si nou, delete si falta)

**Funcions afectades**:
- **`deriveNodes()`**: Només copia nodes PINYA (exclou TRONC/BASE) quan es crea una nova variant
- **`snapshotInstance()`**: Snapshoteja tant `FigureFamilyNode`s com `FigureNode`s a `InstanceNode`s
- **`duplicate()`**: En duplicar un template, si té família, els TRONC/BASE venen automàticament de la família

### Migració de dades

Script `migrate-tronc-to-family.script.ts` (idempotent):
1. Itera per cada `FigureFamily`
2. Troba el template amb `variantOrder` més baix (variant base)
3. Copia els seus nodes TRONC/BASE a `figure_family_nodes`
4. Elimina tots els nodes TRONC/BASE de `figure_nodes` per tota la família

Nx target: `nx run api:migrate-tronc-to-family`

### Seeds actualitzats

Els seeds ara tenen estructura `familyNodes` separada:

```typescript
interface FigureSeed {
  family: { name, slug, description };
  variants: Array<{
    name, slug, variantOrder,
    nodes: FigureNodeSeed[]  // només PINYA
  }>;
  familyNodes: FigureNodeSeed[]  // TRONC + BASE, compartits
}
```

`insertFigure()` és idempotent: comprova si la família ja té family nodes abans d'inserir-los.

### Beneficis

- **Edició unificada**: Editar el tronc d'una variant actualitza automàticament totes les variants
- **Menys duplicació**: Un sol conjunt de nodes TRONC/BASE per família
- **Conceptualment correcte**: El tronc és la mateixa estructura física per tota la família
- **Backward compatible**: Instàncies existents snapshotted no es veuen afectades

---

## 13. Convenció d'ordre de les Bases (P5.8)

### El problema

Les Bases (zone `BASE`, `z = 0`) defineixen el P1 del Tronc. La seva posició horitzontal al Tronc (via `sortOrder`) determina quina persona del Tronc queda alineada sobre quina Base. Si les Bases no estan en l'ordre correcte, les assignacions del Tronc (Segon, Alçadora, Xiqueta) es col·loquen sobre la Base equivocada.

### Convenció oficial

**Les Bases es numeren i s'ordenen en sentit anti-horari (CCW) partint de la dalt-esquerra**, vist des de dalt del canvas de Pinya.

| Núm. Base | Posició aproximada | Exemple (4 Bases) |
|-----------|-------------------|-------------------|
| Base 1    | Dalt-esquerra     | Top-left (NW)     |
| Base 2    | Baix-esquerra     | Bottom-left (SW)  |
| Base 3    | Baix-dreta        | Bottom-right (SE) |
| Base 4    | Dalt-dreta        | Top-right (NE)    |

Diagrama:
```
  Base 1 ── Base 4
    |  ↺ CCW  |
  Base 2 ── Base 3
```

Per a N Bases, el patró continua en sentit anti-horari des de la Base 1 (dalt-esquerra).

### Etiquetatge automàtic

Quan el Cap de Pinyes afegeix una Base des de l'editor, el sistema li assigna automàticament el label `Base N` (on N és la posició seqüencial dins la família: `Base 1`, `Base 2`, etc.). Aquest label reflecteix l'`sortOrder` de la Base.

### Validació en l'editor

La funció `validateBaseOrdering()` (`utils/base-ordering.util.ts`) comprova si les Bases segueixen l'ordre anti-horari:

1. Calcula el centroide de totes les Bases.
2. Mesura l'angle de cada Base respecte al centroide en coordenades de pantalla (`atan2`).
3. Calcula la distància anti-horari de cada Base respecte a la Base 1 (`sortOrder` 0).
4. Verifica que aquesta distància augmenta monòtonament amb el `sortOrder`.

Si la validació falla (N ≥ 2 Bases), l'editor mostra un avís **"Ordre incorrecte"** a la secció de Bases de la barra d'eines.

### Validació a la llista de templates

A la vista de llista de famílies (`/pinyes`), cada família amb Bases desordenades mostra el badge **"Bases desordenades"**. Fent clic s'obre el modal d'ajuda que explica la convenció.

La validació es fa de forma asíncrona en carregar la llista: per a cada família es carrega el primer variant (menor `variantOrder`) i s'extrauen els nodes `BASE`.

### Modal d'ajuda

El `TemplateEditorHelpModalComponent` explica:
- Com funciona l'editor de figures.
- La convenció d'ordre anti-horari de les Bases (amb diagrama).
- La relació entre l'ordre de Bases i els pisos del Tronc.

Es mostra automàticament a la primera visita a l'editor de templates (clau localStorage: `muixer_template_editor_help_dismissed`). Es pot reobrir des del botó `?` de la topbar de l'editor.

---

## 14. Vista de projecció (P5.8.1 → P5.9)

Mode **fullscreen** per projectar les assignacions d'un segment durant assajos o actuacions. Accessible des del gestor de segments de l'event (`SegmentManagerComponent` → botó "Projecció"), des del canvas d'assignació (botó "Projectar" per figura) o directament per URL.

### Evolució

| Fase | Què es va implementar | Estat actual |
|------|----------------------|--------------|
| **P5.8.1** | Vista de projecció inicial: `ProjectionViewComponent`, `SegmentCanvasComponent` Konva, posicionament lliure (`projectionX/Y/Scale`), elements de referència, mode edició/projecció | Spec: `docs/specs/2026-05-22-p5-8-1-projection-view-design.md`. El posicionament Konva i el mode edició **ja no s'utilitzen** |
| **P5.9.1** | Grid CSS responsive, bases visibles, tronc per doble clic, ruta figura individual, ellipsis, fons configurable, gestió d'elements de referència | Grid, bases, ruta individual i fons **actius**; elements de referència **eliminats de la UI** de projecció |
| **P5.9.2** | Eliminació mode edició, vista Troncs (`?view=troncs`), panells flotants multi-figura, HUD de navegació, correccions toast/enrere | **Estat actual** del component |

### P5.9.1 — Millores de layout i projecció per figura

Canvis implementats sobre P5.8.1 (pla *Projection View Fixes & Enhancements*):

#### 1. Bases visibles a la projecció

Previament, `FigureProjectionComponent.pinyaNodes` excloua `FigureZone.BASE`, de manera que les bases no es renderitzaven al canvas Konva.

**Fix:** `pinyaNodes` filtra només `TRONC`:

```typescript
readonly pinyaNodes = computed(() =>
  instance.nodes.filter((n) => n.zone !== FigureZone.TRONC),
);
```

Afecta `FigureProjectionComponent`, la grid de `ProjectionViewComponent` (`getInstancePinyaNodes`) i `segment-canvas.component.ts` (mini-previews en mode edició, ja eliminat).

#### 2. Grid CSS en lloc de posicionament Konva

Substituïx el llenç Konva lliure (`projectionX`, `projectionY`, `projectionScale`) per un layout **flex-wrap** que s'adapta al nombre de figures. El pipeline d'auto-save de posicions (`PUT .../projection-layout`) es va eliminar del frontend de projecció.

#### 3. Tronc per doble clic (primera iteració)

Primera versió: un sol panell flotant fix (`troncOverlayInstanceId`) obert amb doble clic sobre una cel·la de la grid. Substituit a P5.9.2 per panells multi-figura independents (vegeu més avall).

#### 4. Ruta de projecció per figura individual

Nova ruta lazy-loaded i `FigureProjectionComponent` en mode standalone:

- Carrega dades via `GET .../projection` i filtra per `instanceId` de la ruta
- Layout: tronc (esquerra, `TroncViewComponent mode="projection"`) + pinya (`FigureCanvasComponent mode="readonly"`)
- Botó "Tornar al segment" → navega a `/project` del mateix segment
- `LayoutService.requestFullscreen()` en entrar / `exitFullscreen()` en sortir

**Punts d'accés:**
- Grid de segment: enllaç `Maximize2` (hover) per cel·la
- Canvas d'assignació: botó **"Projectar"** a la toolbar (per la figura de la pestanya activa)

#### 5. Navegació de segments clickable

Els `<kbd>←</kbd>` / `<kbd>→</kbd>` del HUD passen de ser decoratius a `<button>` amb `(click)="navigateSegment('prev'|'next')"`.

#### 6. Ellipsis als noms de nodes Konva

A `FigureCanvasComponent`, els labels en mode projecció/readonly usaven `wrap: 'word'`, cosa que permetia desbordament multilínia sense retallar. Es va canviar a `wrap: 'none'` (posteriorment evolucionat a `fitFontSizeForNode()` per reduir la font abans de truncar).

#### 7. Fons configurable (blanc / negre)

Signal `bgColor: signal<'white' | 'black'>` (defecte: blanc). Toggle Moon/Sun al HUD. Els labels de figura adapten color segons fons (`text-gray-800` / `text-white`).

#### 8. Elements de referència (mode edició — eliminat a P5.9.2)

A P5.9.1 s'afegí gestió d'elements de referència des del mode edició:
- Modal per afegir rectangle/fletxa amb label personalitzat
- Botó eliminar quan un element està seleccionat
- Auto-save de posicions via `ReferenceElementService.batchUpdate` (debounce 2s)

L'API continua retornant `referenceElements` a `GET .../projection`, però la UI de projecció **ja no els gestiona** des de P5.9.2.

### P5.9.2 — Refinament de la UX (estat actual)

#### Rutes frontend

| Ruta | Component | Propòsit |
|------|-----------|----------|
| `/pinyes/events/:eventId/segments/:segmentId/project` | `ProjectionViewComponent` | Grid del segment sencer (pinyes o troncs) |
| `/pinyes/events/:eventId/segments/:segmentId/project/:instanceId` | `FigureProjectionComponent` | Una sola figura en pantalla completa |

**Query param de vista** (només `ProjectionViewComponent`):

| URL | Vista |
|-----|-------|
| `/project` | **Pinyes** (defecte) — grid de canvases Konva per figura |
| `/project?view=troncs` | **Troncs** — grid de resums de tronc per figura |

El query param es preserva en navegar entre segments (`←` / `→`). La tecla `E` alterna entre vistes i sincronitza l'URL via `syncQueryParam()`.

#### Arquitectura de vistes

El component **no té mode d'edició** (`SegmentCanvasComponent` eliminat de la projecció). Hi ha dues vistes independents controlades per `viewMode: signal<'pinyes' | 'troncs'>`:

```
ProjectionViewComponent
├── viewMode = 'pinyes'  (defecte)
│   ├── CSS flex-wrap grid de FigureCanvasComponent (mode readonly)
│   ├── Doble clic → panell flotant de tronc (TroncViewComponent)
│   └── Enllaç Maximize2 → FigureProjectionComponent (figura individual)
│
└── viewMode = 'troncs'  (?view=troncs)
    └── CSS flex-wrap grid de targetes amb TroncViewComponent (mode projection)
```

#### Layout responsive (CSS grid)

Les figures s'organitzen amb `flex-wrap` i mides calculades per `gridCols` / `gridRows`:

| N figures | Columnes | Files |
|-----------|----------|-------|
| 1 | 1 | 1 |
| 2 | 2 | 1 |
| 3 | 3 | 1 |
| 4 | 2 | 2 |
| 5+ | 3 | `ceil(n/3)` (última fila centrada) |

Cada cel·la usa `itemWidthStyle()` / `itemHeightStyle()` (`calc(X% - 6px)`) per tenir en compte el gap de 3px.

Els camps `projectionX`, `projectionY`, `projectionScale` de `FigureInstance` continuen existint a la BD però **ja no governen el layout** de la projecció.

#### Vista Pinyes

- Renderitza cada figura amb `FigureCanvasComponent` en mode `readonly`.
- Nodes mostrats: tot excepte `TRONC` (inclou `PINYA`, `BASE`, directions).
- Assignacions visibles com a àlies sobre els nodes.
- **Doble clic** sobre una figura obre un panell flotant de tronc independent.
- **Hover → Maximize2**: navega a `/project/:instanceId` per veure la figura sola.

#### Panells flotants de tronc (vista Pinyes)

Substituïx l'antic overlay únic i fix. Permet **múltiples panells simultanis**, un per figura:

```typescript
interface TroncPanel {
  instanceId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

readonly openTroncPanels = signal<TroncPanel[]>([]);
```

| Acció | Comportament |
|-------|-------------|
| Doble clic figura | Obre panell nou (offset +30px/+30px per evitar superposició) |
| Doble clic figura ja oberta | Porta el panell al davant (`bringPanelToFront`) |
| Arrossegar capçalera | Mou el panell (`DragState` + `@HostListener document:mousemove`) |
| Handle cantonada inferior dreta | Redimensiona (mínim 300×200px) |
| Botó X / `Esc` | Tanca el panell superior (màxim `zIndex`) |
| Canvi de segment | Esborra tots els panells (`openTroncPanels.set([])`) |

Contingut del panell: `TroncViewComponent` en mode `projection`, amb interior `flex-1 overflow-y-auto min-h-0` per adaptar-se a l'alçada en redimensionar.

**Eliminat**: backdrop invisible a pantalla completa que bloquejava la interacció amb altres panells.

#### Vista Troncs

Resum del segment amb **només troncs** (no pinyes). Cada figura és una targeta fosca amb:
- Capçalera amb nom de la figura
- `TroncViewComponent` (mode `projection`) amb nodes `TRONC` + `BASE` i assignacions

Mateixes dimensions de grid que la vista Pinyes. No hi ha panells flotants en aquesta vista.

#### HUD de navegació flotant

Barra `<nav>` fixa al centre-inferior, **sempre visible** (no s'amaga amb el cursor):

| Control | Funció |
|---------|--------|
| ← (ArrowLeft) | Tornar a l'event (`Location.back()`) |
| Nom del segment | Informatiu |
| ← / → (kbd) | Segment anterior / següent |
| Pinyes / Troncs | Toggle de vista (també tecla `E`) |
| Moon / Sun | Alternar fons blanc / negre |
| ? | Modal d'ajuda de dreceres |

El botó enrere usa `Location.back()` (no `/events/:eventId`, ruta inexistent) per tornar correctament tant a `/rehearsals/:id` com a `/performances/:id`.

#### FigureProjectionComponent

Projecció d'**una sola figura** en pantalla completa. Dos modes:

- **Standalone** (ruta `/project/:instanceId`): carrega dades via `ProjectionService.getProjection()` i filtra la instància demanada.
- **Embedded** (input `instance`): per tests o ús futur dins d'un altre component.

Mostra `FigureCanvasComponent` (pinya + bases) i `TroncViewComponent` (tronc) en layout vertical.

#### Dreceres de teclat

| Tecla | Acció |
|-------|-------|
| `←` / `→` | Segment anterior / següent |
| `E` | Alternar vista Pinyes / Troncs |
| `F` | Pantalla completa del navegador |
| `Esc` | Tancar ajuda → tancar panell tronc superior → tornar enrere |
| `?` / `H` | Obrir / tancar modal d'ajuda |

En mode projecció, el cursor s'amaga després de 3s d'inactivitat (`cursor-none`); el HUD roman interactiu.

#### Correccions P5.9.2 (maig 2026)

| Problema | Solució |
|----------|---------|
| Entrada a `/project` mostrava canvas d'edició (SegmentCanvas + elements de referència) | Eliminat mode edició; defecte = grid Pinyes |
| Toast buit interceptava hover (32×32px top-right) | `pointer-events-none` al contenidor, `pointer-events-auto` a cada toast individual; `aria-live` es manté al DOM |
| Botó enrere navegava a `/events/:eventId` (404) | `Location.back()` |
| Panell tronc fix (P5.9.1), un sol overlay, backdrop bloquejant | Multi-panell independent, draggable, resizable, sense backdrop |
| Tecla `E` obria vista d'edició sense sentit | Reconvertit a toggle Pinyes ↔ Troncs amb `?view=troncs` |

#### Fitxers implicats

| Fitxer | Canvis principals |
|--------|-------------------|
| `projection-view.component.ts/html` | Grid CSS, `viewMode`, panells flotants, HUD |
| `figure-projection.component.ts/html` | Bases incloses, mode standalone per ruta |
| `figure-projection.component.spec.ts` | Tests `pinyaNodes` inclou BASE |
| `figure-canvas.component.ts` | Ellipsis / `fitFontSizeForNode` en mode readonly |
| `segment-canvas.component.ts` | BASE incloses a mini-previews (legacy edit mode) |
| `pinyes.routes.ts` | Rutes `/project` i `/project/:instanceId` |
| `assignment-canvas.component.html` | Botó "Projectar" per figura activa |
| `toast.component.ts` | `pointer-events-none` al contenidor buit |

#### Flux de dades

```
SegmentManager → navigate('/pinyes/events/:eventId/segments/:segmentId/project')
        │
        ▼
ProjectionViewComponent.ngOnInit()
  1. layoutService.requestFullscreen()
  2. Llegeix ?view=troncs → viewMode
  3. GET /events/:eventId/segments/:segmentId/projection
        │
        ▼
ProjectionSegmentData {
  segment: { id, name, prevSegmentId, nextSegmentId },
  instances: [{ nodes, assignments, figureTemplate, ... }],
  referenceElements: [...]   // retornat per l'API; no gestionat des de la UI de projecció
}
        │
        ▼
Renderitza grid segons viewMode ('pinyes' | 'troncs')
```

---

## 15. Invariants de domini

Aquests invariants han de mantenir-se en qualsevol futura implementació:

1. **Snapshot immutable**: Un cop `snapshotted = true`, els `InstanceNode` d'una instància no es modifiquen per canvis al template. Només `upgradeInstance()` pot afegir nous `InstanceNode`s.

2. **Assignació → InstanceNode only**: `NodeAssignment` apunta **sempre** a `InstanceNode`, mai directament a `FigureNode`.

3. **originNodeId traces back to root**: Dins d'una família, el `originNodeId` d'un node derivat sempre apunta a l'**ancestre arrel** (el node de la primera variant), no al node de la variant immediatament anterior.

4. **Family ordering**: Els templates d'una família tenen `variantOrder` estrictament creixents. L'upgrade sempre va a `variantOrder + 1`.

5. **XOR template/composition**: Una `FigureInstance` té exactament un de `figureTemplate` o `compositionTemplate`. Mai tots dos, mai cap.

6. **One person per segment**: Una persona no pot aparèixer en dues `NodeAssignment` de `FigureInstance`s del mateix `EventSegment`.

7. **ringLevel consistency**: Tots els nodes d'un template amb `ringLevel = N` impliquen l'existència d'almenys un node amb `ringLevel = 1..N-1`. No poden haver-hi forats.

8. **Node ID stability**: Dins d'un template, `FigureNode.id` és estable entre saves (upsert, no delete+recreate).

9. **Cordo-obert independence**: Nodes amb `positionType = 'cordo-obert'` poden tenir `ringLevel = null`. La seva presència és independent del compte de cordons.

10. **Tronc shared at family level (P5.7)**: Nodes `TRONC` i `BASE` existeixen només a `FigureFamilyNode` (no a `FigureNode`). Són compartits per totes les variants d'una família.

11. **Relative units for tronc (P5.6)**: Per nodes `TRONC`/`BASE`, `x` i `width` són unitats relatives (0–8u, steps 0.5). Per nodes `PINYA`, són pixels.

12. **Base ordering (P5.8)**: Les Bases han de seguir l'ordre anti-horari (CCW) partint de dalt-esquerra. `sortOrder` 0 = dalt-esquerra, i augmenta en sentit anti-horari. El label de cada Base ha de ser `Base N` (N = sortOrder + 1). La funció `validateBaseOrdering()` comprova aquest invariant.

13. **Assignment lock (P5.10)**: Un cop `event.date + ASSIGNMENT_LOCK_DAYS < now()`, les operacions d'escriptura sobre `NodeAssignment` (assign, unassign, swap, bulkImport, upgrade, reset) retornen 403. Les lectures (GET) no es veuen afectades. `ASSIGNMENT_LOCK_DAYS = 0` desactiva el lock.

14. **Position-positionType soft matching (P5.10)**: `Position.slug` i `FigureNode.positionType` es relacionen per convenció de noms (mateixa cadena), no per FK. El matching és opcional i s'usa per prioritzar persones al panel d'assignació.

15. **Rengla integrity (P5.11)**: Un node amb `renglaId` no-null ha de tenir `renglaPosition` no-null. Si es borra una `Rengla`, tots els nodes amb aquell `renglaId` passen a `renglaId = null, renglaPosition = null`.

16. **Cordons visibility (P5.11)**: `isNodeVisible()` és la funció canònica per filtrar nodes per cordons. Nodes sense `renglaId` sempre es mostren. Nodes `cordo-obert` es mostren només si la seva rengla està a `openCordons`.

17. **Bulk import matching (P5.11)**: El matching de nodes entre instàncies es fa per `renglaId + renglaPosition` com a clau primària, amb fallback a `sourceNodeId` directe.

---

## 18 (antic 16). Gestió d'errors i casos límit

| Situació | Codi HTTP | Missatge Catalan |
|----------|-----------|-----------------|
| Slug duplicat en template | 409 | "L'identificador ja l'utilitza una altra figura. Canvia'l." |
| Slug duplicat en família | 409 | "L'identificador ja l'utilitza una altra família. Canvia'l." |
| Eliminar template amb instàncies | 409 | "No es pot esborrar: hi ha instàncies que fan servir aquest template." |
| Eliminar template amb slots de composició | 409 | "No es pot esborrar: s'utilitza en composicions." |
| Eliminar família amb variants | 409 | "No es pot esborrar: la família té N variant(s) associada(es)." |
| Afegir cordó — no existeix variant superior | 400 | "No hi ha una variant amb més cordons disponible per a aquesta família." |
| Node ja ocupat | 409 | "Aquesta posició ja està ocupada." |
| Persona ja assignada al segment | 409 | "Aquesta persona ja està assignada a una altra figura del segment." |
| InstanceNode no trobat en snapshot | 404 | (missatge intern, no exposat a UI) |

### Casos que ja NO generen 409 (canvi P5.5)

- **Editar template amb instàncies snapshotted**: Les `FigureInstance`s snapshotted ja no depenen de `FigureNode`s en FK activa. Es pot editar el template lliurement.
- **Guard `countByNode()` eliminat**: No existeix cap 409 per "template té assignacions actives" en el flux de sincronització de nodes.

---

## 17. Guia per futures implementacions

### Afegir un nou tipus de posicionType

1. `FigureNode.positionType` és un `varchar` lliure, no un enum. Afegir el nou valor al seed o a l'UI no requereix migració.
2. Si el tipus és "growable" (apareix en cordons addicionats per upgrade), afegir-lo a la constant `GROWABLE_POSITION_TYPES` a `libs/shared`.
3. Actualitzar el toolbar de l'editor si es vol un botó específic.

### Crear un nou template derivat (variant)

```
POST /figure-templates
{
  "familyId": "family-uuid",
  "variantOrder": 3,
  "name": "Pilar de 4 — 3 cordons",
  "slug": "pilar-de-4-3c",
  "nodes": [
    // Nodes copiats de la variant 2, amb originNodeId = node.originNodeId ?? node.id
    // Nous nodes del cordó 3 amb ringLevel = 3, originNodeId = null
  ]
}
```

### Implementar downgrade (eliminar cordó)

El downgrade NO està implementat. Si es vol implementar en el futur:
1. Verificar que cap `InstanceNode` del cordó N té `NodeAssignment`s actives (si en té, bloquejar amb 422)
2. Si cap, eliminar els `InstanceNode`s del `ringLevel = N`
3. Actualitzar `instance.sourceVariantOrder = N - 1` i `instance.figureTemplate` a la variant N-1

### Implementar UI d'upgrade de cordó al canvas

El backend de `upgradeInstance` ja està implementat. La integració frontend (Phase D.2) inclou:
- Botó "Afegir cordó" visible quan `nextVariant` existeix
- Modal de confirmació amb el nombre de posicions noves
- Feedback visual dels nodes nous durant 5 segons post-upgrade
- Endpoint: `POST /node-assignments/instances/:id/upgrade`

### Millores a la projecció (futur)

Possibles extensions sobre P5.9:
- Reintroduir posicionament manual d'elements de referència (escenari, marques) si cal per a actuacions complexes
- Sincronització en temps real entre múltiples pantalles de projecció
- Mode composició (agrupar figures d'un `CompositionTemplate` visualment)

### Multi-tenant (futur)

El model de famílies i templates és **per colla**. Quan s'implementi multi-tenant:
- Afegir `collaId` a `FigureFamily`, `FigureTemplate`, `CompositionTemplate`
- Els seeds seran per colla; les famílies no seran globals
- L'API haurà de filtrar per `collaId` extret del JWT

---

## 18. Rengles — Integració (P5.11)

### Concepte

Una **rengla** és una seqüència ordenada de nodes de pinya que formen una línia radial des del centre de la figura cap enfora. Cada posició dins la rengla correspon a un cordó diferent (1r, 2n, 3r...).

```
                      Cordó 3    Cordó 2    Cordó 1    Centre
                        ↓          ↓          ↓         ↓
Rengla "Mans Nord":  [MANS·3] → [MANS·2] → [MANS·1] → [CROSSA]
Rengla "Vents Est":  [VENTS·3]→ [VENTS·2]→ [VENTS·1]→ [AGULLA]
```

### Entitat `Rengla`

```typescript
@Entity('rengles')
export class Rengla {
  @PrimaryGeneratedColumn('uuid') id: string;
  @ManyToOne(() => FigureTemplate, { onDelete: 'CASCADE' }) template: FigureTemplate;
  @Column({ type: 'varchar' }) name: string;
  @Column({ type: 'int', default: 0 }) sortOrder: number;
  @Column({ type: 'int', default: 1 }) startPosition: number;
  @Column({ type: 'boolean', default: false }) allowsCordoObert: boolean;
  @CreateDateColumn() createdAt: Date;
}
```

### Canvis a `FigureNode`

Nous camps afegits:

| Camp | Tipus | Descripció |
|------|-------|-----------|
| `renglaId` | `uuid \| null` | FK a la rengla (NULL = node lliure/central) |
| `renglaPosition` | `int \| null` | Posició dins la rengla (1 = primer cordó) |

### Relació `ringLevel` ↔ `renglaPosition`

- `ringLevel`: identifica el cordó concèntric globalment (per renderització Konva)
- `renglaPosition`: posició dins la seva rengla (per filtratge de cordons)
- En la majoria de casos: `ringLevel === renglaPosition`
- Nodes sense rengla (agulla, crossa, contrafort, tap): `renglaId = null`, `renglaPosition = null`

### Diagrama de relacions actualitzat

```
FigureFamily
    │ 1:N
    └──► FigureTemplate ──── 1:N ────► FigureNode (renglaId, renglaPosition)
              │                              │
              ├─ 1:N ──► Rengla             ◄── FK: renglaId
              │
              └─ 1:N ──► FigureInstance ── numberOfCordons, openCordons
                              │
                              └─ 1:N ──► InstanceNode (renglaId, renglaPosition copied)
```

### Impacte en funcionalitats existents

| Funcionalitat | Canvi |
|---------------|-------|
| **Snapshot** | Copia `renglaId` i `renglaPosition` de FigureNode a InstanceNode |
| **Bulk import** | Matching per `renglaId + renglaPosition` (fallback: `sourceNodeId`) |
| **Projecció** | Nodes filtrats per `isNodeVisible()` basant-se en `numberOfCordons` |
| **Upgrade** | Conceptualment reemplaçat pel selector de cordons (reversible, no destructiu) |
| **Derivació de variants** | Eliminada; un sol template conté tots els cordons |

### Nodes sense rengla

Nodes que mai pertanyen a cap rengla i sempre es mostren:
- `agulla`, `crossa`, `contrafort`, `tap`
- Nodes de zona `TRONC`, `BASE`, `FIGURE_DIRECTION`, `XICALLA_DIRECTION`

---

## 19. Ghost Clone — Creació radial de nodes (P5.11 F3)

### Propòsit

Facilitar la creació de nodes al template editor per clonació ràpida, alineant el nou node radialment darrere del node d'origen.

### Funcionament

1. Per a cada node PINYA que no és central i no és cordó obert, es renderitza un ghost (`+`) darrere seu
2. El ghost es posiciona usant la rotació del node: `direction = (sin(R), -cos(R))`, offset = `height + gap`
3. Clicar el ghost crea un clon amb les mateixes propietats, afegit a la mateixa rengla amb `renglaPosition + 1`

### Utilitats (`ghost-clone.util.ts`)

```typescript
calculatePinyaCentroid(nodes): { x, y }       // Centroide aritmètic
calculateGhostPosition(node, gap=3): { x, y } // Posició radial basada en rotació
isGhostEligible(node): boolean                 // true si PINYA i no central/CO
```

### Elegibilitat

| Tipus | Ghost? |
|-------|--------|
| PINYA (mans, vents, laterals) | Sí |
| PINYA (agulla, crossa, contrafort, tap) | No |
| PINYA (cordo-obert) | No |
| TRONC, BASE, directions | No |

---

## 20. Selector de cordons a l'assignació (P5.11 F4)

### Propòsit

Permet al Cap de Pinyes triar quants cordons mostrar a l'assignació sense canviar de template. Substitueix el concepte d'upgrade de cordó (que era irreversible).

### Model de dades

| Camp | Entitat | Tipus | Descripció |
|------|---------|-------|-----------|
| `numberOfCordons` | `FigureInstance` | `int \| null` | Cordons visibles (NULL = tots) |
| `openCordons` | `FigureInstance` | `jsonb (string[]) \| null` | IDs de rengles amb cordó obert actiu |

### Lògica de visibilitat (`isNodeVisible`)

```typescript
function isNodeVisible(
  node: { renglaId, renglaPosition, positionType },
  numberOfCordons: number | null,
  openCordons: string[] | null,
): boolean {
  if (!node.renglaId) return true;
  if (node.positionType === 'cordo-obert') {
    return (openCordons ?? []).includes(node.renglaId);
  }
  return node.renglaPosition! <= (numberOfCordons ?? Infinity);
}
```

### Components

- **`CordonsDialogComponent`**: modal inline amb selector numèric + toggles per rengla
- **Integració**: botó "Cordons" a la topbar de `AssignmentCanvasComponent`
- **Persistència**: `PATCH /figure-instances/:id/cordons` desa la configuració
- **Projecció**: `getInstanceNodes()` aplica `isNodeVisible()` abans de retornar nodes

### Característiques clau

- Reversible: amagar cordons no elimina assignacions
- Per instància: cada instància pot tenir configuració diferent
- Persistent: sobreviu a recàrregues de pàgina

---

*Documentació actualitzada el 28 de maig de 2026. Referències principals:*
- *P5.5: `docs/specs/2026-05-19-p5-family-snapshot-redesign.md`*
- *P5.6: `docs/specs/2026-05-20-p5-tronc-visualization-design.md`*
- *P5.8.1: `docs/specs/2026-05-22-p5-8-1-projection-view-design.md`*
- *P5.9: vista de projecció — `ProjectionViewComponent`, `FigureProjectionComponent`*
- *P5.11: `docs/specs/2026-05-28-rengles-integration-spec.md`*
