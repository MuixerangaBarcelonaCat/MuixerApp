import { Component, input, output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import {
  LUCIDE_ICONS, LucideIconProvider,
  ArrowLeft, Users, Edit, RefreshCw, Plus, PanelLeft, PanelLeftClose,
} from 'lucide-angular';
import { AssignmentCanvasComponent } from './assignment-canvas.component';
import { FigureCanvasComponent } from '../figure-canvas/figure-canvas.component';
import { PersonPanelComponent } from '../person-panel/person-panel.component';
import { NodePopoverComponent } from '../node-popover/node-popover.component';
import { ImportPinyaModalComponent } from '../import-pinya-modal/import-pinya-modal.component';
import { TroncViewComponent } from '../tronc-view/tronc-view.component';
import { NodeAssignmentService } from '../../services/node-assignment.service';
import { AssignmentStateService } from '../../services/assignment-state.service';
import { EventSegmentService } from '../../services/event-segment.service';
import { FigureTemplateService } from '../../services/figure-template.service';
import { FigureFamilyService } from '../../services/figure-family.service';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';
import { AssignmentDetail, AvailablePerson, BulkImportResult, InstanceNodeItem } from '../../models/assignment.model';
import { SegmentDetail } from '../../models/segment.model';
import { FigureZone, NodeShape } from '@muixer/shared';

// ── Stub child components ───────────────────────────────────────────────────

@Component({ selector: 'app-figure-canvas', standalone: true, template: '' })
class StubFigureCanvas {
  readonly nodes = input<unknown[]>([]);
  readonly mode = input<string>('editor');
  readonly selectedNodeId = input<string | null>(null);
  readonly assignments = input<AssignmentDetail[]>([]);
  readonly heightMode = input<string>('relative');
  readonly attendanceMap = input<Map<string, string>>(new Map());
  readonly nextPerformanceMap = input<Map<string, string | null>>(new Map());
  readonly highlightedNodeIds = input<Set<string>>(new Set());
  readonly nodeSelected = output<string | null>();
  readonly nodeClicked = output<{ nodeId: string; x: number; y: number }>();
}

@Component({ selector: 'app-person-panel', standalone: true, template: '' })
class StubPersonPanel {
  readonly eventId = input.required<string>();
  readonly segmentId = input.required<string>();
  readonly selectedNodeId = input<string | null>(null);
  readonly assignments = input<AssignmentDetail[]>([]);
  readonly heightMode = input<string>('relative');
  readonly personSelected = output<AvailablePerson>();
  readonly assignedPersonSelected = output<{ personId: string; instanceId: string }>();
}

@Component({ selector: 'app-node-popover', standalone: true, template: '' })
class StubNodePopover {
  readonly assignment = input<AssignmentDetail | null>(null);
  readonly position = input<{ x: number; y: number }>({ x: 0, y: 0 });
  readonly heightMode = input<string>('relative');
  readonly attendanceStatus = input<string | null>(null);
  readonly unassign = output<AssignmentDetail>();
  readonly close = output<void>();
}

@Component({ selector: 'app-import-pinya-modal', standalone: true, template: '' })
class StubImportModal {
  readonly figureTemplateId = input.required<string>();
  readonly currentInstanceId = input.required<string>();
  readonly open = input<boolean>(false);
  readonly importCompleted = output<BulkImportResult>();
  readonly closed = output<void>();
}

@Component({ selector: 'app-tronc-view', standalone: true, template: '' })
class StubTroncView {
  readonly troncNodes = input<unknown[]>([]);
  readonly baseNodes = input<unknown[]>([]);
  readonly assignments = input<AssignmentDetail[]>([]);
  readonly selectedNodeId = input<string | null>(null);
  readonly mode = input<string>('assignment');
  readonly heightMode = input<string>('relative');
  readonly highlightedNodeIds = input<Set<string>>(new Set());
  readonly attendanceMap = input<Map<string, string>>(new Map());
  readonly nodeSelected = output<string | null>();
  readonly nodeClicked = output<{ nodeId: string; event: MouseEvent }>();
}

// ── Test constants & factories ──────────────────────────────────────────────

const EVENT_ID = 'event-uuid-1';
const SEGMENT_ID = 'segment-uuid-1';
const INSTANCE_ID = 'instance-uuid-1';
const TEMPLATE_ID = 'template-uuid-1';
const FAMILY_ID = 'family-uuid-1';

const makeInstance = (overrides = {}) => ({
  id: INSTANCE_ID,
  label: null,
  sortOrder: 0,
  snapshotted: false,
  sourceVariantOrder: null,
  assignedCount: 0,
  figureTemplate: { id: TEMPLATE_ID, name: 'pd4' },
  compositionTemplate: null,
  ...overrides,
});

const makeSegment = (instanceOverrides = {}): SegmentDetail => ({
  id: SEGMENT_ID,
  name: 'Bloc A',
  sortOrder: 0,
  startTime: null,
  endTime: null,
  notes: null,
  isVisible: false,
  instances: [makeInstance(instanceOverrides)],
});

const makeInstanceNodes = (): InstanceNodeItem[] => [
  { id: 'inode-1', label: 'base-1', zone: FigureZone.BASE, z: 0, positionType: null, x: 100, y: 100, width: 60, height: 40, rotation: 0, color: null, shape: NodeShape.ELLIPSE, sortOrder: 0, ringLevel: null, originNodeId: null, sourceNodeId: 'node-1', isSnapshotted: false },
  { id: 'inode-2', label: 'tronc-1', zone: FigureZone.TRONC, z: 1, positionType: null, x: 200, y: 100, width: 60, height: 40, rotation: 0, color: null, shape: NodeShape.ELLIPSE, sortOrder: 1, ringLevel: null, originNodeId: null, sourceNodeId: 'node-2', isSnapshotted: false },
];

const makeTemplate = () => ({
  id: TEMPLATE_ID,
  name: 'pd4',
  slug: 'pd4',
  description: null,
  hasPinya: true,
  direction: 0,
  variantOrder: 1,
  familyId: FAMILY_ID,
  familyName: 'pd4',
  nodeCount: 2,
  metadata: {},
  nodes: [],
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
});

const makeFamily = () => ({
  id: FAMILY_ID,
  name: 'pd4',
  slug: 'pd4',
  description: null,
  variantCount: 2,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  metadata: {},
  variants: [
    { id: TEMPLATE_ID, name: 'pd4 — variant 1', slug: 'pd4-v1', variantOrder: 1, nodeCount: 2 },
    { id: 'template-v2', name: 'pd4 — variant 2', slug: 'pd4-v2', variantOrder: 2, nodeCount: 4 },
  ],
});

let assignmentIdCounter = 0;
const makeAssignment = (nodeId = 'inode-1', personId = 'person-1'): AssignmentDetail => ({
  id: `assignment-${++assignmentIdCounter}`,
  figureInstanceId: INSTANCE_ID,
  compositionSlotId: null,
  node: { id: nodeId, label: 'base-1', zone: 'BASE', z: 0, positionType: null, sortOrder: 0, ringLevel: null, originNodeId: null, sourceNodeId: 'node-1' },
  person: { id: personId, alias: 'Pepet', name: 'Pere', firstSurname: 'Garcia', shoulderHeight: 140 },
});

const makeAvailablePerson = (id = 'person-1'): AvailablePerson => ({
  id,
  alias: 'Pepet',
  name: 'Pere',
  firstSurname: 'Garcia',
  shoulderHeight: 140,
  isXicalla: false,
  attendanceStatus: 'ANIRE',
  nextPerformanceStatus: null,
  assignedInSegment: false,
});

type MockFn = ReturnType<typeof vi.fn>;

interface MockAssignmentService {
  getInstanceNodes: MockFn;
  getByInstance: MockFn;
  assign: MockFn;
  unassign: MockFn;
  swap: MockFn;
  upgradeInstance: MockFn;
  bulkImport: MockFn;
  getHistory: MockFn;
  getNextPerformance: MockFn;
  getAvailablePersons: MockFn;
}

describe('AssignmentCanvasComponent', () => {
  let fixture: ComponentFixture<AssignmentCanvasComponent>;
  let component: AssignmentCanvasComponent;
  let assignmentService: MockAssignmentService;
  let segmentService: { getByEvent: MockFn };
  let figureTemplateService: { getOne: MockFn };
  let familyService: { getOne: MockFn };
  let toastService: { success: MockFn; error: MockFn };
  let routerMock: { navigate: MockFn };
  let stateService: AssignmentStateService;

  beforeEach(async () => {
    assignmentIdCounter = 0;
    assignmentService = {
      getInstanceNodes: vi.fn().mockReturnValue(of({ data: makeInstanceNodes() })),
      getByInstance: vi.fn().mockReturnValue(of({ data: [] })),
      assign: vi.fn().mockImplementation(() => of(makeAssignment())),
      unassign: vi.fn().mockReturnValue(of(undefined)),
      swap: vi.fn().mockReturnValue(of({
        a: makeAssignment('inode-1', 'person-2'),
        b: makeAssignment('inode-2', 'person-1'),
      })),
      upgradeInstance: vi.fn().mockReturnValue(of({ addedNodes: 2, totalNodes: 4 })),
      bulkImport: vi.fn().mockReturnValue(of({ created: [], conflicts: [] })),
      getHistory: vi.fn().mockReturnValue(of({ data: [] })),
      getNextPerformance: vi.fn().mockReturnValue(of(null)),
      getAvailablePersons: vi.fn().mockReturnValue(of({ data: [] })),
    };

    segmentService = {
      getByEvent: vi.fn().mockReturnValue(of({ data: [makeSegment()] })),
    };

    figureTemplateService = {
      getOne: vi.fn().mockReturnValue(of(makeTemplate())),
    };

    familyService = {
      getOne: vi.fn().mockReturnValue(of(makeFamily())),
    };

    toastService = {
      success: vi.fn(),
      error: vi.fn(),
    };

    routerMock = {
      navigate: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [AssignmentCanvasComponent],
      providers: [
        { provide: NodeAssignmentService, useValue: assignmentService },
        { provide: EventSegmentService, useValue: segmentService },
        { provide: FigureTemplateService, useValue: figureTemplateService },
        { provide: FigureFamilyService, useValue: familyService },
        { provide: ToastService, useValue: toastService },
        { provide: Router, useValue: routerMock },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { params: { eventId: EVENT_ID, segmentId: SEGMENT_ID } } },
        },
        {
          provide: LUCIDE_ICONS, multi: true,
          useFactory: () => new LucideIconProvider({ ArrowLeft, Users, Edit, RefreshCw, Plus, PanelLeft, PanelLeftClose }),
        },
      ],
    })
    .overrideComponent(AssignmentCanvasComponent, {
      remove: { imports: [FigureCanvasComponent, PersonPanelComponent, NodePopoverComponent, ImportPinyaModalComponent, TroncViewComponent] },
      add: { imports: [StubFigureCanvas, StubPersonPanel, StubNodePopover, StubImportModal, StubTroncView] },
    })
    .compileComponents();

    fixture = TestBed.createComponent(AssignmentCanvasComponent);
    component = fixture.componentInstance;
    stateService = component.state;
    fixture.detectChanges();
  });

  // ── initialization ────────────────────────────────────────────────────────

  describe('initialization', () => {
    it('creates successfully', () => {
      expect(component).toBeTruthy();
    });

    it('loads segment on init', () => {
      expect(segmentService.getByEvent).toHaveBeenCalledWith(EVENT_ID);
    });

    it('first instance is active by default', () => {
      expect(stateService.activeInstanceId()).toBe(INSTANCE_ID);
    });

    it('loads instance nodes instead of template nodes', () => {
      expect(assignmentService.getInstanceNodes).toHaveBeenCalledWith(INSTANCE_ID);
    });

    it('tabs show figure name + progress', () => {
      const tabs = component.tabs();
      expect(tabs).toHaveLength(1);
      expect(tabs[0].label).toBe('pd4');
      expect(tabs[0].snapshotted).toBe(false);
    });
  });

  // ── pick and place interaction ────────────────────────────────────────────

  describe('pick and place interaction', () => {
    it('clicking empty node sets selectedNodeId', () => {
      stateService.assignments.set([]);
      component.onNodeSelected('inode-1');
      expect(stateService.selectedNodeId()).toBe('inode-1');
    });

    it('clicking person after selecting empty node triggers assign', () => {
      stateService.assignments.set([]);
      stateService.setSelectedNodeId('inode-1');
      component.onPersonSelected(makeAvailablePerson());
      expect(assignmentService.assign).toHaveBeenCalledWith(
        INSTANCE_ID,
        expect.objectContaining({ nodeId: 'inode-1', personId: 'person-1' }),
      );
    });

    it('clicking occupied node then person triggers unassign + assign (replace)', () => {
      const existing = makeAssignment('inode-1', 'old-person');
      stateService.assignments.set([existing]);
      stateService.setSelectedNodeId('inode-1');
      assignmentService.unassign.mockReturnValue(of(undefined));
      assignmentService.assign.mockImplementation(() => of(makeAssignment('inode-1', 'new-person')));

      component.onPersonSelected(makeAvailablePerson('new-person'));

      expect(assignmentService.unassign).toHaveBeenCalledWith(INSTANCE_ID, existing.id);
    });

    it('clicking person with no node selected sets selectedPersonId', () => {
      stateService.setSelectedNodeId(null);
      component.onPersonSelected(makeAvailablePerson());
      expect(stateService.selectedPersonId()).toBe('person-1');
    });

    it('clicking occupied node shows popover assignment', () => {
      const existing = makeAssignment('inode-1');
      stateService.assignments.set([existing]);
      component.onNodeSelected('inode-1');
      expect(component.popoverAssignment()).not.toBeNull();
    });
  });

  // ── swap via atomic endpoint ──────────────────────────────────────────────

  describe('swap', () => {
    it('uses atomic swap endpoint instead of 4 sequential calls', () => {
      const a1 = makeAssignment('inode-1', 'person-1');
      const a2 = makeAssignment('inode-2', 'person-2');
      stateService.assignments.set([a1, a2]);

      stateService.setSelectedNodeId('inode-1');
      component.onNodeSelected('inode-2');

      expect(assignmentService.swap).toHaveBeenCalledWith(
        INSTANCE_ID,
        { assignmentIdA: a1.id, assignmentIdB: a2.id },
      );
      expect(assignmentService.unassign).not.toHaveBeenCalled();
    });

    it('rollback on swap error and shows toast', () => {
      const a1 = makeAssignment('inode-1', 'person-1');
      const a2 = makeAssignment('inode-2', 'person-2');
      stateService.assignments.set([a1, a2]);
      assignmentService.swap.mockReturnValue(throwError(() => ({ status: 500 })));

      stateService.setSelectedNodeId('inode-1');
      component.onNodeSelected('inode-2');

      expect(toastService.error).toHaveBeenCalledWith(expect.stringContaining('intercanvi'));
    });
  });

  // ── auto-advance ──────────────────────────────────────────────────────────

  describe('auto-advance', () => {
    it('after assign, advances to next empty node', () => {
      const nodes = makeInstanceNodes();
      component.tabs.update((tabs) => tabs.map((t) => ({ ...t, nodes })));
      stateService.assignments.set([]);
      assignmentService.assign.mockReturnValue(of(makeAssignment('inode-1', 'person-1')));

      stateService.setSelectedNodeId('inode-1');
      component.onPersonSelected(makeAvailablePerson());

      expect(stateService.selectedNodeId()).toBe('inode-2');
    });
  });

  // ── optimistic UI ─────────────────────────────────────────────────────────

  describe('optimistic UI', () => {
    it('rollback on 409 error reverts assignments and shows toast', () => {
      stateService.assignments.set([]);
      assignmentService.assign.mockReturnValue(
        throwError(() => ({ status: 409, message: 'conflict' })),
      );

      stateService.setSelectedNodeId('inode-1');
      component.onPersonSelected(makeAvailablePerson());

      expect(toastService.error).toHaveBeenCalledWith(expect.stringContaining('Conflicte'));
      expect(stateService.assignments()).toHaveLength(0);
    });
  });

  // ── snapshot transition ───────────────────────────────────────────────────

  describe('snapshot transition', () => {
    it('first assignment triggers node refresh for pre-snapshot instance', () => {
      component.tabs.update((list) =>
        list.map((t) => ({ ...t, snapshotted: false, nodes: makeInstanceNodes() })),
      );
      assignmentService.assign.mockReturnValue(of(makeAssignment()));

      stateService.setSelectedNodeId('inode-1');
      component.onPersonSelected(makeAvailablePerson());

      expect(assignmentService.getInstanceNodes).toHaveBeenCalledWith(INSTANCE_ID);
    });
  });

  // ── upgrade ───────────────────────────────────────────────────────────────

  describe('upgrade', () => {
    beforeEach(() => {
      component.tabs.update((list) =>
        list.map((t) => ({
          ...t,
          familyId: FAMILY_ID,
          snapshotted: true,
          sourceVariantOrder: 1,
          nodes: makeInstanceNodes(),
        })),
      );
      component['familyDetail'].set(makeFamily());
      fixture.detectChanges();
    });

    it('canUpgrade is true when next variant exists', () => {
      expect(component.canUpgrade()).toBe(true);
    });

    it('nextVariant returns the next family variant', () => {
      expect(component.nextVariant()?.variantOrder).toBe(2);
    });

    it('confirmUpgrade calls upgradeInstance and shows toast', () => {
      const upgradedNodes = [...makeInstanceNodes(), {
        id: 'inode-3', label: 'pinya-new-1', zone: FigureZone.PINYA, z: 0,
        positionType: 'laterals', x: 300, y: 100, width: 40, height: 40,
        rotation: 0, color: null, shape: NodeShape.ELLIPSE, sortOrder: 2,
        ringLevel: 2, originNodeId: null, sourceNodeId: 'node-3', isSnapshotted: true,
      }, {
        id: 'inode-4', label: 'pinya-new-2', zone: FigureZone.PINYA, z: 0,
        positionType: 'mans', x: 400, y: 100, width: 40, height: 40,
        rotation: 0, color: null, shape: NodeShape.ELLIPSE, sortOrder: 3,
        ringLevel: 2, originNodeId: null, sourceNodeId: 'node-4', isSnapshotted: true,
      }];

      assignmentService.getInstanceNodes.mockReturnValue(of({ data: upgradedNodes }));

      component.confirmUpgrade();

      expect(assignmentService.upgradeInstance).toHaveBeenCalledWith(INSTANCE_ID);
      expect(toastService.success).toHaveBeenCalledWith(expect.stringContaining('2 posicions'));
    });

    it('upgrade error shows error toast', () => {
      assignmentService.upgradeInstance.mockReturnValue(
        throwError(() => ({ error: { message: 'No next variant' } })),
      );

      component.confirmUpgrade();

      expect(toastService.error).toHaveBeenCalled();
    });

    it('canUpgrade is false when at max variant', () => {
      component['familyDetail'].set({
        ...makeFamily(),
        variants: [{ id: TEMPLATE_ID, name: 'pd4 — variant 1', slug: 'pd4-v1', variantOrder: 1, nodeCount: 2 }],
      });
      fixture.detectChanges();

      expect(component.canUpgrade()).toBe(false);
    });
  });

  // ── tabs ──────────────────────────────────────────────────────────────────

  describe('tabs', () => {
    it('switching tab changes activeInstanceId and loads assignments', () => {
      const secondInstanceId = 'instance-uuid-2';
      component.tabs.update((list) => [
        ...list,
        {
          instanceId: secondInstanceId, label: 'pd3', figureTemplateId: TEMPLATE_ID,
          familyId: null, snapshotted: false, sourceVariantOrder: null,
          nodes: [], assignedCount: 0, totalCount: 0,
        },
      ]);

      component.selectTab(secondInstanceId);
      expect(stateService.activeInstanceId()).toBe(secondInstanceId);
      expect(assignmentService.getByInstance).toHaveBeenCalledWith(secondInstanceId);
    });
  });

  // ── bottom bar ────────────────────────────────────────────────────────────

  describe('bottom bar', () => {
    it('"Abs/Rel" toggle changes heightMode signal', () => {
      expect(stateService.heightMode()).toBe('relative');
      stateService.toggleHeightMode();
      expect(stateService.heightMode()).toBe('absolute');
    });

    it('"Lliures" counter shows correct count', () => {
      stateService.confirmedPersons.set([
        makeAvailablePerson('p1'),
        makeAvailablePerson('p2'),
      ]);
      stateService.assignments.set([makeAssignment('inode-1', 'p1')]);
      expect(stateService.freePersonsCount()).toBe(1);
    });
  });

  // ── import ────────────────────────────────────────────────────────────────

  describe('import', () => {
    it('onImportCompleted refreshes instance nodes', () => {
      const result: BulkImportResult = { created: [makeAssignment()], conflicts: [] };
      assignmentService.getInstanceNodes.mockClear();

      component.onImportCompleted(result);

      expect(assignmentService.getInstanceNodes).toHaveBeenCalledWith(INSTANCE_ID);
      expect(toastService.success).toHaveBeenCalled();
    });
  });

  // ── tronc panel & zone filtering ──────────────────────────────────────────

  describe('tronc panel', () => {
    const allNodes = makeInstanceNodes(); // inode-1=BASE, inode-2=TRONC

    beforeEach(() => {
      component.tabs.update((list) => list.map((t) => ({ ...t, nodes: allNodes })));
      fixture.detectChanges();
    });

    it('activePinyaNodes excludes TRONC-zone nodes', () => {
      const pinyaNodes = component.activePinyaNodes();
      expect(pinyaNodes.every((n) => n.zone !== FigureZone.TRONC)).toBe(true);
      expect(pinyaNodes.length).toBe(allNodes.filter((n) => n.zone !== FigureZone.TRONC).length);
    });

    it('activeTroncNodes contains only TRONC-zone nodes', () => {
      const troncNodes = component.activeTroncNodes();
      expect(troncNodes.every((n) => n.zone === FigureZone.TRONC)).toBe(true);
      expect(troncNodes.length).toBe(1);
    });

    it('activeBaseNodes contains only BASE-zone nodes', () => {
      const baseNodes = component.activeBaseNodes();
      expect(baseNodes.every((n) => n.zone === FigureZone.BASE)).toBe(true);
      expect(baseNodes.length).toBe(1);
    });

    it('troncPanelOpen defaults to true', () => {
      expect(component.troncPanelOpen()).toBe(true);
    });

    it('troncPanelOpen toggles correctly', () => {
      component.troncPanelOpen.update((v) => !v);
      expect(component.troncPanelOpen()).toBe(false);
      component.troncPanelOpen.update((v) => !v);
      expect(component.troncPanelOpen()).toBe(true);
    });
  });
});
