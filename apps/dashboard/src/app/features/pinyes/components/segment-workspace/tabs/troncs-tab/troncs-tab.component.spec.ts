import { TroncViewComponent, TroncNodeItem, AssignmentDetail, AvailablePerson, InstanceNodeItem, InstanceDetail, SegmentDetail } from '@muixer/pinyes-render';
import { Component, input, output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { describe, it, expect, vi } from 'vitest';
import { allLucideIconsProvider } from '../../../../../../../testing/lucide-test-provider';
import { TroncsTabComponent } from './troncs-tab.component';
import { PersonPanelComponent } from '../../../person-panel/person-panel.component';
import { SegmentWorkspaceStateService } from '../../../../services/segment-workspace-state.service';
import { AssignmentStateService } from '../../../../services/assignment-state.service';
import { UndoRedoService } from '../../../../services/undo-redo.service';
import { EventSegmentService } from '../../../../services/event-segment.service';
import { SegmentDistributionService } from '../../../../services/segment-distribution.service';
import { NodeAssignmentService } from '../../../../services/node-assignment.service';
import { ToastService } from '../../../../../../shared/components/feedback/toast/toast.service';

// ── Stub children ────────────────────────────────────────────────────────────

@Component({ selector: 'app-tronc-view', standalone: true, template: '' })
class StubTroncView {
  readonly instanceId = input<string>('');
  readonly troncNodes = input<TroncNodeItem[]>([]);
  readonly baseNodes = input<TroncNodeItem[]>([]);
  readonly directionNodes = input<TroncNodeItem[]>([]);
  readonly assignments = input<AssignmentDetail[]>([]);
  readonly conflictPersonIds = input<Set<string>>(new Set());
  readonly selectedNodeId = input<string | null>(null);
  readonly mode = input<string>('assignment');
  readonly heightMode = input<string>('relative');
  readonly highlightedNodeIds = input<Set<string>>(new Set());
  readonly attendanceMap = input<Map<string, string>>(new Map());
  readonly isPast = input<boolean>(false);
  readonly personDetailsMap = input<Map<string, unknown>>(new Map());
  readonly nodeSelected = output<string | null>();
  readonly nodeClicked = output<{ nodeId: string; event: MouseEvent }>();
  readonly nodeUnassigned = output<string>();
  readonly nodeDropped = output<{
    sourceInstanceId: string;
    sourceNodeId: string;
    targetInstanceId: string;
    targetNodeId: string;
  }>();
  readonly directionAdded = output<{ zone: string }>();
  readonly directionRemoved = output<string>();
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
  z: 1,
  width: 1,
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
  isPublished: true,
  instances,
});

let assignmentSeq = 0;
const makeAssignment = (
  instanceId: string,
  nodeId: string,
  personId = `p-${++assignmentSeq}`,
  zone = 'TRONC',
): AssignmentDetail => ({
  id: `as-${assignmentSeq}`,
  figureInstanceId: instanceId,
  node: {
    id: nodeId,
    label: nodeId,
    zone,
    z: 1,
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
  assignedPlacements: [],
  assignedInTronc: false,
  assignedInPinya: false,
  conflictInSegment: false,
  positions: [],
});

type MockFn = ReturnType<typeof vi.fn>;

describe('TroncsTabComponent', () => {
  let fixture: ComponentFixture<TroncsTabComponent>;
  let component: TroncsTabComponent;
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
    createAdHocNode: MockFn;
    deleteAdHocNode: MockFn;
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
      [INST_A]: [makeNode('n1', 'TRONC', { z: 1 }), makeNode('n2', 'TRONC', { z: 1, x: 1 })],
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
      unassign: vi.fn().mockReturnValue(of({})),
      swap: vi.fn(),
      createAdHocNode: vi.fn(),
      deleteAdHocNode: vi.fn(),
    };
    toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [TroncsTabComponent],
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
      .overrideComponent(TroncsTabComponent, {
        remove: { imports: [TroncViewComponent, PersonPanelComponent] },
        add: { imports: [StubTroncView, StubPersonPanel] },
      })
      .compileComponents();

    ws = TestBed.inject(SegmentWorkspaceStateService);
    state = TestBed.inject(AssignmentStateService);
    undoRedo = TestBed.inject(UndoRedoService);
    ws.load(EVENT_ID, SEGMENT_ID);
    refreshSpy = vi.spyOn(ws, 'refresh');

    fixture = TestBed.createComponent(TroncsTabComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  const troncStubs = (): StubTroncView[] =>
    fixture.debugElement.queryAll((n) => n.componentInstance instanceof StubTroncView)
      .map((n) => n.componentInstance as StubTroncView);

  describe('rendering', () => {
    it('renders one tronc-view per figure with a tronc, in segment order', async () => {
      await setup({
        instances: [makeInstance(INST_A), makeInstance(INST_B)],
        nodesByInstance: {
          [INST_A]: [makeNode('n1', 'TRONC')],
          [INST_B]: [makeNode('m1', 'TRONC')],
        },
      });

      expect(troncStubs()).toHaveLength(2);
    }, 10_000);

    it('refreshes the workspace on init so figures edited in other tabs show up-to-date', async () => {
      await setup();

      expect(refreshSpy).toHaveBeenCalled();
    });

    it('skips figures with no tronc/base/direction nodes', async () => {
      await setup({
        instances: [makeInstance(INST_A), makeInstance(INST_B)],
        nodesByInstance: {
          [INST_A]: [makeNode('n1', 'PINYA')],
          [INST_B]: [makeNode('m1', 'TRONC')],
        },
      });

      expect(troncStubs()).toHaveLength(1);
    });

    it('passes only TRONC, BASE and DIRECTION nodes to each tronc-view', async () => {
      await setup({
        nodesByInstance: {
          [INST_A]: [
            makeNode('t1', 'TRONC'),
            makeNode('b1', 'BASE'),
            makeNode('d1', 'FIGURE_DIRECTION'),
            makeNode('p1', 'PINYA'),
          ],
        },
      });

      const stub = troncStubs()[0];
      expect(stub.troncNodes().map((n) => n.id)).toEqual(['t1']);
      expect(stub.baseNodes().map((n) => n.id)).toEqual(['b1']);
      expect(stub.directionNodes().map((n) => n.id)).toEqual(['d1']);
    });
  });

  describe('node selection', () => {
    it('selecting a node sets the workspace instance and shared node selection', async () => {
      await setup();

      component.onTroncNodeSelected(INST_A, 'n1');

      expect(ws.selectedInstanceId()).toBe(INST_A);
      expect(state.selectedNodeId()).toBe('n1');
    });

    it('ignores selection when locked', async () => {
      await setup({ locked: true });

      component.onTroncNodeSelected(INST_A, 'n1');

      expect(component.selectedRef()).toBeNull();
    });
  });

  describe('assignment', () => {
    it('assigns the selected person to the selected node', async () => {
      await setup();
      component.onPersonSelected(makePerson('p-9'));

      component.onTroncNodeSelected(INST_A, 'n1');

      expect(assignmentService.assign).toHaveBeenCalledWith(INST_A, { nodeId: 'n1', personId: 'p-9' });
    });

    it('advances to the next empty tronc node of the same figure after assigning', async () => {
      await setup({
        instances: [makeInstance(INST_A), makeInstance(INST_B)],
        nodesByInstance: {
          [INST_A]: [makeNode('n1', 'TRONC', { sortOrder: 0 }), makeNode('n2', 'TRONC', { sortOrder: 1 })],
          [INST_B]: [makeNode('m1', 'TRONC')],
        },
      });
      assignmentService.assign.mockReturnValue(of(makeAssignment(INST_A, 'n1', 'p-9')));
      component.onTroncNodeSelected(INST_A, 'n1');

      component.onPersonSelected(makePerson('p-9'));

      expect(component.selectedRef()).toEqual({ slotId: INST_A, nodeId: 'n2' });
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
  });

  describe('click-click no longer swaps or moves', () => {
    it('selecting two assigned nodes in sequence does not swap them', async () => {
      const a1 = makeAssignment(INST_A, 'n1', 'p-1');
      const a2 = makeAssignment(INST_A, 'n2', 'p-2');
      await setup({ assignmentsByInstance: { [INST_A]: [a1, a2] } });

      component.onTroncNodeSelected(INST_A, 'n1');
      component.onTroncNodeSelected(INST_A, 'n2');

      expect(assignmentService.swap).not.toHaveBeenCalled();
      expect(component.selectedRef()).toEqual({ slotId: INST_A, nodeId: 'n2' });
    });

    it('selecting an assigned node then an empty node does not move the person', async () => {
      const existing = makeAssignment(INST_A, 'n1', 'p-1');
      await setup({ assignmentsByInstance: { [INST_A]: [existing] } });

      component.onTroncNodeSelected(INST_A, 'n1');
      component.onTroncNodeSelected(INST_A, 'n2');

      expect(assignmentService.unassign).not.toHaveBeenCalled();
      expect(component.selectedRef()).toEqual({ slotId: INST_A, nodeId: 'n2' });
    });
  });

  describe('onNodeDropped (drag-and-drop)', () => {
    it('swaps two assigned nodes of the same figure', async () => {
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

    it('swaps two assigned nodes across figures via unassign + reassign', async () => {
      const a1 = makeAssignment(INST_A, 'n1', 'p-1');
      const a2 = makeAssignment(INST_B, 'm1', 'p-2');
      await setup({
        instances: [makeInstance(INST_A), makeInstance(INST_B)],
        nodesByInstance: {
          [INST_A]: [makeNode('n1', 'TRONC')],
          [INST_B]: [makeNode('m1', 'TRONC')],
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

    it('moves the person when dropped on an empty node', async () => {
      const existing = makeAssignment(INST_A, 'n1', 'p-1');
      await setup({ assignmentsByInstance: { [INST_A]: [existing] } });

      component.onNodeDropped({ slotId: INST_A, nodeId: 'n1' }, { slotId: INST_A, nodeId: 'n2' });

      expect(assignmentService.unassign).toHaveBeenCalledWith(INST_A, existing.id);
      expect(assignmentService.assign).toHaveBeenCalledWith(INST_A, { nodeId: 'n2', personId: 'p-1' });
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
        zone: 'TRONC',
        z: 1,
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
          [INST_A]: [makeNode('n1', 'TRONC')],
          [INST_B]: [makeNode('m1', 'TRONC')],
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

    it('plain assign: undo removes it from state, redo re-adds it', async () => {
      await setup({ instances: [makeInstance(INST_A, { snapshotted: true })] });
      assignmentService.assign.mockImplementation(
        (instanceId: string, payload: { nodeId: string; personId: string }) =>
          of(dynamicAssignment(instanceId, payload.nodeId, payload.personId)),
      );
      component.onTroncNodeSelected(INST_A, 'n1');
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

  describe('directions', () => {
    it('adds a direction node to the given figure', async () => {
      await setup();
      component.onTroncNodeSelected(INST_A, 'n1');
      assignmentService.createAdHocNode.mockReturnValue(of(makeNode('dir-1', 'FIGURE_DIRECTION')));

      component.onDirectionAdded(INST_A, { zone: 'FIGURE_DIRECTION' });

      expect(assignmentService.createAdHocNode).toHaveBeenCalledWith(
        INST_A,
        expect.objectContaining({ zone: 'FIGURE_DIRECTION' }),
      );
    });

    it('removes an unassigned direction node', async () => {
      await setup({
        nodesByInstance: { [INST_A]: [makeNode('d1', 'FIGURE_DIRECTION')] },
      });
      assignmentService.deleteAdHocNode.mockReturnValue(of(undefined));

      component.onDirectionRemoved(INST_A, 'd1');

      expect(assignmentService.deleteAdHocNode).toHaveBeenCalledWith(INST_A, 'd1');
    });

    it('refuses to remove an assigned direction node', async () => {
      const existing = makeAssignment(INST_A, 'd1', 'p-1');
      await setup({
        nodesByInstance: { [INST_A]: [makeNode('d1', 'FIGURE_DIRECTION')] },
        assignmentsByInstance: { [INST_A]: [existing] },
      });

      component.onDirectionRemoved(INST_A, 'd1');

      expect(assignmentService.deleteAdHocNode).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalled();
    });
  });

  describe('figure colors', () => {
    it('assigns a distinct color to each figure by segment order', async () => {
      await setup({
        instances: [makeInstance(INST_A), makeInstance(INST_B)],
        nodesByInstance: {
          [INST_A]: [makeNode('n1', 'TRONC')],
          [INST_B]: [makeNode('m1', 'TRONC')],
        },
      });

      const [a, b] = component.figures();
      expect(a.color).not.toBe(b.color);
    });
  });

  describe('minimap', () => {
    it('starts open', async () => {
      await setup();
      expect(component.minimapOpen()).toBe(true);
    });

    it('toggles closed and open', async () => {
      await setup();

      component.toggleMinimap();
      expect(component.minimapOpen()).toBe(false);

      component.toggleMinimap();
      expect(component.minimapOpen()).toBe(true);
    });

    it('exposes one bounding box per figure with a pinya, derived from the pinya slots', async () => {
      await setup({
        instances: [makeInstance(INST_A), makeInstance(INST_B)],
        nodesByInstance: {
          [INST_A]: [makeNode('n1', 'PINYA', { z: 0, width: 40, height: 40 })],
          [INST_B]: [makeNode('m1', 'TRONC')],
        },
      });

      const boxes = component.minimapBoxes();
      expect(boxes.map((b) => b.slotId)).toEqual([INST_A]);
    });

    it('computes a padded viewBox covering all boxes', async () => {
      await setup({
        nodesByInstance: {
          [INST_A]: [makeNode('n1', 'PINYA', { z: 0, x: 0, y: 0, width: 40, height: 40 })],
        },
      });

      const viewBox = component.minimapViewBox();
      const [x, y, w, h] = viewBox.split(' ').map(Number);
      expect(w).toBeGreaterThan(40);
      expect(h).toBeGreaterThan(40);
      expect(x).toBeLessThanOrEqual(-20);
      expect(y).toBeLessThanOrEqual(-20);
    });

    it('falls back to a default viewBox when there are no boxes', async () => {
      await setup({ nodesByInstance: { [INST_A]: [makeNode('n1', 'TRONC')] } });

      expect(component.minimapViewBox()).toBe('0 0 100 100');
    });
  });

  describe('error handling', () => {
    it('reverts and toasts when assign fails', async () => {
      await setup();
      assignmentService.assign.mockReturnValue(throwError(() => ({ status: 500 })));
      component.onTroncNodeSelected(INST_A, 'n1');

      component.onPersonSelected(makePerson('p-9'));

      expect(state.assignments()).toHaveLength(0);
      expect(toast.error).toHaveBeenCalled();
    });
  });

  describe('reassign dialog (parity with the Pinyes tab)', () => {
    it('opens the dialog when an already-assigned person is picked with a target node selected', async () => {
      const existing = makeAssignment(INST_A, 'n1', 'p-1');
      await setup({
        instances: [makeInstance(INST_A), makeInstance(INST_B)],
        nodesByInstance: {
          [INST_A]: [makeNode('n1', 'TRONC')],
          [INST_B]: [makeNode('m1', 'TRONC')],
        },
        assignmentsByInstance: { [INST_A]: [existing] },
      });
      component.onTroncNodeSelected(INST_B, 'm1');

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
          [INST_A]: [makeNode('n1', 'TRONC')],
          [INST_B]: [makeNode('m1', 'TRONC')],
        },
        assignmentsByInstance: { [INST_A]: [existing] },
      });
      component.onTroncNodeSelected(INST_B, 'm1');
      component.onAssignedPersonSelected({ personId: 'p-1', instanceId: INST_A });

      component.onReassignDialogConfirm();

      expect(assignmentService.unassign).toHaveBeenCalledWith(INST_A, existing.id);
      expect(assignmentService.assign).toHaveBeenCalledWith(INST_B, { nodeId: 'm1', personId: 'p-1' });
    });

    it('"assign anyway" keeps the old assignment and assigns to the target as a duplicate', async () => {
      const existing = makeAssignment(INST_A, 'n1', 'p-1');
      await setup({
        instances: [makeInstance(INST_A), makeInstance(INST_B)],
        nodesByInstance: {
          [INST_A]: [makeNode('n1', 'TRONC')],
          [INST_B]: [makeNode('m1', 'TRONC')],
        },
        assignmentsByInstance: { [INST_A]: [existing] },
      });
      component.onTroncNodeSelected(INST_B, 'm1');
      component.onAssignedPersonSelected({ personId: 'p-1', instanceId: INST_A });

      component.onReassignDialogAssignAnyway();

      expect(assignmentService.unassign).not.toHaveBeenCalled();
      expect(assignmentService.assign).toHaveBeenCalledWith(INST_B, { nodeId: 'm1', personId: 'p-1' });
      expect(component.reassignDialog()).toBeNull();
    });

    it('navigates directly (no dialog) when no target node is selected', async () => {
      const existing = makeAssignment(INST_A, 'n1', 'p-1');
      await setup({ assignmentsByInstance: { [INST_A]: [existing] } });

      component.onAssignedPersonSelected({ personId: 'p-1', instanceId: INST_A });

      expect(component.reassignDialog()).toBeNull();
      expect(component.selectedRef()).toEqual({ slotId: INST_A, nodeId: 'n1' });
    });
  });

  describe('cross-tab "Anar-hi" navigation', () => {
    it('emits crossTabSelect instead of selecting locally when the person is on a PINYA node', async () => {
      const existing = makeAssignment(INST_A, 'p1', 'p-1', 'PINYA');
      await setup({ assignmentsByInstance: { [INST_A]: [existing] } });
      const emitSpy = vi.fn();
      component.crossTabSelect.subscribe(emitSpy);

      component.onAssignedPersonSelected({ personId: 'p-1', instanceId: INST_A });

      expect(emitSpy).toHaveBeenCalledWith({ tab: 'pinyes', ref: { slotId: INST_A, nodeId: 'p1' } });
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

    it('treats FIGURE_DIRECTION nodes as staying in the Troncs tab (no switch)', async () => {
      const existing = makeAssignment(INST_A, 'd1', 'p-1', 'FIGURE_DIRECTION');
      await setup({ assignmentsByInstance: { [INST_A]: [existing] } });
      const emitSpy = vi.fn();
      component.crossTabSelect.subscribe(emitSpy);

      component.onAssignedPersonSelected({ personId: 'p-1', instanceId: INST_A });

      expect(emitSpy).not.toHaveBeenCalled();
      expect(component.selectedRef()).toEqual({ slotId: INST_A, nodeId: 'd1' });
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
    it('renders the tronc view + person panel by default (no matchMedia)', async () => {
      await setup();
      expect(fixture.nativeElement.textContent).not.toContain('Encara no optimitzat per a mòbil');
    }, 10_000);

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
        expect(fixture.nativeElement.querySelector('app-tronc-view')).toBeFalsy();
        expect(fixture.nativeElement.querySelector('app-person-panel')).toBeFalsy();
      });
    });
  });
});
