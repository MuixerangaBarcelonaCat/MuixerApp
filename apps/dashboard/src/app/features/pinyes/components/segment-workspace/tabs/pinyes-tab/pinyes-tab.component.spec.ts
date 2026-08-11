import { Component, input, output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { describe, it, expect, vi } from 'vitest';
import { allLucideIconsProvider } from '../../../../../../../testing/lucide-test-provider';
import { PinyesTabComponent } from './pinyes-tab.component';
import { FigureCanvasComponent, CompositionSlotWithNodes } from '../../../figure-canvas/figure-canvas.component';
import { PersonPanelComponent } from '../../../person-panel/person-panel.component';
import { SegmentWorkspaceStateService } from '../../../../services/segment-workspace-state.service';
import { AssignmentStateService } from '../../../../services/assignment-state.service';
import { UndoRedoService } from '../../../../services/undo-redo.service';
import { EventSegmentService } from '../../../../services/event-segment.service';
import { SegmentDistributionService } from '../../../../services/segment-distribution.service';
import { NodeAssignmentService } from '../../../../services/node-assignment.service';
import { ToastService } from '../../../../../../shared/components/feedback/toast/toast.service';
import { SegmentNodeRef } from '../../../../utils/segment-assignment-render.util';
import { AssignmentDetail, AvailablePerson, BulkImportResult, InstanceNodeItem } from '../../../../models/assignment.model';
import { ImportPinyaModalComponent } from '../../../import-pinya-modal/import-pinya-modal.component';
import { InstanceDetail, SegmentDetail } from '../../../../models/segment.model';

// ── Stub children ────────────────────────────────────────────────────────────

@Component({ selector: 'app-figure-canvas', standalone: true, template: '' })
class StubFigureCanvas {
  readonly mode = input<string>('editor');
  readonly compositionSlots = input<CompositionSlotWithNodes[]>([]);
  readonly assignments = input<AssignmentDetail[]>([]);
  readonly conflictPersonIds = input<Set<string>>(new Set());
  readonly selectedSegmentNode = input<SegmentNodeRef | null>(null);
  readonly dimmedSlotIds = input<Set<string>>(new Set());
  readonly heightMode = input<string>('relative');
  readonly attendanceMap = input<Map<string, string>>(new Map());
  readonly nextPerformanceMap = input<Map<string, string | null>>(new Map());
  readonly personDetailsMap = input<Map<string, unknown>>(new Map());
  readonly highlightedNodeIds = input<Set<string>>(new Set());
  readonly gridEnabled = input<boolean>(true);
  readonly isPast = input<boolean>(false);
  readonly segmentNodeSelected = output<SegmentNodeRef | null>();
  readonly segmentNodeDoubleClicked = output<SegmentNodeRef>();
  centerOnContent = vi.fn();
  zoomIn = vi.fn();
  zoomOut = vi.fn();
}

@Component({ selector: 'app-person-panel', standalone: true, template: '' })
class StubPersonPanel {
  readonly eventId = input.required<string>();
  readonly segmentId = input.required<string>();
  readonly selectedNodeId = input<string | null>(null);
  readonly assignments = input<AssignmentDetail[]>([]);
  readonly conflictPersonIds = input<Set<string>>(new Set());
  readonly heightMode = input<string>('relative');
  readonly activeNodePositionType = input<string | null>(null);
  readonly selectedNodeZone = input<string | null>(null);
  readonly isPast = input<boolean>(false);
  readonly personSelected = output<AvailablePerson>();
  readonly assignedPersonSelected = output<{ personId: string; instanceId: string }>();
  readonly unassignRequested = output<AssignmentDetail>();
}

@Component({ selector: 'app-import-pinya-modal', standalone: true, template: '' })
class StubImportModal {
  readonly figureTemplateId = input.required<string>();
  readonly currentInstanceId = input.required<string>();
  readonly open = input<boolean>(false);
  readonly importCompleted = output<BulkImportResult>();
  readonly closed = output<void>();
}

// ── Factories ────────────────────────────────────────────────────────────────

const EVENT_ID = 'event-1';
const SEGMENT_ID = 'seg-1';
const INST_A = 'inst-a';
const INST_B = 'inst-b';

const makeNode = (id: string, zone: string, overrides: Partial<InstanceNodeItem> = {}): InstanceNodeItem => ({
  id,
  label: id,
  zone,
  positionType: null,
  x: 0,
  y: 0,
  z: 0,
  width: 30,
  height: 30,
  rotation: 0,
  color: null,
  shape: 'RECTANGLE',
  sortOrder: 0,
  climbIndicator: null,
  ringLevel: null,
  originNodeId: null,
  renglaId: null,
  renglaPosition: null,
  sourceNodeId: null,
  isSnapshotted: false,
  isAdHoc: false,
  createdById: null,
  ...overrides,
});

const makeInstance = (id: string, overrides: Partial<InstanceDetail> = {}): InstanceDetail => ({
  id,
  label: null,
  sortOrder: 0,
  snapshotted: false,
  assignedCount: 0,
  pinyaAssignedCount: 0,
  totalCordons: null,
  numberOfCordons: null,
  cordonsObertsEnabled: true,
  projectionX: null,
  projectionY: null,
  projectionScale: 1,
  figureMode: 'COMPLETA',
  figureTemplate: { id: `tpl-${id}`, name: `Figura ${id}`, hasPinya: true },
  ...overrides,
});

const makeSegment = (instances: InstanceDetail[]): SegmentDetail => ({
  id: SEGMENT_ID,
  name: 'Bloc 1',
  sortOrder: 0,
  startTime: null,
  endTime: null,
  notes: null,
  isVisible: true,
  instances,
});

let assignmentSeq = 0;
const makeAssignment = (
  instanceId: string,
  nodeId: string,
  personId = `p-${++assignmentSeq}`,
  zone = 'PINYA',
): AssignmentDetail => ({
  id: `as-${assignmentSeq}`,
  figureInstanceId: instanceId,
  node: {
    id: nodeId,
    label: nodeId,
    zone,
    z: 0,
    positionType: null,
    sortOrder: 0,
    climbIndicator: null,
    ringLevel: null,
    originNodeId: null,
    sourceNodeId: null,
  },
  person: {
    id: personId,
    alias: `Alias ${personId}`,
    name: 'Nom',
    firstSurname: 'Cognom',
    shoulderHeight: null,
    notes: null,
    notesEmoji: null,
  },
});

const makePerson = (id: string): AvailablePerson => ({
  id,
  alias: `Alias ${id}`,
  name: 'Nom',
  firstSurname: 'Cognom',
  shoulderHeight: null,
  isXicalla: false,
  notes: null,
  notesEmoji: null,
  attendanceStatus: 'ANIRE',
  nextPerformanceStatus: null,
  assignedInSegment: false,
  assignedPlacements: [],
  assignedInTronc: false,
  assignedInPinya: false,
  conflictInSegment: false,
  positions: [],
});

type MockFn = ReturnType<typeof vi.fn>;

describe('PinyesTabComponent', () => {
  let fixture: ComponentFixture<PinyesTabComponent>;
  let component: PinyesTabComponent;
  let ws: SegmentWorkspaceStateService;
  let state: AssignmentStateService;
  let undoRedo: UndoRedoService;
  let assignmentService: {
    getInstanceNodes: MockFn;
    getByInstance: MockFn;
    getAvailablePersons: MockFn;
    getLockStatus: MockFn;
    getSegmentConflicts: MockFn;
    assign: MockFn;
    unassign: MockFn;
    swap: MockFn;
    resetSnapshot: MockFn;
  };
  let toast: { success: MockFn; error: MockFn; info: MockFn };
  let refreshSpy: ReturnType<typeof vi.spyOn>;

  const setup = async (opts: {
    instances?: InstanceDetail[];
    nodesByInstance?: Record<string, InstanceNodeItem[]>;
    assignmentsByInstance?: Record<string, AssignmentDetail[]>;
    locked?: boolean;
  } = {}) => {
    const segment = makeSegment(opts.instances ?? [makeInstance(INST_A)]);
    const defaultNodes: Record<string, InstanceNodeItem[]> = opts.nodesByInstance ?? {
      [INST_A]: [makeNode('n1', 'PINYA'), makeNode('n2', 'PINYA', { x: 50 })],
    };

    assignmentService = {
      getInstanceNodes: vi.fn((instanceId: string) => of({ data: defaultNodes[instanceId] ?? [] })),
      getByInstance: vi.fn((instanceId: string) =>
        of({ data: opts.assignmentsByInstance?.[instanceId] ?? [] }),
      ),
      getAvailablePersons: vi.fn().mockReturnValue(of({ data: [] })),
      getSegmentConflicts: vi.fn().mockReturnValue(of({ data: [] })),
      getLockStatus: vi
        .fn()
        .mockReturnValue(of({ locked: opts.locked ?? false, lockDate: null, lockDays: 3 })),
      assign: vi.fn().mockReturnValue(of(makeAssignment(INST_A, 'n1'))),
      unassign: vi.fn().mockReturnValue(of(null)),
      swap: vi.fn(),
      resetSnapshot: vi.fn(),
    };
    toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [PinyesTabComponent],
      providers: [
        allLucideIconsProvider,
        SegmentWorkspaceStateService,
        AssignmentStateService,
        UndoRedoService,
        { provide: EventSegmentService, useValue: { getByEvent: vi.fn().mockReturnValue(of({ data: [segment] })) } },
        {
          provide: SegmentDistributionService,
          useValue: {
            getDistribution: vi.fn().mockReturnValue(
              of({ segment: { id: SEGMENT_ID, name: 'Bloc 1' }, items: [] }),
            ),
          },
        },
        { provide: NodeAssignmentService, useValue: assignmentService },
        { provide: ToastService, useValue: toast },
      ],
    })
      .overrideComponent(PinyesTabComponent, {
        remove: { imports: [FigureCanvasComponent, PersonPanelComponent, ImportPinyaModalComponent] },
        add: { imports: [StubFigureCanvas, StubPersonPanel, StubImportModal] },
      })
      .compileComponents();

    ws = TestBed.inject(SegmentWorkspaceStateService);
    state = TestBed.inject(AssignmentStateService);
    undoRedo = TestBed.inject(UndoRedoService);
    ws.load(EVENT_ID, SEGMENT_ID);
    refreshSpy = vi.spyOn(ws, 'refresh');

    fixture = TestBed.createComponent(PinyesTabComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  const canvasStub = (): StubFigureCanvas =>
    fixture.debugElement.query((n) => n.componentInstance instanceof StubFigureCanvas)
      ?.componentInstance as StubFigureCanvas;

  describe('rendering', () => {
    it('renders the canvas in segment-assignment mode with the workspace slots', async () => {
      await setup();
      const stub = canvasStub();

      expect(stub).toBeTruthy();
      expect(stub.mode()).toBe('segment-assignment');
      expect(stub.compositionSlots().map((s) => s.slotId)).toEqual([INST_A]);
    });

    it('centers the viewport on the content once after the slots load', async () => {
      await setup();
      fixture.detectChanges();
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(canvasStub().centerOnContent).toHaveBeenCalledTimes(1);
    });

    it('refreshes the workspace on init so figures edited in other tabs show up-to-date', async () => {
      await setup();

      expect(refreshSpy).toHaveBeenCalled();
    });

    it('does not center the viewport until every figure has finished loading its nodes (avoids freezing on a partial layout)', async () => {
      const segment = makeSegment([makeInstance(INST_A), makeInstance('inst-b')]);
      const subjectA = new Subject<{ data: InstanceNodeItem[] }>();
      const subjectB = new Subject<{ data: InstanceNodeItem[] }>();
      assignmentService = {
        getInstanceNodes: vi.fn((instanceId: string) => (instanceId === INST_A ? subjectA : subjectB)),
        getByInstance: vi.fn(() => of({ data: [] })),
        getAvailablePersons: vi.fn().mockReturnValue(of({ data: [] })),
        getSegmentConflicts: vi.fn().mockReturnValue(of({ data: [] })),
        getLockStatus: vi.fn().mockReturnValue(of({ locked: false, lockDate: null, lockDays: 3 })),
        assign: vi.fn(),
        unassign: vi.fn(),
        swap: vi.fn(),
        resetSnapshot: vi.fn(),
      };
      toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

      await TestBed.configureTestingModule({
        imports: [PinyesTabComponent],
        providers: [
          allLucideIconsProvider,
          SegmentWorkspaceStateService,
          AssignmentStateService,
          UndoRedoService,
          { provide: EventSegmentService, useValue: { getByEvent: vi.fn().mockReturnValue(of({ data: [segment] })) } },
          {
            provide: SegmentDistributionService,
            useValue: { getDistribution: vi.fn().mockReturnValue(of({ segment: { id: SEGMENT_ID, name: 'Bloc 1' }, items: [] })) },
          },
          { provide: NodeAssignmentService, useValue: assignmentService },
          { provide: ToastService, useValue: toast },
        ],
      })
        .overrideComponent(PinyesTabComponent, {
          remove: { imports: [FigureCanvasComponent, PersonPanelComponent, ImportPinyaModalComponent] },
          add: { imports: [StubFigureCanvas, StubPersonPanel, StubImportModal] },
        })
        .compileComponents();

      vi.useFakeTimers();

      ws = TestBed.inject(SegmentWorkspaceStateService);
      ws.load(EVENT_ID, SEGMENT_ID);
      fixture = TestBed.createComponent(PinyesTabComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      // Only figure A has loaded so far — pinyaSlots() is already non-empty,
      // but centering now would freeze the viewport on a 1-figure layout.
      subjectA.next({ data: [makeNode('n1', 'PINYA')] });
      fixture.detectChanges();
      vi.runAllTimers();
      expect(canvasStub().centerOnContent).not.toHaveBeenCalled();

      subjectB.next({ data: [makeNode('n2', 'PINYA')] });
      fixture.detectChanges();
      vi.runAllTimers();
      expect(canvasStub().centerOnContent).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });
  });

  describe('node selection', () => {
    it('selecting a node sets the workspace instance and the shared node selection', async () => {
      await setup();

      component.onSegmentNodeSelected({ slotId: INST_A, nodeId: 'n1' });

      expect(ws.selectedInstanceId()).toBe(INST_A);
      expect(state.selectedNodeId()).toBe('n1');
      expect(component.selectedRef()).toEqual({ slotId: INST_A, nodeId: 'n1' });
    });

    it('selecting null clears the selection', async () => {
      await setup();
      component.onSegmentNodeSelected({ slotId: INST_A, nodeId: 'n1' });

      component.onSegmentNodeSelected(null);

      expect(component.selectedRef()).toBeNull();
      expect(state.selectedNodeId()).toBeNull();
    });

    it('ignores node selection when the event is locked', async () => {
      await setup({ locked: true });

      component.onSegmentNodeSelected({ slotId: INST_A, nodeId: 'n1' });

      expect(component.selectedRef()).toBeNull();
    });
  });

  describe('assignment', () => {
    it('assigns the selected person when a node is clicked', async () => {
      await setup();
      component.onPersonSelected(makePerson('p-9'));
      expect(state.selectedPersonId()).toBe('p-9');

      component.onSegmentNodeSelected({ slotId: INST_A, nodeId: 'n1' });

      expect(assignmentService.assign).toHaveBeenCalledWith(INST_A, { nodeId: 'n1', personId: 'p-9' });
    });

    it('assigns to the node instance when a person is selected with a node selected', async () => {
      await setup();
      component.onSegmentNodeSelected({ slotId: INST_A, nodeId: 'n1' });

      component.onPersonSelected(makePerson('p-9'));

      expect(assignmentService.assign).toHaveBeenCalledWith(INST_A, { nodeId: 'n1', personId: 'p-9' });
    });

    it('adds an optimistic assignment that is replaced by the created one', async () => {
      await setup();
      const response$ = new Subject<AssignmentDetail>();
      assignmentService.assign.mockReturnValue(response$);
      component.onSegmentNodeSelected({ slotId: INST_A, nodeId: 'n1' });

      component.onPersonSelected(makePerson('p-9'));

      const optimistic = state.assignments().find((a) => a.node.id === 'n1');
      expect(optimistic?.id.startsWith('temp-')).toBe(true);

      const created = makeAssignment(INST_A, 'n1', 'p-9');
      // After the assign succeeds, the server would return the created assignment too.
      assignmentService.getByInstance.mockReturnValue(of({ data: [created] }));
      response$.next(created);
      response$.complete();

      expect(state.assignments().some((a) => a.id === created.id)).toBe(true);
      expect(state.assignments().some((a) => a.id.startsWith('temp-'))).toBe(false);
    });

    it('refreshes the instance nodes after assigning to a non-snapshotted instance', async () => {
      await setup();
      component.onSegmentNodeSelected({ slotId: INST_A, nodeId: 'n1' });
      assignmentService.getInstanceNodes.mockClear();

      component.onPersonSelected(makePerson('p-9'));

      expect(assignmentService.getInstanceNodes).toHaveBeenCalledWith(INST_A);
    });

    it('reverts the optimistic assignment and shows a toast when assign fails', async () => {
      await setup();
      assignmentService.assign.mockReturnValue(throwError(() => ({ status: 500 })));
      component.onSegmentNodeSelected({ slotId: INST_A, nodeId: 'n1' });

      component.onPersonSelected(makePerson('p-9'));

      expect(state.assignments()).toHaveLength(0);
      expect(toast.error).toHaveBeenCalled();
      expect(component.selectedRef()).toEqual({ slotId: INST_A, nodeId: 'n1' });
    });

    it('advances the selection to the next empty node of the same figure after assigning', async () => {
      await setup({
        instances: [makeInstance(INST_A), makeInstance(INST_B)],
        nodesByInstance: {
          [INST_A]: [makeNode('n1', 'PINYA', { sortOrder: 0 }), makeNode('n2', 'PINYA', { sortOrder: 1, x: 50 })],
          [INST_B]: [makeNode('m1', 'PINYA')],
        },
      });
      const created = makeAssignment(INST_A, 'n1', 'p-9');
      assignmentService.assign.mockReturnValue(of(created));
      component.onSegmentNodeSelected({ slotId: INST_A, nodeId: 'n1' });

      component.onPersonSelected(makePerson('p-9'));

      expect(component.selectedRef()).toEqual({ slotId: INST_A, nodeId: 'n2' });
    });
  });

  describe('click-click no longer moves or swaps', () => {
    it('selecting an assigned node then clicking an empty node does not move the person', async () => {
      const existing = makeAssignment(INST_A, 'n1', 'p-1');
      await setup({ assignmentsByInstance: { [INST_A]: [existing] } });

      component.onSegmentNodeSelected({ slotId: INST_A, nodeId: 'n1' });
      component.onSegmentNodeSelected({ slotId: INST_A, nodeId: 'n2' });

      expect(assignmentService.unassign).not.toHaveBeenCalled();
      expect(component.selectedRef()).toEqual({ slotId: INST_A, nodeId: 'n2' });
    });

    it('selecting two assigned nodes in sequence does not swap them', async () => {
      const a1 = makeAssignment(INST_A, 'n1', 'p-1');
      const a2 = makeAssignment(INST_A, 'n2', 'p-2');
      await setup({ assignmentsByInstance: { [INST_A]: [a1, a2] } });

      component.onSegmentNodeSelected({ slotId: INST_A, nodeId: 'n1' });
      component.onSegmentNodeSelected({ slotId: INST_A, nodeId: 'n2' });

      expect(assignmentService.swap).not.toHaveBeenCalled();
      expect(component.selectedRef()).toEqual({ slotId: INST_A, nodeId: 'n2' });
    });
  });

  describe('onNodeDropped (drag-and-drop)', () => {
    it('moves the person when dropped on an empty node', async () => {
      const existing = makeAssignment(INST_A, 'n1', 'p-1');
      await setup({ assignmentsByInstance: { [INST_A]: [existing] } });

      component.onNodeDropped({ slotId: INST_A, nodeId: 'n1' }, { slotId: INST_A, nodeId: 'n2' });

      expect(assignmentService.unassign).toHaveBeenCalledWith(INST_A, existing.id);
      expect(assignmentService.assign).toHaveBeenCalledWith(INST_A, { nodeId: 'n2', personId: 'p-1' });
    });

    it('swaps two assigned nodes of the same instance', async () => {
      const a1 = makeAssignment(INST_A, 'n1', 'p-1');
      const a2 = makeAssignment(INST_A, 'n2', 'p-2');
      await setup({ assignmentsByInstance: { [INST_A]: [a1, a2] } });
      assignmentService.swap.mockReturnValue(of({ a: a1, b: a2 }));

      component.onNodeDropped({ slotId: INST_A, nodeId: 'n1' }, { slotId: INST_A, nodeId: 'n2' });

      expect(assignmentService.swap).toHaveBeenCalledWith(INST_A, {
        assignmentIdA: a1.id,
        assignmentIdB: a2.id,
      });
    });

    it('swaps two assigned nodes of different figures by unassigning both and reassigning crossed', async () => {
      const a1 = makeAssignment(INST_A, 'n1', 'p-1');
      const a2 = makeAssignment(INST_B, 'm1', 'p-2');
      await setup({
        instances: [makeInstance(INST_A), makeInstance(INST_B)],
        nodesByInstance: {
          [INST_A]: [makeNode('n1', 'PINYA')],
          [INST_B]: [makeNode('m1', 'PINYA')],
        },
        assignmentsByInstance: { [INST_A]: [a1], [INST_B]: [a2] },
      });
      assignmentService.assign.mockImplementation((instanceId: string, payload: { nodeId: string; personId: string }) =>
        of(makeAssignment(instanceId, payload.nodeId, payload.personId)),
      );

      component.onNodeDropped({ slotId: INST_A, nodeId: 'n1' }, { slotId: INST_B, nodeId: 'm1' });

      expect(assignmentService.unassign).toHaveBeenCalledWith(INST_A, a1.id);
      expect(assignmentService.unassign).toHaveBeenCalledWith(INST_B, a2.id);
      expect(assignmentService.assign).toHaveBeenCalledWith(INST_A, { nodeId: 'n1', personId: 'p-2' });
      expect(assignmentService.assign).toHaveBeenCalledWith(INST_B, { nodeId: 'm1', personId: 'p-1' });
    });

    it('reverts the optimistic swap when the cross-figure swap fails', async () => {
      const a1 = makeAssignment(INST_A, 'n1', 'p-1');
      const a2 = makeAssignment(INST_B, 'm1', 'p-2');
      await setup({
        instances: [makeInstance(INST_A), makeInstance(INST_B)],
        nodesByInstance: {
          [INST_A]: [makeNode('n1', 'PINYA')],
          [INST_B]: [makeNode('m1', 'PINYA')],
        },
        assignmentsByInstance: { [INST_A]: [a1], [INST_B]: [a2] },
      });
      assignmentService.unassign.mockReturnValue(throwError(() => ({ status: 500 })));

      component.onNodeDropped({ slotId: INST_A, nodeId: 'n1' }, { slotId: INST_B, nodeId: 'm1' });

      const persons = state
        .assignments()
        .map((a) => [a.figureInstanceId, a.person.id])
        .sort();
      expect(persons).toEqual([
        [INST_A, 'p-1'],
        [INST_B, 'p-2'],
      ]);
      expect(toast.error).toHaveBeenCalled();
    });

    it('does nothing when dropped on itself', async () => {
      const existing = makeAssignment(INST_A, 'n1', 'p-1');
      await setup({ assignmentsByInstance: { [INST_A]: [existing] } });

      component.onNodeDropped({ slotId: INST_A, nodeId: 'n1' }, { slotId: INST_A, nodeId: 'n1' });

      expect(assignmentService.unassign).not.toHaveBeenCalled();
      expect(assignmentService.swap).not.toHaveBeenCalled();
    });

    it('does nothing when the source node has no assignment', async () => {
      await setup();

      component.onNodeDropped({ slotId: INST_A, nodeId: 'n1' }, { slotId: INST_A, nodeId: 'n2' });

      expect(assignmentService.unassign).not.toHaveBeenCalled();
      expect(assignmentService.assign).not.toHaveBeenCalled();
    });

    it('ignores drops when locked', async () => {
      const existing = makeAssignment(INST_A, 'n1', 'p-1');
      await setup({ locked: true, assignmentsByInstance: { [INST_A]: [existing] } });

      component.onNodeDropped({ slotId: INST_A, nodeId: 'n1' }, { slotId: INST_A, nodeId: 'n2' });

      expect(assignmentService.unassign).not.toHaveBeenCalled();
    });
  });

  describe('undo/redo (FE-BUG-7): move and swap are fully reversible', () => {
    let dynSeq = 0;
    const dynamicAssignment = (instanceId: string, nodeId: string, personId: string): AssignmentDetail => ({
      id: `dyn-${++dynSeq}`,
      figureInstanceId: instanceId,
      node: {
        id: nodeId,
        label: nodeId,
        zone: 'PINYA',
        z: 0,
        positionType: null,
        sortOrder: 0,
        climbIndicator: null,
        ringLevel: null,
        originNodeId: null,
        sourceNodeId: null,
      },
      person: {
        id: personId,
        alias: `Alias ${personId}`,
        name: 'Nom',
        firstSurname: 'Cognom',
        shoulderHeight: null,
        notes: null,
        notesEmoji: null,
      },
    });

    it('move: undo restores the person to the original node, redo re-applies the move', async () => {
      const existing = makeAssignment(INST_A, 'n1', 'p-1');
      await setup({
        instances: [makeInstance(INST_A, { snapshotted: true })],
        assignmentsByInstance: { [INST_A]: [existing] },
      });
      assignmentService.assign.mockImplementation(
        (instanceId: string, payload: { nodeId: string; personId: string }) =>
          of(dynamicAssignment(instanceId, payload.nodeId, payload.personId)),
      );

      component.onNodeDropped({ slotId: INST_A, nodeId: 'n1' }, { slotId: INST_A, nodeId: 'n2' });
      expect(state.assignments().find((a) => a.node.id === 'n2')?.person.id).toBe('p-1');
      expect(state.assignments().find((a) => a.node.id === 'n1')).toBeUndefined();

      undoRedo.undo().subscribe();
      expect(state.assignments().find((a) => a.node.id === 'n1')?.person.id).toBe('p-1');
      expect(state.assignments().find((a) => a.node.id === 'n2')).toBeUndefined();

      undoRedo.redo().subscribe();
      expect(state.assignments().find((a) => a.node.id === 'n2')?.person.id).toBe('p-1');
      expect(state.assignments().find((a) => a.node.id === 'n1')).toBeUndefined();
    });

    it('same-figure swap: undo swaps back, redo re-swaps', async () => {
      const a1 = { ...makeAssignment(INST_A, 'n1', 'p-1'), id: 'assign-a1' };
      const a2 = { ...makeAssignment(INST_A, 'n2', 'p-2'), id: 'assign-a2' };
      await setup({ assignmentsByInstance: { [INST_A]: [a1, a2] } });

      let occupant1 = a1.person;
      let occupant2 = a2.person;
      assignmentService.swap.mockImplementation(() => {
        [occupant1, occupant2] = [occupant2, occupant1];
        return of({ a: { ...a1, person: occupant1 }, b: { ...a2, person: occupant2 } });
      });

      component.onNodeDropped({ slotId: INST_A, nodeId: 'n1' }, { slotId: INST_A, nodeId: 'n2' });
      expect(state.assignments().find((a) => a.node.id === 'n1')?.person.id).toBe('p-2');
      expect(state.assignments().find((a) => a.node.id === 'n2')?.person.id).toBe('p-1');

      undoRedo.undo().subscribe();
      expect(state.assignments().find((a) => a.node.id === 'n1')?.person.id).toBe('p-1');
      expect(state.assignments().find((a) => a.node.id === 'n2')?.person.id).toBe('p-2');

      undoRedo.redo().subscribe();
      expect(state.assignments().find((a) => a.node.id === 'n1')?.person.id).toBe('p-2');
      expect(state.assignments().find((a) => a.node.id === 'n2')?.person.id).toBe('p-1');
    });

    it('cross-figure swap: undo restores original persons, redo re-swaps', async () => {
      const a1 = { ...makeAssignment(INST_A, 'n1', 'p-1'), id: 'assign-a1' };
      const a2 = { ...makeAssignment(INST_B, 'm1', 'p-2'), id: 'assign-a2' };
      await setup({
        instances: [makeInstance(INST_A, { snapshotted: true }), makeInstance(INST_B, { snapshotted: true })],
        nodesByInstance: {
          [INST_A]: [makeNode('n1', 'PINYA')],
          [INST_B]: [makeNode('m1', 'PINYA')],
        },
        assignmentsByInstance: { [INST_A]: [a1], [INST_B]: [a2] },
      });
      assignmentService.assign.mockImplementation(
        (instanceId: string, payload: { nodeId: string; personId: string }) =>
          of(dynamicAssignment(instanceId, payload.nodeId, payload.personId)),
      );

      component.onNodeDropped({ slotId: INST_A, nodeId: 'n1' }, { slotId: INST_B, nodeId: 'm1' });
      expect(state.assignments().find((a) => a.figureInstanceId === INST_A)?.person.id).toBe('p-2');
      expect(state.assignments().find((a) => a.figureInstanceId === INST_B)?.person.id).toBe('p-1');

      undoRedo.undo().subscribe();
      expect(state.assignments().find((a) => a.figureInstanceId === INST_A)?.person.id).toBe('p-1');
      expect(state.assignments().find((a) => a.figureInstanceId === INST_B)?.person.id).toBe('p-2');

      undoRedo.redo().subscribe();
      expect(state.assignments().find((a) => a.figureInstanceId === INST_A)?.person.id).toBe('p-2');
      expect(state.assignments().find((a) => a.figureInstanceId === INST_B)?.person.id).toBe('p-1');
    });

    it('reassign dialog confirm: undo restores the person to the original node', async () => {
      const existing = makeAssignment(INST_A, 'n1', 'p-1');
      await setup({
        instances: [makeInstance(INST_A, { snapshotted: true }), makeInstance(INST_B, { snapshotted: true })],
        nodesByInstance: {
          [INST_A]: [makeNode('n1', 'PINYA')],
          [INST_B]: [makeNode('m1', 'PINYA')],
        },
        assignmentsByInstance: { [INST_A]: [existing] },
      });
      assignmentService.assign.mockImplementation(
        (instanceId: string, payload: { nodeId: string; personId: string }) =>
          of(dynamicAssignment(instanceId, payload.nodeId, payload.personId)),
      );
      component.onSegmentNodeSelected({ slotId: INST_B, nodeId: 'm1' });
      component.onAssignedPersonSelected({ personId: 'p-1', instanceId: INST_A });

      component.onReassignDialogConfirm();
      expect(state.assignments().find((a) => a.figureInstanceId === INST_B)?.person.id).toBe('p-1');
      expect(state.assignments().find((a) => a.figureInstanceId === INST_A)).toBeUndefined();

      undoRedo.undo().subscribe();
      expect(state.assignments().find((a) => a.figureInstanceId === INST_A)?.person.id).toBe('p-1');
      expect(state.assignments().find((a) => a.figureInstanceId === INST_B)).toBeUndefined();
    });

    it('plain assign: undo removes it from state, redo re-adds it', async () => {
      await setup({ instances: [makeInstance(INST_A, { snapshotted: true })] });
      assignmentService.assign.mockImplementation(
        (instanceId: string, payload: { nodeId: string; personId: string }) =>
          of(dynamicAssignment(instanceId, payload.nodeId, payload.personId)),
      );
      component.onSegmentNodeSelected({ slotId: INST_A, nodeId: 'n1' });
      component.onPersonSelected(makePerson('p-9'));
      expect(state.assignments().some((a) => a.node.id === 'n1')).toBe(true);

      undoRedo.undo().subscribe();
      expect(state.assignments().some((a) => a.node.id === 'n1')).toBe(false);

      undoRedo.redo().subscribe();
      expect(state.assignments().some((a) => a.node.id === 'n1')).toBe(true);
    });

    it('plain unassign: undo restores it in state, redo removes it again', async () => {
      const existing = makeAssignment(INST_A, 'n1', 'p-1');
      await setup({ assignmentsByInstance: { [INST_A]: [existing] } });
      assignmentService.assign.mockImplementation(
        (instanceId: string, payload: { nodeId: string; personId: string }) =>
          of(dynamicAssignment(instanceId, payload.nodeId, payload.personId)),
      );

      component.onUnassign(existing);
      expect(state.assignments()).toHaveLength(0);

      undoRedo.undo().subscribe();
      expect(state.assignments().find((a) => a.node.id === 'n1')?.person.id).toBe('p-1');

      undoRedo.redo().subscribe();
      expect(state.assignments()).toHaveLength(0);
    });
  });

  describe('undo/redo keyboard shortcuts and guards', () => {
    it('Ctrl+Z triggers performUndo', async () => {
      await setup();
      const spy = vi.spyOn(component, 'performUndo');

      component.onKeyDown(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }));

      expect(spy).toHaveBeenCalled();
    });

    it('Ctrl+Shift+Z triggers performRedo', async () => {
      await setup();
      const spy = vi.spyOn(component, 'performRedo');

      component.onKeyDown(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true }));

      expect(spy).toHaveBeenCalled();
    });

    it('performUndo does nothing when there is no history', async () => {
      await setup();
      const undoSpy = vi.spyOn(undoRedo, 'undo');

      component.performUndo();

      expect(undoSpy).not.toHaveBeenCalled();
    });

    it('performUndo does nothing when the workspace is locked', async () => {
      const existing = makeAssignment(INST_A, 'n1', 'p-1');
      await setup({ locked: true, assignmentsByInstance: { [INST_A]: [existing] } });
      const undoSpy = vi.spyOn(undoRedo, 'undo');

      component.performUndo();

      expect(undoSpy).not.toHaveBeenCalled();
    });
  });

  describe('zoom keyboard shortcuts', () => {
    it('Ctrl+= zooms in', async () => {
      await setup();

      component.onKeyDown(new KeyboardEvent('keydown', { key: '=', ctrlKey: true }));

      expect(canvasStub().zoomIn).toHaveBeenCalled();
    });

    it('Ctrl+- zooms out', async () => {
      await setup();

      component.onKeyDown(new KeyboardEvent('keydown', { key: '-', ctrlKey: true }));

      expect(canvasStub().zoomOut).toHaveBeenCalled();
    });
  });

  describe('import pinya', () => {
    it('opens the import modal directly when the segment has a single figure', async () => {
      await setup();

      component.openImport();

      expect(component.importTarget()).toEqual({
        instanceId: INST_A,
        figureTemplateId: `tpl-${INST_A}`,
      });
      expect(component.importMenuOpen()).toBe(false);
    });

    it('opens a figure menu first when the segment has several figures', async () => {
      await setup({
        instances: [makeInstance(INST_A), makeInstance(INST_B)],
        nodesByInstance: {
          [INST_A]: [makeNode('n1', 'PINYA')],
          [INST_B]: [makeNode('m1', 'PINYA')],
        },
      });

      component.openImport();
      expect(component.importMenuOpen()).toBe(true);
      expect(component.importTarget()).toBeNull();

      component.chooseImportFigure(INST_B);
      expect(component.importTarget()).toEqual({
        instanceId: INST_B,
        figureTemplateId: `tpl-${INST_B}`,
      });
      expect(component.importMenuOpen()).toBe(false);
    });

    it('refreshes the target instance and closes the modal when an import completes', async () => {
      await setup();
      component.openImport();
      assignmentService.getInstanceNodes.mockClear();

      component.onImportCompleted({ created: [], conflicts: [], clonedAdHocNodes: 0 });

      expect(assignmentService.getInstanceNodes).toHaveBeenCalledWith(INST_A);
      expect(toast.success).toHaveBeenCalled();
      expect(component.importTarget()).toBeNull();
    });
  });

  describe('reset snapshot', () => {
    it('opens the reset confirmation directly with a single snapshotted figure', async () => {
      await setup({ instances: [makeInstance(INST_A, { snapshotted: true })] });

      component.openReset();

      expect(component.resetTarget()).toBe(INST_A);
    });

    it('opens a figure menu first when several figures are snapshotted', async () => {
      await setup({
        instances: [
          makeInstance(INST_A, { snapshotted: true }),
          makeInstance(INST_B, { snapshotted: true }),
        ],
        nodesByInstance: {
          [INST_A]: [makeNode('n1', 'PINYA')],
          [INST_B]: [makeNode('m1', 'PINYA')],
        },
      });

      component.openReset();
      expect(component.resetMenuOpen()).toBe(true);
      expect(component.resetTarget()).toBeNull();

      component.chooseResetFigure(INST_B);
      expect(component.resetTarget()).toBe(INST_B);
    });

    it('resets the figure and clears its assignments on confirm', async () => {
      const a1 = makeAssignment(INST_A, 'n1', 'p-1');
      await setup({
        instances: [makeInstance(INST_A, { snapshotted: true })],
        assignmentsByInstance: { [INST_A]: [a1] },
      });
      assignmentService.resetSnapshot.mockReturnValue(
        of({ removedAssignments: 1, deletedAdHocCount: 0 }),
      );
      // After the reset, the server no longer returns any assignment for the instance.
      assignmentService.getByInstance.mockReturnValue(of({ data: [] }));

      component.openReset();
      component.confirmReset();

      expect(assignmentService.resetSnapshot).toHaveBeenCalledWith(INST_A);
      expect(state.assignments()).toHaveLength(0);
      expect(toast.success).toHaveBeenCalled();
      expect(component.resetTarget()).toBeNull();
    });
  });

  describe('unassignment', () => {
    it('unassigns optimistically and calls the service', async () => {
      const existing = makeAssignment(INST_A, 'n1', 'p-1');
      await setup({ assignmentsByInstance: { [INST_A]: [existing] } });
      const response$ = new Subject<void>();
      assignmentService.unassign.mockReturnValue(response$);

      component.onUnassign(existing);

      expect(state.assignments()).toHaveLength(0);
      expect(assignmentService.unassign).toHaveBeenCalledWith(INST_A, existing.id);
    });

    it('unassigns the selected assigned node with the Delete key', async () => {
      const existing = makeAssignment(INST_A, 'n1', 'p-1');
      await setup({ assignmentsByInstance: { [INST_A]: [existing] } });
      component.onSegmentNodeSelected({ slotId: INST_A, nodeId: 'n1' });
      // Selecting an assigned node keeps it selected
      expect(component.selectedRef()).toEqual({ slotId: INST_A, nodeId: 'n1' });

      component.onKeyDown(new KeyboardEvent('keydown', { key: 'Delete' }));

      expect(assignmentService.unassign).toHaveBeenCalledWith(INST_A, existing.id);
    });
  });

  describe('keyboard', () => {
    it('Escape clears selection', async () => {
      await setup();
      component.onSegmentNodeSelected({ slotId: INST_A, nodeId: 'n1' });

      component.onKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(component.selectedRef()).toBeNull();
      expect(state.selectedPersonId()).toBeNull();
    });
  });

  describe('reassign dialog', () => {
    it('opens the dialog when an already-assigned person is picked with a target node selected', async () => {
      const existing = makeAssignment(INST_A, 'n1', 'p-1');
      await setup({
        instances: [makeInstance(INST_A), makeInstance(INST_B)],
        nodesByInstance: {
          [INST_A]: [makeNode('n1', 'PINYA')],
          [INST_B]: [makeNode('m1', 'PINYA')],
        },
        assignmentsByInstance: { [INST_A]: [existing] },
      });
      component.onSegmentNodeSelected({ slotId: INST_B, nodeId: 'm1' });

      component.onAssignedPersonSelected({ personId: 'p-1', instanceId: INST_A });

      expect(component.reassignDialog()).toMatchObject({
        personId: 'p-1',
        targetInstanceId: INST_B,
        targetNodeId: 'm1',
        // figureName is the figure the person is CURRENTLY in (INST_A), not the target (INST_B).
        figureName: 'Figura inst-a',
      });
    });

    it('confirming the dialog unassigns the old assignment and assigns to the target', async () => {
      const existing = makeAssignment(INST_A, 'n1', 'p-1');
      await setup({
        instances: [makeInstance(INST_A), makeInstance(INST_B)],
        nodesByInstance: {
          [INST_A]: [makeNode('n1', 'PINYA')],
          [INST_B]: [makeNode('m1', 'PINYA')],
        },
        assignmentsByInstance: { [INST_A]: [existing] },
      });
      component.onSegmentNodeSelected({ slotId: INST_B, nodeId: 'm1' });
      component.onAssignedPersonSelected({ personId: 'p-1', instanceId: INST_A });

      component.onReassignDialogConfirm();

      expect(assignmentService.unassign).toHaveBeenCalledWith(INST_A, existing.id);
      expect(assignmentService.assign).toHaveBeenCalledWith(INST_B, { nodeId: 'm1', personId: 'p-1' });
    });
  });

  describe('cross-tab "Anar-hi" navigation', () => {
    it('emits crossTabSelect instead of selecting locally when the person is on a TRONC node', async () => {
      const existing = makeAssignment(INST_A, 't1', 'p-1', 'TRONC');
      await setup({ assignmentsByInstance: { [INST_A]: [existing] } });
      const emitSpy = vi.fn();
      component.crossTabSelect.subscribe(emitSpy);

      component.onAssignedPersonSelected({ personId: 'p-1', instanceId: INST_A });

      expect(emitSpy).toHaveBeenCalledWith({ tab: 'troncs', ref: { slotId: INST_A, nodeId: 't1' } });
      expect(component.selectedRef()).toBeNull();
    });

    it('selects locally (no tab switch) when the person is on a BASE node', async () => {
      const existing = makeAssignment(INST_A, 'b1', 'p-1', 'BASE');
      await setup({ assignmentsByInstance: { [INST_A]: [existing] } });
      const emitSpy = vi.fn();
      component.crossTabSelect.subscribe(emitSpy);

      component.onAssignedPersonSelected({ personId: 'p-1', instanceId: INST_A });

      expect(emitSpy).not.toHaveBeenCalled();
      expect(component.selectedRef()).toEqual({ slotId: INST_A, nodeId: 'b1' });
    });

    it('"Anar-hi" on the reassign dialog also switches tabs for a TRONC assignment', async () => {
      const existing = makeAssignment(INST_A, 't1', 'p-1', 'TRONC');
      await setup({
        instances: [makeInstance(INST_A), makeInstance(INST_B)],
        nodesByInstance: {
          [INST_A]: [makeNode('t1', 'TRONC')],
          [INST_B]: [makeNode('m1', 'PINYA')],
        },
        assignmentsByInstance: { [INST_A]: [existing] },
      });
      component.onSegmentNodeSelected({ slotId: INST_B, nodeId: 'm1' });
      component.onAssignedPersonSelected({ personId: 'p-1', instanceId: INST_A });
      const emitSpy = vi.fn();
      component.crossTabSelect.subscribe(emitSpy);

      component.onReassignDialogView();

      expect(emitSpy).toHaveBeenCalledWith({ tab: 'troncs', ref: { slotId: INST_A, nodeId: 't1' } });
    });

    it('consumes a pending cross-tab selection on init and selects the requested node', async () => {
      await setup({ assignmentsByInstance: { [INST_A]: [] } });
      ws.pendingSelection.set({ slotId: INST_A, nodeId: 'n1' });

      component.ngOnInit();

      expect(component.selectedRef()).toEqual({ slotId: INST_A, nodeId: 'n1' });
      expect(ws.pendingSelection()).toBeNull();
    });
  });

  describe('mobile guard (WI-13, P-M2/GE-H3)', () => {
    it('renders the canvas + person panel by default (no matchMedia)', async () => {
      await setup();
      expect(canvasStub()).toBeTruthy();
      expect(fixture.nativeElement.textContent).not.toContain('Encara no optimitzat per a mòbil');
    });

    describe('below sm (< 640px)', () => {
      const originalMatchMedia = window.matchMedia;

      beforeEach(() => {
        window.matchMedia = vi.fn().mockImplementation((query: string) => ({
          matches: true,
          media: query,
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })) as unknown as typeof window.matchMedia;
      });

      afterEach(() => {
        window.matchMedia = originalMatchMedia;
      });

      it('shows a "not optimized for mobile" message instead of the unusable canvas', async () => {
        await setup();
        expect(fixture.nativeElement.textContent).toContain('Encara no optimitzat per a mòbil');
        expect(fixture.nativeElement.querySelector('app-figure-canvas')).toBeFalsy();
        expect(fixture.nativeElement.querySelector('app-person-panel')).toBeFalsy();
      });
    });
  });
});
