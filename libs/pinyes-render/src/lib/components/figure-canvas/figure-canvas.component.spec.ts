import { TestBed } from '@angular/core/testing';
import Konva from 'konva';
import { FigureCanvasComponent } from './figure-canvas.component';

/**
 * Unlike every other spec that touches `FigureCanvasComponent`, this one constructs
 * it for real rather than swapping it for a stub — but only to exercise a single,
 * narrow, JS-level claim: does a real Konva drag event bubble to the Stage and
 * toggle `interactionActive`? That's event-wiring correctness, not visual/gesture
 * correctness ("does a pinch produce the right zoom") — the latter has "no
 * meaningful jsdom signal" per this lib's `jest.config.cts` and is covered by the
 * Playwright gesture audit (`pnpm audit:gestures`) instead; this test doesn't
 * duplicate that, it protects a narrower and cheaper-to-verify property.
 */
describe('FigureCanvasComponent — interactionActive', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<FigureCanvasComponent>>;
  let component: FigureCanvasComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [FigureCanvasComponent] });
    fixture = TestBed.createComponent(FigureCanvasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges(); // runs ngAfterViewInit, constructing a real Konva.Stage
  });

  afterEach(() => {
    fixture.destroy();
  });

  /** The interactive layer nodes are actually rendered into (`pinyaLayer`, added last —
   *  unlike `gridLayer`/`outlineLayer`, which are `listening: false` and never bubble
   *  events at all). */
  const interactiveLayer = (): Konva.Layer => {
    const stage = component['stage'] as Konva.Stage;
    const layers = stage.getLayers();
    return layers[layers.length - 1];
  };

  /** A draggable shape standing in for a node/tronc-panel/slot group — any of them,
   *  since the whole point of a stage-level listener is not caring which one. */
  const addDraggableShape = (): Konva.Rect => {
    const rect = new Konva.Rect({ x: 0, y: 0, width: 10, height: 10, draggable: true });
    interactiveLayer().add(rect);
    return rect;
  };

  it('turns on when any node starts being dragged', () => {
    const seen: boolean[] = [];
    component.interactionActive.subscribe((active) => seen.push(active));
    const rect = addDraggableShape();

    rect.fire('dragstart', {}, true); // bubble: true — reaches the Stage, as a real drag does

    expect(seen).toEqual([true]);
  });

  it('turns off when the drag ends', () => {
    const seen: boolean[] = [];
    component.interactionActive.subscribe((active) => seen.push(active));
    const rect = addDraggableShape();

    rect.fire('dragstart', {}, true);
    rect.fire('dragend', {}, true);

    expect(seen).toEqual([true, false]);
  });

  it('does not care which node was dragged — a stage-level listener, not one per node type', () => {
    const seen: boolean[] = [];
    component.interactionActive.subscribe((active) => seen.push(active));
    const layer = interactiveLayer();
    const groupA = new Konva.Group({ draggable: true });
    const groupB = new Konva.Group({ draggable: true });
    layer.add(groupA);
    layer.add(groupB);

    groupA.fire('dragstart', {}, true);
    groupA.fire('dragend', {}, true);
    groupB.fire('dragstart', {}, true);
    groupB.fire('dragend', {}, true);

    expect(seen).toEqual([true, false, true, false]);
  });
});
