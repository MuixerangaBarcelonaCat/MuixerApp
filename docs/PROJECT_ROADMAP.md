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
| P5.6 | Mòdul Pinyes — Projecció i Consulta Històrica | ⚪ Pendent | — | — | — | Mode fullscreen TV/projector. Consulta events passats per figura/persona |
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
