import { FigureTemplateListItem, FigureCanvasComponent, CompositionSlotWithNodes, CanvasMode } from '@muixer/pinyes-render';
import { Component, input, output } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { of, NEVER } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FigureZone, NodeShape } from '@muixer/shared';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { CompositionEditorComponent } from './composition-editor.component';
import { CompositionService } from '../../services/composition.service';
import { FigureTemplateService } from '../../services/figure-template.service';
import { LayoutService } from '../../../../core/services/layout.service';
import { CanvasStateService } from '../../services/canvas-state.service';
import { CompositionDetail, CompositionEntryItem } from '../../models/composition.model';

@Component({ selector: 'app-figure-canvas', standalone: true, template: '' })
class FigureCanvasStub {
  readonly mode = input<CanvasMode>('composition');
  readonly compositionSlots = input<CompositionSlotWithNodes[]>([]);
  readonly selectedSlotId = input<string | null>(null);
  readonly gridEnabled = input<boolean>(false);
  readonly gridSpacing = input<number>(20);
  readonly snapToGrid = input<boolean>(false);
  readonly slotSelected = output<string | null>();
  readonly slotMoved = output<{ slotId: string; offsetX: number; offsetY: number; angle: number }>();
  readonly troncMoved = output<{ slotId: string; troncPanelX: number | null; troncPanelY: number | null }>();
  getViewportCenter = vi.fn().mockReturnValue({ x: 500, y: 400 });
  centerOnContent = vi.fn();
}

const COMPOSITION_ID = 'comp-uuid-1';

const makeNode = (
  id: string,
  zone: FigureZone,
  renglaId: string | null = null,
  renglaPosition: number | null = null,
  overrides: { positionType?: string | null; x?: number; y?: number } = {},
) => ({
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
  shape: NodeShape.RECTANGLE,
  sortOrder: 0,
  climbIndicator: null,
  ringLevel: null,
  originNodeId: null,
  renglaId,
  renglaPosition,
  metadata: {},
  ...overrides,
});

const makeEntry = (overrides: Partial<CompositionEntryItem> = {}): CompositionEntryItem => ({
  id: 'entry-1',
  label: null,
  offsetX: 0,
  offsetY: 0,
  angle: 0,
  troncPanelX: null,
  troncPanelY: null,
  figureMode: 'COMPLETA',
  numberOfCordons: null,
  cordonsObertsEnabled: true,
  sortOrder: 0,
  troncGridCols: 2,
  troncGridRows: 3,
  figureTemplate: {
    id: 'fig-1',
    name: 'Pilar',
    hasPinya: true,
    direction: 0,
    nodes: [makeNode('n1', FigureZone.PINYA), makeNode('b1', FigureZone.BASE)],
  },
  ...overrides,
});

const makeDetail = (entries: CompositionEntryItem[] = [makeEntry()], id = COMPOSITION_ID): CompositionDetail => ({
  id,
  name: 'Composició 1',
  description: null,
  entries,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
});

const template: FigureTemplateListItem = {
  id: 'fig-9',
  name: 'Pilar nou',
  slug: 'pilar-nou',
  description: null,
  hasPinya: true,
  direction: 0,
  nodeCount: 2,
  renglaCount: 1,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};

describe('CompositionEditorComponent', () => {
  let compositionService: { getOne: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let figureTemplateService: { getAll: ReturnType<typeof vi.fn> };
  let layoutService: { requestFullscreen: ReturnType<typeof vi.fn>; exitFullscreen: ReturnType<typeof vi.fn> };
  let router: Router;
  let navigateSpy: ReturnType<typeof vi.spyOn>;

  async function setup(id: string | null) {
    await TestBed.configureTestingModule({
      imports: [CompositionEditorComponent],
      providers: [
        provideRouter([]),
        allLucideIconsProvider,
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: (key: string) => (key === 'id' ? id : null) } } },
        },
        { provide: CompositionService, useValue: compositionService },
        { provide: FigureTemplateService, useValue: figureTemplateService },
        { provide: LayoutService, useValue: layoutService },
        CanvasStateService,
      ],
    })
      .overrideComponent(CompositionEditorComponent, {
        remove: { imports: [FigureCanvasComponent] },
        add: { imports: [FigureCanvasStub] },
      })
      .compileComponents();

    router = TestBed.inject(Router);
    navigateSpy = vi.spyOn(router, 'navigate');
    const fixture = TestBed.createComponent(CompositionEditorComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    const canvasStub = fixture.debugElement.query(By.directive(FigureCanvasStub))
      ?.componentInstance as FigureCanvasStub;
    return { fixture, component, canvasStub };
  }

  beforeEach(() => {
    compositionService = {
      getOne: vi.fn().mockReturnValue(of(makeDetail())),
      create: vi.fn().mockReturnValue(of(makeDetail())),
      // Never resolves by default, like a real network round-trip — tests that assert on
      // immediate local state shouldn't be tripped up by a same-tick response overwriting it.
      // Tests that need to verify the save response merging back override this per-test.
      update: vi.fn().mockReturnValue(NEVER),
    };
    figureTemplateService = {
      getAll: vi.fn().mockReturnValue(of({ data: [], meta: { total: 0, page: 1, limit: 200 } })),
    };
    layoutService = {
      requestFullscreen: vi.fn(),
      exitFullscreen: vi.fn(),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls requestFullscreen on init', async () => {
    await setup(COMPOSITION_ID);
    expect(layoutService.requestFullscreen).toHaveBeenCalled();
  });

  it('calls exitFullscreen on destroy', async () => {
    const { component } = await setup(COMPOSITION_ID);
    component.ngOnDestroy();
    expect(layoutService.exitFullscreen).toHaveBeenCalled();
  });

  it('loads an existing composition and maps entries to canvas slots', async () => {
    const { component } = await setup(COMPOSITION_ID);
    expect(compositionService.getOne).toHaveBeenCalledWith(COMPOSITION_ID);
    expect(component.compositionSlots()).toHaveLength(1);
    expect(component.compositionSlots()[0].slotId).toBe('entry-1');
  });

  it('centers the viewport on the loaded content after data arrives', async () => {
    vi.useFakeTimers();
    const { canvasStub } = await setup(COMPOSITION_ID);

    expect(canvasStub.centerOnContent).not.toHaveBeenCalled();
    vi.runAllTimers();

    expect(canvasStub.centerOnContent).toHaveBeenCalledTimes(1);
  });

  it('onSlotMoved updates the matching entry in local state', async () => {
    const { component } = await setup(COMPOSITION_ID);

    component.onSlotMoved({ slotId: 'entry-1', offsetX: 200, offsetY: 300, angle: 45 });

    const slot = component.compositionSlots().find((s) => s.slotId === 'entry-1');
    expect(slot?.offsetX).toBe(200);
    expect(slot?.offsetY).toBe(300);
    expect(slot?.angle).toBe(45);
  });

  it('autosaves immediately after a change, calling update()', async () => {
    const { component } = await setup(COMPOSITION_ID);

    component.onSlotMoved({ slotId: 'entry-1', offsetX: 200, offsetY: 300, angle: 45 });

    expect(compositionService.update).toHaveBeenCalledWith(
      COMPOSITION_ID,
      expect.objectContaining({
        entries: expect.arrayContaining([expect.objectContaining({ offsetX: 200, offsetY: 300, angle: 45 })]),
      }),
    );
  });

  it('autosaves once per change, not batched or debounced', async () => {
    const { component } = await setup(COMPOSITION_ID);

    component.onSlotMoved({ slotId: 'entry-1', offsetX: 200, offsetY: 300, angle: 45 });
    component.onSlotMoved({ slotId: 'entry-1', offsetX: 250, offsetY: 350, angle: 90 });

    expect(compositionService.update).toHaveBeenCalledTimes(2);
  });

  it('recomputes node filtering when the figure mode changes to REMAT', async () => {
    const { component } = await setup(COMPOSITION_ID);

    component.updateFigureMode('entry-1', 'REMAT');

    const slot = component.compositionSlots().find((s) => s.slotId === 'entry-1');
    expect(slot?.figureTemplate.nodes.some((n) => n.zone === 'PINYA')).toBe(false);
    expect(slot?.figureTemplate.nodes.some((n) => n.zone === 'BASE')).toBe(true);
    expect(component.entries().find((e) => e.id === 'entry-1')?.numberOfCordons).toBeNull();
  });


  describe('cordons oberts checkbox', () => {
    it('propertiesEntry exposes hasCordoObertNodes and cordonsObertsEnabled', async () => {
      compositionService.getOne.mockReturnValue(
        of(
          makeDetail([
            makeEntry({
              cordonsObertsEnabled: false,
              figureTemplate: {
                id: 'fig-1',
                name: 'Pilar',
                hasPinya: true,
                direction: 0,
                nodes: [makeNode('co', FigureZone.PINYA, 'r1', 1, { positionType: 'cordo-obert' })],
              },
            }),
          ]),
        ),
      );
      const { component } = await setup(COMPOSITION_ID);
      component.onSlotSelected('entry-1');

      expect(component.propertiesEntry()).toMatchObject({ hasCordoObertNodes: true, cordonsObertsEnabled: false });
    });

    it('excludes cordo-obert nodes from the slot entirely when cordonsObertsEnabled is false', async () => {
      compositionService.getOne.mockReturnValue(
        of(
          makeDetail([
            makeEntry({
              cordonsObertsEnabled: false,
              figureTemplate: {
                id: 'fig-1',
                name: 'Pilar',
                hasPinya: true,
                direction: 0,
                nodes: [
                  makeNode('n1', FigureZone.PINYA),
                  makeNode('co', FigureZone.PINYA, 'r1', 1, { positionType: 'cordo-obert' }),
                ],
              },
            }),
          ]),
        ),
      );
      const { component } = await setup(COMPOSITION_ID);

      const slot = component.compositionSlots().find((s) => s.slotId === 'entry-1');

      expect(slot?.figureTemplate.nodes.map((n) => n.id)).toEqual(['n1']);
    });

    it('updateCordonsObertsEnabled patches the entry and autosaves', async () => {
      const { component } = await setup(COMPOSITION_ID);

      component.updateCordonsObertsEnabled('entry-1', false);

      expect(component.entries().find((e) => e.id === 'entry-1')?.cordonsObertsEnabled).toBe(false);
      expect(compositionService.update).toHaveBeenCalledWith(
        COMPOSITION_ID,
        expect.objectContaining({
          entries: expect.arrayContaining([expect.objectContaining({ cordonsObertsEnabled: false })]),
        }),
      );
    });
  });

  it('always keeps a cordo-obert PINYA node even when its renglaPosition exceeds numberOfCordons', async () => {
    compositionService.getOne.mockReturnValue(
      of(
        makeDetail([
          makeEntry({
            numberOfCordons: 1,
            figureTemplate: {
              id: 'fig-1',
              name: 'Pilar',
              hasPinya: true,
              direction: 0,
              nodes: [
                makeNode('n1', FigureZone.PINYA, 'r1', 1),
                makeNode('n2', FigureZone.PINYA, 'r1', 2, { positionType: 'cordo-obert' }),
              ],
            },
          }),
        ]),
      ),
    );
    const { component } = await setup(COMPOSITION_ID);

    const slot = component.compositionSlots().find((s) => s.slotId === 'entry-1');
    expect(slot?.figureTemplate.nodes.map((n) => n.id).sort()).toEqual(['n1', 'n2']);
  });

  it('repositions a cordo-obert node to the position of the first hidden node in its rengla', async () => {
    compositionService.getOne.mockReturnValue(
      of(
        makeDetail([
          makeEntry({
            numberOfCordons: 1,
            figureTemplate: {
              id: 'fig-1',
              name: 'Pilar',
              hasPinya: true,
              direction: 0,
              nodes: [
                makeNode('n1', FigureZone.PINYA, 'r1', 1, { x: 10, y: 10 }),
                makeNode('n2', FigureZone.PINYA, 'r1', 2, { x: 20, y: 20 }),
                makeNode('co', FigureZone.PINYA, 'r1', 3, { positionType: 'cordo-obert', x: 30, y: 30 }),
              ],
            },
          }),
        ]),
      ),
    );
    const { component } = await setup(COMPOSITION_ID);

    const slot = component.compositionSlots().find((s) => s.slotId === 'entry-1');
    const cordoObert = slot?.figureTemplate.nodes.find((n) => n.id === 'co');
    expect(cordoObert?.x).toBe(20);
    expect(cordoObert?.y).toBe(20);
  });

  it('removeEntry removes the entry from local state and clears selection', async () => {
    const { component } = await setup(COMPOSITION_ID);

    component.onSlotSelected('entry-1');
    component.removeEntry('entry-1');

    expect(component.entries()).toHaveLength(0);
    expect(component.selectedEntryId()).toBeNull();
  });

  it('addFigureTemplate places the new entry at the canvas viewport center', async () => {
    // create() resolves synchronously in this suite, so assert on the outgoing payload
    // (built from the optimistic entry) rather than post-response local state.
    const { component, canvasStub } = await setup(null);

    component.addFigureTemplate(template);

    expect(canvasStub.getViewportCenter).toHaveBeenCalled();
    expect(compositionService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        entries: expect.arrayContaining([expect.objectContaining({ offsetX: 500, offsetY: 400 })]),
      }),
    );
  });

  it('new composition flow: first add posts to create and navigates to the edit URL', async () => {
    compositionService.create.mockReturnValue(of(makeDetail([makeEntry({ id: 'real-entry-1' })], 'new-comp-id')));
    const { component } = await setup(null);

    component.addFigureTemplate(template);

    expect(compositionService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Pilar nou',
        entries: expect.arrayContaining([expect.objectContaining({ figureTemplateId: 'fig-9' })]),
      }),
    );
    expect(navigateSpy).toHaveBeenCalledWith(['/pinyes/compositions', 'new-comp-id', 'edit'], { replaceUrl: true });
    expect(component.compositionId()).toBe('new-comp-id');
  });

  describe('tap targets >=24px (WI-22)', () => {
    it('gives the figure search input a >=24px tap target', async () => {
      const { fixture } = await setup('comp-1');
      const search = fixture.nativeElement.querySelector('input[type="search"]') as HTMLElement;
      expect(search).toBeTruthy();
      expect(search.className).toContain('h-6');
    });
  });
});
