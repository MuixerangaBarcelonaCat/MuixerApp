# Mòdul de Pinyes — Documentació Tècnica

> Última actualització: 19 de maig de 2026  
> Fases implementades: P5.1 → P5.5  
> Spec de referència: `docs/specs/2026-05-19-p5-family-snapshot-redesign.md`

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
11. [Invariants de domini](#11-invariants-de-domini)
12. [Gestió d'errors i casos límit](#12-gestió-derrors-i-casos-límit)
13. [Guia per futures implementacions](#13-guia-per-futures-implementacions)

---

## 1. Propòsit i abast

El mòdul de Pinyes permet al **Cap de Pinyes** (tècnic de la colla) dissenyar figures muixerangueres, organitzar-les per events i assignar persones a cada posició.

### Funcionalitats principals

- **Disseny de figures**: Editor visual (canvas Konva) per crear templates amb posicions de pinya, tronc i base.
- **Famílies i variants**: Agrupa templates que representen la mateixa figura a mides diferents (ex: "Pilar de 4" amb 1, 2 i 3 cordons).
- **Composicions**: Agrupa múltiples figures en una disposició espacial (ex: "Altar" = 2 pilars + 1 morera).
- **Segments d'event**: Cada event es divideix en blocs temporals; cada bloc conté figures a realitzar.
- **Assignació**: Canvas d'assignació pick-and-place on el Cap de Pinyes assigna membres a cada posició.
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
    ▼
FigureTemplate ──── 1:N (CASCADE) ────► FigureNode
    │                                       │
    │ 1:N                             ringLevel, originNodeId
    ▼
FigureInstance ─── snapshotted, sourceVariantOrder
    │
    ├─ 1:N (CASCADE) ────► InstanceNode ◄──── originNodeId, sourceNodeId
    │                           │
    └─ 1:N (CASCADE) ────► NodeAssignment ───► InstanceNode (RESTRICT)
                                           └──► Person (RESTRICT)
```

### Taules de base de dades

| Taula | Descripció | Fase |
|-------|-----------|------|
| `figure_families` | Famílies de figures | P5.5 |
| `figure_templates` | Templates reutilitzables | P5.1 |
| `figure_nodes` | Nodes d'un template | P5.1 |
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
│   ├── tronc-widget/            # Widget del tronc (pisos, posicions per fila)
│   └── pinyes-onboarding-modal/ # Modal d'introducció al mòdul (P5.5)
├── services/
│   ├── figure-template.service.ts
│   ├── figure-family.service.ts    # P5.5
│   ├── node-assignment.service.ts
│   ├── assignment-state.service.ts # Signals: estat global del canvas
│   ├── event-segment.service.ts
│   ├── figure-instance.service.ts
│   └── composition-template.service.ts
└── models/
    ├── figure-template.model.ts
    ├── figure-family.model.ts      # P5.5
    ├── figure-node.model.ts
    ├── assignment.model.ts
    ├── segment.model.ts
    └── composition.model.ts
```

### TemplateListComponent

Vista principal del mòdul de pinyes, accessible via `/pinyes`.

**Tres tabs**:
- **Famílies** (defecte, P5.5): Llistat de `FigureFamily` amb variants expandibles. Botons: "Nova Família" (modal), "Nova Variant" (navega a editor), "Editar", "Eliminar".
- **Figures**: Llistat pla de `FigureTemplate`s, per gestionar templates orfes o pre-família.
- **Composicions**: Llistat de `CompositionTemplate`s.

### TemplateEditorComponent

Editor de pàgina complet accessible via `/pinyes/templates/:id/edit`.

- **FigureCanvasComponent** (Konva): canvas pinya (65-70% ample) + tronc lateral (30-35%)
- **TroncWidget**: pisos seqüencials P1–P6, botons +/− per posicions per fila
- **Toolbar lateral**: afegir nodes per zona + positionType, eliminar node seleccionat
- **Panel propietats**: label, zona, positionType, color, shape, ringLevel (P5.5), climbPath
- **Auto-save** amb debounce 2s + indicador d'estat
- **Upsert de nodes**: envia el payload complet al `PUT`; el backend fa upsert per ID

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

## 11. Invariants de domini

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

---

## 12. Gestió d'errors i casos límit

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

## 13. Guia per futures implementacions

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

### Projecció fullscreen (P5.6)

Per implementar el mode projector:
- Afegir ruta `/pinyes/events/:eventId/segments/:segmentId/project`
- Reutilitzar `FigureCanvasComponent` en mode read-only
- `LayoutService.requestFullscreen()` ja disponible des de P4.3
- Carregar `GET /node-assignments/instances/:id/nodes` + assignacions per mostrar els noms

### Multi-tenant (futur)

El model de famílies i templates és **per colla**. Quan s'implementi multi-tenant:
- Afegir `collaId` a `FigureFamily`, `FigureTemplate`, `CompositionTemplate`
- Els seeds seran per colla; les famílies no seran globals
- L'API haurà de filtrar per `collaId` extret del JWT

---

*Documentació generada el 19 de maig de 2026. Referència principal: `docs/specs/2026-05-19-p5-family-snapshot-redesign.md`.*
