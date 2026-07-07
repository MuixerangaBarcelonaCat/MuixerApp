import { Component, input, output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { describe, it, expect, vi } from 'vitest';
import { allLucideIconsProvider } from '../../../../../../../testing/lucide-test-provider';
import { TroncsTabComponent } from './troncs-tab.component';
import { TroncViewComponent, TroncNodeItem } from '../../../tronc-view/tronc-view.component';
import { PersonPanelComponent } from '../../../person-panel/person-panel.component';
import { SegmentWorkspaceStateService } from '../../../../services/segment-workspace-state.service';
import { AssignmentStateService } from '../../../../services/assignment-state.service';
import { UndoRedoService } from '../../../../services/undo-redo.service';
import { EventSegmentService } from '../../../../services/event-segment.service';
import { SegmentDistributionService } from '../../../../services/segment-distribution.service';
import { NodeAssignmentService } from '../../../../services/node-assignment.service';
import { ToastService } from '../../../../../../shared/components/feedback/toast/toast.service';
import { AssignmentDetail, AvailablePerson, InstanceNodeItem } from '../../../../models/assignment.model';
import { InstanceDetail, SegmentDetail } from '../../../../models/segment.model';

// ── Stub children ────────────────────────────────────────────────────────────

@Component({ selector: 'app-tronc-view', standalone: true, template: '' })
class StubTroncView {
  readonly troncNodes = input<TroncNodeItem[]>([]);
  readonly baseNodes = input<TroncNodeItem[]>([]);
  readonly directionNodes = input<TroncNodeItem[]>([]);
  readonly assignments = input<AssignmentDetail[]>([]);
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
  readonly directionAdded = output<{ zone: string }>();
  readonly directionRemoved = output<string>();
}

@Component({ selector: 'app-person-panel', standalone: true, template: '' })
class StubPersonPanel {
  readonly eventId = input.required<string>();
  readonly segmentId = input.required<string>();
  readonly selectedNodeId = input<string | null>(null);
  readonly assignments = input<AssignmentDetail[]>([]);
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
  pinyaCapacity: null,
  totalCordons: null,
  numberOfCordons: null,
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
const makeAssignment = (instanceId: string, nodeId: string, personId = `p-${++assignmentSeq}`): AssignmentDetail => ({
  id: `as-${assignmentSeq}`,
  figureInstanceId: instanceId,
  node: {
    id: nodeId,
    label: nodeId,
    zone: 'TRONC',
    z: 1,
    positionType: null,
    sortOrder: 0,
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
  positions: [],
});

type MockFn = ReturnType<typeof vi.fn>;

describe('TroncsTabComponent', () => {
  let fixture: ComponentFixture<TroncsTabComponent>;
  let component: TroncsTabComponent;
  let ws: SegmentWorkspaceStateService;
  let state: AssignmentStateService;
  let assignmentService: {
    getInstanceNodes: MockFn;
    getByInstance: MockFn;
    getAvailablePersons: MockFn;
    getLockStatus: MockFn;
    assign: MockFn;
    unassign: MockFn;
    swap: MockFn;
    createAdHocNode: MockFn;
    deleteAdHocNode: MockFn;
  };
  let toast: { success: MockFn; error: MockFn; info: MockFn };

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
      getLockStatus: vi
        .fn()
        .mockReturnValue(of({ locked: opts.locked ?? false, lockDate: null, lockDays: 3 })),
      assign: vi.fn().mockReturnValue(of(makeAssignment(INST_A, 'n1'))),
      unassign: vi.fn().mockReturnValue(of(null)),
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
    ws.load(EVENT_ID, SEGMENT_ID);

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

  describe('swap', () => {
    it('swaps two assigned nodes of the same figure', async () => {
      const a1 = makeAssignment(INST_A, 'n1', 'p-1');
      const a2 = makeAssignment(INST_A, 'n2', 'p-2');
      await setup({ assignmentsByInstance: { [INST_A]: [a1, a2] } });
      assignmentService.swap.mockReturnValue(of({ a: a1, b: a2 }));

      component.onTroncNodeSelected(INST_A, 'n1');
      component.onTroncNodeSelected(INST_A, 'n2');

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

      component.onTroncNodeSelected(INST_A, 'n1');
      component.onTroncNodeSelected(INST_B, 'm1');

      expect(assignmentService.unassign).toHaveBeenCalledWith(INST_A, a1.id);
      expect(assignmentService.unassign).toHaveBeenCalledWith(INST_B, a2.id);
      expect(assignmentService.assign).toHaveBeenCalledWith(INST_A, { nodeId: 'n1', personId: 'p-2' });
      expect(assignmentService.assign).toHaveBeenCalledWith(INST_B, { nodeId: 'm1', personId: 'p-1' });
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
});
