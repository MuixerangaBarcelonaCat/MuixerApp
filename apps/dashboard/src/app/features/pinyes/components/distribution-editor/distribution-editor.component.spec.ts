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

const itemWithPosition = (instanceId: string, x: number, y: number, angle = 0) => ({
  instanceId,
  label: null,
  figureTemplate: { id: 'fig-1', name: 'pd4', nodes: [] },
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
});
