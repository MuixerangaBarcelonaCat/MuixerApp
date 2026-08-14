import { FigureCanvasComponent, CompositionSlotWithNodes, SegmentNodeRef, AssignmentDetail, HeightMode, InstanceNodeItem, UpdateAdHocNodePayload, InstanceDetail, SegmentDetail } from '@muixer/pinyes-render';
import { Component, input, output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, it, expect, vi } from 'vitest';
import { allLucideIconsProvider } from '../../../../../../../testing/lucide-test-provider';
import { NodesTabComponent } from './nodes-tab.component';
import { AdHocNodePropertiesComponent } from '../../../ad-hoc-node-properties/ad-hoc-node-properties.component';
import { SegmentWorkspaceStateService } from '../../../../services/segment-workspace-state.service';
import { AssignmentStateService } from '../../../../services/assignment-state.service';
import { UndoRedoService } from '../../../../services/undo-redo.service';
import { EventSegmentService } from '../../../../services/event-segment.service';
import { SegmentDistributionService } from '../../../../services/segment-distribution.service';
import { NodeAssignmentService } from '../../../../services/node-assignment.service';
import { ToastService } from '../../../../../../shared/components/feedback/toast/toast.service';

// ── Stub children ────────────────────────────────────────────────────────────

@Component({ selector: 'app-figure-canvas', standalone: true, template: '' })
class StubFigureCanvas {
  readonly mode = input<string>('editor');
  readonly compositionSlots = input<CompositionSlotWithNodes[]>([]);
  readonly assignments = input<AssignmentDetail[]>([]);
  readonly conflictPersonIds = input<Set<string>>(new Set());
  readonly selectedSegmentNode = input<SegmentNodeRef | null>(null);
  readonly dimmedSlotIds = input<Set<string>>(new Set());
  readonly isPlacementMode = input<boolean>(false);
  readonly placementSlotId = input<string | null>(null);
  readonly adHocNodesEditable = input<boolean>(false);
  readonly isPast = input<boolean>(false);
  readonly segmentNodeSelected = output<SegmentNodeRef | null>();
  readonly canvasClicked = output<{ x: number; y: number }>();
  readonly segmentAdHocNodeMoved = output<SegmentNodeRef & { x: number; y: number }>();
  readonly segmentAdHocNodeTransformed = output<
    SegmentNodeRef & { x: number; y: number; width: number; height: number; rotation: number }
  >();
  zoomIn = vi.fn();
  zoomOut = vi.fn();
}

@Component({ selector: 'app-ad-hoc-node-properties', standalone: true, template: '' })
class StubAdHocNodeProperties {
  readonly node = input.required<InstanceNodeItem>();
  readonly instanceId = input.required<string>();
  readonly assignment = input<AssignmentDetail | null>(null);
  readonly heightMode = input<HeightMode>('relative');
  readonly attendanceStatus = input<string | null>(null);
  readonly isPast = input<boolean>(false);
  readonly closed = output<void>();
  readonly nodeUpdated = output<void>();
  readonly deleteRequested = output<string>();
  readonly duplicateRequested = output<void>();
  readonly propertyChanged = output<{ nodeId: string; patch: Partial<UpdateAdHocNodePayload> }>();
  readonly unassign = output<AssignmentDetail>();
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
// Always bumps the counter (even when personId is passed) so every assignment gets a
// unique `as-N` id — the old default-param form reused the previous id on explicit personId.
const makeAssignment = (instanceId: string, nodeId: string, personId?: string): AssignmentDetail => {
  const seq = ++assignmentSeq;
  const pid = personId ?? `p-${seq}`;
  return {
    id: `as-${seq}`,
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
      id: pid,
      alias: `Alias ${pid}`,
      name: 'Nom',
      firstSurname: 'Cognom',
      shoulderHeight: null,
      notes: null,
      notesEmoji: null,
    },
  };
};

type MockFn = ReturnType<typeof vi.fn>;

describe('NodesTabComponent', () => {
  let fixture: ComponentFixture<NodesTabComponent>;
  let component: NodesTabComponent;
  let ws: SegmentWorkspaceStateService;
  let state: AssignmentStateService;
  let assignmentService: {
    getInstanceNodes: MockFn;
    getByInstance: MockFn;
    getAvailablePersons: MockFn;
    getLockStatus: MockFn;
    getSegmentConflicts: MockFn;
    createAdHocNode: MockFn;
    updateAdHocNode: MockFn;
    deleteAdHocNode: MockFn;
  };
  let toast: { success: MockFn; error: MockFn; info: MockFn };

  // Reset the module-level assignment id counter so tests don't depend on execution order.
  beforeEach(() => {
    assignmentSeq = 0;
  });

  const setup = async (opts: {
    instances?: InstanceDetail[];
    nodesByInstance?: Record<string, InstanceNodeItem[]>;
    assignmentsByInstance?: Record<string, AssignmentDetail[]>;
  } = {}) => {
    const segment = makeSegment(opts.instances ?? [makeInstance(INST_A)]);
    const defaultNodes: Record<string, InstanceNodeItem[]> = opts.nodesByInstance ?? {
      [INST_A]: [makeNode('n1', 'PINYA'), makeNode('adhoc-1', 'PINYA', { isAdHoc: true, positionType: 'comodin' })],
    };

    assignmentService = {
      getInstanceNodes: vi.fn((instanceId: string) => of({ data: defaultNodes[instanceId] ?? [] })),
      getByInstance: vi.fn((instanceId: string) =>
        of({ data: opts.assignmentsByInstance?.[instanceId] ?? [] }),
      ),
      getAvailablePersons: vi.fn().mockReturnValue(of({ data: [] })),
      getSegmentConflicts: vi.fn().mockReturnValue(of({ data: [] })),
      getLockStatus: vi.fn().mockReturnValue(of({ locked: false, lockDate: null, lockDays: 3 })),
      createAdHocNode: vi.fn().mockReturnValue(of(makeNode('new-1', 'PINYA', { isAdHoc: true }))),
      updateAdHocNode: vi.fn().mockReturnValue(of(makeNode('adhoc-1', 'PINYA', { isAdHoc: true }))),
      deleteAdHocNode: vi.fn().mockReturnValue(of(undefined)),
    };
    toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [NodesTabComponent],
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
      .overrideComponent(NodesTabComponent, {
        remove: { imports: [FigureCanvasComponent, AdHocNodePropertiesComponent] },
        add: { imports: [StubFigureCanvas, StubAdHocNodeProperties] },
      })
      .compileComponents();

    ws = TestBed.inject(SegmentWorkspaceStateService);
    state = TestBed.inject(AssignmentStateService);
    ws.load(EVENT_ID, SEGMENT_ID);

    fixture = TestBed.createComponent(NodesTabComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  const canvasStub = (): StubFigureCanvas =>
    fixture.debugElement.query((n) => n.componentInstance instanceof StubFigureCanvas)
      ?.componentInstance as StubFigureCanvas;

  const panelStub = (): StubAdHocNodeProperties | null =>
    (fixture.debugElement.query((n) => n.componentInstance instanceof StubAdHocNodeProperties)
      ?.componentInstance as StubAdHocNodeProperties) ?? null;

  describe('rendering', () => {
    it('renders the figure selector with every instance of the segment', async () => {
      await setup({ instances: [makeInstance(INST_A), makeInstance(INST_B)] });

      expect(component.ws.instances().map((i) => i.instanceId)).toEqual([INST_A, INST_B]);
    });

    it('renders the canvas in segment-assignment mode with the workspace pinya slots', async () => {
      await setup();
      const stub = canvasStub();

      expect(stub.mode()).toBe('segment-assignment');
      expect(stub.compositionSlots().map((s) => s.slotId)).toEqual([INST_A]);
    });

    it('makes ad-hoc nodes editable on the canvas and targets placement at the selected figure', async () => {
      await setup();
      ws.selectInstance(INST_A);
      fixture.detectChanges();

      expect(canvasStub().adHocNodesEditable()).toBe(true);
      expect(canvasStub().placementSlotId()).toBe(INST_A);
    });

    it('dims every figure except the selected one', async () => {
      await setup({
        instances: [makeInstance(INST_A), makeInstance(INST_B)],
        nodesByInstance: {
          [INST_A]: [makeNode('n1', 'PINYA')],
          [INST_B]: [makeNode('m1', 'PINYA')],
        },
      });
      ws.selectInstance(INST_A);
      fixture.detectChanges();

      expect(canvasStub().dimmedSlotIds()).toEqual(new Set([INST_B]));
    });
  });

  describe('figure selection', () => {
    it('selecting a figure updates the workspace selection and clears the node selection', async () => {
      await setup({
        instances: [makeInstance(INST_A), makeInstance(INST_B)],
        nodesByInstance: {
          [INST_A]: [makeNode('n1', 'PINYA')],
          [INST_B]: [makeNode('m1', 'PINYA')],
        },
      });
      component.onSegmentNodeSelected({ slotId: INST_A, nodeId: 'n1' });

      component.selectFigure(INST_B);

      expect(ws.selectedInstanceId()).toBe(INST_B);
      expect(component.selectedRef()).toBeNull();
    });
  });

  describe('node selection', () => {
    it('selecting an ad-hoc node opens the properties panel with the right node and instance', async () => {
      await setup();

      component.onSegmentNodeSelected({ slotId: INST_A, nodeId: 'adhoc-1' });
      fixture.detectChanges();

      expect(component.selectedRef()).toEqual({ slotId: INST_A, nodeId: 'adhoc-1' });
      expect(component.selectedAdHocNode()?.id).toBe('adhoc-1');
      expect(panelStub()?.node().id).toBe('adhoc-1');
      expect(panelStub()?.instanceId()).toBe(INST_A);
    });

    it('selecting a template (non ad-hoc) node selects the figure but does not open the panel', async () => {
      await setup();

      component.onSegmentNodeSelected({ slotId: INST_A, nodeId: 'n1' });
      fixture.detectChanges();

      expect(ws.selectedInstanceId()).toBe(INST_A);
      expect(component.selectedAdHocNode()).toBeNull();
      expect(panelStub()).toBeNull();
    });

    it('selecting null clears the selection', async () => {
      await setup();
      component.onSegmentNodeSelected({ slotId: INST_A, nodeId: 'adhoc-1' });

      component.onSegmentNodeSelected(null);

      expect(component.selectedRef()).toBeNull();
    });

    it('keeps the same selectedRef object identity when re-selecting the same node', async () => {
      await setup();
      component.onSegmentNodeSelected({ slotId: INST_A, nodeId: 'adhoc-1' });
      const first = component.selectedRef();

      component.onSegmentNodeSelected({ slotId: INST_A, nodeId: 'adhoc-1' });

      expect(component.selectedRef()).toBe(first);
    });
  });

  describe('presets and placement mode', () => {
    it('selecting a normal preset enters placement mode directly', async () => {
      await setup();

      component.onPresetSelected(component.adHocPresets[0]);

      expect(state.isPlacementMode()).toBe(true);
      expect(state.placementPreset()).toBe(component.adHocPresets[0]);
      expect(component.comodinInputOpen()).toBe(false);
    });

    it('selecting a preset that requires a custom label opens the comodí dialog instead', async () => {
      await setup();
      const comodinPreset = component.adHocPresets.find((p) => p.requiresCustomLabel)!;

      component.onPresetSelected(comodinPreset);

      expect(component.comodinInputOpen()).toBe(true);
      expect(state.isPlacementMode()).toBe(false);
    });

    it('confirming the comodí label enters placement mode with the custom label', async () => {
      await setup();
      const comodinPreset = component.adHocPresets.find((p) => p.requiresCustomLabel)!;
      component.onPresetSelected(comodinPreset);
      component.comodinLabel.set('Reforç extra');

      component.confirmComodinLabel();

      expect(state.isPlacementMode()).toBe(true);
      expect(state.placementCustomLabel()).toBe('Reforç extra');
      expect(component.comodinInputOpen()).toBe(false);
    });

    it('canceling the comodí dialog does not enter placement mode', async () => {
      await setup();
      const comodinPreset = component.adHocPresets.find((p) => p.requiresCustomLabel)!;
      component.onPresetSelected(comodinPreset);

      component.cancelComodinInput();

      expect(component.comodinInputOpen()).toBe(false);
      expect(state.isPlacementMode()).toBe(false);
    });
  });

  describe('creating ad-hoc nodes', () => {
    it('creates a node for the selected figure when the canvas is clicked in placement mode', async () => {
      await setup();
      ws.selectInstance(INST_A);
      component.onPresetSelected(component.adHocPresets[0]);

      component.onCanvasClicked({ x: 120, y: 80 });

      expect(assignmentService.createAdHocNode).toHaveBeenCalledWith(
        INST_A,
        expect.objectContaining({ x: 120, y: 80, zone: component.adHocPresets[0].zone }),
      );
      expect(state.isPlacementMode()).toBe(false);
    });

    it('does nothing when the canvas is clicked outside placement mode', async () => {
      await setup();

      component.onCanvasClicked({ x: 120, y: 80 });

      expect(assignmentService.createAdHocNode).not.toHaveBeenCalled();
    });
  });

  describe('editing ad-hoc nodes', () => {
    it('updates the node optimistically and calls the service', async () => {
      await setup();
      component.onSegmentNodeSelected({ slotId: INST_A, nodeId: 'adhoc-1' });

      component.onAdHocPropertyChanged({ nodeId: 'adhoc-1', patch: { x: 200 } });

      expect(assignmentService.updateAdHocNode).toHaveBeenCalledWith(INST_A, 'adhoc-1', { x: 200 });
      const node = ws.instances().find((i) => i.instanceId === INST_A)?.nodes.find((n) => n.id === 'adhoc-1');
      expect(node?.x).toBe(200);
    });

    it('updates the node position when dragged directly on the canvas', async () => {
      await setup();

      component.onSegmentAdHocNodeMoved({ slotId: INST_A, nodeId: 'adhoc-1', x: 42, y: 84 });

      expect(assignmentService.updateAdHocNode).toHaveBeenCalledWith(INST_A, 'adhoc-1', { x: 42, y: 84 });
      const node = ws.instances().find((i) => i.instanceId === INST_A)?.nodes.find((n) => n.id === 'adhoc-1');
      expect(node).toMatchObject({ x: 42, y: 84 });
    });

    it('updates size/rotation when resized via the canvas transformer', async () => {
      await setup();

      component.onSegmentAdHocNodeTransformed({
        slotId: INST_A,
        nodeId: 'adhoc-1',
        x: 10,
        y: 20,
        width: 60,
        height: 40,
        rotation: 45,
      });

      expect(assignmentService.updateAdHocNode).toHaveBeenCalledWith(INST_A, 'adhoc-1', {
        x: 10,
        y: 20,
        width: 60,
        height: 40,
        rotation: 45,
      });
    });
  });

  describe('deleting ad-hoc nodes', () => {
    it('deletes an unassigned ad-hoc node immediately', async () => {
      await setup();
      component.onSegmentNodeSelected({ slotId: INST_A, nodeId: 'adhoc-1' });

      component.onDeleteRequested('adhoc-1');

      expect(assignmentService.deleteAdHocNode).toHaveBeenCalledWith(INST_A, 'adhoc-1');
      expect(component.deleteModalOpen()).toBe(false);
    });

    it('asks for confirmation before deleting an assigned ad-hoc node', async () => {
      await setup({ assignmentsByInstance: { [INST_A]: [makeAssignment(INST_A, 'adhoc-1')] } });
      component.onSegmentNodeSelected({ slotId: INST_A, nodeId: 'adhoc-1' });

      component.onDeleteRequested('adhoc-1');

      expect(component.deleteModalOpen()).toBe(true);
      expect(assignmentService.deleteAdHocNode).not.toHaveBeenCalled();

      component.confirmDelete();

      expect(assignmentService.deleteAdHocNode).toHaveBeenCalledWith(INST_A, 'adhoc-1');
    });
  });

  describe('duplicate and copy/paste', () => {
    it('duplicates the selected node offset by 20px', async () => {
      await setup();
      component.onSegmentNodeSelected({ slotId: INST_A, nodeId: 'adhoc-1' });

      component.duplicateSelected();

      expect(assignmentService.createAdHocNode).toHaveBeenCalledWith(
        INST_A,
        expect.objectContaining({ x: 20, y: 20 }),
      );
    });

    it('copies then pastes the selected node with Ctrl+C / Ctrl+V', async () => {
      await setup();
      component.onSegmentNodeSelected({ slotId: INST_A, nodeId: 'adhoc-1' });

      component.onKeyDown(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true }));
      component.onKeyDown(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true }));

      expect(assignmentService.createAdHocNode).toHaveBeenCalledWith(
        INST_A,
        expect.objectContaining({ x: 20, y: 20, label: 'adhoc-1' }),
      );
    });
  });

  describe('keyboard', () => {
    it('Escape clears the selection', async () => {
      await setup();
      component.onSegmentNodeSelected({ slotId: INST_A, nodeId: 'adhoc-1' });

      component.onKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(component.selectedRef()).toBeNull();
    });

    it('Escape exits placement mode when active', async () => {
      await setup();
      component.onPresetSelected(component.adHocPresets[0]);

      component.onKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(state.isPlacementMode()).toBe(false);
    });

    it('Delete removes the selected ad-hoc node', async () => {
      await setup();
      component.onSegmentNodeSelected({ slotId: INST_A, nodeId: 'adhoc-1' });

      component.onKeyDown(new KeyboardEvent('keydown', { key: 'Delete' }));

      expect(assignmentService.deleteAdHocNode).toHaveBeenCalledWith(INST_A, 'adhoc-1');
    });

    it('arrow keys nudge the selected ad-hoc node', async () => {
      await setup();
      component.onSegmentNodeSelected({ slotId: INST_A, nodeId: 'adhoc-1' });

      component.onKeyDown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));

      expect(assignmentService.updateAdHocNode).toHaveBeenCalledWith(INST_A, 'adhoc-1', { x: 1, y: 0 });
    });

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

  describe('mobile guard (WI-13 parity, P-M2/GE-H3)', () => {
    it('renders the canvas by default (no matchMedia)', async () => {
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
      });
    });
  });
});
