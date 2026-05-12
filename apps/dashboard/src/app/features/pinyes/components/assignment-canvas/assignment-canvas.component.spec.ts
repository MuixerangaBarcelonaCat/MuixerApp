import { Component, input, output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import {
  LUCIDE_ICONS, LucideIconProvider,
  ArrowLeft, Users, Edit, RefreshCw,
} from 'lucide-angular';
import { AssignmentCanvasComponent } from './assignment-canvas.component';
import { FigureCanvasComponent } from '../figure-canvas/figure-canvas.component';
import { PersonPanelComponent } from '../person-panel/person-panel.component';
import { NodePopoverComponent } from '../node-popover/node-popover.component';
import { ImportPinyaModalComponent } from '../import-pinya-modal/import-pinya-modal.component';
import { NodeAssignmentService } from '../../services/node-assignment.service';
import { AssignmentStateService } from '../../services/assignment-state.service';
import { EventSegmentService } from '../../services/event-segment.service';
import { FigureTemplateService } from '../../services/figure-template.service';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';
import { AssignmentDetail, AvailablePerson, BulkImportResult } from '../../models/assignment.model';
import { SegmentDetail } from '../../models/segment.model';
import { FigureNodeItem } from '../../models/figure-template.model';
import { FigureZone, NodeShape } from '@muixer/shared';

// ── Stub child components (avoid Konva/DOM issues in JSDOM) ───────────────────

@Component({ selector: 'app-figure-canvas', standalone: true, template: '' })
class StubFigureCanvas {
  readonly nodes = input<FigureNodeItem[]>([]);
  readonly mode = input<string>('editor');
  readonly selectedNodeId = input<string | null>(null);
  readonly assignments = input<AssignmentDetail[]>([]);
  readonly heightMode = input<string>('relative');
  readonly attendanceMap = input<Map<string, string>>(new Map());
  readonly nodeSelected = output<string | null>();
}

@Component({ selector: 'app-person-panel', standalone: true, template: '' })
class StubPersonPanel {
  readonly eventId = input.required<string>();
  readonly segmentId = input.required<string>();
  readonly selectedNodeId = input<string | null>(null);
  readonly assignments = input<AssignmentDetail[]>([]);
  readonly heightMode = input<string>('relative');
  readonly personSelected = output<AvailablePerson>();
}

@Component({ selector: 'app-node-popover', standalone: true, template: '' })
class StubNodePopover {
  readonly assignment = input<AssignmentDetail | null>(null);
  readonly position = input<{ x: number; y: number }>({ x: 0, y: 0 });
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

const EVENT_ID = 'event-uuid-1';
const SEGMENT_ID = 'segment-uuid-1';
const INSTANCE_ID = 'instance-uuid-1';
const TEMPLATE_ID = 'template-uuid-1';

const makeInstance = () => ({
  id: INSTANCE_ID,
  label: null,
  sortOrder: 0,
  figureTemplate: { id: TEMPLATE_ID, name: 'pd4' },
  compositionTemplate: null,
});

const makeSegment = (): SegmentDetail => ({
  id: SEGMENT_ID,
  name: 'Bloc A',
  sortOrder: 0,
  startTime: null,
  endTime: null,
  notes: null,
  isVisible: false,
  instances: [makeInstance()],
});

const makeTemplateNodes = (): FigureNodeItem[] => [
  { id: 'node-1', label: 'base-1', zone: FigureZone.BASE, z: 0, positionType: null, x: 100, y: 100, width: 60, height: 40, rotation: 0, color: null, shape: NodeShape.ELLIPSE, sortOrder: 0, climbPath: null, metadata: {} },
  { id: 'node-2', label: 'tronc-1', zone: FigureZone.TRONC, z: 1, positionType: null, x: 200, y: 100, width: 60, height: 40, rotation: 0, color: null, shape: NodeShape.ELLIPSE, sortOrder: 1, climbPath: null, metadata: {} },
];

const makeTemplate = () => ({
  id: TEMPLATE_ID,
  name: 'pd4',
  slug: 'pd4',
  description: null,
  hasPinya: true,
  direction: 0,
  nodeCount: 2,
  metadata: {},
  nodes: makeTemplateNodes(),
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
});

let assignmentIdCounter = 0;
const makeAssignment = (nodeId = 'node-1', personId = 'person-1'): AssignmentDetail => ({
  id: `assignment-${++assignmentIdCounter}`,
  figureInstanceId: INSTANCE_ID,
  compositionSlotId: null,
  node: { id: nodeId, label: 'base-1', zone: 'BASE', z: 0, positionType: null, sortOrder: 0 },
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

describe('AssignmentCanvasComponent', () => {
  let fixture: ComponentFixture<AssignmentCanvasComponent>;
  let component: AssignmentCanvasComponent;
  let assignmentService: {
    getByInstance: ReturnType<typeof vi.fn>;
    assign: ReturnType<typeof vi.fn>;
    unassign: ReturnType<typeof vi.fn>;
    bulkImport: ReturnType<typeof vi.fn>;
    getHistory: ReturnType<typeof vi.fn>;
    getNextPerformance: ReturnType<typeof vi.fn>;
    getAvailablePersons: ReturnType<typeof vi.fn>;
  };
  let segmentService: { getByEvent: ReturnType<typeof vi.fn> };
  let figureTemplateService: { getOne: ReturnType<typeof vi.fn> };
  let toastService: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let routerMock: { navigate: ReturnType<typeof vi.fn> };
  let stateService: AssignmentStateService;

  beforeEach(async () => {
    assignmentIdCounter = 0;
    assignmentService = {
      getByInstance: vi.fn().mockReturnValue(of({ data: [] })),
      assign: vi.fn().mockImplementation(() => of(makeAssignment())),
      unassign: vi.fn().mockReturnValue(of(undefined)),
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
        { provide: ToastService, useValue: toastService },
        { provide: Router, useValue: routerMock },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { params: { eventId: EVENT_ID, segmentId: SEGMENT_ID } } },
        },
        {
          provide: LUCIDE_ICONS, multi: true,
          useFactory: () => new LucideIconProvider({ ArrowLeft, Users, Edit, RefreshCw }),
        },
      ],
    })
    .overrideComponent(AssignmentCanvasComponent, {
      remove: { imports: [FigureCanvasComponent, PersonPanelComponent, NodePopoverComponent, ImportPinyaModalComponent] },
      add: { imports: [StubFigureCanvas, StubPersonPanel, StubNodePopover, StubImportModal] },
    })
    .compileComponents();

    fixture = TestBed.createComponent(AssignmentCanvasComponent);
    component = fixture.componentInstance;
    stateService = component.state;
    fixture.detectChanges();
  });

  // ── initialization ─────────────────────────────────────────────────────────

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

    it('tabs show figure name + progress', () => {
      const tabs = component.tabs();
      expect(tabs).toHaveLength(1);
      expect(tabs[0].label).toBe('pd4');
    });
  });

  // ── pick and place interaction ─────────────────────────────────────────────

  describe('pick and place interaction', () => {
    it('clicking empty node sets selectedNodeId', () => {
      stateService.assignments.set([]);
      component.onNodeSelected('node-1');
      expect(stateService.selectedNodeId()).toBe('node-1');
    });

    it('clicking person after selecting empty node triggers assign', () => {
      stateService.assignments.set([]);
      stateService.setSelectedNodeId('node-1');
      const person = makeAvailablePerson();
      component.onPersonSelected(person);
      expect(assignmentService.assign).toHaveBeenCalledWith(
        INSTANCE_ID,
        expect.objectContaining({ nodeId: 'node-1', personId: 'person-1' }),
      );
    });

    it('clicking occupied node then person triggers unassign + assign (replace)', () => {
      const existing = makeAssignment('node-1', 'old-person');
      stateService.assignments.set([existing]);
      stateService.setSelectedNodeId('node-1');
      assignmentService.unassign.mockReturnValue(of(undefined));
      assignmentService.assign.mockImplementation(() => of(makeAssignment('node-1', 'new-person')));

      component.onPersonSelected(makeAvailablePerson('new-person'));

      expect(assignmentService.unassign).toHaveBeenCalledWith(INSTANCE_ID, existing.id);
    });

    it('clicking person with no node selected sets selectedPersonId', () => {
      stateService.setSelectedNodeId(null);
      component.onPersonSelected(makeAvailablePerson());
      expect(stateService.selectedPersonId()).toBe('person-1');
    });

    it('clicking occupied node shows popover assignment', () => {
      const existing = makeAssignment('node-1');
      stateService.assignments.set([existing]);
      component.onNodeSelected('node-1');
      expect(component.popoverAssignment()).not.toBeNull();
    });

    it('clicking empty node then person (via person selected) triggers assign', () => {
      stateService.assignments.set([]);
      // Select a person first, then select a node
      stateService.setSelectedPersonId('person-1');
      component.onNodeSelected('node-1');
      expect(assignmentService.assign).toHaveBeenCalledWith(
        INSTANCE_ID,
        expect.objectContaining({ nodeId: 'node-1', personId: 'person-1' }),
      );
    });
  });

  // ── auto-advance ───────────────────────────────────────────────────────────

  describe('auto-advance', () => {
    it('after assign, advances to next empty node', () => {
      const template = makeTemplate();
      component.tabs.update((tabs) => tabs.map((t) => ({ ...t, nodes: template.nodes })));
      stateService.assignments.set([]);
      assignmentService.assign.mockReturnValue(of(makeAssignment('node-1', 'person-1')));

      stateService.setSelectedNodeId('node-1');
      component.onPersonSelected(makeAvailablePerson());

      // After assign completes, should select node-2 (next empty)
      expect(stateService.selectedNodeId()).toBe('node-2');
    });

    it('if no more empty nodes, selectedNodeId becomes null', () => {
      const template = makeTemplate();
      component.tabs.update((tabs) => tabs.map((t) => ({ ...t, nodes: template.nodes })));
      // Both nodes assigned
      stateService.assignments.set([
        makeAssignment('node-1', 'person-1'),
        makeAssignment('node-2', 'person-2'),
      ]);
      assignmentService.assign.mockReturnValue(of(makeAssignment('node-1', 'person-1')));

      stateService.setSelectedNodeId('node-1');
      component.onPersonSelected(makeAvailablePerson());

      expect(stateService.selectedNodeId()).toBeNull();
    });
  });

  // ── optimistic UI ──────────────────────────────────────────────────────────

  describe('optimistic UI', () => {
    it('assign paints immediately before HTTP response', () => {
      stateService.assignments.set([]);
      const subject = vi.fn();
      // Use a cold observable to delay response
      assignmentService.assign.mockReturnValue({
        subscribe: (obs: any) => {
          // Store the observer without calling it immediately
          subject.mockImplementation(obs.next);
          return { unsubscribe: vi.fn() };
        },
      });

      stateService.setSelectedNodeId('node-1');
      component.onPersonSelected(makeAvailablePerson());

      // Optimistically added before server responds
      expect(stateService.assignments().length).toBeGreaterThan(0);
    });

    it('rollback on 409 error reverts assignments and shows toast', () => {
      stateService.assignments.set([]);
      assignmentService.assign.mockReturnValue(
        throwError(() => ({ status: 409, message: 'conflict' })),
      );

      stateService.setSelectedNodeId('node-1');
      component.onPersonSelected(makeAvailablePerson());

      expect(toastService.error).toHaveBeenCalledWith(expect.stringContaining('Conflicte'));
      expect(stateService.assignments()).toHaveLength(0);
    });
  });

  // ── tabs ───────────────────────────────────────────────────────────────────

  describe('tabs', () => {
    it('switching tab changes activeInstanceId and loads assignments', () => {
      const secondInstanceId = 'instance-uuid-2';
      component.tabs.update((list) => [
        ...list,
        { instanceId: secondInstanceId, label: 'pd3', figureTemplateId: TEMPLATE_ID, nodes: [], assignedCount: 0, totalCount: 0 },
      ]);

      component.selectTab(secondInstanceId);
      expect(stateService.activeInstanceId()).toBe(secondInstanceId);
      expect(assignmentService.getByInstance).toHaveBeenCalledWith(secondInstanceId);
    });
  });

  // ── bottom bar ─────────────────────────────────────────────────────────────

  describe('bottom bar', () => {
    it('"Abs/Rel" toggle changes heightMode signal', () => {
      expect(stateService.heightMode()).toBe('relative');
      stateService.toggleHeightMode();
      expect(stateService.heightMode()).toBe('absolute');
    });

    it('"Lliures" counter shows correct count (ANIRE not assigned)', () => {
      stateService.confirmedPersons.set([
        makeAvailablePerson('p1'),
        makeAvailablePerson('p2'),
      ]);
      stateService.assignments.set([makeAssignment('node-1', 'p1')]);
      expect(stateService.freePersonsCount()).toBe(1);
    });
  });
});
