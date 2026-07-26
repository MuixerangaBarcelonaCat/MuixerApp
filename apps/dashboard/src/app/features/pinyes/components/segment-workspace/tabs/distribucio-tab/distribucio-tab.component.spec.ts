import { Component, input, output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, it, expect, vi } from 'vitest';
import { allLucideIconsProvider } from '../../../../../../../testing/lucide-test-provider';
import { DistribucioTabComponent } from './distribucio-tab.component';
import { FigureCanvasComponent, CompositionSlotWithNodes, CanvasMode } from '../../../figure-canvas/figure-canvas.component';
import {
  FigurePropertiesPanelComponent,
  FigurePropertiesEntry,
} from '../../../figure-properties-panel/figure-properties-panel.component';
import { SegmentWorkspaceStateService } from '../../../../services/segment-workspace-state.service';
import { AssignmentStateService } from '../../../../services/assignment-state.service';
import { UndoRedoService } from '../../../../services/undo-redo.service';
import { EventSegmentService } from '../../../../services/event-segment.service';
import { SegmentDistributionService } from '../../../../services/segment-distribution.service';
import { NodeAssignmentService } from '../../../../services/node-assignment.service';
import { FigureInstanceService } from '../../../../services/figure-instance.service';
import { ToastService } from '../../../../../../shared/components/feedback/toast/toast.service';
import { InstanceDetail, SegmentDetail } from '../../../../models/segment.model';
import { SegmentDistributionData } from '../../../../models/distribution.model';

// ── Stub children ────────────────────────────────────────────────────────────

@Component({ selector: 'app-figure-canvas', standalone: true, template: '' })
class StubFigureCanvas {
  readonly mode = input<CanvasMode>('composition');
  readonly compositionSlots = input<CompositionSlotWithNodes[]>([]);
  readonly selectedSlotId = input<string | null>(null);
  readonly gridEnabled = input<boolean>(false);
  readonly gridSpacing = input<number>(20);
  readonly snapToGrid = input<boolean>(false);
  readonly slotSelected = output<string | null>();
  readonly slotMoved = output<{ slotId: string; offsetX: number; offsetY: number; angle: number }>();
  readonly troncMoved = output<{ slotId: string; troncPanelX: number | null; troncPanelY: number | null }>();
  centerOnContent = vi.fn();
  setZoom = vi.fn();
}

@Component({ selector: 'app-figure-properties-panel', standalone: true, template: '' })
class StubPropertiesPanel {
  readonly entry = input.required<FigurePropertiesEntry>();
  readonly showRemove = input(true);
  readonly labelChanged = output<{ id: string; value: string | null }>();
  readonly figureModeChanged = output<{ id: string; value: string }>();
  readonly numberOfCordonsChanged = output<{ id: string; value: number | null }>();
  readonly cordonsObertsEnabledChanged = output<{ id: string; value: boolean }>();
  readonly offsetXChanged = output<{ id: string; value: number }>();
  readonly offsetYChanged = output<{ id: string; value: number }>();
  readonly angleChanged = output<{ id: string; value: number }>();
  readonly removeRequested = output<string>();
}

// ── Factories ────────────────────────────────────────────────────────────────

const EVENT_ID = 'event-1';
const SEGMENT_ID = 'seg-1';
const INST_A = 'inst-a';
const INST_B = 'inst-b';

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

const makeDistributionNode = (
  id: string,
  zone: string,
  overrides: { renglaId?: string | null; renglaPosition?: number | null; positionType?: string | null } = {},
) => ({
  id,
  label: id,
  zone,
  x: 0,
  y: 0,
  width: 30,
  height: 30,
  rotation: 0,
  color: null,
  shape: 'RECTANGLE',
  renglaId: null,
  renglaPosition: null,
  positionType: null,
  ...overrides,
});

const makeDistributionItem = (
  instanceId: string,
  overrides: Partial<SegmentDistributionData['items'][number]> = {},
): SegmentDistributionData['items'][number] => ({
  instanceId,
  label: null,
  figureMode: 'COMPLETA',
  numberOfCordons: null,
  cordonsObertsEnabled: true,
  assignments: [],
  figureTemplate: {
    id: `tpl-${instanceId}`,
    name: `Figura ${instanceId}`,
    nodes: [makeDistributionNode('n1', 'PINYA')],
  },
  troncGridCols: 2,
  troncGridRows: 3,
  projectionX: 100,
  projectionY: 50,
  projectionAngle: 0,
  troncPanelX: null,
  troncPanelY: null,
  troncPanelWidth: null,
  troncPanelHeight: null,
  ...overrides,
});

type MockFn = ReturnType<typeof vi.fn>;

describe('DistribucioTabComponent', () => {
  let fixture: ComponentFixture<DistribucioTabComponent>;
  let component: DistribucioTabComponent;
  let ws: SegmentWorkspaceStateService;
  let distributionService: { getDistribution: MockFn; saveDistribution: MockFn; clearDistribution: MockFn };
  let instanceService: { update: MockFn };
  let assignmentService: { getInstanceNodes: MockFn; getByInstance: MockFn; getAvailablePersons: MockFn; getLockStatus: MockFn; updateCordons: MockFn };
  let toast: { success: MockFn; error: MockFn; info: MockFn };

  const setup = async (opts: {
    instances?: InstanceDetail[];
    items?: SegmentDistributionData['items'];
  } = {}) => {
    const segment = makeSegment(opts.instances ?? [makeInstance(INST_A)]);
    const items = opts.items ?? [makeDistributionItem(INST_A)];

    distributionService = {
      getDistribution: vi.fn().mockReturnValue(
        of({ segment: { id: SEGMENT_ID, name: 'Bloc 1' }, items }),
      ),
      saveDistribution: vi.fn().mockReturnValue(of(undefined)),
      clearDistribution: vi.fn().mockReturnValue(of(undefined)),
    };
    instanceService = { update: vi.fn().mockReturnValue(of(makeInstance(INST_A))) };
    assignmentService = {
      getInstanceNodes: vi.fn().mockReturnValue(of({ data: [] })),
      getByInstance: vi.fn().mockReturnValue(of({ data: [] })),
      getAvailablePersons: vi.fn().mockReturnValue(of({ data: [] })),
      getLockStatus: vi.fn().mockReturnValue(of({ locked: false, lockDate: null, lockDays: 3 })),
      updateCordons: vi.fn().mockReturnValue(of({ numberOfCordons: 2, cordonsObertsEnabled: true })),
    };
    toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [DistribucioTabComponent],
      providers: [
        allLucideIconsProvider,
        SegmentWorkspaceStateService,
        AssignmentStateService,
        UndoRedoService,
        { provide: EventSegmentService, useValue: { getByEvent: vi.fn().mockReturnValue(of({ data: [segment] })) } },
        { provide: SegmentDistributionService, useValue: distributionService },
        { provide: NodeAssignmentService, useValue: assignmentService },
        { provide: FigureInstanceService, useValue: instanceService },
        { provide: ToastService, useValue: toast },
      ],
    })
      .overrideComponent(DistribucioTabComponent, {
        remove: { imports: [FigureCanvasComponent, FigurePropertiesPanelComponent] },
        add: { imports: [StubFigureCanvas, StubPropertiesPanel] },
      })
      .compileComponents();

    ws = TestBed.inject(SegmentWorkspaceStateService);
    ws.load(EVENT_ID, SEGMENT_ID);

    fixture = TestBed.createComponent(DistribucioTabComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  const canvasStub = (): StubFigureCanvas =>
    fixture.debugElement.query((n) => n.componentInstance instanceof StubFigureCanvas)
      ?.componentInstance as StubFigureCanvas;

  const panelStub = (): StubPropertiesPanel | null =>
    (fixture.debugElement.query((n) => n.componentInstance instanceof StubPropertiesPanel)
      ?.componentInstance as StubPropertiesPanel) ?? null;

  describe('loading', () => {
    it('loads the distribution for the workspace event/segment', async () => {
      await setup();
      expect(distributionService.getDistribution).toHaveBeenCalledWith(EVENT_ID, SEGMENT_ID);
    });

    it('renders the canvas in composition mode with the mapped slots', async () => {
      await setup({ items: [makeDistributionItem(INST_A), makeDistributionItem(INST_B)] });
      const stub = canvasStub();
      expect(stub.mode()).toBe('composition');
      expect(stub.compositionSlots().map((s) => s.slotId)).toEqual([INST_A, INST_B]);
    });

    it('centers the viewport on the content once after load', async () => {
      vi.useFakeTimers();
      await setup();

      vi.runAllTimers();

      expect(canvasStub().centerOnContent).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });

    it('sets the zoom to 75% before centering', async () => {
      vi.useFakeTimers();
      await setup();

      vi.runAllTimers();

      expect(canvasStub().setZoom).toHaveBeenCalledWith(0.75);
      vi.useRealTimers();
    });
  });

  describe('selection', () => {
    it('selecting a slot sets ws.selectedInstanceId and shows its properties', async () => {
      await setup();

      component.onSlotSelected(INST_A);

      expect(ws.selectedInstanceId()).toBe(INST_A);
      expect(component.selectedSlotId()).toBe(INST_A);
    });

    it('preselects the slot already selected in the workspace on init', async () => {
      ws = undefined as unknown as SegmentWorkspaceStateService;
      const segment = makeSegment([makeInstance(INST_A), makeInstance(INST_B)]);
      distributionService = {
        getDistribution: vi.fn().mockReturnValue(
          of({ segment: { id: SEGMENT_ID, name: 'Bloc 1' }, items: [makeDistributionItem(INST_A), makeDistributionItem(INST_B)] }),
        ),
        saveDistribution: vi.fn().mockReturnValue(of(undefined)),
        clearDistribution: vi.fn().mockReturnValue(of(undefined)),
      };
      instanceService = { update: vi.fn() };
      assignmentService = {
        getInstanceNodes: vi.fn().mockReturnValue(of({ data: [] })),
        getByInstance: vi.fn().mockReturnValue(of({ data: [] })),
        getAvailablePersons: vi.fn().mockReturnValue(of({ data: [] })),
        getLockStatus: vi.fn().mockReturnValue(of({ locked: false, lockDate: null, lockDays: 3 })),
        updateCordons: vi.fn(),
      };
      toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

      await TestBed.configureTestingModule({
        imports: [DistribucioTabComponent],
        providers: [
          allLucideIconsProvider,
          SegmentWorkspaceStateService,
          AssignmentStateService,
          UndoRedoService,
          { provide: EventSegmentService, useValue: { getByEvent: vi.fn().mockReturnValue(of({ data: [segment] })) } },
          { provide: SegmentDistributionService, useValue: distributionService },
          { provide: NodeAssignmentService, useValue: assignmentService },
          { provide: FigureInstanceService, useValue: instanceService },
          { provide: ToastService, useValue: toast },
        ],
      })
        .overrideComponent(DistribucioTabComponent, {
          remove: { imports: [FigureCanvasComponent, FigurePropertiesPanelComponent] },
          add: { imports: [StubFigureCanvas, StubPropertiesPanel] },
        })
        .compileComponents();

      ws = TestBed.inject(SegmentWorkspaceStateService);
      ws.load(EVENT_ID, SEGMENT_ID);
      ws.selectInstance(INST_B);

      fixture = TestBed.createComponent(DistribucioTabComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component.selectedSlotId()).toBe(INST_B);
    });
  });

  describe('slot movement', () => {
    it('slotMoved updates the local slot position and saves immediately', async () => {
      await setup();

      component.onSlotMoved({ slotId: INST_A, offsetX: 200, offsetY: 300, angle: 45 });

      const slot = component.slots().find((s) => s.slotId === INST_A);
      expect(slot?.offsetX).toBe(200);
      expect(slot?.offsetY).toBe(300);
      expect(slot?.angle).toBe(45);
      expect(distributionService.saveDistribution).toHaveBeenCalledWith(
        EVENT_ID,
        SEGMENT_ID,
        expect.arrayContaining([expect.objectContaining({ instanceId: INST_A, x: 200, y: 300, angle: 45 })]),
      );
    });

    it('troncMoved updates the tronc panel position and saves', async () => {
      await setup();

      component.onTroncMoved({ slotId: INST_A, troncPanelX: 120, troncPanelY: 80 });

      const slot = component.slots().find((s) => s.slotId === INST_A);
      expect(slot?.troncPanelX).toBe(120);
      expect(slot?.troncPanelY).toBe(80);
      expect(distributionService.saveDistribution).toHaveBeenCalledWith(
        EVENT_ID,
        SEGMENT_ID,
        expect.arrayContaining([expect.objectContaining({ instanceId: INST_A, troncPanelX: 120, troncPanelY: 80 })]),
      );
    });
  });

  describe('properties panel', () => {
    it('passes the selected slot as a properties entry, hiding the remove button', async () => {
      await setup();
      component.onSlotSelected(INST_A);
      fixture.detectChanges();

      const panel = panelStub();
      expect(panel?.entry()).toMatchObject({ id: INST_A, offsetX: 100, offsetY: 50, angle: 0 });
      expect(panel?.showRemove()).toBe(false);
    });

    it('computes maxCordons from the raw (unfiltered) distribution item nodes', async () => {
      await setup({
        items: [
          makeDistributionItem(INST_A, {
            figureTemplate: {
              id: 'tpl-a',
              name: 'Figura a',
              nodes: [
                makeDistributionNode('n1', 'PINYA', { renglaId: 'r1', renglaPosition: 1 }),
                makeDistributionNode('n2', 'PINYA', { renglaId: 'r1', renglaPosition: 4 }),
              ],
            },
          }),
        ],
      });
      component.onSlotSelected(INST_A);
      fixture.detectChanges();

      expect(panelStub()?.entry().maxCordons).toBe(4);
    });

    it('excludes cordo-obert nodes from maxCordons', async () => {
      await setup({
        items: [
          makeDistributionItem(INST_A, {
            figureTemplate: {
              id: 'tpl-a',
              name: 'Figura a',
              nodes: [
                makeDistributionNode('n1', 'PINYA', { renglaId: 'r1', renglaPosition: 1 }),
                makeDistributionNode('n2', 'PINYA', { renglaId: 'r1', renglaPosition: 4, positionType: 'cordo-obert' }),
              ],
            },
          }),
        ],
      });
      component.onSlotSelected(INST_A);
      fixture.detectChanges();

      expect(panelStub()?.entry().maxCordons).toBe(1);
    });

    it('sources hasPinya from the workspace instance (template-intrinsic, not distribution data)', async () => {
      await setup({ instances: [makeInstance(INST_A, { figureTemplate: { id: 'tpl-a', name: 'Torreta', hasPinya: false } })] });
      component.onSlotSelected(INST_A);
      fixture.detectChanges();

      expect(panelStub()?.entry().hasPinya).toBe(false);
    });

    it('sources numberOfCordons and figureMode from the distribution item, not the (possibly stale) workspace instance list', async () => {
      // ws.instances() is populated from a separate endpoint (EventSegmentService) that
      // this tab never re-fetches; the distribution item is this tab's own fresh data.
      await setup({
        instances: [makeInstance(INST_A, { numberOfCordons: 1, figureMode: 'COMPLETA' })],
        items: [makeDistributionItem(INST_A, { numberOfCordons: 3, figureMode: 'PEU' })],
      });
      component.onSlotSelected(INST_A);
      fixture.detectChanges();

      expect(panelStub()?.entry()).toMatchObject({ numberOfCordons: 3, figureMode: 'PEU' });
    });

    it('offsetX/Y/angle changes update the slot and save', async () => {
      await setup();
      component.onSlotSelected(INST_A);

      component.onOffsetXChanged({ id: INST_A, value: 500 });

      const slot = component.slots().find((s) => s.slotId === INST_A);
      expect(slot?.offsetX).toBe(500);
      expect(distributionService.saveDistribution).toHaveBeenCalled();
    });

    it('label change calls the instance update endpoint and updates the slot label optimistically', async () => {
      await setup();
      component.onSlotSelected(INST_A);

      component.onLabelChanged({ id: INST_A, value: 'Pilar central' });

      expect(instanceService.update).toHaveBeenCalledWith(EVENT_ID, SEGMENT_ID, INST_A, { label: 'Pilar central' });
      const slot = component.slots().find((s) => s.slotId === INST_A);
      expect(slot?.label).toBe('Pilar central');
    });

    it('figureMode change calls the instance update endpoint and reloads the distribution', async () => {
      await setup();
      component.onSlotSelected(INST_A);
      distributionService.getDistribution.mockClear();

      component.onFigureModeChanged({ id: INST_A, value: 'REMAT' });

      expect(instanceService.update).toHaveBeenCalledWith(EVENT_ID, SEGMENT_ID, INST_A, { figureMode: 'REMAT' });
      expect(distributionService.getDistribution).toHaveBeenCalledWith(EVENT_ID, SEGMENT_ID);
    });

    it('numberOfCordons change calls updateCordons and reloads the distribution', async () => {
      await setup();
      component.onSlotSelected(INST_A);
      distributionService.getDistribution.mockClear();

      component.onNumberOfCordonsChanged({ id: INST_A, value: 2 });

      expect(assignmentService.updateCordons).toHaveBeenCalledWith(INST_A, { numberOfCordons: 2 });
      expect(distributionService.getDistribution).toHaveBeenCalledWith(EVENT_ID, SEGMENT_ID);
    });

    it('does not call updateCordons directly when decreasing cordons would remove assignments — asks for confirmation first', async () => {
      const items = [
        makeDistributionItem(INST_A, {
          numberOfCordons: 3,
          figureTemplate: {
            id: 'tpl-a',
            name: 'Figura a',
            nodes: [
              makeDistributionNode('n1', 'PINYA', { renglaId: 'r1', renglaPosition: 1 }),
              makeDistributionNode('n2', 'PINYA', { renglaId: 'r1', renglaPosition: 2 }),
            ],
          },
          assignments: [{ figureNodeId: 'n2', personAlias: 'JoanP' }],
        }),
      ];
      await setup({ items });
      component.onSlotSelected(INST_A);

      component.onNumberOfCordonsChanged({ id: INST_A, value: 1 });

      expect(assignmentService.updateCordons).not.toHaveBeenCalled();
      expect(component.pendingCordonsChange()).toEqual({ id: INST_A, value: 1, affectedCount: 1 });
    });

    it('calls updateCordons once the pending cordons change is confirmed', async () => {
      const items = [
        makeDistributionItem(INST_A, {
          numberOfCordons: 3,
          figureTemplate: {
            id: 'tpl-a',
            name: 'Figura a',
            nodes: [makeDistributionNode('n2', 'PINYA', { renglaId: 'r1', renglaPosition: 2 })],
          },
          assignments: [{ figureNodeId: 'n2', personAlias: 'JoanP' }],
        }),
      ];
      await setup({ items });
      component.onSlotSelected(INST_A);
      component.onNumberOfCordonsChanged({ id: INST_A, value: 1 });
      distributionService.getDistribution.mockClear();

      component.confirmCordonsChange();

      expect(assignmentService.updateCordons).toHaveBeenCalledWith(INST_A, { numberOfCordons: 1 });
      expect(distributionService.getDistribution).toHaveBeenCalledWith(EVENT_ID, SEGMENT_ID);
      expect(component.pendingCordonsChange()).toBeNull();
    });

    it('does not call updateCordons when the pending cordons change is cancelled', async () => {
      const items = [
        makeDistributionItem(INST_A, {
          numberOfCordons: 3,
          figureTemplate: {
            id: 'tpl-a',
            name: 'Figura a',
            nodes: [makeDistributionNode('n2', 'PINYA', { renglaId: 'r1', renglaPosition: 2 })],
          },
          assignments: [{ figureNodeId: 'n2', personAlias: 'JoanP' }],
        }),
      ];
      await setup({ items });
      component.onSlotSelected(INST_A);
      component.onNumberOfCordonsChanged({ id: INST_A, value: 1 });

      component.cancelCordonsChange();

      expect(assignmentService.updateCordons).not.toHaveBeenCalled();
      expect(component.pendingCordonsChange()).toBeNull();
    });

    it('does not ask for confirmation when decreasing cordons affects no assignments', async () => {
      const items = [
        makeDistributionItem(INST_A, {
          numberOfCordons: 3,
          figureTemplate: {
            id: 'tpl-a',
            name: 'Figura a',
            nodes: [makeDistributionNode('n2', 'PINYA', { renglaId: 'r1', renglaPosition: 2 })],
          },
          assignments: [],
        }),
      ];
      await setup({ items });
      component.onSlotSelected(INST_A);

      component.onNumberOfCordonsChanged({ id: INST_A, value: 1 });

      expect(assignmentService.updateCordons).toHaveBeenCalledWith(INST_A, { numberOfCordons: 1 });
      expect(component.pendingCordonsChange()).toBeNull();
    });

    it('does not ask for confirmation when increasing cordons', async () => {
      const items = [
        makeDistributionItem(INST_A, {
          numberOfCordons: 1,
          figureTemplate: {
            id: 'tpl-a',
            name: 'Figura a',
            nodes: [makeDistributionNode('n2', 'PINYA', { renglaId: 'r1', renglaPosition: 2 })],
          },
          assignments: [{ figureNodeId: 'n2', personAlias: 'JoanP' }],
        }),
      ];
      await setup({ items });
      component.onSlotSelected(INST_A);

      component.onNumberOfCordonsChanged({ id: INST_A, value: 3 });

      expect(assignmentService.updateCordons).toHaveBeenCalledWith(INST_A, { numberOfCordons: 3 });
      expect(component.pendingCordonsChange()).toBeNull();
    });

    it('does not count a cordo-obert node assignment as affected (it stays visible regardless of cordons)', async () => {
      const items = [
        makeDistributionItem(INST_A, {
          numberOfCordons: 3,
          figureTemplate: {
            id: 'tpl-a',
            name: 'Figura a',
            nodes: [
              makeDistributionNode('co', 'PINYA', { renglaId: 'r1', renglaPosition: 2, positionType: 'cordo-obert' }),
            ],
          },
          assignments: [{ figureNodeId: 'co', personAlias: 'JoanP' }],
        }),
      ];
      await setup({ items });
      component.onSlotSelected(INST_A);

      component.onNumberOfCordonsChanged({ id: INST_A, value: 1 });

      expect(assignmentService.updateCordons).toHaveBeenCalledWith(INST_A, { numberOfCordons: 1 });
      expect(component.pendingCordonsChange()).toBeNull();
    });
  });

  describe('responsive layout (WI-10, P-H1)', () => {
    it('stacks the canvas above the properties panel on narrow viewports instead of a fixed-width side-by-side row', async () => {
      // P-H1: a fixed-width `aside` (w-70 / 280px) in a row layout squeezes the canvas
      // container to 0px at 393px, crashing Konva. The row must become a column below `sm`.
      await setup();
      component.onSlotSelected(INST_A);
      fixture.detectChanges();

      const root = fixture.nativeElement.querySelector(':scope > div.flex') as HTMLElement;
      expect(root.className).toContain('flex-col');
      expect(root.className).toContain('sm:flex-row');
    });

    it('lets the properties aside take the full width (bounded height) below `sm`, and reverts to a fixed side column at `sm` and up', async () => {
      await setup();
      component.onSlotSelected(INST_A);
      fixture.detectChanges();

      const aside = fixture.nativeElement.querySelector('aside') as HTMLElement;
      expect(aside.className).toContain('w-full');
      // Fixed width restored at `sm`+ via an arbitrary value: the bare `w-70` utility
      // doesn't exist in Tailwind's default spacing scale (64 -> 72, no 70) and silently
      // produced no CSS at all, so it never actually constrained the aside's width.
      expect(aside.className).toMatch(/sm:w-\[\d+px\]/);
      // Bounded on mobile so the canvas above it always keeps real, non-zero space.
      expect(aside.className).toMatch(/max-h-\[\d+(?:vh|px)\]/);
    });
  });

  describe('cordons oberts checkbox', () => {
    it('passes hasCordoObertNodes and cordonsObertsEnabled to the properties entry', async () => {
      await setup({
        items: [
          makeDistributionItem(INST_A, {
            cordonsObertsEnabled: false,
            figureTemplate: {
              id: 'tpl-a',
              name: 'Figura a',
              nodes: [makeDistributionNode('co', 'PINYA', { positionType: 'cordo-obert' })],
            },
          }),
        ],
      });
      component.onSlotSelected(INST_A);
      fixture.detectChanges();

      expect(panelStub()?.entry()).toMatchObject({ hasCordoObertNodes: true, cordonsObertsEnabled: false });
    });

    it('hasCordoObertNodes is false when the figure has no cordo-obert nodes', async () => {
      await setup({
        items: [
          makeDistributionItem(INST_A, {
            figureTemplate: {
              id: 'tpl-a',
              name: 'Figura a',
              nodes: [makeDistributionNode('n1', 'PINYA')],
            },
          }),
        ],
      });
      component.onSlotSelected(INST_A);
      fixture.detectChanges();

      expect(panelStub()?.entry().hasCordoObertNodes).toBe(false);
    });

    it('enabling cordonsObertsEnabled calls updateCordons directly and reloads the distribution', async () => {
      await setup();
      component.onSlotSelected(INST_A);
      distributionService.getDistribution.mockClear();

      component.onCordonsObertsEnabledChanged({ id: INST_A, value: true });

      expect(assignmentService.updateCordons).toHaveBeenCalledWith(INST_A, { cordonsObertsEnabled: true });
      expect(distributionService.getDistribution).toHaveBeenCalledWith(EVENT_ID, SEGMENT_ID);
    });

    it('disabling with no cordo-obert assignments calls updateCordons directly', async () => {
      const items = [
        makeDistributionItem(INST_A, {
          figureTemplate: {
            id: 'tpl-a',
            name: 'Figura a',
            nodes: [makeDistributionNode('co', 'PINYA', { positionType: 'cordo-obert' })],
          },
          assignments: [],
        }),
      ];
      await setup({ items });
      component.onSlotSelected(INST_A);

      component.onCordonsObertsEnabledChanged({ id: INST_A, value: false });

      expect(assignmentService.updateCordons).toHaveBeenCalledWith(INST_A, { cordonsObertsEnabled: false });
      expect(component.pendingCordonsObertsChange()).toBeNull();
    });

    it('disabling with existing cordo-obert assignments asks for confirmation first', async () => {
      const items = [
        makeDistributionItem(INST_A, {
          figureTemplate: {
            id: 'tpl-a',
            name: 'Figura a',
            nodes: [makeDistributionNode('co', 'PINYA', { positionType: 'cordo-obert' })],
          },
          assignments: [{ figureNodeId: 'co', personAlias: 'JoanP' }],
        }),
      ];
      await setup({ items });
      component.onSlotSelected(INST_A);

      component.onCordonsObertsEnabledChanged({ id: INST_A, value: false });

      expect(assignmentService.updateCordons).not.toHaveBeenCalled();
      expect(component.pendingCordonsObertsChange()).toEqual({ id: INST_A, affectedCount: 1 });
    });

    it('confirming the pending cordons oberts change calls updateCordons and reloads', async () => {
      const items = [
        makeDistributionItem(INST_A, {
          figureTemplate: {
            id: 'tpl-a',
            name: 'Figura a',
            nodes: [makeDistributionNode('co', 'PINYA', { positionType: 'cordo-obert' })],
          },
          assignments: [{ figureNodeId: 'co', personAlias: 'JoanP' }],
        }),
      ];
      await setup({ items });
      component.onSlotSelected(INST_A);
      component.onCordonsObertsEnabledChanged({ id: INST_A, value: false });
      distributionService.getDistribution.mockClear();

      component.confirmCordonsObertsChange();

      expect(assignmentService.updateCordons).toHaveBeenCalledWith(INST_A, { cordonsObertsEnabled: false });
      expect(distributionService.getDistribution).toHaveBeenCalledWith(EVENT_ID, SEGMENT_ID);
      expect(component.pendingCordonsObertsChange()).toBeNull();
    });

    it('cancelling the pending cordons oberts change does not call updateCordons', async () => {
      const items = [
        makeDistributionItem(INST_A, {
          figureTemplate: {
            id: 'tpl-a',
            name: 'Figura a',
            nodes: [makeDistributionNode('co', 'PINYA', { positionType: 'cordo-obert' })],
          },
          assignments: [{ figureNodeId: 'co', personAlias: 'JoanP' }],
        }),
      ];
      await setup({ items });
      component.onSlotSelected(INST_A);
      component.onCordonsObertsEnabledChanged({ id: INST_A, value: false });

      component.cancelCordonsObertsChange();

      expect(assignmentService.updateCordons).not.toHaveBeenCalled();
      expect(component.pendingCordonsObertsChange()).toBeNull();
    });
  });

  describe('reset distribution', () => {
    it('clears the distribution and reloads it', async () => {
      await setup();
      distributionService.getDistribution.mockClear();

      component.onResetDistribution();

      expect(distributionService.clearDistribution).toHaveBeenCalledWith(EVENT_ID, SEGMENT_ID);
      expect(distributionService.getDistribution).toHaveBeenCalledWith(EVENT_ID, SEGMENT_ID);
      expect(toast.success).toHaveBeenCalled();
    });
  });
});
