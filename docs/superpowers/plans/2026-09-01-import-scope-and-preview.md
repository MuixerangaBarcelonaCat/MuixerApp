# Importació per àmbit (pinya/tronc/figura) amb previsualització — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a técnic import only the pinya, only the tronc, or the whole figure from a past instance, with a per-scope visual preview before importing.

**Architecture:** Two independently shippable phases. Phase 1 adds an `ImportScope` enum shared across the stack, filters `bulkImport()` by the zones of the chosen scope, enriches `getHistory()` with `segmentId`/`zone`, and replaces the modal's single "Importa" button with three scoped actions. Phase 2 adds a preview overlay that renders only the scoped subset via the existing `lib-pinya-projection` (for PINYA/ALL) or `lib-tronc-view` (for TRONC) components — no new endpoint.

**Tech Stack:** NestJS/TypeORM (API), Angular 21 standalone/signals (dashboard), Jest (API), Vitest (dashboard).

**Spec:** [docs/superpowers/specs/2026-09-01-import-scope-and-preview-design.md](../specs/2026-09-01-import-scope-and-preview-design.md)

## Global Constraints

- Zones of scope `PINYA`: `FigureZone.PINYA`. Zones of scope `TRONC`: `FigureZone.TRONC`, `FigureZone.BASE`. Scope `ALL`: no filter (today's behavior).
- `scope` on `BulkImportAssignmentDto` is optional; omitted = `ALL` (backward compatible, existing callers unaffected).
- Ad-hoc node cloning in `bulkImport()` is **never** filtered by scope — it always clones every ad-hoc node from source to target, exactly as today.
- Existing target assignments are never overwritten; out-of-scope or already-occupied nodes still surface as `conflicts`, never rejected.
- UI text is Catalan; code/identifiers are English (see root `CLAUDE.md`).
- No dropdown selectors in the modal — three explicit buttons/rows: Pinya, Tronc, Figura.
- `pinyes-tab` keeps its single entry point; its button label changes from "Importa pinya" to "Importa figura".

---

## Phase 1 — Scoped import (backend + modal actions, no preview)

### Task 1: `ImportScope` enum + zone-mapping util (shared)

**Files:**
- Create: `libs/shared/src/enums/import-scope.enum.ts`
- Create: `libs/shared/src/utils/import-scope.util.ts`
- Test: `libs/shared/src/utils/import-scope.util.spec.ts`
- Modify: `libs/shared/src/index.ts` (add the two new exports)

**Interfaces:**
- Produces: `enum ImportScope { PINYA = 'PINYA', TRONC = 'TRONC', ALL = 'ALL' }`, `function zonesForScope(scope: ImportScope): Set<FigureZone> | null` (returns `null` for `ALL`, meaning "no filter").

- [ ] **Step 1: Write the failing test**

```typescript
// libs/shared/src/utils/import-scope.util.spec.ts
import { FigureZone } from '../enums/figure-zone.enum';
import { ImportScope } from '../enums/import-scope.enum';
import { zonesForScope } from './import-scope.util';

describe('zonesForScope', () => {
  it('maps PINYA to only the PINYA zone', () => {
    expect(zonesForScope(ImportScope.PINYA)).toEqual(new Set([FigureZone.PINYA]));
  });

  it('maps TRONC to TRONC and BASE zones', () => {
    expect(zonesForScope(ImportScope.TRONC)).toEqual(
      new Set([FigureZone.TRONC, FigureZone.BASE]),
    );
  });

  it('maps ALL to null (no filter)', () => {
    expect(zonesForScope(ImportScope.ALL)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `nx test shared --testFile=libs/shared/src/utils/import-scope.util.spec.ts`
Expected: FAIL — cannot find module `./import-scope.util` (and `../enums/import-scope.enum`)

- [ ] **Step 3: Write minimal implementation**

```typescript
// libs/shared/src/enums/import-scope.enum.ts
export enum ImportScope {
  PINYA = 'PINYA',
  TRONC = 'TRONC',
  ALL = 'ALL',
}
```

```typescript
// libs/shared/src/utils/import-scope.util.ts
import { FigureZone } from '../enums/figure-zone.enum';
import { ImportScope } from '../enums/import-scope.enum';

/** Zones that belong to each import scope; `null` for ALL means "no filter — every zone". */
export function zonesForScope(scope: ImportScope): Set<FigureZone> | null {
  switch (scope) {
    case ImportScope.PINYA:
      return new Set([FigureZone.PINYA]);
    case ImportScope.TRONC:
      return new Set([FigureZone.TRONC, FigureZone.BASE]);
    case ImportScope.ALL:
      return null;
  }
}
```

Add to `libs/shared/src/index.ts`, next to the other enum/util exports:

```typescript
export * from './enums/import-scope.enum';
export * from './utils/import-scope.util';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `nx test shared --testFile=libs/shared/src/utils/import-scope.util.spec.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add libs/shared/src/enums/import-scope.enum.ts libs/shared/src/utils/import-scope.util.ts libs/shared/src/utils/import-scope.util.spec.ts libs/shared/src/index.ts
git commit -m "feat(shared): add ImportScope enum and zone mapping util"
```

---

### Task 2: `bulkImport()` filters by scope (API)

**Files:**
- Modify: `apps/api/src/modules/node-assignment/dto/bulk-import-assignment.dto.ts`
- Modify: `apps/api/src/modules/node-assignment/node-assignment.service.ts:1239-1341` (the `bulkImport` method's source-assignment loop)
- Test: `apps/api/src/modules/node-assignment/node-assignment.service.spec.ts` (extend the `describe('bulkImport', ...)` block at line ~1811)

**Interfaces:**
- Consumes: `ImportScope`, `zonesForScope` from `@muixer/shared` (Task 1).
- Produces: `bulkImport(instanceId: string, dto: { sourceInstanceId: string; scope?: ImportScope })` — same return type `BulkImportResult` as today; `scope` defaults to `ImportScope.ALL` when omitted.

- [ ] **Step 1: Write the failing tests**

Add to the existing `describe('bulkImport', ...)` block in `apps/api/src/modules/node-assignment/node-assignment.service.spec.ts` (reuses `makeInstance`, `makeInstanceNode` helpers already defined at the top of the file):

```typescript
it('imports only PINYA-zone assignments when scope is PINYA', async () => {
  const pinyaNode = makeInstanceNode({ id: 'target-pinya', zone: FigureZone.PINYA, renglaId: 'r1', renglaPosition: 1 });
  const troncNode = makeInstanceNode({ id: 'target-tronc', zone: FigureZone.TRONC, renglaId: null, renglaPosition: null, sourceNodeId: 'src-tronc-fn' });
  const target = makeInstance({ snapshotted: true, instanceNodes: [pinyaNode, troncNode] });

  const sourcePinyaNode = makeInstanceNode({ id: 'src-pinya', zone: FigureZone.PINYA, renglaId: 'r1', renglaPosition: 1 });
  const sourceTroncNode = makeInstanceNode({ id: 'src-tronc', zone: FigureZone.TRONC, sourceNodeId: 'src-tronc-fn' });
  const source = makeInstance({ id: 'source-uuid', snapshotted: true, instanceNodes: [sourcePinyaNode, sourceTroncNode] });

  mockInstanceRepo.findOne
    .mockResolvedValueOnce(target)
    .mockResolvedValueOnce(source);
  mockAssignmentRepo.find.mockResolvedValue([
    makeAssignment({ instanceNode: sourcePinyaNode as any, person: makePerson({ id: 'p-pinya' }) as any }),
    makeAssignment({ instanceNode: sourceTroncNode as any, person: makePerson({ id: 'p-tronc' }) as any }),
  ]);
  mockAssignmentRepo.create = jest.fn((x) => x);
  mockAssignmentRepo.save = jest.fn((x) => Promise.resolve({ ...x, id: 'new-assignment' }));

  const result = await service.bulkImport(INSTANCE_ID, {
    sourceInstanceId: 'source-uuid',
    scope: ImportScope.PINYA,
  });

  expect(result.created).toHaveLength(1);
  expect(result.created[0].node.id).toBe('target-pinya');
});

it('imports TRONC and BASE zones when scope is TRONC, not PINYA', async () => {
  const pinyaNode = makeInstanceNode({ id: 'target-pinya', zone: FigureZone.PINYA, renglaId: 'r1', renglaPosition: 1 });
  const baseNode = makeInstanceNode({ id: 'target-base', zone: FigureZone.BASE, renglaId: null, renglaPosition: null, sourceNodeId: 'src-base-fn' });
  const target = makeInstance({ snapshotted: true, instanceNodes: [pinyaNode, baseNode] });

  const sourcePinyaNode = makeInstanceNode({ id: 'src-pinya', zone: FigureZone.PINYA, renglaId: 'r1', renglaPosition: 1 });
  const sourceBaseNode = makeInstanceNode({ id: 'src-base', zone: FigureZone.BASE, sourceNodeId: 'src-base-fn' });
  const source = makeInstance({ id: 'source-uuid', snapshotted: true, instanceNodes: [sourcePinyaNode, sourceBaseNode] });

  mockInstanceRepo.findOne
    .mockResolvedValueOnce(target)
    .mockResolvedValueOnce(source);
  mockAssignmentRepo.find.mockResolvedValue([
    makeAssignment({ instanceNode: sourcePinyaNode as any, person: makePerson({ id: 'p-pinya' }) as any }),
    makeAssignment({ instanceNode: sourceBaseNode as any, person: makePerson({ id: 'p-base' }) as any }),
  ]);
  mockAssignmentRepo.create = jest.fn((x) => x);
  mockAssignmentRepo.save = jest.fn((x) => Promise.resolve({ ...x, id: 'new-assignment' }));

  const result = await service.bulkImport(INSTANCE_ID, {
    sourceInstanceId: 'source-uuid',
    scope: ImportScope.TRONC,
  });

  expect(result.created).toHaveLength(1);
  expect(result.created[0].node.id).toBe('target-base');
});

it('imports every zone when scope is omitted (default ALL, backward compatible)', async () => {
  const pinyaNode = makeInstanceNode({ id: 'target-pinya', zone: FigureZone.PINYA, renglaId: 'r1', renglaPosition: 1 });
  const target = makeInstance({ snapshotted: true, instanceNodes: [pinyaNode] });
  const sourcePinyaNode = makeInstanceNode({ id: 'src-pinya', zone: FigureZone.PINYA, renglaId: 'r1', renglaPosition: 1 });
  const source = makeInstance({ id: 'source-uuid', snapshotted: true, instanceNodes: [sourcePinyaNode] });

  mockInstanceRepo.findOne
    .mockResolvedValueOnce(target)
    .mockResolvedValueOnce(source);
  mockAssignmentRepo.find.mockResolvedValue([
    makeAssignment({ instanceNode: sourcePinyaNode as any, person: makePerson({ id: 'p-pinya' }) as any }),
  ]);
  mockAssignmentRepo.create = jest.fn((x) => x);
  mockAssignmentRepo.save = jest.fn((x) => Promise.resolve({ ...x, id: 'new-assignment' }));

  const result = await service.bulkImport(INSTANCE_ID, { sourceInstanceId: 'source-uuid' });

  expect(result.created).toHaveLength(1);
});
```

Add the necessary imports at the top of the spec file if not already present: `import { ImportScope } from '@muixer/shared';` (check the existing `FigureZone` import line and add `ImportScope` alongside it rather than a new import statement, since both come from `@muixer/shared`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `nx test api --testFile=apps/api/src/modules/node-assignment/node-assignment.service.spec.ts -t "scope"`
Expected: FAIL — `result.created` has length 2, not 1 (no filtering happens yet), or a TS error on the unknown `scope` property until Step 3's DTO/service change lands.

- [ ] **Step 3: Write minimal implementation**

`apps/api/src/modules/node-assignment/dto/bulk-import-assignment.dto.ts`:

```typescript
import { IsString, IsUUID, IsOptional, IsEnum } from 'class-validator';
import { ImportScope } from '@muixer/shared';

export class BulkImportAssignmentDto {
  @IsUUID()
  sourceInstanceId: string;

  @IsOptional()
  @IsUUID()
  sourceCompositionSlotId?: string;

  @IsOptional()
  @IsEnum(ImportScope)
  scope?: ImportScope;
}
```

In `apps/api/src/modules/node-assignment/node-assignment.service.ts`, add the import (near the other `@muixer/shared` imports at the top of the file):

```typescript
import { ImportScope, zonesForScope } from '@muixer/shared';
```

Then in `bulkImport()` (around line 1239), compute the zone filter once and apply it in the source-assignment loop:

```typescript
async bulkImport(
  instanceId: string,
  dto: { sourceInstanceId: string; scope?: ImportScope },
): Promise<BulkImportResult> {
  await this.checkEventLock(instanceId);

  const scopeZones = zonesForScope(dto.scope ?? ImportScope.ALL);

  // ... unchanged: targetInstance/sourceInstance loading, auto-snapshot, sourceAssignments query ...

  for (const sourceAssignment of sourceAssignments) {
    const sourceNode = sourceAssignment.instanceNode;
    if (sourceNode.isAdHoc) continue; // ad-hoc assignments handled below, never scope-filtered
    if (scopeZones && !scopeZones.has(sourceNode.zone)) continue;
    const personId = sourceAssignment.person.id;
    // ... rest of the loop body unchanged ...
  }

  // ... unchanged: ad-hoc node cloning block, getSegmentConflicts, return ...
}
```

Only these two lines are new inside the loop (the `scopeZones` computation before the loop, and the `if (scopeZones && ...) continue;` guard placed immediately after the existing `isAdHoc` guard). Nothing else in the method changes — the ad-hoc cloning block below stays untouched per the Global Constraints.

- [ ] **Step 4: Run tests to verify they pass**

Run: `nx test api --testFile=apps/api/src/modules/node-assignment/node-assignment.service.spec.ts`
Expected: PASS (full file, including the 3 new tests and all pre-existing `bulkImport` tests unaffected)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/node-assignment/dto/bulk-import-assignment.dto.ts apps/api/src/modules/node-assignment/node-assignment.service.ts apps/api/src/modules/node-assignment/node-assignment.service.spec.ts
git commit -m "feat(api): filter bulkImport by ImportScope (pinya/tronc/all)"
```

---

### Task 3: `getHistory()` returns `segmentId` and per-assignment `zone` (API)

**Files:**
- Modify: `apps/api/src/modules/node-assignment/node-assignment.service.ts:882-936` (the `getHistory` method's mapping)
- Modify: `libs/shared/src/interfaces/pinyes/assignment.interfaces.ts` (`FigureHistoryEntry`)
- Modify: `libs/pinyes-render/src/lib/models/assignment.model.ts` (`FigureHistoryEntry`)
- Test: `apps/api/src/modules/node-assignment/node-assignment.service.spec.ts` (extend the `describe('getHistory', ...)` block)

**Interfaces:**
- Produces: `FigureHistoryEntry` gains `segmentId: string` (top-level) and `zone: FigureZone` on each element of `assignments[]`.

- [ ] **Step 1: Write the failing test**

Find the existing `getHistory` describe block in `node-assignment.service.spec.ts` (search for `describe('getHistory'`) and add:

```typescript
it('includes segmentId and each assignment zone in the response', async () => {
  const node = makeInstanceNode({ zone: FigureZone.TRONC });
  const instance = {
    ...makeInstance({ instanceNodeCount: 1 }),
    assignments: [makeAssignment({ instanceNode: node as any, person: makePerson() as any })],
  };
  mockTemplateRepo.findOne.mockResolvedValue(makeTemplate());
  mockInstanceQb.getCount.mockResolvedValue(1);
  mockInstanceQb.getMany.mockResolvedValue([instance]);

  const result = await service.getHistory(TEMPLATE_ID);

  expect(result.data[0].segmentId).toBe(SEGMENT_ID);
  expect(result.data[0].assignments[0].zone).toBe(FigureZone.TRONC);
});
```

Adjust the mock names (`mockInstanceQb`, `mockTemplateRepo`) to whatever the existing `getHistory` tests in the file already use — copy their exact setup pattern instead of inventing new mock variable names.

- [ ] **Step 2: Run test to verify it fails**

Run: `nx test api --testFile=apps/api/src/modules/node-assignment/node-assignment.service.spec.ts -t "segmentId and each assignment zone"`
Expected: FAIL — `result.data[0].segmentId` is `undefined`, `result.data[0].assignments[0].zone` is `undefined`

- [ ] **Step 3: Write minimal implementation**

In `node-assignment.service.ts`, inside `getHistory()`'s `data = instances.map(...)`:

```typescript
const data = instances.map((instance) => {
  const event = instance.segment.event as Event;
  return {
    eventId: event.id,
    eventTitle: event.title,
    eventDate: event.date as unknown as string,
    eventType: event.eventType,
    segmentId: instance.segment.id, // NEW
    segmentName: instance.segment.name ?? null,
    instanceId: instance.id,
    snapshotted: instance.snapshotted,
    assignmentCount: instance.assignments?.length ?? 0,
    totalNodes: (instance as FigureInstance & { instanceNodeCount?: number }).instanceNodeCount ?? 0,
    assignments: (instance.assignments ?? []).map((a) => ({
      nodeId: a.instanceNode.id,
      nodeLabel: a.instanceNode.label,
      zone: a.instanceNode.zone, // NEW
      personId: a.person.id,
      personAlias: a.person.alias,
    })),
  };
});
```

In `libs/shared/src/interfaces/pinyes/assignment.interfaces.ts`, `FigureHistoryEntry`:

```typescript
export interface FigureHistoryEntry {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventType: EventType;
  segmentId: string; // NEW
  segmentName: string | null;
  instanceId: string;
  snapshotted: boolean;
  assignmentCount: number;
  totalNodes: number;
  assignments: {
    nodeId: string;
    nodeLabel: string;
    zone: FigureZone; // NEW
    personId: string;
    personAlias: string;
  }[];
}
```

Add `FigureZone` to that file's imports if not already imported.

Mirror the same two additions in `libs/pinyes-render/src/lib/models/assignment.model.ts`'s `FigureHistoryEntry` (currently at line 144), keeping `eventType: string` as-is there (that file already uses `string` instead of the API's `EventType` enum — match its existing convention, just add `segmentId` and `zone`).

- [ ] **Step 4: Run test to verify it passes**

Run: `nx test api --testFile=apps/api/src/modules/node-assignment/node-assignment.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/node-assignment/node-assignment.service.ts apps/api/src/modules/node-assignment/node-assignment.service.spec.ts libs/shared/src/interfaces/pinyes/assignment.interfaces.ts libs/pinyes-render/src/lib/models/assignment.model.ts
git commit -m "feat(api): add segmentId and per-assignment zone to figure import history"
```

---

### Task 4: Dashboard service passes `scope` through `bulkImport` (dashboard)

**Files:**
- Modify: `libs/pinyes-render/src/lib/models/assignment.model.ts` (`BulkImportPayload`)
- Modify: `apps/dashboard/src/app/features/pinyes/services/node-assignment.service.ts` (no signature change needed — already takes `BulkImportPayload`)
- Test: `apps/dashboard/src/app/features/pinyes/services/node-assignment.service.spec.ts`

**Interfaces:**
- Consumes: `ImportScope` from `@muixer/shared`.
- Produces: `BulkImportPayload` gains optional `scope?: ImportScope`.

- [ ] **Step 1: Write the failing test**

Find the existing `bulkImport` test in `node-assignment.service.spec.ts` and add one asserting the payload passes through untouched, including `scope`:

```typescript
it('passes scope through in the bulkImport request body', () => {
  service.bulkImport('instance-1', { sourceInstanceId: 'source-1', scope: ImportScope.TRONC }).subscribe();

  const req = httpMock.expectOne('/api/figure-instances/instance-1/assignments/bulk');
  expect(req.request.body).toEqual({ sourceInstanceId: 'source-1', scope: ImportScope.TRONC });
  req.flush({ created: [], conflicts: [], clonedAdHocNodes: 0, conflictsByKind: {} });
});
```

Match this test's HTTP-mocking style (`httpMock`/`HttpTestingController` or whatever the file's existing `bulkImport` test already uses) exactly — copy the existing test's setup instead of introducing a new mocking approach. Add `import { ImportScope } from '@muixer/shared';` to the spec file's imports.

- [ ] **Step 2: Run test to verify it fails**

Run: `nx test dashboard --testFile=apps/dashboard/src/app/features/pinyes/services/node-assignment.service.spec.ts -t "passes scope through"`
Expected: FAIL — TS error, `scope` does not exist on type `BulkImportPayload`

- [ ] **Step 3: Write minimal implementation**

In `libs/pinyes-render/src/lib/models/assignment.model.ts`:

```typescript
export interface BulkImportPayload {
  sourceInstanceId: string;
  scope?: ImportScope;
}
```

Add `ImportScope` to that file's import from `@muixer/shared` (or from the relevant relative enum path this file already uses for other shared enums — follow its existing import style, e.g. it likely already imports `FigureZone` from `@muixer/shared` at the top; add `ImportScope` to that same import line).

No change needed in `node-assignment.service.ts` (dashboard) — `bulkImport()` already forwards the whole `payload` object as the request body.

- [ ] **Step 4: Run test to verify it passes**

Run: `nx test dashboard --testFile=apps/dashboard/src/app/features/pinyes/services/node-assignment.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add libs/pinyes-render/src/lib/models/assignment.model.ts apps/dashboard/src/app/features/pinyes/services/node-assignment.service.spec.ts
git commit -m "feat(dashboard): add scope to BulkImportPayload"
```

---

### Task 5: Three scoped import actions in `ImportPinyaModalComponent`

**Files:**
- Modify: `apps/dashboard/src/app/features/pinyes/components/import-pinya-modal/import-pinya-modal.component.ts`
- Modify: `apps/dashboard/src/app/features/pinyes/components/import-pinya-modal/import-pinya-modal.component.html`
- Test: `apps/dashboard/src/app/features/pinyes/components/import-pinya-modal/import-pinya-modal.component.spec.ts`
- Modify: `apps/dashboard/src/app/features/pinyes/components/segment-workspace/tabs/pinyes-tab/pinyes-tab.component.html:115-120` (button label only)

**Interfaces:**
- Consumes: `ImportScope`, `zonesForScope` from `@muixer/shared`; `FigureHistoryEntry.assignments[].zone` (Task 3); `BulkImportPayload.scope` (Task 4).
- Produces: `ImportPinyaModalComponent.doImport(scope: ImportScope): void` (replaces the current parameterless `doImport()`); a `computed` per-scope assignment count usable by future tasks (Task 9 wires the preview button off the same data).

- [ ] **Step 1: Write the failing tests**

Add to `import-pinya-modal.component.spec.ts` (follow the file's existing setup pattern — component creation, `NodeAssignmentService` mock, `selectEntry` helper):

```typescript
const entryWithMixedZones = (): FigureHistoryEntry => ({
  eventId: 'e1',
  eventTitle: 'Assaig',
  eventDate: '2026-05-01',
  eventType: EventType.ASSAIG,
  segmentId: 'seg-1',
  segmentName: 'Bloc 1',
  instanceId: 'inst-1',
  snapshotted: true,
  assignmentCount: 3,
  totalNodes: 5,
  assignments: [
    { nodeId: 'n1', nodeLabel: 'Segones', zone: FigureZone.PINYA, personId: 'p1', personAlias: 'Guille' },
    { nodeId: 'n2', nodeLabel: 'Base 2', zone: FigureZone.BASE, personId: 'p2', personAlias: 'Amparo' },
    { nodeId: 'n3', nodeLabel: 'Tronc 1', zone: FigureZone.TRONC, personId: 'p3', personAlias: 'Marc' },
  ],
});

it('counts assignments per scope from the selected entry', () => {
  component.selectEntry(entryWithMixedZones());
  fixture.detectChanges();

  expect(component.countForScope(ImportScope.PINYA)).toBe(1);
  expect(component.countForScope(ImportScope.TRONC)).toBe(2); // BASE + TRONC
  expect(component.countForScope(ImportScope.ALL)).toBe(3);
});

it('calls bulkImport with the chosen scope', () => {
  component.selectEntry(entryWithMixedZones());
  assignmentServiceMock.bulkImport.mockReturnValue(
    of({ created: [], conflicts: [], clonedAdHocNodes: 0, conflictsByKind: {} }),
  );

  component.doImport(ImportScope.TRONC);

  expect(assignmentServiceMock.bulkImport).toHaveBeenCalledWith(
    component.currentInstanceId(),
    { sourceInstanceId: 'inst-1', scope: ImportScope.TRONC },
  );
});
```

Use the mock/import style (`assignmentServiceMock`, `of(...)` from `rxjs`, `fixture`) that the file's existing tests already establish — do not introduce a new mocking pattern. Add `ImportScope` and `FigureZone` to the spec's `@muixer/shared` import.

- [ ] **Step 2: Run tests to verify they fail**

Run: `nx test dashboard --testFile=apps/dashboard/src/app/features/pinyes/components/import-pinya-modal/import-pinya-modal.component.spec.ts -t "scope"`
Expected: FAIL — `countForScope` and the new `doImport` signature don't exist yet

- [ ] **Step 3: Write minimal implementation**

In `import-pinya-modal.component.ts`, add the import and replace `doImport()`:

```typescript
import { ImportScope, zonesForScope } from '@muixer/shared';
```

```typescript
countForScope(scope: ImportScope): number {
  const entry = this.selectedEntry();
  if (!entry) return 0;
  const zones = zonesForScope(scope);
  return zones
    ? entry.assignments.filter((a) => zones.has(a.zone)).length
    : entry.assignments.length;
}

readonly ImportScope = ImportScope;

doImport(scope: ImportScope): void {
  const entry = this.selectedEntry();
  if (!entry) return;

  this.importing.set(true);
  this.error.set(null);

  this.assignmentService
    .bulkImport(this.currentInstanceId(), { sourceInstanceId: entry.instanceId, scope })
    .subscribe({
      next: (result) => {
        this.importing.set(false);
        this.lastResult.set(result);
        this.importCompleted.emit(result);
      },
      error: () => {
        this.importing.set(false);
        this.error.set('Error en importar les assignacions. Torna-ho a intentar.');
      },
    });
}
```

In `import-pinya-modal.component.html`, replace the single "Importa" button in `.modal-action` with three rows, placed right after the existing summary block (`@if (selectedEntry()) { ... }` that already lists up to 5 assignments) and before the `@if (lastResult())` block:

```html
@if (selectedEntry() && !lastResult()) {
  <div class="space-y-1 mb-4">
    @for (row of [
      { scope: ImportScope.PINYA, label: 'Pinya' },
      { scope: ImportScope.TRONC, label: 'Tronc' },
      { scope: ImportScope.ALL, label: 'Figura' }
    ]; track row.scope) {
      <div class="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-base-300">
        <div class="text-sm">
          <span class="font-medium">{{ row.label }}</span>
          <span class="text-xs text-base-content/50 ml-1">{{ countForScope(row.scope) }} assignacions</span>
        </div>
        <button
          type="button"
          class="btn btn-primary btn-xs gap-1"
          [disabled]="countForScope(row.scope) === 0 || importing()"
          (click)="doImport(row.scope)"
        >
          @if (importing()) {
            <span class="loading loading-spinner loading-xs"></span>
          } @else {
            <i-lucide [img]="Import" class="size-3" />
          }
          Importa
        </button>
      </div>
    }
  </div>
}
```

Remove the old `@if (!lastResult()) { <button ... (click)="doImport()">Importa</button> }` block from `.modal-action` — only the "Tancar" button stays there.

In `pinyes-tab.component.html` (lines 115-120), update the label and `aria-label`:

```html
<button
  type="button"
  class="btn btn-xs btn-outline gap-1"
  (click)="openImport()"
  [disabled]="ws.isLocked()"
  aria-label="Importa les assignacions d'una figura anterior"
>
  Importa figura
</button>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `nx test dashboard --testFile=apps/dashboard/src/app/features/pinyes/components/import-pinya-modal/import-pinya-modal.component.spec.ts`
Expected: PASS (full file — verify no pre-existing test still asserts the old single-button `doImport()` call signature; update any that do to call `doImport(ImportScope.ALL)` instead, matching what a técnic clicking "Figura" now triggers)

Run also: `nx test dashboard --testFile=apps/dashboard/src/app/features/pinyes/components/segment-workspace/tabs/pinyes-tab/pinyes-tab.component.spec.ts`
Expected: PASS (check for any assertion on the old "Importa pinya" label text and update it to "Importa figura")

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/app/features/pinyes/components/import-pinya-modal/ apps/dashboard/src/app/features/pinyes/components/segment-workspace/tabs/pinyes-tab/
git commit -m "feat(dashboard): scoped import actions (pinya/tronc/figura) in import modal"
```

---

**Phase 1 checkpoint:** at this point the feature is fully usable end-to-end without a preview — a técnic can import just the pinya, just the tronc, or the whole figure. Run `pnpm run ci:local` before moving to Phase 2.

---

## Phase 2 — Per-scope preview

### Task 6: `PinyaProjectionComponent` gains a `scope` input that hides the tronc panel for `PINYA`

**Files:**
- Modify: `libs/pinyes-render/src/lib/components/pinya-projection/pinya-projection.component.ts`
- Test: `libs/pinyes-render/src/lib/components/pinya-projection/pinya-projection.component.spec.ts`

**Interfaces:**
- Consumes: `ImportScope` from `@muixer/shared`.
- Produces: new input `scope = input<ImportScope | null>(null)`. When `scope() === ImportScope.PINYA`, `distributionTroncPanels()` and `distributionFitBounds()` both return `[]`. Any other value (including `null`/`ALL`) keeps today's behavior unchanged.

- [ ] **Step 1: Write the failing test**

Find this component's existing spec file and add (reusing whatever test-data builders it already has for `ProjectionSegmentData`/instances with tronc nodes):

```typescript
it('hides tronc panels when scope is PINYA', () => {
  fixture.componentRef.setInput('data', dataWithTroncPanel());
  fixture.componentRef.setInput('scope', ImportScope.PINYA);
  fixture.detectChanges();

  expect(component.distributionTroncPanels()).toEqual([]);
});

it('still shows tronc panels when scope is not set', () => {
  fixture.componentRef.setInput('data', dataWithTroncPanel());
  fixture.detectChanges();

  expect(component.distributionTroncPanels().length).toBeGreaterThan(0);
});
```

Add `import { ImportScope } from '@muixer/shared';` to the spec. If the file has no existing `dataWithTroncPanel()`-style builder, build the minimal `ProjectionSegmentData` fixture inline using the `ProjectionInstance` shape (an instance with at least one `TRONC` node in `nodes`).

- [ ] **Step 2: Run test to verify it fails**

Run: `nx test pinyes-render --testFile=libs/pinyes-render/src/lib/components/pinya-projection/pinya-projection.component.spec.ts -t "scope is PINYA"`
Expected: FAIL — `setInput('scope', ...)` errors (no such input) or `distributionTroncPanels()` still returns the panel

- [ ] **Step 3: Write minimal implementation**

Add the input near the other inputs (after `highlightPersonId` at line 74):

```typescript
import { ImportScope } from '@muixer/shared';
// ...
readonly scope = input<ImportScope | null>(null);
```

Guard both `distributionTroncPanels` (line 437) and `distributionFitBounds` (line ~380) with an early return:

```typescript
readonly distributionFitBounds = computed((): { x: number; y: number; width: number; height: number }[] => {
  if (this.scope() === ImportScope.PINYA) return [];
  // ... existing body unchanged ...
});
```

```typescript
readonly distributionTroncPanels = computed((): DistributionTroncPanel[] => {
  if (this.scope() === ImportScope.PINYA) return [];
  // ... existing body unchanged ...
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `nx test pinyes-render --testFile=libs/pinyes-render/src/lib/components/pinya-projection/pinya-projection.component.spec.ts`
Expected: PASS (full file)

- [ ] **Step 5: Commit**

```bash
git add libs/pinyes-render/src/lib/components/pinya-projection/pinya-projection.component.ts libs/pinyes-render/src/lib/components/pinya-projection/pinya-projection.component.spec.ts
git commit -m "feat(pinyes-render): PinyaProjectionComponent hides tronc panel for PINYA scope"
```

---

### Task 7: `ImportPreviewModalComponent` (new)

**Files:**
- Create: `apps/dashboard/src/app/features/pinyes/components/import-preview-modal/import-preview-modal.component.ts`
- Create: `apps/dashboard/src/app/features/pinyes/components/import-preview-modal/import-preview-modal.component.html`
- Test: `apps/dashboard/src/app/features/pinyes/components/import-preview-modal/import-preview-modal.component.spec.ts`

**Interfaces:**
- Consumes: `ProjectionService.getProjection(eventId, segmentId): Observable<ProjectionSegmentData>` (existing, `apps/dashboard/src/app/features/pinyes/services/projection.service.ts`); `PinyaProjectionComponent` (Task 6, `scope` input); `TroncViewComponent` (existing, `libs/pinyes-render`); `ImportScope` from `@muixer/shared`.
- Produces: `ImportPreviewModalComponent` with inputs `eventId: string`, `segmentId: string`, `instanceId: string`, `scope: ImportScope`, `eventTitle: string`, `open: boolean`; output `closed: void`.

- [ ] **Step 1: Write the failing test**

```typescript
// import-preview-modal.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ImportScope } from '@muixer/shared';
import { ImportPreviewModalComponent } from './import-preview-modal.component';
import { ProjectionService } from '../../services/projection.service';

describe('ImportPreviewModalComponent', () => {
  let fixture: ComponentFixture<ImportPreviewModalComponent>;
  let component: ImportPreviewModalComponent;
  let projectionServiceMock: { getProjection: jest.Mock };

  const projectionData = () => ({
    segment: { id: 'seg-1', name: 'Bloc 1', sortOrder: 0, prevSegmentId: null, nextSegmentId: null },
    instances: [{
      id: 'inst-1', label: null, sortOrder: 0, numberOfCordons: null,
      projectionX: 0, projectionY: 0, projectionScale: 1, projectionAngle: 0,
      troncPanelX: null, troncPanelY: null, troncPanelWidth: null, troncPanelHeight: null,
      figureMode: 'COMPLETA', figureTemplate: { id: 't1', name: 'Pilar', hasPinya: true },
      nodes: [], assignments: [],
    }],
    personAttendance: {}, hasDistribution: true, conflicts: [],
  });

  beforeEach(async () => {
    projectionServiceMock = { getProjection: jest.fn() };
    await TestBed.configureTestingModule({
      imports: [ImportPreviewModalComponent],
      providers: [{ provide: ProjectionService, useValue: projectionServiceMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(ImportPreviewModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('eventId', 'event-1');
    fixture.componentRef.setInput('segmentId', 'seg-1');
    fixture.componentRef.setInput('instanceId', 'inst-1');
    fixture.componentRef.setInput('scope', ImportScope.PINYA);
    fixture.componentRef.setInput('eventTitle', 'Assaig 1');
  });

  it('fetches projection data when opened', () => {
    projectionServiceMock.getProjection.mockReturnValue(of(projectionData()));

    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    expect(projectionServiceMock.getProjection).toHaveBeenCalledWith('event-1', 'seg-1');
    expect(component.loading()).toBe(false);
    expect(component.projectionData()).not.toBeNull();
  });

  it('sets an error message when the fetch fails', () => {
    projectionServiceMock.getProjection.mockReturnValue(throwError(() => new Error('boom')));

    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    expect(component.error()).toBeTruthy();
    expect(component.loading()).toBe(false);
  });

  it('emits closed when close() is called', () => {
    const spy = jest.fn();
    component.closed.subscribe(spy);

    component.close();

    expect(spy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `nx test dashboard --testFile=apps/dashboard/src/app/features/pinyes/components/import-preview-modal/import-preview-modal.component.spec.ts`
Expected: FAIL — cannot find module `./import-preview-modal.component`

- [ ] **Step 3: Write minimal implementation**

```typescript
// import-preview-modal.component.ts
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  OnChanges,
  output,
  signal,
  SimpleChanges,
} from '@angular/core';
import { LucideAngularModule, X } from 'lucide-angular';
import { ImportScope } from '@muixer/shared';
import { PinyaProjectionComponent, ProjectionSegmentData, TroncViewComponent } from '@muixer/pinyes-render';
import { ProjectionService } from '../../services/projection.service';

@Component({
  selector: 'app-import-preview-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, PinyaProjectionComponent, TroncViewComponent],
  templateUrl: './import-preview-modal.component.html',
})
export class ImportPreviewModalComponent implements OnChanges {
  readonly eventId = input.required<string>();
  readonly segmentId = input.required<string>();
  readonly instanceId = input.required<string>();
  readonly scope = input.required<ImportScope>();
  readonly eventTitle = input.required<string>();
  readonly open = input<boolean>(false);

  readonly closed = output<void>();

  private readonly projectionService = inject(ProjectionService);

  readonly X = X;
  readonly ImportScope = ImportScope;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly projectionData = signal<ProjectionSegmentData | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open()) {
      this.loading.set(true);
      this.error.set(null);
      this.projectionData.set(null);
      this.projectionService.getProjection(this.eventId(), this.segmentId()).subscribe({
        next: (data) => {
          this.projectionData.set(data);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('No s\'ha pogut carregar la previsualització.');
          this.loading.set(false);
        },
      });
    }
  }

  troncNodesFor(): ReturnType<PinyaProjectionComponent['getInstanceTroncNodes']> {
    const inst = this.projectionData()?.instances.find((i) => i.id === this.instanceId());
    return inst ? inst.nodes.filter((n) => n.zone === 'TRONC') as any : [];
  }

  close(): void {
    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }
}
```

> Note on `troncNodesFor()`: keep it simple and inline rather than reaching into `PinyaProjectionComponent`'s private helpers — filter `nodes` by `zone` directly, matching the filtering already done in `getInstanceTroncNodes`/`getInstanceBaseNodes`/`getInstanceDirectionNodes` in `pinya-projection.component.ts` (lines 654-666). Import `FigureZone` from `@muixer/shared` for the comparison instead of the string literal shown above.

```html
<!-- import-preview-modal.component.html -->
@if (open()) {
  <dialog
    class="modal modal-open"
    role="dialog"
    aria-labelledby="import-preview-title"
    aria-modal="true"
    (click)="onBackdropClick($event)"
    (keydown.escape)="close()"
  >
    <div class="modal-box max-w-5xl h-[80vh] flex flex-col">
      <div class="flex items-center justify-between mb-4">
        <h2 id="import-preview-title" class="text-lg font-bold">
          Previsualització — {{ eventTitle() }}
        </h2>
        <button type="button" class="btn btn-ghost btn-sm" (click)="close()" aria-label="Tancar">
          <i-lucide [img]="X" class="size-4" />
        </button>
      </div>

      @if (loading()) {
        <div class="flex flex-1 items-center justify-center">
          <span class="loading loading-spinner loading-md text-primary"></span>
        </div>
      }

      @if (error()) {
        <div class="alert alert-error text-sm">{{ error() }}</div>
      }

      @if (!loading() && !error() && projectionData(); as data) {
        <div class="flex-1 min-h-0">
          @if (scope() === ImportScope.TRONC) {
            <lib-tronc-view
              class="block w-full h-full"
              mode="projection"
              [troncNodes]="troncNodesFor()"
            />
          } @else {
            <lib-pinya-projection
              class="block w-full h-full"
              [data]="data"
              [instanceId]="instanceId()"
              [scope]="scope()"
              [showZoomControls]="false"
            />
          }
        </div>
      }

      <div class="modal-action">
        <button type="button" class="btn btn-ghost btn-sm" (click)="close()">Tancar</button>
      </div>
    </div>
    <button type="button" class="modal-backdrop" (click)="close()" aria-label="Tancar"></button>
  </dialog>
}
```

Confirm `PinyaProjectionComponent` and `TroncViewComponent` are exported from `@muixer/pinyes-render`'s public API (`libs/pinyes-render/src/index.ts`) — if not, add the export there as part of this task.

- [ ] **Step 4: Run test to verify it passes**

Run: `nx test dashboard --testFile=apps/dashboard/src/app/features/pinyes/components/import-preview-modal/import-preview-modal.component.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/app/features/pinyes/components/import-preview-modal/
git commit -m "feat(dashboard): add ImportPreviewModalComponent for scoped import preview"
```

---

### Task 8: Wire "Previsualitza" buttons into `ImportPinyaModalComponent`

**Files:**
- Modify: `apps/dashboard/src/app/features/pinyes/components/import-pinya-modal/import-pinya-modal.component.ts`
- Modify: `apps/dashboard/src/app/features/pinyes/components/import-pinya-modal/import-pinya-modal.component.html`
- Test: `apps/dashboard/src/app/features/pinyes/components/import-pinya-modal/import-pinya-modal.component.spec.ts`

**Interfaces:**
- Consumes: `ImportPreviewModalComponent` (Task 7).
- Produces: `ImportPinyaModalComponent.openPreview(scope: ImportScope): void`, `closePreview(): void`, and a `previewScope = signal<ImportScope | null>(null)` exposed for the template.

- [ ] **Step 1: Write the failing test**

```typescript
it('opens the preview modal for the chosen scope', () => {
  component.selectEntry(entryWithMixedZones());

  component.openPreview(ImportScope.TRONC);

  expect(component.previewScope()).toBe(ImportScope.TRONC);
});

it('closes the preview modal', () => {
  component.selectEntry(entryWithMixedZones());
  component.openPreview(ImportScope.PINYA);

  component.closePreview();

  expect(component.previewScope()).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `nx test dashboard --testFile=apps/dashboard/src/app/features/pinyes/components/import-pinya-modal/import-pinya-modal.component.spec.ts -t "preview"`
Expected: FAIL — `openPreview`/`previewScope`/`closePreview` don't exist

- [ ] **Step 3: Write minimal implementation**

In `import-pinya-modal.component.ts`, add:

```typescript
readonly previewScope = signal<ImportScope | null>(null);

openPreview(scope: ImportScope): void {
  if (!this.selectedEntry()) return;
  this.previewScope.set(scope);
}

closePreview(): void {
  this.previewScope.set(null);
}
```

Add `ImportPreviewModalComponent` to the component's `imports` array.

In the template, add a "Previsualitza" button to each scope row (next to "Importa"), and the preview modal wired to `selectedEntry()`:

```html
<button
  type="button"
  class="btn btn-ghost btn-xs gap-1"
  [disabled]="countForScope(row.scope) === 0"
  (click)="openPreview(row.scope)"
>
  Previsualitza
</button>
```

(placed before the existing "Importa" button inside each row's action group)

```html
@if (previewScope(); as scope) {
  <app-import-preview-modal
    [eventId]="selectedEntry()!.eventId"
    [segmentId]="selectedEntry()!.segmentId"
    [instanceId]="selectedEntry()!.instanceId"
    [scope]="scope"
    [eventTitle]="selectedEntry()!.eventTitle"
    [open]="true"
    (closed)="closePreview()"
  />
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `nx test dashboard --testFile=apps/dashboard/src/app/features/pinyes/components/import-pinya-modal/import-pinya-modal.component.spec.ts`
Expected: PASS (full file)

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/app/features/pinyes/components/import-pinya-modal/
git commit -m "feat(dashboard): wire per-scope preview into the import modal"
```

---

## Final Verification

- [ ] Run `pnpm run ci:local` (lint + test + build, all projects) and confirm it's green.
- [ ] Manually test in the dev app: open a segment's Pinyes tab, click "Importa figura", pick a past figure, preview each of Pinya/Tronc/Figura, import one, confirm the toast and canvas refresh.
- [ ] If any `.entity.ts` file changed — none did in this plan — skip `docs:map`/`docs:model`; otherwise run them and include the diff.
