import { Component, input, output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import {
  LUCIDE_ICONS, LucideIconProvider,
  ArrowLeft, Users, Edit, RefreshCw, Plus, PanelLeft, PanelLeftClose, HelpCircle,
} from 'lucide-angular';
import { AssignmentCanvasComponent } from './assignment-canvas.component';
import { FigureCanvasComponent } from '../figure-canvas/figure-canvas.component';
import { PersonPanelComponent } from '../person-panel/person-panel.component';
import { NodePopoverComponent } from '../node-popover/node-popover.component';
import { ImportPinyaModalComponent } from '../import-pinya-modal/import-pinya-modal.component';
import { TroncViewComponent } from '../tronc-view/tronc-view.component';
import { AdHocNodesHelpModalComponent } from '../ad-hoc-nodes-help-modal/ad-hoc-nodes-help-modal.component';
import { NodeAssignmentService } from '../../services/node-assignment.service';
import { AssignmentStateService } from '../../services/assignment-state.service';
import { EventSegmentService } from '../../services/event-segment.service';
import { FigureTemplateService } from '../../services/figure-template.service';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';
import { AssignmentDetail, AvailablePerson, BulkImportResult, InstanceNodeItem } from '../../models/assignment.model';
import { SegmentDetail } from '../../models/segment.model';
import { FigureZone, NodeShape, AD_HOC_PINYA_PRESETS } from '@muixer/shared';

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
  readonly isPlacementMode = input<boolean>(false);
  readonly nodeSelected = output<string | null>();
  readonly nodeClicked = output<{ nodeId: string; x: number; y: number }>();
  readonly canvasClicked = output<{ x: number; y: number }>();
  readonly adHocNodeMoved = output<{ nodeId: string; x: number; y: number }>();
  readonly adHocNodeTransformed = output<{ nodeId: string; width: number; height: number; rotation: number }>();
}

@Component({ selector: 'app-person-panel', standalone: true, template: '' })
class StubPersonPanel {
  readonly eventId = input.required<string>();
  readonly segmentId = input.required<string>();
  readonly selectedNodeId = input<string | null>(null);
  readonly assignments = input<AssignmentDetail[]>([]);
  readonly heightMode = input<string>('relative');
  readonly activeNodePositionType = input<string | null>(null);
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
  // eslint-disable-next-line @angular-eslint/no-output-native -- stub mirrors real component
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

@Component({ selector: 'app-ad-hoc-nodes-help-modal', standalone: true, template: '' })
class StubHelpModal {
  readonly open = input<boolean>(false);
  readonly closed = output<void>();
}

// ── Test constants & factories ──────────────────────────────────────────────

const EVENT_ID = 'event-uuid-1';
const SEGMENT_ID = 'segment-uuid-1';
const INSTANCE_ID = 'instance-uuid-1';
const TEMPLATE_ID = 'template-uuid-1';

const makeInstance = (overrides = {}) => ({
  id: INSTANCE_ID,
  label: null,
  sortOrder: 0,
  snapshotted: false,
  assignedCount: 0,
  numberOfCordons: null,
  openCordons: null,
  projectionX: null,
  projectionY: null,
  projectionScale: 1,
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
  { id: 'inode-1', label: 'base-1', zone: FigureZone.BASE, z: 0, positionType: null, x: 100, y: 100, width: 60, height: 40, rotation: 0, color: null, shape: NodeShape.ELLIPSE, sortOrder: 0, ringLevel: null, originNodeId: null, renglaId: null, renglaPosition: null, sourceNodeId: 'node-1', isSnapshotted: false, isAdHoc: false, createdById: null },
  { id: 'inode-2', label: 'tronc-1', zone: FigureZone.TRONC, z: 1, positionType: null, x: 200, y: 100, width: 60, height: 40, rotation: 0, color: null, shape: NodeShape.ELLIPSE, sortOrder: 1, ringLevel: null, originNodeId: null, renglaId: null, renglaPosition: null, sourceNodeId: 'node-2', isSnapshotted: false, isAdHoc: false, createdById: null },
];

const makeTemplate = () => ({
  id: TEMPLATE_ID,
  name: 'pd4',
  slug: 'pd4',
  description: null,
  hasPinya: true,
  direction: 0,
  nodeCount: 2,
  renglaCount: 0,
  metadata: {},
  nodes: [],
  rengles: [],
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
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
  positions: [],
});

type MockFn = ReturnType<typeof vi.fn>;

interface MockAssignmentService {
  getInstanceNodes: MockFn;
  getByInstance: MockFn;
  assign: MockFn;
  unassign: MockFn;
  swap: MockFn;
  updateCordons: MockFn;
  resetSnapshot: MockFn;
  bulkImport: MockFn;
  getHistory: MockFn;
  createAdHocNode: MockFn;
  updateAdHocNode: MockFn;
  deleteAdHocNode: MockFn;
  getNextPerformance: MockFn;
  getAvailablePersons: MockFn;
  getLockStatus: MockFn;
}

describe('AssignmentCanvasComponent', () => {
  let fixture: ComponentFixture<AssignmentCanvasComponent>;
  let component: AssignmentCanvasComponent;
  let assignmentService: MockAssignmentService;
  let segmentService: { getByEvent: MockFn };
  let figureTemplateService: { getOne: MockFn };
  let toastService: { success: MockFn; error: MockFn; info: MockFn; warning: MockFn };
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
      updateCordons: vi.fn().mockReturnValue(of({ numberOfCordons: null, openCordons: null })),
      resetSnapshot: vi.fn().mockReturnValue(of({ removedAssignments: 0, deletedAdHocCount: 0 })),
      bulkImport: vi.fn().mockReturnValue(of({ created: [], conflicts: [], clonedAdHocNodes: 0 })),
      getHistory: vi.fn().mockReturnValue(of({ data: [] })),
      createAdHocNode: vi.fn().mockReturnValue(of(makeInstanceNodes()[0])),
      updateAdHocNode: vi.fn().mockReturnValue(of(makeInstanceNodes()[0])),
      deleteAdHocNode: vi.fn().mockReturnValue(of(undefined)),
      getNextPerformance: vi.fn().mockReturnValue(of(null)),
      getAvailablePersons: vi.fn().mockReturnValue(of({ data: [] })),
      getLockStatus: vi.fn().mockReturnValue(of({ locked: false, lockDate: null, lockDays: 2 })),
    };

    segmentService = {
      getByEvent: vi.fn().mockReturnValue(of({ data: [makeSegment()] })),
    };

    figureTemplateService = {
      getOne: vi.fn().mockReturnValue(of(makeTemplate())),
    };

    toastService = {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
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
        { provide: ToastService, useValue: toastService },
        { provide: Router, useValue: routerMock },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { params: { eventId: EVENT_ID, segmentId: SEGMENT_ID } } },
        },
        {
          provide: LUCIDE_ICONS, multi: true,
          useFactory: () => new LucideIconProvider({ ArrowLeft, Users, Edit, RefreshCw, Plus, PanelLeft, PanelLeftClose, HelpCircle }),
        },
      ],
    })
    .overrideComponent(AssignmentCanvasComponent, {
      remove: { imports: [FigureCanvasComponent, PersonPanelComponent, NodePopoverComponent, ImportPinyaModalComponent, TroncViewComponent, AdHocNodesHelpModalComponent] },
      add: { imports: [StubFigureCanvas, StubPersonPanel, StubNodePopover, StubImportModal, StubTroncView, StubHelpModal] },
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

  // ── cordons ──────────────────────────────────────────────────────────────

  describe('cordons', () => {
    it('hasCordonsConfig is false when no rengles are loaded', () => {
      expect(component.hasCordonsConfig()).toBe(false);
    });

    it('hasCordonsConfig is true when rengles are present', () => {
      component['templateRengles'].set([
        { id: 'r1', name: 'Mans', sortOrder: 0, startPosition: 1, allowsCordoObert: true },
      ]);
      expect(component.hasCordonsConfig()).toBe(true);
    });

    it('renglesWithCordoObert filters only allowsCordoObert=true', () => {
      component['templateRengles'].set([
        { id: 'r1', name: 'Mans', sortOrder: 0, startPosition: 1, allowsCordoObert: true },
        { id: 'r2', name: 'Vents', sortOrder: 1, startPosition: 1, allowsCordoObert: false },
      ]);
      expect(component.renglesWithCordoObert().length).toBe(1);
      expect(component.renglesWithCordoObert()[0].id).toBe('r1');
    });

    it('onCordonsSaved calls updateCordons and reloads nodes', () => {
      assignmentService.updateCordons.mockReturnValue(of({ numberOfCordons: 2, openCordons: null }));
      assignmentService.getInstanceNodes.mockReturnValue(of({ data: makeInstanceNodes() }));

      component.onCordonsSaved({ numberOfCordons: 2, openCordons: [] });

      expect(assignmentService.updateCordons).toHaveBeenCalledWith(INSTANCE_ID, {
        numberOfCordons: 2,
        openCordons: null,
      });
      expect(toastService.success).toHaveBeenCalled();
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
          snapshotted: false,
          numberOfCordons: null, openCordons: null,
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
      const result: BulkImportResult = { created: [makeAssignment()], conflicts: [], clonedAdHocNodes: 0 };
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

    it('troncPanelOpen defaults to false (floating panel, user opens)', () => {
      expect(component.troncPanelOpen()).toBe(false);
    });

    it('troncPanelOpen toggles correctly', () => {
      component.troncPanelOpen.update((v) => !v);
      expect(component.troncPanelOpen()).toBe(true);
      component.troncPanelOpen.update((v) => !v);
      expect(component.troncPanelOpen()).toBe(false);
    });
  });

  // ── ad-hoc nodes ───────────────────────────────────────────────────────────

  describe('ad-hoc nodes', () => {
    const adHocNode: InstanceNodeItem = {
      id: 'adhoc-1', label: 'Cordó obert', zone: FigureZone.PINYA, z: 0,
      positionType: 'cordo-obert', x: 150, y: 200, width: 80, height: 40,
      rotation: 0, color: '#FFF9C4', shape: NodeShape.ELLIPSE, sortOrder: 10,
      ringLevel: null, originNodeId: null, renglaId: null, renglaPosition: null,
      sourceNodeId: null, isSnapshotted: true, isAdHoc: true, createdById: 'user-1',
    };

    const dispatchKey = (key: string) => {
      const event = new KeyboardEvent('keydown', { key, bubbles: true });
      document.body.dispatchEvent(event);
    };

    it('onPresetSelected with non-comodin preset enters placement mode', () => {
      const preset = AD_HOC_PINYA_PRESETS.find((p) => !p.requiresCustomLabel)!;
      component.onPresetSelected(preset);
      expect(stateService.isPlacementMode()).toBe(true);
      expect(stateService.placementPreset()).toBe(preset);
    });

    it('onPresetSelected with comodin opens label input', () => {
      const comodin = AD_HOC_PINYA_PRESETS.find((p) => p.requiresCustomLabel)!;
      component.onPresetSelected(comodin);
      expect(component.comodinInputOpen()).toBe(true);
      expect(stateService.isPlacementMode()).toBe(false);
    });

    it('Escape exits placement mode', () => {
      const preset = AD_HOC_PINYA_PRESETS[0];
      stateService.enterPlacementMode(preset);
      expect(stateService.isPlacementMode()).toBe(true);

      dispatchKey('Escape');
      expect(stateService.isPlacementMode()).toBe(false);
    });

    it('onCanvasClicked during placement calls createAdHocNode', () => {
      const preset = AD_HOC_PINYA_PRESETS[0];
      stateService.enterPlacementMode(preset);
      stateService.activeInstanceId.set(INSTANCE_ID);

      component.onCanvasClicked({ x: 300, y: 400 });

      expect(assignmentService.createAdHocNode).toHaveBeenCalledWith(
        INSTANCE_ID,
        expect.objectContaining({ x: 300, y: 400, zone: preset.zone }),
      );
    });

    it('Backspace on selected ad-hoc node (unassigned) calls deleteAdHocNode', () => {
      const nodesWithAdHoc = [...makeInstanceNodes(), adHocNode];
      component.tabs.update((list) => list.map((t) => ({ ...t, nodes: nodesWithAdHoc })));
      stateService.selectedNodeId.set('adhoc-1');
      stateService.assignments.set([]);
      fixture.detectChanges();

      dispatchKey('Delete');
      expect(assignmentService.deleteAdHocNode).toHaveBeenCalledWith(INSTANCE_ID, 'adhoc-1');
    });

    it('Backspace on selected ad-hoc node (assigned) opens confirmation modal', () => {
      const nodesWithAdHoc = [...makeInstanceNodes(), adHocNode];
      component.tabs.update((list) => list.map((t) => ({ ...t, nodes: nodesWithAdHoc })));
      stateService.selectedNodeId.set('adhoc-1');
      stateService.assignments.set([{
        ...makeAssignment('adhoc-1', 'person-1'),
        node: { id: 'adhoc-1', label: 'Cordó obert', zone: 'PINYA', z: 0, positionType: 'cordo-obert', sortOrder: 10, ringLevel: null, originNodeId: null, sourceNodeId: null },
      }]);
      fixture.detectChanges();

      dispatchKey('Backspace');
      expect(component.deleteAdHocModalOpen()).toBe(true);
      expect(component.pendingDeleteNodeLabel()).toBe('Cordó obert');
      expect(component.pendingDeletePersonName()).toBe('Pepet');
    });

    it('Backspace on template node does nothing', () => {
      stateService.selectedNodeId.set('inode-1');
      dispatchKey('Delete');
      expect(assignmentService.deleteAdHocNode).not.toHaveBeenCalled();
      expect(component.deleteAdHocModalOpen()).toBe(false);
    });

    it('refreshInstanceNodes updates activeTabNodes for reset warning', () => {
      const nodesWithAdHoc = [...makeInstanceNodes(), adHocNode];
      assignmentService.getInstanceNodes.mockReturnValue(of({ data: nodesWithAdHoc }));
      stateService.activeInstanceId.set(INSTANCE_ID);

      component['refreshInstanceNodes'](INSTANCE_ID);

      expect(stateService.activeTabNodes()).toEqual(nodesWithAdHoc);
      expect(stateService.hasAdHocNodes()).toBe(true);
    });

    it('onEditTemplate shows info toast and navigates', () => {
      component.tabs.update((list) => list.map((t) => ({
        ...t, figureTemplateId: TEMPLATE_ID,
      })));
      fixture.detectChanges();

      component.onEditTemplate();
      expect(toastService.info).toHaveBeenCalledWith(
        'Els canvis al template no afecten instàncies ja creades.',
      );
      expect(routerMock.navigate).toHaveBeenCalledWith(
        ['/pinyes', 'templates', TEMPLATE_ID, 'edit'],
      );
    });
  });
});
