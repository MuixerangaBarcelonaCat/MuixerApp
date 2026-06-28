import { Component, input } from '@angular/core';
import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { DistributionEditorComponent } from './distribution-editor.component';
import { SegmentDistributionService } from '../../services/segment-distribution.service';
import { LayoutService } from '../../../../core/services/layout.service';
import { CanvasStateService } from '../../services/canvas-state.service';
import { SegmentDistributionData } from '../../models/distribution.model';
import { FigureCanvasComponent, CompositionSlotWithNodes, CanvasMode } from '../figure-canvas/figure-canvas.component';

@Component({ selector: 'app-figure-canvas', standalone: true, template: '' })
class FigureCanvasStub {
  readonly mode = input<CanvasMode>('composition');
  readonly compositionSlots = input<CompositionSlotWithNodes[]>([]);
  readonly selectedSlotId = input<string | null>(null);
  readonly gridEnabled = input<boolean>(false);
  readonly gridSpacing = input<number>(20);
  readonly snapToGrid = input<boolean>(false);
  fitAllSlots() {}
}

const EVENT_ID = 'event-uuid-1';
const SEGMENT_ID = 'seg-uuid-1';
const INST_A = 'inst-a';
const INST_B = 'inst-b';

const makeDistributionNode = (id: string, zone: string, renglaId: string | null = null, renglaPosition: number | null = null) => ({
  id,
  label: id,
  zone,
  x: 0, y: 0, width: 30, height: 30, rotation: 0,
  color: null,
  shape: 'RECTANGLE',
  renglaId,
  renglaPosition,
});

const itemWithPosition = (instanceId: string, x: number, y: number, angle = 0) => ({
  instanceId,
  label: null as string | null,
  figureMode: 'COMPLETA',
  numberOfCordons: null as number | null,
  assignments: [] as { figureNodeId: string; personAlias: string }[],
  figureTemplate: { id: 'fig-1', name: 'pd4', nodes: [] as ReturnType<typeof makeDistributionNode>[] },
  projectionX: x,
  projectionY: y,
  projectionAngle: angle,
  troncPanelX: null,
  troncPanelY: null,
  troncPanelWidth: null,
  troncPanelHeight: null,
});

const itemNoPosition = (instanceId: string) => ({
  ...itemWithPosition(instanceId, 0, 0),
  projectionX: null,
  projectionY: null,
  projectionAngle: null,
});

const makeDistributionData = (items: SegmentDistributionData['items']): SegmentDistributionData => ({
  segment: { id: SEGMENT_ID, name: 'Bloc 1' },
  items,
});

describe('DistributionEditorComponent', () => {
  let component: DistributionEditorComponent;
  let distributionService: { getDistribution: ReturnType<typeof vi.fn>; saveDistribution: ReturnType<typeof vi.fn>; clearDistribution: ReturnType<typeof vi.fn> };
  let layoutService: { requestFullscreen: ReturnType<typeof vi.fn>; exitFullscreen: ReturnType<typeof vi.fn> };
  let location: Location;
  let router: Router;

  beforeEach(async () => {
    distributionService = {
      getDistribution: vi.fn().mockReturnValue(of(makeDistributionData([]))),
      saveDistribution: vi.fn().mockReturnValue(of(null)),
      clearDistribution: vi.fn().mockReturnValue(of(null)),
    };

    layoutService = {
      requestFullscreen: vi.fn(),
      exitFullscreen: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [DistributionEditorComponent],
      providers: [
        provideRouter([]),
        allLucideIconsProvider,
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: (key: string) => key === 'eventId' ? EVENT_ID : SEGMENT_ID } },
          },
        },
        { provide: SegmentDistributionService, useValue: distributionService },
        { provide: LayoutService, useValue: layoutService },
        CanvasStateService,
      ],
    })
    .overrideComponent(DistributionEditorComponent, {
      remove: { imports: [FigureCanvasComponent] },
      add: { imports: [FigureCanvasStub] },
    })
    .compileComponents();

    router = TestBed.inject(Router);
    location = TestBed.inject(Location);
    const fixture = TestBed.createComponent(DistributionEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
    component.ngOnDestroy();
  });

  it('calls requestFullscreen on init', () => {
    expect(layoutService.requestFullscreen).toHaveBeenCalled();
  });

  it('loads distribution data on init', () => {
    expect(distributionService.getDistribution).toHaveBeenCalledWith(EVENT_ID, SEGMENT_ID);
  });

  it('auto-places items in a row when projectionX is null', () => {
    distributionService.getDistribution.mockReturnValue(
      of(makeDistributionData([itemNoPosition(INST_A), itemNoPosition(INST_B)])),
    );
    const fixture = TestBed.createComponent(DistributionEditorComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    const slots = comp.compositionSlots();
    expect(slots[0].offsetX).toBe(0);
    expect(slots[1].offsetX).toBeGreaterThan(0);
    expect(slots[0].offsetY).toBe(0);
    expect(slots[1].offsetY).toBe(0);
  });

  it('uses stored positions when projectionX is set', () => {
    distributionService.getDistribution.mockReturnValue(
      of(makeDistributionData([itemWithPosition(INST_A, 150, 250, 30)])),
    );
    const fixture = TestBed.createComponent(DistributionEditorComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    const slots = comp.compositionSlots();
    expect(slots[0].offsetX).toBe(150);
    expect(slots[0].offsetY).toBe(250);
    expect(slots[0].angle).toBe(30);
  });

  it('slotMoved updates compositionSlots state', () => {
    distributionService.getDistribution.mockReturnValue(
      of(makeDistributionData([itemWithPosition(INST_A, 0, 0)])),
    );
    const fixture = TestBed.createComponent(DistributionEditorComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    comp.onSlotMoved({ slotId: INST_A, offsetX: 200, offsetY: 300, angle: 45 });

    const slot = comp.compositionSlots().find((s) => s.slotId === INST_A);
    expect(slot?.offsetX).toBe(200);
    expect(slot?.offsetY).toBe(300);
    expect(slot?.angle).toBe(45);
  });

  it('onSlotMoved saves distribution immediately', () => {
    distributionService.getDistribution.mockReturnValue(
      of(makeDistributionData([itemWithPosition(INST_A, 0, 0)])),
    );
    const fixture = TestBed.createComponent(DistributionEditorComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    comp.onSlotMoved({ slotId: INST_A, offsetX: 100, offsetY: 100, angle: 0 });

    expect(distributionService.saveDistribution).toHaveBeenCalledWith(
      EVENT_ID,
      SEGMENT_ID,
      expect.arrayContaining([expect.objectContaining({ instanceId: INST_A, x: 100, y: 100, angle: 0 })]),
    );
  });

  it('clearDistribution calls service and navigates back', async () => {
    const backSpy = vi.spyOn(location, 'back').mockImplementation(() => {});
    distributionService.clearDistribution.mockReturnValue(of(null));

    await component.clearDistribution();

    expect(distributionService.clearDistribution).toHaveBeenCalledWith(EVENT_ID, SEGMENT_ID);
    expect(backSpy).toHaveBeenCalled();
  });

  it('calls exitFullscreen on destroy', () => {
    component.ngOnDestroy();
    expect(layoutService.exitFullscreen).toHaveBeenCalled();
  });

  describe('slot label computation', () => {
    const makeItem = (figureMode: string, label: string | null, templateName = 'Pilar') => ({
      ...itemWithPosition(INST_A, 0, 0),
      figureMode,
      label,
      figureTemplate: { id: 'fig-1', name: templateName, nodes: [] },
    });

    it('uses the template name when label is null and figureMode is COMPLETA', () => {
      distributionService.getDistribution.mockReturnValue(
        of(makeDistributionData([makeItem('COMPLETA', null, 'Pilar')])),
      );
      const fixture = TestBed.createComponent(DistributionEditorComponent);
      fixture.detectChanges();

      expect(fixture.componentInstance.compositionSlots()[0].label).toBe('Pilar');
    });

    it('uses the instance label over the template name', () => {
      distributionService.getDistribution.mockReturnValue(
        of(makeDistributionData([makeItem('COMPLETA', 'Pilar central', 'Pilar')])),
      );
      const fixture = TestBed.createComponent(DistributionEditorComponent);
      fixture.detectChanges();

      expect(fixture.componentInstance.compositionSlots()[0].label).toBe('Pilar central');
    });

    it('prefixes "Peu de" when figureMode is PEU', () => {
      distributionService.getDistribution.mockReturnValue(
        of(makeDistributionData([makeItem('PEU', null, 'Pilar')])),
      );
      const fixture = TestBed.createComponent(DistributionEditorComponent);
      fixture.detectChanges();

      expect(fixture.componentInstance.compositionSlots()[0].label).toBe('Peu de Pilar');
    });

    it('prefixes "Remat de" when figureMode is REMAT', () => {
      distributionService.getDistribution.mockReturnValue(
        of(makeDistributionData([makeItem('REMAT', null, 'Pilar')])),
      );
      const fixture = TestBed.createComponent(DistributionEditorComponent);
      fixture.detectChanges();

      expect(fixture.componentInstance.compositionSlots()[0].label).toBe('Remat de Pilar');
    });

    it('adds "neta" suffix for a name ending in "a" when figureMode is NETA', () => {
      distributionService.getDistribution.mockReturnValue(
        of(makeDistributionData([makeItem('NETA', null, 'Castella')])),
      );
      const fixture = TestBed.createComponent(DistributionEditorComponent);
      fixture.detectChanges();

      expect(fixture.componentInstance.compositionSlots()[0].label).toBe('Castella neta');
    });

    it('adds "net" suffix for a non-feminine name when figureMode is NETA', () => {
      distributionService.getDistribution.mockReturnValue(
        of(makeDistributionData([makeItem('NETA', null, 'Pilar')])),
      );
      const fixture = TestBed.createComponent(DistributionEditorComponent);
      fixture.detectChanges();

      expect(fixture.componentInstance.compositionSlots()[0].label).toBe('Pilar net');
    });
  });

  describe('cordon filtering', () => {
    it('shows all nodes when numberOfCordons is null', () => {
      const item = {
        ...itemWithPosition(INST_A, 0, 0),
        numberOfCordons: null,
        figureTemplate: {
          id: 'fig-1', name: 'Pilar',
          nodes: [
            makeDistributionNode('n1', 'PINYA', 'rengla-1', 1),
            makeDistributionNode('n2', 'PINYA', 'rengla-1', 2),
          ],
        },
      };
      distributionService.getDistribution.mockReturnValue(of(makeDistributionData([item])));
      const fixture = TestBed.createComponent(DistributionEditorComponent);
      fixture.detectChanges();

      expect(fixture.componentInstance.compositionSlots()[0].figureTemplate.nodes).toHaveLength(2);
    });

    it('hides PINYA nodes whose renglaPosition > numberOfCordons', () => {
      const item = {
        ...itemWithPosition(INST_A, 0, 0),
        numberOfCordons: 1,
        figureTemplate: {
          id: 'fig-1', name: 'Pilar',
          nodes: [
            makeDistributionNode('n1', 'PINYA', 'rengla-1', 1),
            makeDistributionNode('n2', 'PINYA', 'rengla-1', 2),
          ],
        },
      };
      distributionService.getDistribution.mockReturnValue(of(makeDistributionData([item])));
      const fixture = TestBed.createComponent(DistributionEditorComponent);
      fixture.detectChanges();

      const nodes = fixture.componentInstance.compositionSlots()[0].figureTemplate.nodes;
      expect(nodes).toHaveLength(1);
      expect(nodes[0].id).toBe('n1');
    });

    it('always includes BASE nodes regardless of numberOfCordons', () => {
      const item = {
        ...itemWithPosition(INST_A, 0, 0),
        numberOfCordons: 0,
        figureTemplate: {
          id: 'fig-1', name: 'Pilar',
          nodes: [
            makeDistributionNode('b1', 'BASE', null, null),
            makeDistributionNode('n1', 'PINYA', 'rengla-1', 1),
          ],
        },
      };
      distributionService.getDistribution.mockReturnValue(of(makeDistributionData([item])));
      const fixture = TestBed.createComponent(DistributionEditorComponent);
      fixture.detectChanges();

      const nodes = fixture.componentInstance.compositionSlots()[0].figureTemplate.nodes;
      expect(nodes.some((n) => n.id === 'b1')).toBe(true);
    });
  });

  describe('slot assignments', () => {
    it('passes assignments from the item to the slot', () => {
      const item = {
        ...itemWithPosition(INST_A, 0, 0),
        assignments: [{ figureNodeId: 'n1', personAlias: 'JoanP' }],
      };
      distributionService.getDistribution.mockReturnValue(of(makeDistributionData([item])));
      const fixture = TestBed.createComponent(DistributionEditorComponent);
      fixture.detectChanges();

      expect(fixture.componentInstance.compositionSlots()[0].assignments).toEqual([
        { figureNodeId: 'n1', personAlias: 'JoanP' },
      ]);
    });
  });
});
