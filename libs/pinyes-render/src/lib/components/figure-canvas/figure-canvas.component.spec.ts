import Konva from 'konva';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { CANVAS_FONTS_LOADED } from '../../node-render/fonts';
import { FigureZone, Gender } from '@muixer/shared';
import { ATTENDANCE_TONES, GENDER_TONES, ThemeService } from '@muixer/ui';
import { paperGrain } from '../../theme/paper-grain';
import { AssignmentDetail } from '../../models/assignment.model';
import { NodeAppearanceInput } from '../../node-render/appearance';
import { CanvasMode, CanvasNode, FigureCanvasComponent } from './figure-canvas.component';
import { FigureLink } from '../../utils/figure-link.util';

describe('FigureCanvasComponent', () => {
  // The Konva stage needs a real canvas (absent in jsdom) — only the host is under test here.
  function render() {
    TestBed.overrideComponent(FigureCanvasComponent, { set: { template: '' } });
    jest.spyOn(FigureCanvasComponent.prototype, 'ngAfterViewInit').mockImplementation(() => undefined);
    jest.spyOn(FigureCanvasComponent.prototype, 'ngOnDestroy').mockImplementation(() => undefined);
    const fixture = TestBed.createComponent(FigureCanvasComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('follows the app theme instead of pinning the light one', () => {
    expect(render().nativeElement.hasAttribute('data-theme')).toBe(false);
  });

  it('lays the canvas on grained paper, the grain of the app theme', () => {
    const fixture = render();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.style.getPropertyValue('--paper-grain')).toBe(paperGrain('light'));
    try {
      TestBed.inject(ThemeService).setPreference('dark');
      fixture.detectChanges();
      expect(host.style.getPropertyValue('--paper-grain')).toBe(paperGrain('dark'));
    } finally {
      TestBed.inject(ThemeService).setPreference('system');
      localStorage.clear();
    }
  });

  describe('full redraw (theme change, fonts loaded)', () => {
    // renderNodes() empties the Transformer: a full redraw must hand it the selection back.
    it('puts the resize handles back on the selected node in the editor', () => {
      const fixture = render();
      fixture.componentRef.setInput('mode', 'editor');
      const component = fixture.componentInstance as unknown as Record<string, jest.Mock> & { renderAll(): void };
      const calls: string[] = [];
      for (const name of ['renderGrid', 'renderFigureLinks']) component[name] = jest.fn();
      component['renderNodes'] = jest.fn(() => calls.push('renderNodes'));
      component['updateTransformer'] = jest.fn(() => calls.push('updateTransformer'));

      component.renderAll();

      expect(calls).toEqual(['renderNodes', 'updateTransformer']);
    });
  });

  describe('deferred gesture redraw (projection pan/pinch)', () => {
    type ViewInternals = {
      stage: unknown;
      pinyaLayer: unknown;
      containerRef: { nativeElement: HTMLDivElement };
      setView(v: { x: number; y: number; scaleX: number; scaleY: number }): void;
      onGestureEnd(e: { touches: { length: number } }): void;
      renderGrid(): void;
    };

    /** Just enough of a Konva stage: its transform, and spies on what draws. */
    function fakeStage(container: HTMLDivElement) {
      let t = { x: 10, y: 20, scale: 2 };
      return {
        x: () => t.x,
        y: () => t.y,
        scaleX: () => t.scale,
        scaleY: () => t.scale,
        position: jest.fn((p?: { x: number; y: number }) => {
          if (p) t = { ...t, ...p };
          return { x: t.x, y: t.y };
        }),
        scale: jest.fn((s: { x: number; y: number }) => (t = { ...t, scale: s.x })),
        draw: jest.fn(),
        batchDraw: jest.fn(),
        container: () => container,
      };
    }

    function setup(deferGestureRedraw: boolean) {
      const fixture = render();
      fixture.componentRef.setInput('mode', 'readonly');
      fixture.componentRef.setInput('deferGestureRedraw', deferGestureRedraw);
      const component = fixture.componentInstance as unknown as ViewInternals;
      const container = document.createElement('div');
      const stage = fakeStage(container);
      component.stage = stage;
      component.pinyaLayer = { listening: jest.fn(() => true), drawHit: jest.fn() };
      component.containerRef = { nativeElement: container };
      component.renderGrid = jest.fn();
      const moved: unknown[] = [];
      const committed: unknown[] = [];
      fixture.componentInstance.gestureMoved.subscribe((d) => moved.push(d));
      fixture.componentInstance.stageTransformChanged.subscribe((t) => committed.push(t));
      return { component, container, stage, moved, committed };
    }

    beforeEach(() => {
      jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        cb(0);
        return 1;
      });
    });

    it('moves the drawn canvas with a CSS transform instead of redrawing it', () => {
      const { component, container, stage, moved, committed } = setup(true);

      component.setView({ x: 40, y: 20, scaleX: 4, scaleY: 4 });

      expect(stage.batchDraw).not.toHaveBeenCalled();
      expect(stage.draw).not.toHaveBeenCalled();
      expect(stage.position).not.toHaveBeenCalled();
      expect(container.style.transform).toBe('translate(20px, -20px) scale(2)');
      expect(container.style.willChange).toBe('transform');
      expect(moved).toEqual([{ k: 2, tx: 20, ty: -20 }]);
      expect(committed).toEqual([]);
    });

    it('redraws once, at the final transform, when the last finger lifts', () => {
      const { component, container, stage, committed } = setup(true);
      component.setView({ x: 30, y: 25, scaleX: 2, scaleY: 2 });
      component.setView({ x: 40, y: 20, scaleX: 4, scaleY: 4 });

      component.onGestureEnd({ touches: { length: 0 } });

      expect(stage.position()).toEqual({ x: 40, y: 20 });
      expect(stage.scaleX()).toBe(4);
      expect(stage.draw).toHaveBeenCalledTimes(1);
      expect(stage.batchDraw).not.toHaveBeenCalled();
      expect(container.style.transform).toBe('');
      expect(container.style.willChange).toBe('');
      expect(committed).toEqual([{ x: 40, y: 20, scaleX: 4, scaleY: 4 }]);
    });

    // Konva queues a redraw of its own for the next frame whenever the stage's transform changes:
    // on top of the commit's own draw, that drew the whole scene twice.
    it('commits without Konva queueing a second redraw of its own', () => {
      const { component, stage } = setup(true);
      const autoDraw: boolean[] = [];
      stage.position.mockImplementation(((original) => (p?: { x: number; y: number }) => {
        if (p) autoDraw.push(Konva.autoDrawEnabled);
        return original(p);
      })(stage.position.getMockImplementation() as (p?: { x: number; y: number }) => { x: number; y: number }));
      stage.scale.mockImplementation(((original) => (sc: { x: number; y: number }) => {
        autoDraw.push(Konva.autoDrawEnabled);
        return original(sc);
      })(stage.scale.getMockImplementation() as (sc: { x: number; y: number }) => unknown));
      component.setView({ x: 40, y: 20, scaleX: 4, scaleY: 4 });

      component.onGestureEnd({ touches: { length: 0 } });

      expect(autoDraw).toEqual([false, false]);
      expect(Konva.autoDrawEnabled).toBe(true);
    });

    it('keeps the gesture live while a finger is still down (one lifted mid-pinch)', () => {
      const { component, stage, committed } = setup(true);
      component.setView({ x: 40, y: 20, scaleX: 4, scaleY: 4 });

      component.onGestureEnd({ touches: { length: 1 } });

      expect(stage.draw).not.toHaveBeenCalled();
      expect(committed).toEqual([]);
    });

    it('does nothing on a touchend with no gesture (a plain tap)', () => {
      const { component, stage, committed } = setup(true);

      component.onGestureEnd({ touches: { length: 0 } });

      expect(stage.draw).not.toHaveBeenCalled();
      expect(committed).toEqual([]);
    });

    // Troba'm: the flight moves pixels the same way, and redraws once where it lands.
    describe('flight', () => {
      type FlightInternals = ViewInternals & {
        flyToBounds(bounds: { x: number; y: number; width: number; height: number }[], options?: { durationMs?: number }): void;
        cancelFlight(): void;
        stopFlight(): void;
        viewNow(): { x: number; y: number; scaleX: number; scaleY: number };
      };

      function setupFlight() {
        const s = setup(true);
        const internals = s.stage as unknown as Record<string, unknown>;
        internals['width'] = () => 400;
        internals['height'] = () => 800;
        const landed: unknown[] = [];
        const order: string[] = [];
        const fixture = (s.component as unknown as { flightLanded: { subscribe(cb: () => void): void } });
        fixture.flightLanded.subscribe(() => {
          landed.push(true);
          order.push('landed');
        });
        (s.component as unknown as { stageTransformChanged: { subscribe(cb: () => void): void } }).stageTransformChanged.subscribe(() => order.push('committed'));
        return { ...s, component: s.component as FlightInternals, landed, order };
      }
      const TARGET = [{ x: 1000, y: 500, width: 100, height: 100 }];

      beforeEach(() => jest.useFakeTimers());
      afterEach(() => jest.useRealTimers());

      it('moves the canvas by CSS each frame, without drawing or committing', () => {
        const { component, container, stage, moved, committed } = setupFlight();

        component.flyToBounds(TARGET, { durationMs: 1000 });
        jest.advanceTimersByTime(500);

        expect(moved.length).toBeGreaterThan(5);
        expect(container.style.transform).not.toBe('');
        expect(stage.draw).not.toHaveBeenCalled();
        expect(stage.batchDraw).not.toHaveBeenCalled();
        expect(stage.position).not.toHaveBeenCalled();
        expect(committed).toEqual([]);
      });

      it('lands by drawing once at the destination, then reports the landing', () => {
        const { component, container, stage, committed, order } = setupFlight();

        component.flyToBounds(TARGET, { durationMs: 1000 });
        jest.advanceTimersByTime(1100);

        expect(stage.draw).toHaveBeenCalledTimes(1);
        expect(container.style.transform).toBe('');
        expect(committed).toHaveLength(1);
        // The fit centres the target (bounds are centred on x/y) on the screen's centre (200, 400).
        const [t] = committed as { x: number; y: number; scaleX: number }[];
        expect(1000 * t.scaleX + t.x).toBeCloseTo(200);
        expect(500 * t.scaleX + t.y).toBeCloseTo(400);
        expect(order).toEqual(['committed', 'landed']);
      });

      it('stops where it is when a finger lands, for the gesture to carry on from there', () => {
        const { component, stage, committed, landed } = setupFlight();
        component.flyToBounds(TARGET, { durationMs: 1000 });
        jest.advanceTimersByTime(500);
        const midway = component.viewNow();

        component.stopFlight();
        jest.advanceTimersByTime(1000);

        expect(component.viewNow()).toEqual(midway);
        expect(stage.draw).not.toHaveBeenCalled();
        expect(committed).toEqual([]);
        expect(landed).toEqual([]);
      });

      it('commits where it is when cancelled outside a touch (desktop pan, a new flight)', () => {
        const { component, stage, committed, landed } = setupFlight();
        component.flyToBounds(TARGET, { durationMs: 1000 });
        jest.advanceTimersByTime(500);
        const midway = component.viewNow();

        component.cancelFlight();

        expect(stage.draw).toHaveBeenCalledTimes(1);
        expect(committed).toEqual([midway]);
        expect(landed).toEqual([]);
      });
    });

    describe('underlay (fills the edges a gesture reveals)', () => {
      type UnderlayInternals = ViewInternals & {
        contentScreenRect(): { x: number; y: number; width: number; height: number } | null;
        drawUnderlay(plan: { rect: unknown; pixelRatio: number }): HTMLCanvasElement;
        renderFigureLinks(links: unknown[]): void;
        resizeStage(): void;
      };
      const underlayOf = (container: HTMLDivElement) => container.querySelector<HTMLCanvasElement>('[data-role="gesture-underlay"]');
      const box = (el: HTMLCanvasElement | null) =>
        el && { left: el.style.left, top: el.style.top, width: el.style.width, height: el.style.height };
      // The whole segment, in screen px at the fake stage's starting transform (x 10, y 20, scale 2).
      const CONTENT = { x: -2000, y: -100, width: 5000, height: 300 };

      function setupUnderlay(deferGestureRedraw = true) {
        const s = setup(deferGestureRedraw);
        const component = s.component as UnderlayInternals;
        const internals = component as unknown as Record<string, unknown>;
        const layer = () => ({ destroyChildren: jest.fn(), add: jest.fn(), batchDraw: jest.fn(), visible: jest.fn() });
        internals['linkLayer'] = layer();
        internals['pinLayer'] = layer();
        internals['pinyaLayer'] = { ...layer(), listening: jest.fn(() => true), drawHit: jest.fn() };
        component.contentScreenRect = jest.fn(() => CONTENT);
        component.drawUnderlay = jest.fn(() => document.createElement('canvas'));
        return { ...s, component };
      }

      /** The drawing changes (here: its strings), and the phone goes idle. */
      function drawnAndIdle(component: UnderlayInternals) {
        component.renderFigureLinks([]);
        jest.runOnlyPendingTimers();
      }

      function gesture(component: UnderlayInternals, view: { x: number; y: number; scaleX: number; scaleY: number }) {
        component.setView(view);
        // Fake timers own requestAnimationFrame here: let the gesture's frame run.
        jest.advanceTimersByTime(16);
      }

      beforeEach(() => jest.useFakeTimers());
      afterEach(() => jest.useRealTimers());

      it('is drawn once idle after the drawing changes, hidden, over the whole segment', () => {
        const { component, container } = setupUnderlay();

        drawnAndIdle(component);

        expect(component.drawUnderlay).toHaveBeenCalledWith({ rect: CONTENT, pixelRatio: 3072 / 5000 });
        expect(underlayOf(container)?.style.visibility).toBe('hidden');
        expect(box(underlayOf(container))).toEqual({ left: '-2000px', top: '-100px', width: '5000px', height: '300px' });
      });

      it('is drawn even with the whole segment on screen: a later zoom needs it', () => {
        const { component, container } = setupUnderlay();
        component.contentScreenRect = jest.fn(() => ({ x: 10, y: 10, width: 300, height: 600 }));

        drawnAndIdle(component);

        expect(underlayOf(container)).not.toBeNull();
      });

      it('shows while a gesture moves the canvas, and hides again when it commits', () => {
        const { component, container } = setupUnderlay();
        drawnAndIdle(component);

        gesture(component, { x: 0, y: 0, scaleX: 2, scaleY: 2 });
        expect(underlayOf(container)?.style.visibility).toBe('visible');

        component.onGestureEnd({ touches: { length: 0 } });
        expect(underlayOf(container)?.style.visibility).toBe('hidden');
      });

      // Flicks come back to back, before the phone is idle again: the copy is never redrawn for
      // a new view, only moved to it, so it is always there.
      it('moves with each committed gesture instead of being redrawn', () => {
        const { component, container } = setupUnderlay();
        drawnAndIdle(component);
        const copy = underlayOf(container);

        gesture(component, { x: 0, y: 0, scaleX: 4, scaleY: 4 }); // from x 10, y 20, scale 2: k 2, tx −20, ty −40
        component.onGestureEnd({ touches: { length: 0 } });
        jest.runOnlyPendingTimers();

        expect(underlayOf(container)).toBe(copy);
        expect(component.drawUnderlay).toHaveBeenCalledTimes(1);
        expect(box(copy)).toEqual({ left: '-4020px', top: '-240px', width: '10000px', height: '600px' });

        gesture(component, { x: 30, y: 0, scaleX: 4, scaleY: 4 });
        expect(copy?.style.visibility).toBe('visible');
      });

      it('is dropped when the drawing changes, and drawn again once idle', () => {
        const { component, container } = setupUnderlay();
        drawnAndIdle(component);
        const old = underlayOf(container);

        component.renderFigureLinks([]);
        expect(underlayOf(container)).toBeNull();
        jest.runOnlyPendingTimers();

        expect(underlayOf(container)).not.toBeNull();
        expect(underlayOf(container)).not.toBe(old);
      });

      it('waits for a gesture in progress before drawing', () => {
        const { component, container } = setupUnderlay();
        component.renderFigureLinks([]);
        gesture(component, { x: 0, y: 0, scaleX: 2, scaleY: 2 });

        jest.runOnlyPendingTimers();
        expect(component.drawUnderlay).not.toHaveBeenCalled();

        component.onGestureEnd({ touches: { length: 0 } });
        jest.runOnlyPendingTimers();
        expect(underlayOf(container)).not.toBeNull();
      });

      it('is kept, not redrawn, when the canvas resizes (a phone rotated)', () => {
        const { component, container } = setupUnderlay();
        drawnAndIdle(component);
        const copy = underlayOf(container);
        Object.defineProperty(container, 'clientWidth', { value: 800 });
        Object.defineProperty(container, 'clientHeight', { value: 400 });
        const internals = component as unknown as { stage: Record<string, unknown> };
        internals.stage['width'] = jest.fn();
        internals.stage['height'] = jest.fn();

        component.resizeStage();
        jest.runOnlyPendingTimers();

        expect(underlayOf(container)).toBe(copy);
        expect(component.drawUnderlay).toHaveBeenCalledTimes(1);
      });

      it('is not drawn for a canvas that redraws every move', () => {
        const { component, container } = setupUnderlay(false);

        drawnAndIdle(component);

        expect(component.drawUnderlay).not.toHaveBeenCalled();
        expect(underlayOf(container)).toBeNull();
      });
    });

    it('redraws every move, as before, when not deferred', () => {
      const { component, container, stage, moved } = setup(false);

      component.setView({ x: 40, y: 20, scaleX: 4, scaleY: 4 });

      expect(stage.position()).toEqual({ x: 40, y: 20 });
      expect(stage.batchDraw).toHaveBeenCalledTimes(1);
      expect(container.style.transform).toBe('');
      expect(moved).toEqual([]);
    });
  });

  // Every Konva layer is a full-screen canvas the browser clears and composites: the projection
  // keeps only the one it needs.
  describe('layers (fewer canvases)', () => {
    /** A Konva layer's surface, enough to tell what is drawn on it and whether it shows. */
    function fakeLayer() {
      const children: unknown[] = [];
      return {
        children,
        visible: jest.fn(),
        add: jest.fn((...nodes: unknown[]) => children.push(...nodes)),
        destroyChildren: jest.fn(() => children.splice(0)),
        getChildren: () => children,
        batchDraw: jest.fn(),
      };
    }
    const LINK: FigureLink = {
      cardEdge: 'top',
      string: { from: { x: 0, y: 0 }, control: { x: 5, y: 10 }, to: { x: 10, y: 0 } },
      stringColor: '#123456',
      stringWidth: 2,
      pin: { x: 10, y: 0 },
      pinRadius: 4,
      color: '#abcdef',
    };
    type LayerInternals = Record<string, unknown> & {
      renderGrid(): void;
      renderFigureLinks(links: FigureLink[]): void;
      renderReadonlyNodes(): void;
    };

    // Konva probes a real canvas the first time it makes a shape; jsdom has none.
    beforeEach(() => jest.spyOn(Konva.Util, 'isCanvasFarblingActive').mockReturnValue(false));

    function setupLayers(mode: CanvasMode) {
      const fixture = render();
      fixture.componentRef.setInput('mode', mode);
      const c = fixture.componentInstance as unknown as LayerInternals;
      const layers = { grid: fakeLayer(), link: fakeLayer(), pinya: fakeLayer(), pin: fakeLayer() };
      c['gridLayer'] = layers.grid;
      c['linkLayer'] = layers.link;
      c['pinyaLayer'] = layers.pinya;
      c['pinLayer'] = layers.pin;
      c['stage'] = { scaleX: () => 1, x: () => 0, y: () => 0, width: () => 400, height: () => 800, batchDraw: jest.fn() };
      c['transformer'] = { nodes: jest.fn(), remove: jest.fn() };
      return { fixture, c, layers };
    }

    it('hides the grid canvas while there is no grid', () => {
      const { fixture, c, layers } = setupLayers('readonly');
      fixture.componentRef.setInput('gridEnabled', false);

      c.renderGrid();

      expect(layers.grid.visible).toHaveBeenLastCalledWith(false);
    });

    it('shows the grid canvas when the grid is on (template editor)', () => {
      const { fixture, c, layers } = setupLayers('editor');
      fixture.componentRef.setInput('gridEnabled', true);

      c.renderGrid();

      expect(layers.grid.visible).toHaveBeenLastCalledWith(true);
    });

    it('in readonly, draws the strings under the nodes and their pins over them, on the nodes canvas', () => {
      const { c, layers } = setupLayers('readonly');

      c.renderFigureLinks([LINK]);

      expect(layers.link.visible).toHaveBeenLastCalledWith(false);
      expect(layers.pin.visible).toHaveBeenLastCalledWith(false);
      expect(layers.link.add).not.toHaveBeenCalled();
      expect(layers.pin.add).not.toHaveBeenCalled();
      const [strings, pins] = layers.pinya.children as Konva.Group[];
      expect(strings.getChildren()[0]).toBeInstanceOf(Konva.Path);
      expect(pins.getChildren()[0]).toBeInstanceOf(Konva.Group);
    });

    it('in readonly, keeps the strings and pins when the nodes are drawn again, in their places', () => {
      const { c, layers } = setupLayers('readonly');
      c.renderFigureLinks([LINK]);
      const [strings, pins] = layers.pinya.children;

      c.renderReadonlyNodes();

      const children = layers.pinya.children;
      expect(children[0]).toBe(strings);
      expect(children.at(-2)).toBe(pins); // above the nodes and their raised pieces; the transformer last
      expect(children.at(-1)).toBe(c['transformer']);
    });

    it('elsewhere, keeps the strings on their own canvases, shown only while there are any', () => {
      const { c, layers } = setupLayers('segment-assignment');

      c.renderFigureLinks([LINK]);
      expect(layers.link.visible).toHaveBeenLastCalledWith(true);
      expect(layers.pin.visible).toHaveBeenLastCalledWith(true);
      expect(layers.link.children).toHaveLength(1);

      c.renderFigureLinks([]);
      expect(layers.link.visible).toHaveBeenLastCalledWith(false);
      expect(layers.pin.visible).toHaveBeenLastCalledWith(false);
    });
  });

  // Konva fits names to the faces it measures when it draws: a name drawn before the faces load is
  // drawn again once they do, and every drawing builds the whole scene.
  describe('first drawing and the canvas faces', () => {
    function setupFonts(mode: CanvasMode, loaded: boolean) {
      const fontsLoaded = signal(loaded);
      TestBed.overrideProvider(CANVAS_FONTS_LOADED, { useValue: fontsLoaded.asReadonly() });
      const fixture = render();
      fixture.componentRef.setInput('mode', mode);
      const c = fixture.componentInstance as unknown as { stage: unknown; renderAll: jest.Mock; initialRender(): void };
      c.renderAll = jest.fn();
      c.stage = {};
      return { fixture, c, fontsLoaded };
    }

    it('draws at once, and only once, when the faces are already loaded', () => {
      const { fixture, c } = setupFonts('readonly', true);

      c.initialRender();
      fixture.detectChanges();

      expect(c.renderAll).toHaveBeenCalledTimes(1);
    });

    it('in the projection, waits for the faces before drawing at all', () => {
      const { fixture, c, fontsLoaded } = setupFonts('readonly', false);

      c.initialRender();
      fixture.detectChanges();
      expect(c.renderAll).not.toHaveBeenCalled();

      fontsLoaded.set(true);
      fixture.detectChanges();
      expect(c.renderAll).toHaveBeenCalledTimes(1);
    });

    it('in the editors, draws at once with the fallback face, and again once the faces load', () => {
      const { fixture, c, fontsLoaded } = setupFonts('editor', false);

      c.initialRender();
      fixture.detectChanges();
      expect(c.renderAll).toHaveBeenCalledTimes(1);

      fontsLoaded.set(true);
      fixture.detectChanges();
      expect(c.renderAll).toHaveBeenCalledTimes(2);
    });
  });

  describe('readonly look', () => {
    const node = { id: 'n1', label: 'Vent', zone: FigureZone.PINYA, positionType: 'vents', color: null, climbIndicator: null } as unknown as CanvasNode;
    const readonlyInput = (inputs: Record<string, unknown>) => {
      const fixture = render();
      for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
      const component = fixture.componentInstance as unknown as { readonlyNodeInput(n: CanvasNode): NodeAppearanceInput };
      return component.readonlyNodeInput(node);
    };

    it('draws the nodes as the projection does by default', () => {
      expect(readonlyInput({ mode: 'readonly' }).mode).toBe('projection');
    });

    it('draws the nodes filled, as the template editor does, with the template look (the Rengles tab)', () => {
      expect(readonlyInput({ mode: 'readonly', readonlyLook: 'template' }).mode).toBe('template');
    });
  });

  describe('display modes (appearance input of a staffed node)', () => {
    const node = { id: 'n1', label: 'Vent', zone: FigureZone.PINYA, positionType: 'vents', color: null, climbIndicator: null } as unknown as CanvasNode;
    const assignment = {
      id: 'a1',
      figureInstanceId: 'fi1',
      node: { id: 'n1' },
      person: { id: 'p1', alias: 'Marta', name: 'Marta', firstSurname: 'Puig', shoulderHeight: 152, notes: null, notesEmoji: null },
    } as unknown as AssignmentDetail;

    function staffed(inputs: Record<string, unknown>) {
      const fixture = render();
      for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
      const component = fixture.componentInstance as unknown as {
        appearanceInput(n: CanvasNode, a: AssignmentDetail | null, mode: 'workspace'): NodeAppearanceInput;
      };
      return (a: AssignmentDetail | null) => component.appearanceInput(node, a, 'workspace');
    }

    it('adds nothing in Posició (the default)', () => {
      const input = staffed({ nextPerformanceMap: new Map([['p1', 'ANIRE']]) })(assignment);
      expect(input.tones).toBeUndefined();
      expect(input.fillPolicy).toBeUndefined();
      expect(input.palette).toBeUndefined();
      expect(input.person?.nextActuacio).toBe(true);
    });

    it('takes the gender from the roster details, and draws an empty node neutral', () => {
      const appearanceInput = staffed({
        displayMode: 'gender',
        personDetailsMap: new Map([['p1', { positions: [], isXicalla: false, notes: null, notesEmoji: null, gender: Gender.FEMALE }]]),
      });
      expect(appearanceInput(assignment).tones).toEqual(GENDER_TONES.female);
      expect(appearanceInput(null)).toMatchObject({ palette: 'neutral' });
    });

    it('in Assistència fills solid in the semantic shade and keeps the star, the badges and the observation', () => {
      const input = staffed({
        displayMode: 'attendance',
        attendanceMap: new Map([['p1', 'NO_VAIG']]),
        nextPerformanceMap: new Map([['p1', 'ANIRE']]),
      })(assignment);
      expect(input).toMatchObject({ tones: ATTENDANCE_TONES.error.strong, fillPolicy: 'solid', attendance: 'absent' });
      expect(input.person).toMatchObject({ nextActuacio: true, height: '+12' });
    });
  });
});
