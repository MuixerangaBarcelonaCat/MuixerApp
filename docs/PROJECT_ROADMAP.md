# MuixerApp — Roadmap de Projecte

> Document viu que manté la visió general de tots els sub-projectes.
> Actualitzar cada vegada que es comenci o completi una fase.

---

## Estat General

| ID | Sub-projecte | Estat | Spec | Pla | Codi | Notes |
|----|-------------|-------|------|-----|------|-------|
| P0 | Scaffold (Nx + NestJS + Angular + NeonDB) | ✅ Completat | ✅ | ✅ | ✅ | Monorepo funcional |
| P1 | Usuaris + Persones (entitats + CRUD) | ✅ Completat | ✅ | ✅ | ✅ | Entitats i API REST. Model User refactorizat a P4.1 |
| P2 | Data Migration (API legacy → NeonDB) | ✅ Completat | ✅ | ✅ | ✅ | Sync SSE complet, merge strategy implementada |
| P2.1 | Dashboard Persons — UX i funcionalitats avançades | ✅ Completat | ✅ | ✅ | ✅ | Ordenació, alçada relativa, filtres, tests |
| P3 | Temporades + Esdeveniments + Assistència | ✅ Completat | ✅ | — | ✅ | Season + Event + Attendance entities, API, sync + dashboard shell |
| P4.1 | **Auth Layer** — JWT+Passport + refactor User/Person + Dashboard login | ✅ Completat | [`docs/specs/2026-04-07-p4-1-auth-layer-design.md`](docs/specs/2026-04-07-p4-1-auth-layer-design.md) | ✅ | ✅ | Flux complet: login, refresh rotation, guards globals, dashboard login page |
| P4.2 | Dashboard Web — Events + Assistència manual | ✅ Completat | [`docs/specs/2026-04-12-p4-2-dashboard-events-attendance-design.md`](docs/specs/2026-04-12-p4-2-dashboard-events-attendance-design.md) | ✅ | ✅ | CRUD events + attendance, persones provisionals, optimistic UI |
| P4.3 | **Dashboard Design Refactor** — Clean slate visual redesign | ✅ Completat | [`docs/specs/2026-04-20-dashboard-design-refactor-design.md`](docs/specs/2026-04-20-dashboard-design-refactor-design.md) | [`dashboard_design_refactor_3f8d1aed`](.cursor/plans/dashboard_design_refactor_3f8d1aed.plan.md) | ✅ | Top nav + tabs, 15+ shared components, Home tab, sync UI, Pinyes/Config placeholders |
| **P4.4** | **Arquitectura Docker Multi-entorn** | ✅ Completat | [`docs/specs/2026-05-07-p4-4-docker-local-postgres-design.md`](docs/specs/2026-05-07-p4-4-docker-local-postgres-design.md) | ✅ | ✅ | Docker local dev + Dockerfile multi-stage + docker-compose.prod.yml VPS. NeonDB eliminat del flux de dev |
| **P5.1** | **Mòdul Pinyes — Templates i Editor Visual** | ✅ Completat | [`docs/specs/2026-05-07-p5-figures-module-overview-design.md`](docs/specs/2026-05-07-p5-figures-module-overview-design.md) | [`p5.1_templates_editor_2859060d`](.cursor/plans/p5.1_templates_editor_2859060d.plan.md) | ✅ | Backend CRUD FigureTemplate+FigureNode, NodeShape enum, Konva editor (pinya + tronc), llistat templates, auto-save. TroncWidget: pisos seqüencials P1–P6 amb opcions per pis, +/- posicions per fila, dropdown cap avall, panel propietats simplificat |
| **P5.2** | **Mòdul Pinyes — Composicions** | ✅ Completat | [`docs/specs/2026-05-08-p5-2-compositions-design.md`](docs/specs/2026-05-08-p5-2-compositions-design.md) | ✅ | ✅ | Backend CompositionModule (entitats+CRUD+tests). Frontend: CompositionEditorComponent (canvas multi-figura, pinya-view, offsets, auto-save), tab Composicions al llistat. P5.2.1: fixes canvas (selection/drag/panning), scale 50%, placeholder, save immediat, offset incremental, fit-all, z-order |
|| **P5.3** | **Mòdul Pinyes — Segments i Instàncies** | ✅ Completat | — | — | ✅ | Backend EventSegmentModule (entitats+CRUD+tests). Frontend: SegmentManagerComponent inline a event-detail, CRUD segments/instàncies, reordenar (fletxes), modal picker figures/composicions, toggle visibilitat. Pendent: revisió UX completa (P5.3.1) |
|| P5.3.1 | Mòdul Pinyes — Revisió UX Segments | ⚪ Pendent | — | — | — | Refactor UX segments: tab dedicat "Pinyes" a event-detail, millores d'interacció amb les figures, preview canvas, navegació fluida |
| **P5.4** | **Mòdul Pinyes — Assignació de Persones** | ✅ Completat | [`docs/specs/2026-05-11-p5-3-event-segments-figure-instances.md`](docs/specs/2026-05-11-p5-3-event-segments-figure-instances.md) | [`p5.4_node_assignment_54c3d5e9`](.cursor/plans/p5.4_node_assignment_54c3d5e9.plan.md) | ✅ | NodeAssignment entity+module (backend), AssignmentCanvas+PersonPanel+NodePopover+ImportPinyaModal (frontend), AssignmentStateService (signals), optimistic UI+rollback, botó "Assignar" al SegmentManager |
| **P5.5** | **Mòdul Pinyes — Famílies, Snapshot i Creixement Concèntric** | ✅ Completat | [`docs/specs/2026-05-19-p5-family-snapshot-redesign.md`](docs/specs/2026-05-19-p5-family-snapshot-redesign.md) | — | ✅ | Fases A+B (backend): FigureFamily+InstanceNode entities, lazy snapshot, upgrade de cordó, upsert estable de nodes, NodeAssignment migrat a InstanceNode. Fases C+D (frontend): tab Famílies, modal Nova Família, llistat variants, AssignmentCanvas amb InstanceNodes, modal onboarding pinyes. |
|| **P5.6** | **Mòdul Pinyes — Visualització i Assignació de Troncs** | ✅ Completat | [`docs/specs/2026-05-20-p5-tronc-visualization-design.md`](docs/specs/2026-05-20-p5-tronc-visualization-design.md) | — | ✅ | TroncViewComponent amb CSS Grid, sistema d'unitats relatives (0.5u–8u), rendering per pisos, variance d'alçades per pis amb color-coding, toggle orientació P1 dalt/baix, controls editor (x/width 0.5 decimals), UI floating draggable panel, add floor/node inline, attendance status indicators |
|| **P5.7** | **Mòdul Pinyes — Tronc Nodes a Nivell de Família** | ✅ Completat | — | — | ✅ | FigureFamilyNode entity (TRONC/BASE shared per família), merge/split transparent al backend (GET merge, PUT split), migrate-tronc-to-family script (idempotent), seed files actualitzats, snapshotInstance amb FamilyNodes, tests actualitzats |
|| **P5.8** | **Mòdul Pinyes — Convenció d'ordre de les Bases** | ✅ Completat | — | — | ✅ | Convenció anti-horari (CCW) per bases. `validateBaseOrdering()` util, badge "Bases desordenades" al llistat de famílies, modal d'ajuda amb diagrama, invariant documentat a PINYES_MODULE.md §15 |
|| **P5.8.1** | **Mòdul Pinyes — Vista de Projecció (inicial)** | ✅ Completat | [`docs/specs/2026-05-22-p5-8-1-projection-view-design.md`](docs/specs/2026-05-22-p5-8-1-projection-view-design.md) | — | ✅ | `ProjectionViewComponent` + `SegmentCanvasComponent` Konva, ruta `/events/:id/projection`, mode edició/projecció. Posicionament Konva substituït per grid CSS a P5.9 |
|| **P5.9** | **Mòdul Pinyes — Vista de Projecció (refinada)** | ✅ Completat | — | — | ✅ | Grid CSS responsive (P5.9.1): bases visibles, ruta figura individual, fons configurable. Vista Troncs `?view=troncs` (P5.9.2), panells flotants multi-figura draggable/resizable independents, HUD navegació, eliminació mode edició |
|| **P5.10** | **Mòdul Pinyes — Posicions, Lock i Historials** | ✅ Completat | [`docs/specs/2026-05-26-p5-10-positions-lock-history-design.md`](docs/specs/2026-05-26-p5-10-positions-lock-history-design.md) | [`f3_historials_implementation_63ca896e`](.cursor/plans/f3_historials_implementation_63ca896e.plan.md) | ✅ | **F1:** PositionModule (CRUD + relació M:N Person), lock automàtic assignacions (`ASSIGNMENT_LOCK_DAYS`), tags de posició a person-detail. **F2:** filtre intel·ligent per posició al PersonPanel (`positionType` matching). **F3:** historials (persona/event/família), 3 endpoints nous, 4 superfícies UI |
| P6 | PWA Mòbil | ⚪ Pendent | — | — | — | Diferit fins al tall. Estén l'auth de P4.1 als membres |
| P7 | Informes + Notificacions + Features avançades | ⚪ Pendent | — | — | — | Reports d'assistència, FCM, estadístiques, notícies |

**Llegenda:** ⚪ Pendent | 🟡 Dissenyant | 🔵 En curs | ✅ Completat | ❌ Cancel·lat

---

## Dependències entre Sub-projectes

```
P0 (Scaffold)
 ├── P1 (Usuaris + Persones) ──┬── P3 (Events + Assistència)
 │                              │
 └── P2 (Data Migration) ───────┤
                                 └── P4.1 (Auth Layer) ← prerequisit seguretat
                                          └── P4.2 (Dashboard Events + Assistència)
                                                  └── P5 (Pinyes i Figures)
                                                          └── P6 (PWA Mòbil)
                                                                  └── P7 (Informes + Notificacions)

Decisions clau d'ordre:
  - P4.1 primer: cal auth per desplegar a servidor sense exposar l'API
  - P5 avançat respecte PWA: dades legacy suficients per validar canvas amb tècnics
  - P6 diferit: membres seguiran usant el legacy fins al tall oficial
  - P6 reutilitza l'AuthModule de P4.1 sense reimplementar-lo
```

---

## Decisions Tecnològiques

| Decisió | Resultat | Data |
|---------|----------|------|
| Backend framework | NestJS | Mar 2026 |
| Frontend framework | Angular 20+ (standalone, signals) | Mar 2026 |
| Mòbil | PWA (sense Ionic) | Mar 2026 |
| Base de dades | PostgreSQL (Docker local dev / VPS prod) | Mar 2026 → Mai 2026 (P4.4) |
| Monorepo | Nx | Mar 2026 |
| Docker en dev | Sí — PostgreSQL en contenidor (dev) + docker-compose.prod.yml (VPS) | Mai 2026 (P4.4) |
| Idioma UI | Català | Mar 2026 |
| Idioma codi | Anglès | Mar 2026 |
| Multi-tenant | Sí (futur, rol ADMIN) | Mar 2026 |
| ORM | TypeORM | Mar 2026 |
| Auth strategy | JWT+Passport (access 15min + refresh 7d). Implementat a P4.1, estès a P6 | Abr 2026 |
| Token storage (Dashboard) | Memòria/signal (access token) + `httpOnly cookie` (refresh token) | Abr 2026 |
| CORS | Array d'orígens via `CORS_ORIGINS` env (Dashboard + PWA) | Abr 2026 |
| Canvas library (pinyes i figures) | `konva` (API imperativa directa, sense `ng2-konva` — incompatible amb Angular 20+) | Mai 2026 (P5.1) |

---

## Decisions sobre el Mòdul Pinyes i Figures (P5)

### P5.1 — Templates i Editor Visual (✅ Completat)

#### Què s'ha implementat

**Backend** (`apps/api/src/modules/figure/`):
- Entitats TypeORM `FigureTemplate` + `FigureNode` (taules `figure_templates` + `figure_nodes`)
- Enum `NodeShape` (`ELLIPSE`, `RECTANGLE`) a `libs/shared/`
- `FigureModule` amb 6 endpoints REST: llistat (cerca + paginació), detall, crear, actualitzar (sync inline de nodes), eliminar, duplicar
- Sync de nodes al `PUT`: crea nous, actualitza existents, elimina els que ja no estan (amb protecció si té `NodeAssignment`s)
- Tests unitaris: `figure-template.service.spec.ts` + `figure-template.controller.spec.ts`

**Frontend** (`apps/dashboard/src/app/features/pinyes/`):
- `TemplateListComponent`: llistat de templates amb tabs "Figures" / "Composicions" (tab Composicions en placeholder per P5.2), cards amb accions Editar / Duplicar / Eliminar (confirm-dialog)
- `FigureCanvasComponent`: canvas Konva reutilitzable amb:
  - **Pinya layer** (zona principal): nodes `PINYA` + nodes `BASE` (bases, z=0)
  - **Tronc layer** (panel lateral dret): tots els nodes `TRONC` agrupats per pis (`z`). Toggle "Mostrar/Ocultar vista Tronc" a la toolbar
  - Grid de guia configurable (toggle + mida), snap-to-grid opcional
  - Zoom (scroll wheel) + pan (click drag fons / botó central)
  - Drag de nodes per reposicionar. Resize i rotate via Konva Transformer
  - Edició inline d'etiquetes amb doble-click (input flotant sobre el canvas)
  - Outputs per `nodeMoved`, `nodeResized`, `nodeRotated`, `nodeLabelChanged`, `nodeSelected`
- `TemplateEditorComponent`: editor complet de pàgina amb:
  - Toolbar lateral: afegir nodes per zona (PINYA, TRONC, FIGURE_DIRECTION, XICALLA_DIRECTION) i `positionType`, eliminar node seleccionat, undo
  - Panel de propietats col·lapsable (dreta): label, zona, positionType, color, shape, dimensions, rotació, climbPath
  - Top bar: nom/slug editable, toggle `hasPinya`, botó torn enrere, indicador d'estat de save
  - Auto-save amb debounce 2s: `PUT /api/figure-templates/:id` amb llista completa de nodes
  - Nou template: primer `POST`, després redirect a mode edició amb ID retornat
- `CanvasStateService`: zoom, panOffset, selectedNodeId, gridEnabled, gridSpacing, troncVisible (signals)
- `FigureTemplateService` (dashboard): extends `ApiService`, mètodes `getAll`, `getOne`, `create`, `update`, `delete`, `duplicate`

#### Decisió tècnica clau

`ng2-konva` descartat per incompatibilitat amb Angular 20+. S'usa `konva` directament amb **API imperativa** wrapped dins un component Angular. Els `effect()` de signals disparen re-renders del canvas.

#### Queda pendent a P5

| Fase | Objectiu | Depèn de |
|------|----------|----------|
| **P5.2** | ✅ Composicions (`CompositionTemplate` + `CompositionSlot`). Editor per agrupar figures amb offsets | P5.1 |
|| **P5.3** | ✅ Segments i Instàncies (`EventSegment` + `FigureInstance`). CRUD segments/instàncies, reordenar (fletxes), modal picker. Pendent: refactor UX (P5.3.1) | P5.1 + P5.2 |
|| **P5.3.1** | Refactor UX segments: tab dedicat "Pinyes" a event-detail, millores d'interacció, preview canvas, navegació fluida | P5.3 |
|| **P5.4** | Assignació de persones (`NodeAssignment`). Canvas d'assignació, panel lateral, cercador filtrat, auto-avançament | P5.3 |
|| **P5.5** | Projecció fullscreen (TV/projector) + consulta historial figures per persona/event | P5.4 |

---

## Decisions sobre el Mòdul Pinyes — Composicions (P5.2)

### P5.2 — Composicions (✅ Completat)

#### Què s'ha implementat

**Backend** (`apps/api/src/modules/composition/`):
- Entitats TypeORM `CompositionTemplate` + `CompositionSlot` (taules `composition_templates` + `composition_slots`)
- `CompositionModule` amb 6 endpoints REST: llistat (cerca + paginació), detall (amb nodes populats per al canvas), crear, actualitzar (sync complet de slots), eliminar, duplicar
- Sync de slots al `PUT`: elimina tots i recrea (full replace)
- Protecció referencial: `FigureTemplateService.remove()` comprova si hi ha `CompositionSlot`s referenciants i llança `ConflictException` (409)
- Tests unitaris: `composition-template.service.spec.ts` + `composition-template.controller.spec.ts` + tests d'integritat a `figure-template.service.spec.ts`

**Frontend** (`apps/dashboard/src/app/features/pinyes/`):
- `CompositionEditorComponent`: editor de pàgina complet amb:
  - Top bar: nom/slug editable, descripció, indicador d'estat de save
  - Panel esquerre (Figure Picker): cerca de `FigureTemplate`s, click per afegir slot
  - Canvas Konva en mode `'composition'`: renderitza nodes pinya-view (PINYA + BASE) de cada slot amb offsets, grups draggables, dashed bounding box, label de grup, selecció de slot
  - Panel dret (Slot Properties): label, offset X/Y, link "Editar figura ↗", eliminar slot
  - Auto-save amb debounce 2s + save immediat en afegir figura
- `TemplateListComponent`: tab "Composicions" amb dades reals (cards CRUD: Editar / Duplicar / Eliminar)
- `CompositionTemplateService` (dashboard): `getAll`, `getOne`, `create`, `update`, `delete`, `duplicate`
- `composition.model.ts`: `CompositionSlotItem`, `CompositionTemplateListItem`, `CompositionTemplateDetail`

#### P5.2.1 — Corrections & Improvements (✅ Completat)

Fixes crítics de canvas i millores UX implementades posteriorment:

| Fix/Millora | Detall |
|-------------|--------|
| **Selecció/drag broken** | Bounding rect `listening: true` — fa de hit area del grup. Sense això, tots els clicks passaven al Stage |
| **Panning conflictiu** | Guard mode-aware: panning esquerre únicament quan no hi ha selecció en el mode actiu (`selectedSlotId` vs `selectedNodeId`) |
| **Cursor grab** | Estès a `mode === 'composition'` |
| **Placeholder per slots buits** | Quan `nodes === []` (just afegit, pendent de resposta API): rect discontinu + text "Carregant..." en comptes de saltarse el slot |
| **Save immediat en afegir** | `addFigure()` crida `saveImmediately()` en lloc de `scheduleSave()` per minimitzar el temps de buit |
| **Offset incremental** | Cada nova figura s'afegeix a `(slots.length * 200, 0)` evitant apilament al (0,0) |
| **Scale 50%** | `scaleX/Y: 0.5` a cada `slotGroup` — múltiples figures caben al viewport sense overflow |
| **Botó "Enquadrar"** | `fitAllSlots()` calcula bounding box global de tots els grups i ajusta zoom+posició per mostrar-los tots (icon Maximize2) |
| **Z-order controls** | "Porta al davant" / "Porta al darrere" al right panel: swap de `sortOrder`, canvas re-renderitza en ordre correcte |

**Spec P5.2.1**: [`docs/specs/2026-05-10-p5-2-1-composition-editor-fixes.md`](docs/specs/2026-05-10-p5-2-1-composition-editor-fixes.md)

---

## Decisions sobre el Mòdul Pinyes — Segments i Instàncies (P5.3)

### P5.3 — Segments i Instàncies (✅ Completat)

#### Què s'ha implementat

**Backend** (`apps/api/src/modules/event-segment/`):
- Entitats TypeORM `EventSegment` + `FigureInstance` (taules `event_segments` + `figure_instances`)
- `EventSegmentModule` amb endpoints REST per segments i instàncies:
  - Segments: llistat (per event), detall, crear, actualitzar, eliminar, reordenar
  - Instàncies: llistat (per segment), detall, crear, actualitzar, eliminar, reordenar
- `EventSegment`: camps `name`, `sortOrder`, `startTime`, `endTime`, `notes`, `isVisible` (visibilitat cap als membres)
- `FigureInstance`: referència a `FigureTemplate` o `CompositionTemplate`, amb `label` opcional, `sortOrder`, relació a `EventSegment`
- Reordenació via endpoint dedicat: `PUT /events/:eventId/segments/reorder` + `PUT /events/:eventId/segments/:segmentId/instances/reorder`
- Tests unitaris: `event-segment.service.spec.ts` + `event-segment.controller.spec.ts` + `figure-instance.service.spec.ts`

**Frontend** (`apps/dashboard/src/app/features/`):
- `SegmentManagerComponent` integrat inline a `event-detail.component.html` (entre cards d'info i llista d'assistència):
  - Llistat de segments amb cards sempre visibles
  - Nom editable inline (click per editar, guardar/cancelar)
  - Toggle visibilitat (`isVisible`) amb icona Eye/EyeOff
  - Reordenació amb fletxes amunt/avall (no drag-handle)
  - Eliminar segment (amb confirmació)
  - Afegir segment nou (botó "+")
  - Figures/composicions mostrades com a badges/chips dins de cada segment
  - Menú contextual per instàncies (eliminar figura del segment)
- `FigurePickerModalComponent`: modal amb tabs "Figures" / "Composicions", cerca, selecció de templates
- `EventSegmentService` + `FigureInstanceService` (dashboard): mètodes CRUD + reordenació
- Models: `SegmentDetail`, `InstanceDetail` a `segment.model.ts`

#### Limitacions actuals i tasques pendents

**No implementat a P5.3**:
- Tab dedicat "Pinyes" a l'event-detail (implementat inline en comptes de tab)
- Preview/miniatura del canvas de les figures dins dels segments
- Navegació directa des de la llista d'events cap als segments (botó/columna)
- Interacció avançada amb les figures (assignació de persones — P5.4)

**P5.3.1 — Revisió UX Segments (⚪ Pendent)**:
- Refactoritzar la secció de segments a un tab dedicat "Pinyes" dins d'event-detail
- Afegir preview readonly del canvas de cada figura dins del segment
- Afegir accés ràpid des de la llista d'events (columna amb recompte + botó d'accés)
- Millorar la navegació entre segments, figures, i el canvas d'edició de templates
- Considerar millores de layout per dispositius mòbils

---

## Decisions sobre el Mòdul Pinyes — Assignació de Persones (P5.4)

### P5.4 — Assignació de Persones (✅ Completat)

#### Què s'ha implementat

**Backend** (`apps/api/src/modules/node-assignment/`):
- Entitat TypeORM `NodeAssignment` (taula `node_assignments`) amb constraints únics: `[figureInstance, figureNode, compositionSlot]` i `[figureInstance, person, compositionSlot]`
- `NodeAssignmentService`: `getByInstance`, `assign` (validacions 404/409), `unassign`, `getHistory`, `bulkImport`, `countByNode`
- `AvailablePersonsService`: `getAvailablePersons` (filtres search/height/xicalla/excludeAssigned, proximity sort per altura, `nextPerformanceStatus`), `getNextPerformance` (propera actuació)
- `NodeAssignmentController`: 7 endpoints REST, protegits amb `AuthGuard`+`RolesGuard`
- Delete guard a `FigureTemplateService`: comprova `countByNode()` abans d'eliminar nodes ocupats (409)
- Relació `@OneToMany` de `FigureInstance` → `NodeAssignment` (cascade delete)
- Tests: `node-assignment.service.spec.ts` + `node-assignment.controller.spec.ts` + `available-persons.service.spec.ts`

**Frontend** (`apps/dashboard/src/app/features/pinyes/`):
- `assignment.model.ts`: interfaces `AssignmentDetail`, `AvailablePerson`, `FigureHistoryEntry`, `BulkImportResult`, `PendingOp`
- `NodeAssignmentService` (HTTP): `getByInstance`, `assign`, `unassign`, `bulkImport`, `getAvailablePersons`, `getHistory`, `getNextPerformance`
- `AssignmentStateService` (signals): `selectedNodeId`, `selectedPersonId`, `activeInstanceId`, `assignments`, `confirmedPersons`, `heightMode`, `panelCollapsed`, `pendingOperations`, computed `freePersonsCount`, `totalConfirmedCount`
- `AssignmentCanvasComponent`: pàgina principal, gestió de tabs per instàncies, interacció pick-and-place (buida+persona, ocupada+persona→swap, ocupada+buida→moure), optimistic UI+rollback, auto-advance al node buit següent
- `PersonPanelComponent`: panel lateral, filtres (cerca, altura±2cm, xicalla, nomes lliures), agrupat per Confirmades/Pendents/No vindran, indicador 🎭 propera actuació, format altura absolut/relatiu
- `NodePopoverComponent`: popover detall d'un node assignat amb botó desassignar
- `ImportPinyaModalComponent`: modal per importar assignacions d'events anteriors, llista historial, preview, resultat de la importació (creats/conflictes)
- `AssignmentStateService.spec.ts` + `NodeAssignmentService.spec.ts` + tests dels components

**Routing**:
- Ruta `pinyes/events/:eventId/segments/:segmentId/assign` → `AssignmentCanvasComponent` (lazy)
- Botó "Assignar" afegit al `SegmentManagerComponent` amb navegació via `Router`

#### Patrons i decisions tècniques clau

| Decisió | Resultat |
|---------|----------|
| **Optimistic UI** | `assignments` signal actualitzat immediatament; rollback si HTTP falla |
| **Pick-and-place** | Selecció d'`AvailablePerson` + `FigureNode` desacoblada, amb auto-trigger si l'altre ja estava seleccionat |
| **Auto-advance** | Després d'una assignació exitosa, el cursor avança al primer node buit (`sortOrder`) |
| **Proximity sort per altura** | `getAvailablePersons` ordena per `|shoulderHeight - query.height|` (exacte primer, ±1–2 cm després) |
| **Next performance** | `AvailablePersonsService.getNextPerformance` busca la propera `ACTUACIO` (per als assajos) |
| **Delete guard** | `NodeAssignmentService.countByNode()` protegeix contra eliminar nodes ocupats (409) |
| **Circular dependency** | `FigureInstance → NodeAssignment` usa string-based entity name a `@OneToMany` per evitar imports circulars |

---

---

## Decisions sobre el Mòdul Pinyes — Famílies, Snapshot i Creixement Concèntric (P5.5)

### P5.5 — Family + Snapshot Redesign (✅ Completat)

#### Problema resolt

| Problema | Impacte (pre-P5.5) |
|----------|-------------------|
| `syncNodes` = delete-all + recreate | Node IDs inestables entre saves; assignacions bloquejaven qualsevol edició del template |
| `NodeAssignment` apuntava a `FigureNode` (template) | Template i instàncies acoblats; editar un template trencava les assignacions existents |
| Sense concepte de família ni variant | Cada mida de figura = template independent sense relació |
| Sense model de cordons | Afegir un cordó requeria crear un template nou des de zero |

#### Quatre fases d'implementació

**Fase A — Data Foundation (backend)**
- `FigureFamily` entity + `FigureFamilyService` + `FigureFamilyController` + DTOs
- `FigureTemplate`: + `family` (FK nullable, RESTRICT) + `variantOrder` (int)
- `FigureNode`: + `ringLevel` (int nullable) + `originNodeId` (uuid nullable, no FK)
- `InstanceNode` entity (snapshot de nodes per instància)
- `FigureInstance`: + `snapshotted` (boolean) + `sourceVariantOrder` (int nullable)
- `NodeAssignment`: `figureNode` FK → `instanceNode` FK (a `InstanceNode`)
- `syncNodes()` reescrit com a **upsert** per ID (update/create/delete vs delete-all+recreate)
- `reset-figure-data.script.ts` + seed reestructurat amb família `pd3`/`pd3-creu`/`pd4`

**Fase B — Snapshot & Upgrade (backend)**
- `getInstanceNodes()` — retorna `InstanceNode`s (snapshotted) o `FigureNode`s vius (pre-snapshot)
- `assign()` amb auto-snapshot: la primera assignació copia tots els nodes del template a `InstanceNode`s propis
- `upgradeInstance()` — afegeix nodes de la variant superior (matching per `originNodeId ?? sourceNodeId`)
- `bulkImport()` remapejat via `sourceNodeId` de `InstanceNode`
- `getHistory()`, `unassign()`, swap — tots migrats a `InstanceNode`

**Fase C — Frontend Famílies i Templates**
- `FigureFamilyService` (dashboard) + `figure-family.model.ts`
- `TemplateListComponent` reestructurat: tab "Famílies" com a vista principal, families expandibles amb variants
- Modal "Nova Família" amb name/slug/description
- `PinyesOnboardingModalComponent`: walkthrough informatiu (famílies, variants, cordons, snapshot)

**Fase D — Frontend Assignment Canvas**
- `AssignmentCanvasComponent` migrat: carrega `InstanceNode`s (snapshotted) o template nodes (pre-snapshot) via `GET /figure-instances/:id/nodes`
- Bulk import actualitzat per `sourceNodeId` de `InstanceNode`
- Models `AssignmentDetail` i `PendingOp` actualitzats per `InstanceNode`

#### Decisions tècniques clau

| Decisió | Resultat |
|---------|----------|
| **Lazy snapshot** | No es creen `InstanceNode`s fins la primera assignació, minimitzant dades per instàncies sense assignar |
| **FK no-referencial per llinatge** | `originNodeId` i `sourceNodeId` com a `uuid nullable` sense FK real — sobreviuen a esborrats de nodes del template |
| **Upgrade per canonical ID** | `canonicalId = originNodeId ?? self.id` — permet matching estable entre variants independentment de la profunditat del llinatge |
| **Backward compatibility al canvas** | `assign()` accepta tant `InstanceNode.id` com `FigureNode.id` (via `sourceNodeId` lookup) per mantenir compatibilitat amb el canvas pre-snapshot |
| **Reset net de dades de dev** | Script `reset-figure-data.script.ts` per netejar instàncies/nodes/assignacions i re-fer el seed, evitant migracions destructives en dev |

---

## Decisions sobre el Mòdul Pinyes — Visualització i Assignació de Troncs (P5.6)

### P5.6 — Tronc Visualization (✅ Completat)

#### Què s'ha implementat

**Backend** (`apps/api/src/modules/figure/`, `apps/api/src/modules/database/scripts/`):
- **Migració d'unitats relatives**: `migrate-tronc-units.script.ts` actualitza valors de `x` i `width` per nodes TRONC/BASE existents a unitats relatives (1–4u → 0–4u posició, 1–4u amplada)
- Nx target `migrate-tronc-units` per executar la migració
- Seeds actualitzats amb noves unitats relatives per pd3, pd3-creu, pd4

**Frontend** (`apps/dashboard/src/app/features/pinyes/`):
- **`TroncViewComponent`**: Component Angular standalone reutilitzable amb:
  - Renderitzat amb CSS Grid (sistema flexible i accessible)
  - Sistema d'unitats relatives: `x` (0–8u, steps 0.5), `width` (0.5–8u, steps 0.5)
  - Organització per pisos (P1=Bases, P2+→TRONC) amb labels "Segon/Segona", "Terç/Tercera", etc.
  - Toggle orientació: P1 dalt (ascendent) ↔ P1 baix (descendent)
  - Mode `editor`: controls per position X, amplada, eliminar node, afegir node inline (+), afegir pis (dropdown amb pissos faltants)
  - Mode `assignment`: visualització assignacions amb àlies persona, alçada (abs/rel segons global toggle), attendance status (color dot), height variance per pis amb color-coding (verd ≤5cm, groc 6–10cm, vermell >10cm)
  - **Floating draggable panel**: panell movible sobre el canvas (no modal amb blur), arrossegable amb mouse, no bloqueja interacció amb canvas subjacent
- **Integració `TemplateEditorComponent`**: botó "Tronc" a topbar, floating panel amb `TroncViewComponent` en mode editor
- **Integració `AssignmentCanvasComponent`**: botó floating "Tronc" sobre canvas, floating panel amb `TroncViewComponent` en mode assignment
- **`floor-variance.util.ts`**: funcions `floorVariance()` (calcula Δcm per pis) i `varianceLevel()` (classifica per threshold)
- **Tests unitaris**: `tronc-view.component.spec.ts` (grid calculations, floor sorting, UI interactions, variance logic), `floor-variance.util.spec.ts`

**Eines i patterns**:
- **CSS Grid**: grid-template-columns dinàmic (minmax responsive), grid-column per positioning de nodes
- **Grid doblejat**: intern usa x*2 i width*2 per suportar 0.5u steps amb CSS Grid (que només suporta enters)
- **Inline styling per colors**: `[style.color]` i `[style.background-color]` amb funcions `getVarianceColor()` i `getAttendanceColor()` per evitar problemes de CSS specificity amb DaisyUI
- **Add floor/node UX**: + inline dins cada pis (no list externa), dropdown "Afegir pis" amb opcions de tots els pisos faltants (no seqüencial)
- **Columna extra per add-node button**: grid té una columna extra fixa (2.5rem) al final per evitar line-break del botó +

#### Decisions tècniques clau

| Decisió | Resultat |
|---------|----------|
| **CSS Grid** | Renderitzat flexible, accessible, responsive. Evita complexitat de Konva per aquest sub-canvas |
| **Unitats relatives** | `x` i `width` per TRONC/BASE són 0–8u (steps 0.5). PINYA nodes mantenen pixels per Konva |
| **Grid doblejat** | Intern *2 tots els valors per permetre 0.5u steps amb CSS Grid (que només accepta enters) |
| **No nova columna DB** | Reinterpretació de `x`/`width` existents — només migració de dades, no schema |
| **Floating panel** | UI movible sense modal/backdrop, permet interacció simultània amb canvas pinya |
| **Inline colors** | `[style.color]` i `[style.background-color]` per evitar CSS specificity issues amb DaisyUI utilities |
| **Add any floor** | `availableFloorOptions()` itera tots els z levels (1–6) i llista els faltants, no només el següent seqüencial |
| **Columna extra grid** | Dedicada al botó +, evita line-break quan totes les posicions del pis estan ocupades |

---

## Decisions sobre el Mòdul Pinyes — Tronc Nodes a Nivell de Família (P5.7)

### P5.7 — Tronc Nodes at Family Level (✅ Completat)

#### Problema resolt

| Problema | Impacte (pre-P5.7) |
|----------|-------------------|
| TRONC/BASE nodes duplicats per variant | Cada variant d'una família tenia la seva pròpia còpia dels nodes de tronc, causant inconsistències quan s'editava el tronc |
| Editar tronc requeria editar totes les variants | Workflow tediós i propens a errors; variants amb troncs diferents sense raó |
| Conceptualment incorrecte | El tronc és la mateixa estructura física per tota la família; només la pinya creix per variant |

#### Implementació: Merge/Split Transparent

**Backend** (`apps/api/src/modules/figure/`):
- **Entitat `FigureFamilyNode`** (`figure_family_nodes`): nodes TRONC/BASE compartits a nivell de `FigureFamily`
  - Camps: `family` FK, `label`, `zone` (TRONC/BASE només), `positionType`, `x`, `width`, `z`, `sortOrder`, `color`, `shape`, `climbPath`
  - No té `originNodeId` (no deriva de res, és l'origen)
- **Estratègia merge/split transparent**:
  - `GET /figure-templates/:id` → merge: combina `FigureFamilyNode`s amb `FigureNode`s (només PINYA), marca FamilyNodes com a `isShared: true`
  - `PUT /figure-templates/:id` → split: separa nodes per zona, TRONC/BASE van a `syncFamilyNodes()`, PINYA/direccions van a `syncTemplateLevelNodes()`
  - `syncFamilyNodes()`: upsert idempotent (update si ID existeix, create si no) pels nodes TRONC/BASE a `figure_family_nodes`
  - `syncTemplateLevelNodes()`: upsert idempotent pels nodes PINYA a `figure_nodes` (no toca TRONC/BASE)
- **Funció `deriveNodes()`**: només copia nodes PINYA (exclou TRONC/BASE) quan es crea una nova variant
- **`snapshotInstance()`**: snapshoteja tant `FigureFamilyNode`s com `FigureNode`s a `InstanceNode`s
- **Script `migrate-tronc-to-family.script.ts`**: migració idempotent que:
  1. Itera per cada `FigureFamily`
  2. Troba el template amb `variantOrder` més baix (variant base)
  3. Copia els seus nodes TRONC/BASE a `figure_family_nodes`
  4. Elimina tots els nodes TRONC/BASE de `figure_nodes` per tota la família
- Nx target `migrate-tronc-to-family` per executar la migració
- Seeds actualitzats (`pd3`, `pd3-creu`, `pd4`): estructura `familyNodes` separada a `FigureSeed`, `insertFigure()` idempotent per family nodes

**Tests**:
- `figure-template.service.spec.ts`: tests merge/split, upsert, deriveNodes (només PINYA), duplicate (només PINYA)
- `node-assignment.service.spec.ts`: snapshotInstance inclou family nodes, getInstanceNodes retorna merged list

#### Decisions tècniques clau

| Decisió | Resultat |
|---------|----------|
| **Entitat `FigureFamilyNode`** | TRONC/BASE compartits a `FigureFamily`, desacoblats de templates individuals |
| **Merge/Split transparent** | Frontend no canvia: segueix rebent/enviant nodes com abans. Backend fa la separació internament |
| **Upsert per ID** | `syncFamilyNodes` i `syncTemplateLevelNodes` fan update si node.id existeix, create si no → estable per auto-save |
| **Derive només PINYA** | Crear nova variant hereta PINYA del parent, però TRONC/BASE venen automàticament de la família |
| **Snapshot inclou family nodes** | `snapshotInstance()` copia FamilyNodes+FigureNodes a InstanceNodes per lazy snapshot correcte |
| **Migració idempotent** | `migrate-tronc-to-family` pot executar-se múltiples vegades sense efectes secundaris |
| **Seed idempotent** | `insertFigure()` comprova si la família ja té family nodes abans d'inserir-los (evita duplicats en re-seed) |

---

## Decisions sobre el Mòdul Pinyes — Convenció de Bases, Projecció i Historials (P5.8–P5.10)

### P5.8 — Convenció d'ordre de les Bases (✅ Completat)

#### Problema resolt

Les Bases de la pinya no tenien un ordre canònic definit, cosa que generava inconsistències visuals entre variants d'una mateixa família i dificultava l'assignació per posició.

#### Implementació

- **Convenció CCW**: `sortOrder` 0 = Base superior-esquerra, augmenta en sentit anti-horari. Label canònic: `Base N` (N = sortOrder + 1).
- **`validateBaseOrdering()`**: funció util al frontend que comprova si les bases segueixen la convenció; retorna `true/false`.
- **Badge "Bases desordenades"**: al llistat de famílies, quan `validateBaseOrdering()` falla per alguna variant, s'afegeix un badge visual.
- **Modal d'ajuda**: diagrama interactiu que explica la convenció CCW amb exemple visual per a la família `pd3`.
- **Invariant §15.12** documentat a `PINYES_MODULE.md`.

---

### P5.8.1 → P5.9 — Vista de Projecció (✅ Completat)

#### Objectiu

Mode fullscreen per a assajos/actuacions: TV/projector mostra les pinyes del segment en curs amb informació d'assignació en temps real.

#### Evolució per sub-fases

| Sub-fase | Contingut | Estat actual |
|----------|-----------|--------------|
| **P5.8.1** | `ProjectionViewComponent` + `SegmentCanvasComponent` Konva, ruta `/events/:id/projection`, posicionament lliure (`projectionX/Y/Scale`), mode edició/projecció | Posicionament Konva i mode edició **reemplaçats** |
| **P5.9.1** | Grid CSS responsive, bases visibles, ruta figura individual (`FigureProjectionComponent`), ellipsis, fons configurable, eliminació elements de referència de la UI | Grid, bases, ruta individual i fons **actius** |
| **P5.9.2** | Vista Troncs (`?view=troncs`), panells flotants multi-figura independents (draggable + resizable, sense backdrop), HUD de navegació, correccions toast/enrere | **Estat actual** |

#### Components i rutes

**Frontend** (`apps/dashboard/src/app/features/pinyes/`):
- `projection-view/`: grid CSS de figures d'un segment, toggle pinya/troncs
- `figure-projection/`: pantalla completa d'una sola figura (ruta `/events/:id/segments/:segId/figures/:instanceId/projection`)
- `ProjectionService` (dashboard): mètodes per obtenir dades de projecció
- `projection.model.ts`: `ProjectionData`, `ProjectionFigure`, `ProjectionNode`

#### Decisions tècniques clau

| Decisió | Resultat |
|---------|----------|
| **Grid CSS sobre Konva** | Posicionament automàtic, responsive, accessible. Konva descartada per la vista de projecció |
| **Multi-panell tronc** | Panells independents per figura (vs. un sol overlay P5.9.1), sense backdrop bloquejant |
| **Ruta figura individual** | Permet projectar una sola figura en pantalla gran, útil per assajos de figures complexes |
| **`?view=troncs`** | Commutació pinya↔troncs via query param, preserva l'URL del segment |

---

### P5.10 — Posicions, Lock i Historials (✅ Completat)

#### Spec

[`docs/specs/2026-05-26-p5-10-positions-lock-history-design.md`](docs/specs/2026-05-26-p5-10-positions-lock-history-design.md)

#### Tres fases d'implementació

**F1 — PositionModule + Lock**

**Backend** (`apps/api/src/modules/position/`):
- Entitat `Position` (taula `positions`): `name`, `slug`, `description`, relació M:N amb `Person` via `person_positions`
- `PositionModule` amb 5 endpoints REST: llistar, detall, crear, actualitzar, eliminar (protecció 409 si té persones assignades)
- **Lock automàtic**: `NodeAssignmentService` comprova `event.date + ASSIGNMENT_LOCK_DAYS < now()` en totes les operacions d'escriptura (`assign`, `unassign`, swap, `bulkImport`, `upgrade`, `reset`). Retorna 403 si l'event està bloquejat. `ASSIGNMENT_LOCK_DAYS=0` desactiva el lock.
- `ASSIGNMENT_LOCK_DAYS` configurable via `.env`
- Tests: `position.service.spec.ts` + `position.controller.spec.ts` + lock guard integrat a `node-assignment.service.spec.ts`

**Frontend**:
- `PositionService` (dashboard): CRUD posicions
- `position.model.ts`: `Position`, `PositionListItem`
- `PositionListComponent` + `PositionFormModalComponent` (tab Configuració → Posicions)
- Tags de posicions a `person-detail` (pills editables)
- Rutes afegides a `config.routes.ts`

**F2 — Filtre intel·ligent per posició**

- `PersonPanel`: nou filtre "Posició" que filtra persones per `position.slug === node.positionType`
- Matching suau: `Position.slug` ↔ `FigureNode.positionType` per convenció de noms (no FK)
- `AvailablePersonsService` (backend): nou paràmetre `positionType` a `getAvailablePersons()`
- Badge de posició als items de persona al panel

**F3 — Historials**

**Backend** — 3 endpoints nous + extensió de `getHistory()`:
- `GET /figure-families/:familyId/history` → historial paginat de la família (amb `seasonId` filter)
- `GET /persons/:personId/assignment-history` → historial paginat de la persona
- `GET /events/:eventId/assignment-summary` → resum estructurat de totes les figures d'un event
- `getHistory()` estès amb `eventType`, `familyName`, paginació i filtre per temporada (`HistoryQueryDto`)
- Tots els endpoints de historial usen TypeORM `QueryBuilder` per joins múltiples eficients

**Frontend** — 4 superfícies UI noves:
- `person-detail`: secció col·lapsable "Historial de pinyes" (taula + paginació + filtre temporada)
- `event-detail`: secció "Pinyes" (resum segments → figures → assignacions, read-only)
- `FamilyHistoryModalComponent` (nou): modal historial per família (taula + paginació + filtre temporada)
- `template-list`: botó "Historial" per família (icona History), obre `FamilyHistoryModalComponent`

#### Invariants nous (PINYES_MODULE.md §15)

| # | Invariant |
|---|-----------|
| 13 | **Assignment lock**: operacions d'escriptura retornen 403 si `event.date + LOCK_DAYS < now()` |
| 14 | **Position-positionType soft matching**: `Position.slug` ↔ `FigureNode.positionType` per convenció de noms, no FK |

---

## Decisions sobre el Dashboard Design Refactor (P4.3)

### Objectius del refactor

Refactorització completa de la capa visual del Dashboard, mantenint intacta tota la lògica TypeScript (services, models, signals). Enfocament "clean slate" per crear una UX intuïtiva per usuaris no experts.

### Canvis clau implementats

| Àrea | Abans | Després |
|------|-------|---------|
| **Navegació** | Sidebar drawer amb menú lateral | Top navigation bar amb tabs (Inici, Persones, Assajos, Actuacions, Pinyes, Configuració) |
| **Design System** | CSS vars legacy + tema DaisyUI fix | `generateCollaTheme(primaryHex)` — genera paleta completa des d'un sol color amb contrast WCAG automàtic |
| **Components** | DaisyUI inline en templates | 15+ components reutilitzables (page-header, data-table, pagination, filter-bar, toast, etc.) |
| **Tipografia** | Sistema per defecte | Inter (Google Fonts) a tots els textos |
| **Icones** | SVG inline | Lucide Angular (moderna, consistent) |
| **Layout** | Drawer + sidebar | `flex-col` amb Brand Bar + Tab Bar + content area |
| **Responsive** | Menú lateral col·lapsable | Desktop (icon+text) → Tablet (icon) → Mobile (dropdown) |
| **Home** | Redirect directe a /persons | Pàgina d'inici amb preview de dades, cards de navegació, accés sync legacy |
| **Fullscreen mode** | No disponible | `LayoutService` signal per Pinyes (futur) |

### Artifacts creats

- **Spec completa**: `docs/specs/2026-04-20-dashboard-design-refactor-design.md` (485 línies)
- **Pla d'implementació**: 7 fases seqüencials amb Mermaid diagrams
- **15+ components shared**: `apps/dashboard/src/app/shared/components/{data,feedback,forms}/`
- **3 nous mòduls**: Home, Sync (global), Config (placeholders)
- **Reducció codi**: ~80% menys HTML als templates refactoritzats (421→100 línies person-list)

### Abast del refactor

| Component/Pàgina | Línies abans | Línies després | Reducció |
|------------------|--------------|----------------|----------|
| `person-list.component.html` | 421 | ~100 | 76% |
| `event-list.component.html` | 394 | ~100 | 75% |
| `person-detail.component.html` | 236 | ~120 | 49% |
| `event-detail.component.html` | 410 | ~180 | 56% |
| `login.component.html` | 76 | ~70 | 8% |

### Preparació per futures fases

- **Pinyes (P5)**: Estructura creada, `LayoutService.requestFullscreen()` disponible
- **Config (P7)**: Skeleton amb sub-rutes (users, tags, seasons)
- **Legacy sync**: UI global + per entitat, marcat com a temporal

---

## Decisions sobre Rols i Permisos

### Model de Rols

| Rol | Àmbit | Descripció |
|-----|-------|-----------|
| `ADMIN` | Futur multi-tenant | Administrador de sistema. Gestió de múltiples colles. Reservat per quan s'implementi multi-tenant |
| `TECHNICAL` | Dashboard + PWA | Tècnic de la colla. Accés complet al Dashboard (inclosa gestió d'usuaris). Funcionalitats extra a la PWA |
| `MEMBER` | PWA | Membre de la colla. Gestió de la pròpia assistència i visualització d'events |

### Jerarquia de Permisos (actual, pre-multi-tenant)

```
TECHNICAL = accés total (Dashboard + PWA completa)
MEMBER    = PWA només (autogestió + visualització)
ADMIN     ≡ TECHNICAL (fins que s'implementi multi-tenant)
```

> **Nota multi-tenant (futur):** Quan s'implementi multi-tenant, `ADMIN` passarà a ser un super-rol transversal de colles. `TECHNICAL` serà el rol màxim dins d'una colla concreta. Això requerirà afegir `collaId` al JWT i un guard de tenant.

### Matriu de permisos per funcionalitat

| Funcionalitat | MEMBER | TECHNICAL | ADMIN |
|---|:---:|:---:|:---:|
| **PWA** — veure propis events i assistència | ✅ | ✅ | ✅ |
| **PWA** — confirmar/cancel·lar pròpia assistència | ✅ | ✅ | ✅ |
| **PWA** — veure llista de confirmats per event | ❌ | ✅ | ✅ |
| **PWA** — accedir al mòdul pinyes (visualització) | ❌ | ✅ | ✅ |
| **Dashboard** — gestió de persones | ❌ | ✅ | ✅ |
| **Dashboard** — gestió d'events i assistència | ❌ | ✅ | ✅ |
| **Dashboard** — mòdul pinyes i figures | ❌ | ✅ | ✅ |
| **Dashboard** — gestió d'usuaris (comptes) | ❌ | ✅ | ✅ |
| **Dashboard** — configuració del sistema | ❌ | ❌ | ✅ |

---

## Decisions sobre el Dashboard Design Refactor (P4.3)

### Enfocament: Clean Slate Visual

Refactorització completa de la capa de presentació sense tocar la lògica de negoci. Objectiu: UX intuïtiva per usuaris no experts, disseny escalable per futures funcionalitats (Pinyes, Config).

### Arquitectura del refactor (7 fases seqüencials)

```
F1: Design System → F2: Layout Shell → F3: Shared Components
                                            ├→ F4: Home Tab
                                            ├→ F5: Llistes
                                            └→ F6: Detalls + Sync + Login
                                                    └→ F7: Placeholders + Cleanup
```

### Components Shared creats

**Data** (`shared/components/data/`):
- `page-header` — Títol + badge contador + slot per botons d'acció
- `data-table` — Generic `<T>` amb sort, skeleton, group-separator, row-actions, sticky columns
- `column-toggle` — Collapse amb checkboxes per mostrar/amagar columnes
- `filter-bar` — Container flexible per inputs de filtre + boto "Netejar"
- `active-filters` — Badges dismissibles dels filtres actius
- `pagination` — Join buttons + selector limit + info de registres
- `empty-state` — Card amb icona Lucide + missatge + acció opcional
- `stat-card` — DaisyUI `stat` per mètriques

**Feedback** (`shared/components/feedback/`):
- `skeleton-rows`, `skeleton-cards` — Loading states animats
- `confirm-dialog` — Modal DaisyUI amb confirmació/cancel·lació
- `toast` + `ToastService` — Sistema de notificacions auto-dismiss (4s)

**Forms** (`shared/components/forms/`):
- `form-field` — Wrapper consistent per labels, errors, helper text

**Layout** (`shared/components/layout/`):
- `tab-nav` — Navegació responsive amb tabs
- `header` — Brand bar amb logo + user-chip slot
- `user-chip` — Avatar + dropdown amb logout (mantingut de P4.1)

### Millores UX implementades

| Feature | Implementació |
|---------|---------------|
| **Home page** | Cards de navegació, preview pròxim assaig/actuació amb comptadors d'assistència, bloc sync legacy, accés ràpid a config |
| **Event lists** | Separador visual per events passats, `opacity-60` per files passades, ordenació per data ASC per defecte |
| **Sync pages** | UI unificada amb progress bar, log en temps real, alertes warnings |
| **Mobile UX** | Dropdown DaisyUI per menú, scroll horitzontal en taules |
| **Fullscreen mode** | `LayoutService` amb Escape listener per Pinyes (futur) |

### Breaking changes

- **`data-theme="colla-barcelona"` obligatori** a `<html>` (aplicat automàticament a `index.html`)
- **Color primari dinàmic**: modificar `generateCollaTheme('#HEX')` a `tailwind.config.js` per canviar el tema
- **`SidebarComponent` eliminat** — totes les referències netejades
- **CSS vars legacy eliminades** — tots els estils via tokens DaisyUI

### Build status

✅ Compilació exitosa en 4.2s  
✅ Bundle principal: 181.76 kB (initial)  
✅ Lazy chunks: 124.64 kB (event-detail), 56.95 kB (modals), 34.99 kB (person-list), 33.95 kB (event-list)  
✅ Zero errors TypeScript

---

## Decisions sobre el Model User / Person (P4.1)

### Relació User ↔ Person

Un `User` és el compte d'accés. Un `Person` és el membre real de la colla. Estan desacoblats per disseny:

```
User (compte d'accés)
 ├── pot tenir cap Person linked  → admin/tècnic "de sistema" sense registre físic a la colla
 └── pot tenir un Person linked   → tècnic o membre que també és part de la colla

Person (membre de la colla)
 ├── pot no tenir User            → existeix per planificació de pinyes, pendent d'onboarding
 └── pot tenir User linked        → ha completat l'onboarding, pot gestionar pròpia assistència
```

### Flux d'onboarding d'un membre

```
[Admin/Tècnic crea Person]
        ↓
[Person existeix: planificació de pinyes possible]
        ↓
[Invite link enviat a Person.email]
        ↓
[Membre crea contrasenya → User creat i linked a Person]
        ↓
[Membre accedeix a PWA amb rol MEMBER]
```

### Canvis al model respecte P1 (aplicats a P4.1)

| Camp | Entitat | Canvi | Raó |
|------|---------|-------|-----|
| `email` | `User` | **AFEGIR** | Credencial de login. Font: `Person.email` durant onboarding |
| `person` | `User` | **AFEGIR** `OneToOne Person \| null` | Referència directa al Person del usuari. Nullable (admins sense Person) |
| `user` | `Person` | **AFEGIR** `OneToOne User \| null` (back-ref) | Permet saber si un Person ja té compte |
| `isMainAccount` | `Person` | **ELIMINAR** | Substituït per `User.person` (OneToOne explícit) |
| Import `OneToMany` | `User` | **NETEJAR** | Importat però no usat |

---

## Decisions sobre el Mòdul Assistència (P4 + P6)

### ✅ Edició manual per tècnics (Dashboard — P4.2) — Implementat

El sync des del legacy és unidireccional i no detecta automàticament "va dir que venia però no va aparèixer". Per cobrir-ho:

| Feature | Rol | Estat | Descripció |
|---------|-----|-------|-----------|
| CRUD esdeveniments | Tècnic, Admin | ✅ | Crear, editar (modal), eliminar (protecció 409 si té assistència) |
| Editar estat d'assistència | Tècnic, Admin | ✅ | Modal per canviar estat + notes de qualsevol membre per a un event |
| Afegir registres d'assistència | Tècnic, Admin | ✅ | Cercar persona existent o crear persona provisional inline |
| Eliminar registres d'assistència | Tècnic, Admin | ✅ | Des del modal d'edició amb confirmació |
| Llista de confirmats | Tècnic, Admin | ✅ | Toggle filtre per estat ANIRE/ASSISTIT |
| Persones provisionals | Tècnic, Admin | ✅ | Creació ràpida amb prefix `~`, promoció/democió, filtre al llistat |
| Recàlcul automàtic summary | — | ✅ | `attendanceSummary` es recalcula a cada operació CRUD |

> **Decisió P4.2:** es va descartar el flag `manuallyOverridden` per simplificar el desenvolupament. Es reconsiderarà si cal en futures fases.

### Autogestió per membres (PWA — P6)

| Feature | Descripció |
|---------|-----------|
| Confirmar assistència | Canviar el propi estat a `ANIRE` |
| Cancel·lar assistència | Canviar el propi estat a `NO_VAIG` |
| Marcar com a pendent | Deixar l'estat en `PENDENT` |
| Afegir nota | Afegir context (p.ex. "Arribo tard") |

> Prerequisit: `AuthModule` implementat a P4.1.

---

## Decisions sobre el Mòdul Persones (P2.1)

| Decisió | Resultat |
|---------|----------|
| Filtres de llista | Mantenir "Actius"; eliminar botons "Membres" i "Xicalla" |
| Ordenació | Server-side, whitelist estricta de camps |
| Vista mòbil | Taula sempre (scroll horitzontal) |
| Alçada espatlles | Baseline 140 cm, toggle per sessió, colors per tonalitat |
| Selector de columnes | Col·lapsable per defecte; persistit en `localStorage` |
| Paginació | Opcions 25/50/100 per pàgina |

---

## Flux de Treball per Sub-projecte

```
Brainstorming → Spec Document → Implementation Plan → Codi → Tests → Review
```

Cada sub-projecte genera:
1. **Spec** → `docs/specs/YYYY-MM-DD-<topic>-design.md`
2. **Pla** → Implementation plan amb tasques ordenades
3. **Codi** → Feature branch → PR → merge

---

## Documents de Referència

| Document | Ubicació | Descripció |
|----------|----------|------------|
| Kickoff equip | `TEAM_KICKOFF.md` | Decisions, arquitectura, flux assistència |
| Model de dades | `DATA_MODEL.md` | Entitats TypeScript |
| Auth flow | `AUTH_FLOW.md` | Fluxos d'autenticació, components, variables |
| Dashboard UI | [`DASHBOARD_UI.md`](DASHBOARD_UI.md) | Design system, components shared, patterns UX (P4.3) |
| Mòdul Pinyes | [`PINYES_MODULE.md`](PINYES_MODULE.md) | Arquitectura completa del mòdul P5: famílies, snapshot, upgrade, assignació |
| API legacy | `API_APPSISTENCIA.md` | Endpoints de l'app actual per migració |
| PRD complet | `docs/prd/` | Requirements, user stories, security |
| Rules Cursor | `.cursor/rules/` | Regles per l'agent AI |

---

## Convencions de Codi i UX

| Aspecte | Decisió | Notes |
|---------|---------|-------|
| Idioma UI | Català | Tots els textos, botons, labels, missatges d'error |
| Idioma codi | Anglès | Variables, funcions, enums, endpoints, commits |
| Components Angular | 2 fitxers preferits | `.ts` + `.html` (inline template per components petits). `.scss` només si necessari (des de P4.3: Tailwind/DaisyUI purs) |
| Canvi de detecció | `OnPush` | Tots els components |
| Estat reactiu | Signals (`signal`, `computed`, `effect`) | Evitar `BehaviorSubject` per estat local |
| Estils | DaisyUI v4 + Tailwind v3 | Cap Tailwind v4 fins nova decisió. Des de P4.3: zero custom CSS, tokens DaisyUI purs |
| Alçada d'espatlles | Baseline 140 cm | Display absolut (cm) o relatiu (+/-) configurable per usuari |
| Tema i colors | `generateCollaTheme(primaryHex)` | Un sol color hex → paleta completa DaisyUI amb contrast WCAG automàtic (P4.3) |
| Navegació | Top navigation bar amb tabs | Desktop: icon+text, Tablet: icon, Mobile: dropdown (des de P4.3) |
| Icones | Lucide Angular | Moderna, consistent, tree-shakeable (des de P4.3) |
| Font | Inter (Google Fonts) | Sans-serif professional per tota l'aplicació (des de P4.3) |

---

## Històric

| Data | Acció |
|------|-------|
| Mar 2026 | Inici brainstorming P0. Decisions stack confirmades. |
| 26 Mar 2026 | Spec P0+P1+P2 aprovat (`docs/specs/2026-03-26-p0-p1-p2-vertical-slice-persons-design.md`). |
| 30 Mar 2026 | Spec Sync + Dashboard aprovat. Implementació SSE, merge strategy, Person List/Detail/Sync. |
| 31 Mar 2026 | P2.1 completat: ordenació server-side, alçada relativa, UX persones, tests (34 API + 16 dashboard). |
| 7 Abr 2026 | Reordenació roadmap: P4.1 Auth Layer (prerequisit seguretat), P5 Pinyes avançat, P6 PWA diferit. Decisions rols, model User/Person i estratègia auth documentades. |
| 9 Abr 2026 | Spec P4.1 Auth Layer aprovada i escrita (`docs/specs/2026-04-07-p4-1-auth-layer-design.md`). |
| 9 Abr 2026 | **P4.1 Auth Layer completat**: backend AuthModule (JWT+Passport, refresh rotation, 7 endpoints, guards globals), frontend AuthService (signals), interceptor (401→refresh→retry), guards, login page DaisyUI. Tests backend + frontend. |
| 12 Abr 2026 | Spec P4.2 aprovada (`docs/specs/2026-04-12-p4-2-dashboard-events-attendance-design.md`). |
| 12 Abr 2026 | **P4.2 Dashboard Events + Attendance completat**: CRUD events (POST/PUT/DELETE), CRUD attendance, persones provisionals (`isProvisional` + prefix `~`), Event Form Modal, Attendance Edit Modal, Person Search Input, tabs Cens/Provisionals al llistat, optimistic UI. |
| 20 Abr 2026 | Brainstorming P4.3 Dashboard Design Refactor iniciat. Decisions: top nav, Home tab, Inter font, Lucide icons, theme generator, full-screen mode per Pinyes. |
| 20 Abr 2026 | Spec P4.3 aprovada (`docs/specs/2026-04-20-dashboard-design-refactor-design.md`). |
| 20 Abr 2026 | **P4.3 Dashboard Design Refactor completat** (7 fases): generateCollaTheme() amb WCAG, sidebar→tabs, 15+ components shared (page-header, data-table, pagination, filter-bar, toast, etc), Home tab amb preview events, refactor complet de person-list/event-list/detail/sync/login, Pinyes + Config placeholders. Reducció ~80% HTML. Build OK en 4.2s. |
| 24 Abr 2026 | **CI/CD activat**: GitHub Actions amb lint + test + build (affected per PRs, all per push). Coverage enforçat (`--configuration=ci`). |
| 24 Abr 2026 | **Deute tècnic CONCERNS.md resolt**: temporades dinàmiques (`loadOrCreateSeasons()`), ToastService integrat a event-detail + person-detail, codi mort eliminat (form-field, confirm-dialog, seed), coverage threshold (70%), refresh token cleanup (`@Cron` diari). |
| 27 Abr 2026 | **Documentació de codebase completa**: 8 documents creats (`docs/codebase/`): ARCHITECTURE, STACK, TESTING, CONCERNS, CONVENTIONS, STRUCTURE, INTEGRATIONS. JSDoc inline restaurat. |
| 7 Mai 2026 | **Documentació actualitzada** amb canvis recents. **P4.4 planificada**: Migració a PostgreSQL Docker local. |
| 7 Mai 2026 | **P4.4 Arquitectura Docker Multi-entorn completada**: docker-compose.yml (dev), Dockerfile multi-stage API, docker-compose.prod.yml (VPS), DB_SSL env var, seed-seasons script, docs DOCKER_ARCHITECTURE + DOCKER_SETUP. NeonDB eliminat del flux de dev. |
| 7 Mai 2026 | **Spec P5 aprovada** (`docs/specs/2026-05-07-p5-figures-module-overview-design.md`): Mòdul complet Pinyes amb 5 sub-fases (P5.1→P5.5), model de dades (7 entitats), API (20+ endpoints), arquitectura Konva, UX canvas. Decisió: `konva` API imperativa (sense `ng2-konva`). |
| 7 Mai 2026 | **P5.1 Templates i Editor Visual completat** (7 tasques): Backend — `FigureTemplate`+`FigureNode` entities, `NodeShape` enum, 6 endpoints CRUD+duplicate, tests unitaris. Frontend — `TemplateListComponent` (llistat amb tabs Figures/Composicions, accions CRUD), `FigureCanvasComponent` (Konva stage: pinya layer + tronc layer togglable, grid, zoom/pan, snap-to-grid, drag, resize, rotate, edició inline etiquetes), `TemplateEditorComponent` (toolbar lateral, panel propietats, auto-save 2s debounce, indicador estat). |
| 7 Mai 2026 | **TroncWidget refinat**: icones Lucide registrades (Building2, List, ArrowDown/Up, ChevronUp, Minus). Dropdown "Afegir pis" ara cap avall amb opcions per pis (P1=Baix directe, P2–P6 amb selector Segon/Terç/Quart/Quint/Alçadora/Xiqueta). Màxim 6 pisos, creació seqüencial. Botons +/− per fila per afegir/treure posicions. Panel propietats simplificat per TRONC (zona, positionType, sortOrder, climbPath ocults). Pre-existing test fixes: `role: UserRole[]` array en tests user-list/user-service/login; grantRole URL; role.guard TestBed reset. Tests: ✅ 258 API + 148 dashboard. |
| 8 Mai 2026 | **Spec P5.2 aprovada** (`docs/specs/2026-05-08-p5-2-compositions-design.md`): Model de dades (`CompositionTemplate` + `CompositionSlot`), 6 endpoints REST, `CompositionEditorComponent` layout amb Figure Picker + canvas multi-figura (pinya-view, offsets, grups draggables) + Slot Properties panel, auto-save. |
| 8–10 Mai 2026 | **P5.2 Composicions completat**: Backend — `CompositionModule` (entitats, 6 endpoints CRUD+duplicate, tests referencial integrity). Frontend — `CompositionEditorComponent` (canvas mode composition, auto-save, Figure Picker), tab Composicions al llistat amb CRUD real. Protecció referencial al delete de `FigureTemplate` (409 si té slots). |
| 10 Mai 2026 | **Spec P5.2.1 aprovada i implementada** (`docs/specs/2026-05-10-p5-2-1-composition-editor-fixes.md`): Fix canvas interaction (listening:true al rect, panning guard mode-aware, cursor grab). Millores UX: scale 50%, placeholder per slots buits, save immediat en add, offset incremental, botó "Enquadrar" (fitAllSlots), z-order controls (bringForward/sendBackward). Tests: ✅ 281 API + 200 dashboard. |
|| 11 Mai 2026 | **P5.3 Segments i Instàncies completat**: Backend — `EventSegmentModule` (entitats EventSegment + FigureInstance, endpoints CRUD + reordenar per segments i instàncies, tests unitaris). Frontend — `SegmentManagerComponent` integrat inline a event-detail (cards sempre visibles, edició nom, toggle visibilitat, fletxes reordenar, badges figures/composicions, `FigurePickerModalComponent` amb tabs). Pendent: refactor UX a tab dedicat "Pinyes" (P5.3.1). |
| 12 Mai 2026 | **P5.4 Assignació de Persones completat** (7 fases): Backend — `NodeAssignmentModule` (entitat `NodeAssignment`, `NodeAssignmentService` CRUD+validacions 404/409/400, `AvailablePersonsService` queries, controller, delete guard integrat a `FigureTemplateService`). Frontend — models `assignment.model.ts`, `NodeAssignmentService` HTTP, `AssignmentStateService` (signals), `AssignmentCanvasComponent` (pick-and-place, optimistic UI+rollback, auto-advance), `PersonPanelComponent` (filtres altura/xicalla/cerca, 🎭 next-performance), `NodePopoverComponent`, `ImportPinyaModalComponent` (import d'historial). Ruta `/pinyes/events/:eventId/segments/:segmentId/assign`. Botó "Assignar" al `SegmentManagerComponent`. Tests: ✅ 370 API + 303 dashboard. |
| 19 Mai 2026 | **Spec P5.5 aprovada i implementada** (`docs/specs/2026-05-19-p5-family-snapshot-redesign.md`): Redesign del model d'instàncies i templates. 4 fases: A (dades backend), B (snapshot+upgrade backend), C (famílies frontend), D (canvas assignació + onboarding). Nous artefactes: `FigureFamily`, `InstanceNode`, `reset-figure-data.script.ts`. Canvis model: `FigureTemplate`+família+variantOrder, `FigureNode`+ringLevel+originNodeId, `FigureInstance`+snapshotted+sourceVariantOrder, `NodeAssignment.figureNode`→`instanceNode`. Documentació actualitzada: `DATA_MODEL.md`, `PROJECT_ROADMAP.md`, `docs/PINYES_MODULE.md` (nou). |
| 20 Mai 2026 | **Spec P5.6 aprovada** (`docs/specs/2026-05-20-p5-tronc-visualization-design.md`): Visualització i assignació de troncs amb CSS Grid, sistema d'unitats relatives (0.5u–8u), variance d'alçades per pis amb color-coding. |
| 20–22 Mai 2026 | **P5.6 Tronc Visualization completat**: Backend — migració `migrate-tronc-units.script.ts`, seeds actualitzats. Frontend — `TroncViewComponent` (CSS Grid, unitats relatives x/width 0.5u steps, toggle orientació P1, mode editor/assignment, floating draggable panel, variance colors inline styling, add floor/node inline UX, columna extra grid per botó +), `floor-variance.util.ts`, integració a `TemplateEditorComponent` i `AssignmentCanvasComponent`. Tests: grid calculations, floor sorting, variance logic. Decisió: grid doblejat intern (x*2, width*2) per suportar 0.5u steps. |
| 21–22 Mai 2026 | **P5.7 Tronc Nodes at Family Level completat**: `FigureFamilyNode` entity (TRONC/BASE compartits per família), estratègia merge/split transparent (`GET` merge, `PUT` split), migració idempotent `migrate-tronc-to-family.script.ts`, seeds actualitzats (familyNodes separats), `snapshotInstance` amb FamilyNodes, tests merge/split/upsert/derive. Decisió: upsert per ID (estable per auto-save), derive només PINYA (tronc ve de família automàticament). |
| 22–23 Mai 2026 | **P5.8 Convenció d'ordre de les Bases completat**: convenció CCW documentada i implementada. `validateBaseOrdering()` util al frontend. Badge "Bases desordenades" al llistat de famílies. Modal d'ajuda amb diagrama CCW. Invariant §15.12 afegit a `PINYES_MODULE.md`. |
| 22–24 Mai 2026 | **P5.8.1 Vista de Projecció (inicial) completada** (`docs/specs/2026-05-22-p5-8-1-projection-view-design.md`): `ProjectionViewComponent` + `SegmentCanvasComponent` Konva, ruta `/events/:id/projection`, mode edició/projecció, elements de referència. |
| 24–25 Mai 2026 | **P5.9 Vista de Projecció (refinada) completada** (P5.9.1 + P5.9.2): Grid CSS responsive, bases visibles, `FigureProjectionComponent` (ruta figura individual), fons configurable. Vista Troncs (`?view=troncs`), panells flotants multi-figura independents draggable+resizable sense backdrop, HUD navegació, eliminació mode edició i elements de referència de la UI. |
| 26 Mai 2026 | **Spec P5.10 aprovada** (`docs/specs/2026-05-26-p5-10-positions-lock-history-design.md`): PositionModule, lock automàtic assignacions, filtre per posició al PersonPanel, historials (persona/event/família). |
| 26 Mai 2026 | **P5.10 Posicions, Lock i Historials completat** (F1+F2+F3): Backend — `PositionModule` (CRUD, M:N Person), lock automàtic (`ASSIGNMENT_LOCK_DAYS`, 403 guard), `HistoryQueryDto`, 3 endpoints historial nous (`getPersonHistory`, `getEventAssignmentSummary`, `getFamilyHistory`), `getHistory()` estès amb `eventType`/`familyName`/paginació. Frontend — `PositionListComponent`+`PositionFormModalComponent` (tab Configuració), tags posicions a person-detail, filtre posició al PersonPanel, secció "Historial de pinyes" a person-detail, secció "Pinyes" (summary) a event-detail, `FamilyHistoryModalComponent` (nou), botó "Historial" per família al template-list. Invariants 13+14 afegits a `PINYES_MODULE.md`. |
