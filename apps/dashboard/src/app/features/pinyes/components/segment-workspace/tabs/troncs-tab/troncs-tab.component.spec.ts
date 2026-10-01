import { TroncViewComponent, TroncNodeItem, AssignmentDetail, AvailablePerson, InstanceNodeItem, InstanceDetail, SegmentDetail } from '@muixer/pinyes-render';
import { Component, input, output, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
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
import { ModalComponent, ToastService } from '@muixer/ui';
import { LayoutService } from '../../../../../../core/services/layout.service';

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
  readonly personDragEnabled = input<boolean>(true);
  readonly heightMode = input<string>('relative');
  readonly highlightedNodeIds = input<Set<string>>(new Set());
  readonly attendanceMap = input<Map<string, string>>(new Map());
  readonly isPast = input<boolean>(false);
  readonly personDetailsMap = input<Map<string, unknown>>(new Map());
  readonly nodeSelected = output<string | null>();
  readonly nodeClicked = output<{ nodeId: string; event: MouseEvent }>();
  readonly nodeUnassigned = output<string>();
  readonly nodeContextMenu = output<string>();
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
  readonly searchOnly = input<boolean>(false);
  readonly personSelected = output<AvailablePerson>();
  readonly assignedPersonSelected = output<{ personId: string; instanceId: string }>();
  readonly unassignRequested = output<AssignmentDetail>();
  readonly navigateNode = output<-1 | 1>();
  focusSearch = vi.fn();
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
  positionType: string | null = null,
): AssignmentDetail => ({
  id: `as-${assignmentSeq}`,
  figureInstanceId: instanceId,
  node: {
    id: nodeId,
    label: nodeId,
    zone,
    z: 1,
    positionType,
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
    getSegmentAssignmentState: MockFn;
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
    /** Simulates a touch device (phone / tablet). */
    touch?: boolean;
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
      getSegmentAssignmentState: vi.fn(() =>
        of({
          data: segment.instances.map((i) => ({
            instanceId: i.id,
            nodes: defaultNodes[i.id] ?? [],
            assignments: opts.assignmentsByInstance?.[i.id] ?? [],
          })),
        }),
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
        { provide: LayoutService, useValue: { isTouch: signal(opts.touch ?? false) } },
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
            makeNode('d1', 'DIRECTION', { positionType: 'direccio-tronc' }),
            makeNode('p1', 'PINYA'),
          ],
        },
      });

      const stub = troncStubs()[0];
      expect(stub.troncNodes().map((n) => n.id)).toEqual(['t1']);
      expect(stub.baseNodes().map((n) => n.id)).toEqual(['b1']);
      expect(stub.directionNodes().map((n) => n.id)).toEqual(['d1']);
    });

    it('excludes BASE nodes for a REMAT figure (its base is hidden in that mode)', async () => {
      await setup({
        instances: [makeInstance(INST_A, { figureMode: 'REMAT' })],
        nodesByInstance: {
          [INST_A]: [makeNode('t1', 'TRONC'), makeNode('b1', 'BASE')],
        },
      });

      const stub = troncStubs()[0];
      expect(stub.troncNodes().map((n) => n.id)).toEqual(['t1']);
      expect(stub.baseNodes().map((n) => n.id)).toEqual([]);
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

  describe('Tab / Shift+Tab node navigation', () => {
    const navSetup = () =>
      setup({
        nodesByInstance: {
          [INST_A]: [
            makeNode('base1', 'BASE'),
            makeNode('t1', 'TRONC', { z: 1, x: 0 }),
            makeNode('t2', 'TRONC', { z: 1, x: 1 }),
            makeNode('dir1', 'DIRECTION', { positionType: 'direccio-tronc' }),
          ],
        },
      });

    it('Tab moves to the next node in the established tronc order', async () => {
      await navSetup();
      component.onTroncNodeSelected(INST_A, 'base1');

      component.onKeyDown(new KeyboardEvent('keydown', { key: 'Tab' }));

      expect(component.selectedRef()).toEqual({ slotId: INST_A, nodeId: 't1' });
    });

    it('Shift+Tab moves to the previous node in the established tronc order', async () => {
      await navSetup();
      component.onTroncNodeSelected(INST_A, 't2');

      component.onKeyDown(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }));

      expect(component.selectedRef()).toEqual({ slotId: INST_A, nodeId: 't1' });
    });

    it('Tab wraps from the last node back to the first', async () => {
      await navSetup();
      component.onTroncNodeSelected(INST_A, 'dir1');

      component.onKeyDown(new KeyboardEvent('keydown', { key: 'Tab' }));

      expect(component.selectedRef()).toEqual({ slotId: INST_A, nodeId: 'base1' });
    });

    it('the person panel navigateNode output drives node navigation', async () => {
      await navSetup();
      component.onTroncNodeSelected(INST_A, 'base1');

      const panel = fixture.debugElement.query((n) => n.componentInstance instanceof StubPersonPanel)
        .componentInstance as StubPersonPanel;
      panel.navigateNode.emit(1);

      expect(component.selectedRef()).toEqual({ slotId: INST_A, nodeId: 't1' });
    });
  });

  describe('background click keeps the search input focused', () => {
    const panelStub = () =>
      fixture.debugElement.query((n) => n.componentInstance instanceof StubPersonPanel)
        .componentInstance as StubPersonPanel;

    it('clicking the tronc background clears the selection and refocuses the search input', async () => {
      await setup({ nodesByInstance: { [INST_A]: [makeNode('n1', 'TRONC', { z: 1 })] } });
      component.onTroncNodeSelected(INST_A, 'n1');
      expect(component.selectedRef()).not.toBeNull();

      const pane: HTMLElement = fixture.nativeElement.querySelector('.overflow-y-auto');
      pane.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();

      expect(component.selectedRef()).toBeNull();
      expect(panelStub().focusSearch).toHaveBeenCalled();
    });

    it('clicking inside a tronc view does not clear the selection', async () => {
      await setup({ nodesByInstance: { [INST_A]: [makeNode('n1', 'TRONC', { z: 1 })] } });
      component.onTroncNodeSelected(INST_A, 'n1');

      const troncView: HTMLElement = fixture.nativeElement.querySelector('app-tronc-view');
      troncView.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();

      expect(component.selectedRef()).toEqual({ slotId: INST_A, nodeId: 'n1' });
    });

    it('clicking an undo/redo button does not clear the selection', async () => {
      await setup({ nodesByInstance: { [INST_A]: [makeNode('n1', 'TRONC', { z: 1 })] } });
      component.onTroncNodeSelected(INST_A, 'n1');

      const button: HTMLElement = fixture.nativeElement.querySelector('button');
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();

      expect(component.selectedRef()).toEqual({ slotId: INST_A, nodeId: 'n1' });
    });
  });

  describe('directions', () => {
    it('adds a direction node to the given figure', async () => {
      await setup();
      component.onTroncNodeSelected(INST_A, 'n1');
      assignmentService.createAdHocNode.mockReturnValue(of(makeNode('dir-1', 'DIRECTION', { positionType: 'direccio-tronc' })));

      component.onDirectionAdded(INST_A, { positionType: 'direccio-tronc' });

      expect(assignmentService.createAdHocNode).toHaveBeenCalledWith(
        INST_A,
        expect.objectContaining({ zone: 'DIRECTION', positionType: 'direccio-tronc' }),
      );
    });

    it('selects the newly created direction node so the person search auto-focuses', async () => {
      await setup();
      assignmentService.createAdHocNode.mockReturnValue(of(makeNode('dir-1', 'DIRECTION', { positionType: 'direccio-tronc' })));

      component.onDirectionAdded(INST_A, { positionType: 'direccio-tronc' });

      expect(component.selectedRef()).toEqual({ slotId: INST_A, nodeId: 'dir-1' });
    });

    it('removes an unassigned direction node', async () => {
      await setup({
        nodesByInstance: { [INST_A]: [makeNode('d1', 'DIRECTION', { positionType: 'direccio-tronc' })] },
      });
      assignmentService.deleteAdHocNode.mockReturnValue(of(undefined));

      component.onDirectionRemoved(INST_A, 'd1');

      expect(assignmentService.deleteAdHocNode).toHaveBeenCalledWith(INST_A, 'd1');
    });

    it('refuses to remove an assigned direction node', async () => {
      const existing = makeAssignment(INST_A, 'd1', 'p-1');
      await setup({
        nodesByInstance: { [INST_A]: [makeNode('d1', 'DIRECTION', { positionType: 'direccio-tronc' })] },
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
    it('starts open on desktop', async () => {
      await setup();
      expect(component.minimapOpen()).toBe(true);
    });

    it('starts hidden on touch devices (it takes too much of a small screen)', async () => {
      await setup({ touch: true });
      expect(component.minimapOpen()).toBe(false);
      expect(fixture.nativeElement.querySelector('[aria-label="Mapa de la posició de les figures del segment"]')).toBeNull();
    });

    it('can still be opened on a touch device', async () => {
      await setup({ touch: true });

      component.toggleMinimap();
      fixture.detectChanges();

      expect(component.minimapOpen()).toBe(true);
      expect(fixture.nativeElement.querySelector('[aria-label="Mapa de la posició de les figures del segment"]')).toBeTruthy();
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

    it('does not open the dialog when assigning a person to a direcció node of a figure whose pinya they already hold (D-«direcció pinya»)', async () => {
      const existing = makeAssignment(INST_A, 'n1', 'p-1', 'PINYA');
      await setup({
        instances: [makeInstance(INST_A)],
        nodesByInstance: {
          [INST_A]: [makeNode('d1', 'DIRECTION', { positionType: 'direccio-pinya' })],
        },
        assignmentsByInstance: { [INST_A]: [existing] },
      });
      component.onTroncNodeSelected(INST_A, 'd1');

      component.onAssignedPersonSelected({ personId: 'p-1', instanceId: INST_A });

      expect(component.reassignDialog()).toBeNull();
      expect(assignmentService.assign).toHaveBeenCalledWith(INST_A, { nodeId: 'd1', personId: 'p-1' });
      expect(assignmentService.unassign).not.toHaveBeenCalled();
    });

    it('still opens the dialog for a direcció/pinya pair across two different figures', async () => {
      const existing = makeAssignment(INST_A, 'n1', 'p-1', 'PINYA');
      await setup({
        instances: [makeInstance(INST_A), makeInstance(INST_B)],
        nodesByInstance: {
          [INST_B]: [makeNode('d1', 'DIRECTION', { positionType: 'direccio-pinya' })],
        },
        assignmentsByInstance: { [INST_A]: [existing] },
      });
      component.onTroncNodeSelected(INST_B, 'd1');

      component.onAssignedPersonSelected({ personId: 'p-1', instanceId: INST_A });

      expect(component.reassignDialog()).not.toBeNull();
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

    it('treats DIRECTION nodes as staying in the Troncs tab (no switch)', async () => {
      const existing = makeAssignment(INST_A, 'd1', 'p-1', 'DIRECTION');
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

  // ── move mode: right-click a person, then press the destination ───────────────

  describe('move mode', () => {
    const banner = () => fixture.nativeElement.querySelector('app-move-banner') as HTMLElement | null;
    const rightClick = (nodeId: string, instanceId = INST_A) => {
      component.onTroncNodeContextMenu(instanceId, nodeId);
      fixture.detectChanges();
    };
    const press = (nodeId: string, instanceId = INST_A) => {
      component.onTroncNodeSelected(instanceId, nodeId);
      fixture.detectChanges();
    };
    const placed = (id = 'p-1', nodeId = 'n1') => ({ [INST_A]: [makeAssignment(INST_A, nodeId, id, 'TRONC')] });
    const nodes = { [INST_A]: [makeNode('n1', 'TRONC', { z: 1 }), makeNode('n2', 'TRONC', { z: 1, x: 1 })] };

    describe('starting', () => {
      it('shows no banner by default', async () => {
        await setup({ assignmentsByInstance: placed() });

        expect(banner()).toBeNull();
      });

      it('the tronc view output starts the move for the right instance and node', async () => {
        await setup({ assignmentsByInstance: placed() });

        troncStubs()[0].nodeContextMenu.emit('n1');
        fixture.detectChanges();

        expect(banner()?.textContent).toContain("S'està movent");
        expect(banner()?.textContent).toContain('Alias p-1');
      });

      it('right-clicking an empty node does nothing', async () => {
        await setup({ assignmentsByInstance: placed() });

        rightClick('n2');

        expect(banner()).toBeNull();
      });

      it('does nothing when the event is locked', async () => {
        await setup({ locked: true, assignmentsByInstance: placed() });

        rightClick('n1');

        expect(banner()).toBeNull();
      });

      it('marks the node being moved in the tronc views, and nothing otherwise', async () => {
        await setup({ assignmentsByInstance: placed() });
        expect([...troncStubs()[0].highlightedNodeIds()]).toEqual([]);

        rightClick('n1');

        expect([...troncStubs()[0].highlightedNodeIds()]).toEqual(['n1']);
      });

      it('drops the current selection', async () => {
        await setup({ assignmentsByInstance: placed('p-1', 'n1') });
        press('n2');
        expect(component.selectedRef()).not.toBeNull();

        rightClick('n1');

        expect(component.selectedRef()).toBeNull();
      });
    });

    describe('pressing the destination', () => {
      it('moves the person when the destination is empty, and the banner goes away', async () => {
        const existing = makeAssignment(INST_A, 'n1', 'p-1', 'TRONC');
        await setup({ nodesByInstance: nodes, assignmentsByInstance: { [INST_A]: [existing] } });
        rightClick('n1');

        press('n2');

        expect(assignmentService.unassign).toHaveBeenCalledWith(INST_A, existing.id);
        expect(assignmentService.assign).toHaveBeenCalledWith(INST_A, { nodeId: 'n2', personId: 'p-1' });
        expect(banner()).toBeNull();
      });

      it('swaps the two persons when the destination is occupied', async () => {
        const a1 = makeAssignment(INST_A, 'n1', 'p-1', 'TRONC');
        const a2 = makeAssignment(INST_A, 'n2', 'p-2', 'TRONC');
        await setup({ nodesByInstance: nodes, assignmentsByInstance: { [INST_A]: [a1, a2] } });
        assignmentService.swap.mockReturnValue(of({ a: a1, b: a2 }));
        rightClick('n1');

        press('n2');

        expect(assignmentService.swap).toHaveBeenCalledWith(INST_A, { assignmentIdA: a1.id, assignmentIdB: a2.id });
        expect(banner()).toBeNull();
      });

      it('swaps across figures (the destination is in another tronc view)', async () => {
        const a1 = makeAssignment(INST_A, 'n1', 'p-1', 'TRONC');
        const a2 = makeAssignment(INST_B, 'm1', 'p-2', 'TRONC');
        await setup({
          instances: [makeInstance(INST_A), makeInstance(INST_B)],
          nodesByInstance: {
            [INST_A]: [makeNode('n1', 'TRONC', { z: 1 })],
            [INST_B]: [makeNode('m1', 'TRONC', { z: 1 })],
          },
          assignmentsByInstance: { [INST_A]: [a1], [INST_B]: [a2] },
        });
        assignmentService.assign.mockImplementation((instanceId: string, payload: { nodeId: string; personId: string }) =>
          of(makeAssignment(instanceId, payload.nodeId, payload.personId, 'TRONC')),
        );
        rightClick('n1', INST_A);

        press('m1', INST_B);

        expect(assignmentService.assign).toHaveBeenCalledWith(INST_A, { nodeId: 'n1', personId: 'p-2' });
        expect(assignmentService.assign).toHaveBeenCalledWith(INST_B, { nodeId: 'm1', personId: 'p-1' });
      });

      it('a right-click on the destination also completes the move (long press counts too)', async () => {
        await setup({ nodesByInstance: nodes, assignmentsByInstance: placed() });
        rightClick('n1');

        rightClick('n2');

        expect(assignmentService.assign).toHaveBeenCalledWith(INST_A, { nodeId: 'n2', personId: 'p-1' });
      });

      it('does not select the destination node', async () => {
        await setup({ nodesByInstance: nodes, assignmentsByInstance: placed() });
        rightClick('n1');

        press('n2');

        expect(component.selectedRef()).toBeNull();
      });
    });

    describe('cancelling', () => {
      const moving = async () => {
        await setup({ nodesByInstance: nodes, assignmentsByInstance: placed() });
        rightClick('n1');
        expect(banner()).not.toBeNull();
      };
      const nothingMoved = () => {
        expect(assignmentService.unassign).not.toHaveBeenCalled();
        expect(assignmentService.swap).not.toHaveBeenCalled();
        expect(banner()).toBeNull();
      };

      it('the cross on the banner cancels', async () => {
        await moving();

        (banner()?.querySelector('button[aria-label="Cancel·la el moviment"]') as HTMLButtonElement).click();
        fixture.detectChanges();

        nothingMoved();
      });

      it('Escape cancels', async () => {
        await moving();

        component.onKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }));
        fixture.detectChanges();

        nothingMoved();
      });

      it('pressing the same node again cancels', async () => {
        await moving();

        press('n1');

        nothingMoved();
      });

      it('pressing the empty area around the figures cancels', async () => {
        await moving();

        const pane: HTMLElement = fixture.nativeElement.querySelector('.overflow-y-auto');
        pane.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        fixture.detectChanges();

        nothingMoved();
      });

      it('pressing empty space inside a tronc view (not on a node) cancels', async () => {
        await moving();

        const troncView: HTMLElement = fixture.nativeElement.querySelector('app-tronc-view');
        troncView.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        fixture.detectChanges();

        nothingMoved();
      });

      it('a click that lands on a node does not cancel by itself (the node handler completes the move)', async () => {
        await moving();
        const troncView: HTMLElement = fixture.nativeElement.querySelector('app-tronc-view');
        const nodeEl = document.createElement('div');
        nodeEl.setAttribute('data-tronc-node-id', 'n2');
        troncView.appendChild(nodeEl);

        nodeEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        fixture.detectChanges();

        expect(banner()).not.toBeNull();
      });

      it('clicking the banner itself does not cancel through the background handler', async () => {
        await moving();

        (banner() as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
        fixture.detectChanges();

        expect(banner()).not.toBeNull();
      });
    });

    describe('on touch', () => {
      const modal = () => fixture.debugElement.query(By.directive(ModalComponent));

      it('pressing the destination moves without opening the person modal', async () => {
        await setup({ touch: true, nodesByInstance: nodes, assignmentsByInstance: placed() });
        rightClick('n1');

        press('n2');

        expect(assignmentService.assign).toHaveBeenCalledWith(INST_A, { nodeId: 'n2', personId: 'p-1' });
        expect(modal().componentInstance.open()).toBe(false);
      });

      it('a normal tap still opens the person modal when no move is in progress', async () => {
        await setup({ touch: true, nodesByInstance: nodes, assignmentsByInstance: placed() });

        press('n2');

        expect(modal().componentInstance.open()).toBe(true);
      });
    });
  });

  // ── touch devices (phones / tablets) ─────────────────────────────────────────
  // No side panel: tapping a node opens the (search-only) person panel in a modal instead.

  describe('touch layout', () => {
    const modal = () => fixture.debugElement.query(By.directive(ModalComponent));
    const modalOpen = (): boolean => modal().componentInstance.open();
    const panelStub = (): StubPersonPanel =>
      fixture.debugElement.query((n) => n.componentInstance instanceof StubPersonPanel)
        ?.componentInstance as StubPersonPanel;
    const tap = (nodeId: string, instanceId = INST_A) => {
      component.onTroncNodeSelected(instanceId, nodeId);
      fixture.detectChanges();
    };

    describe('layout', () => {
      it('desktop: the person panel is a side column, with no modal and not search-only', async () => {
        await setup();

        expect(modal()).toBeNull();
        expect(panelStub().searchOnly()).toBe(false);
      });

      it('touch: the person panel lives inside a modal and is search-only', async () => {
        await setup({ touch: true });

        expect(modal().nativeElement.querySelector('app-person-panel')).toBeTruthy();
        expect(panelStub().searchOnly()).toBe(true);
      });

      it('touch: the person modal starts closed', async () => {
        await setup({ touch: true });

        expect(modalOpen()).toBe(false);
      });

      describe('narrow viewport (< 640px)', () => {
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

        it('touch: renders the tronc views instead of the "not optimised for mobile" message', async () => {
          await setup({ touch: true });

          expect(fixture.nativeElement.textContent).not.toContain('Encara no optimitzat per a mòbil');
          expect(troncStubs().length).toBeGreaterThan(0);
          expect(panelStub()).toBeTruthy();
        });
      });
    });

    describe('drag and drop of persons', () => {
      it('stays enabled on desktop', async () => {
        await setup();

        expect(troncStubs()[0].personDragEnabled()).toBe(true);
      });

      it('is disabled on touch (a long press moves people instead)', async () => {
        await setup({ touch: true });

        expect(troncStubs()[0].personDragEnabled()).toBe(false);
      });
    });

    describe('tapping a node', () => {
      it('opens the person modal on an empty node', async () => {
        await setup({ touch: true });

        tap('n1');

        expect(modalOpen()).toBe(true);
        expect(component.selectedRef()).toEqual({ slotId: INST_A, nodeId: 'n1' });
      });

      it('opens the person modal on an assigned node too', async () => {
        await setup({ touch: true, assignmentsByInstance: { [INST_A]: [makeAssignment(INST_A, 'n1', 'p-1')] } });

        tap('n1');

        expect(modalOpen()).toBe(true);
      });

      it('does not open a modal on desktop', async () => {
        await setup();

        component.onTroncNodeSelected(INST_A, 'n1');
        fixture.detectChanges();

        expect(modal()).toBeNull();
      });

      it('does not open the modal when the event is locked', async () => {
        await setup({ touch: true, locked: true });

        tap('n1');

        expect(modalOpen()).toBe(false);
      });

      it('titles the modal "Assigna una persona" for an empty node and "Canvia la persona" for an assigned one', async () => {
        await setup({ touch: true, assignmentsByInstance: { [INST_A]: [makeAssignment(INST_A, 'n1', 'p-1')] } });

        tap('n2');
        expect(modal().componentInstance.title()).toBe('Assigna una persona');

        tap('n1');
        expect(modal().componentInstance.title()).toBe('Canvia la persona');
      });

      it('tapping the empty area closes the modal and deselects', async () => {
        await setup({ touch: true });
        tap('n1');

        component.onTroncNodeSelected(INST_A, null);
        fixture.detectChanges();

        expect(modalOpen()).toBe(false);
        expect(component.selectedRef()).toBeNull();
      });
    });

    describe('choosing in the modal', () => {
      it('assigns the picked person to the tapped node and closes the modal', async () => {
        await setup({ touch: true });
        tap('n1');

        panelStub().personSelected.emit(makePerson('p-9'));
        fixture.detectChanges();

        expect(assignmentService.assign).toHaveBeenCalledWith(INST_A, { nodeId: 'n1', personId: 'p-9' });
        expect(modalOpen()).toBe(false);
      });

      it('replaces the person of an assigned node (unassign, then assign)', async () => {
        const existing = makeAssignment(INST_A, 'n1', 'p-1');
        await setup({ touch: true, assignmentsByInstance: { [INST_A]: [existing] } });
        tap('n1');

        panelStub().personSelected.emit(makePerson('p-9'));

        expect(assignmentService.unassign).toHaveBeenCalledWith(INST_A, existing.id);
        expect(assignmentService.assign).toHaveBeenCalledWith(INST_A, { nodeId: 'n1', personId: 'p-9' });
      });

      it('does not jump to the next empty node after assigning', async () => {
        await setup({ touch: true });
        tap('n1');

        panelStub().personSelected.emit(makePerson('p-9'));

        expect(component.selectedRef()).toBeNull();
        expect(state.selectedNodeId()).toBeNull();
      });

      it('still jumps to the next empty node on desktop', async () => {
        await setup();
        component.onTroncNodeSelected(INST_A, 'n1');

        panelStub().personSelected.emit(makePerson('p-9'));

        expect(component.selectedRef()).toEqual({ slotId: INST_A, nodeId: 'n2' });
      });

      it('unassigns from the modal and closes it', async () => {
        const existing = makeAssignment(INST_A, 'n1', 'p-1');
        await setup({ touch: true, assignmentsByInstance: { [INST_A]: [existing] } });
        tap('n1');

        panelStub().unassignRequested.emit(existing);
        fixture.detectChanges();

        expect(assignmentService.unassign).toHaveBeenCalledWith(INST_A, existing.id);
        expect(modalOpen()).toBe(false);
      });

      it('picking a person already placed elsewhere closes the modal and asks how to proceed', async () => {
        await setup({
          touch: true,
          assignmentsByInstance: { [INST_A]: [makeAssignment(INST_A, 'n2', 'p-1', 'TRONC')] },
        });
        tap('n1');

        panelStub().assignedPersonSelected.emit({ personId: 'p-1', instanceId: INST_A });
        fixture.detectChanges();

        expect(modalOpen()).toBe(false);
        expect(component.reassignDialog()).not.toBeNull();
      });

      it('dismissing the modal (close button / backdrop / Escape) deselects the node', async () => {
        await setup({ touch: true });
        tap('n1');

        modal().triggerEventHandler('closed', undefined);
        fixture.detectChanges();

        expect(modalOpen()).toBe(false);
        expect(component.selectedRef()).toBeNull();
        expect(state.selectedNodeId()).toBeNull();
      });
    });
  });
});
