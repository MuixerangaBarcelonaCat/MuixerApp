import Konva from 'konva';
import { TestBed } from '@angular/core/testing';
import { FigureZone, Gender } from '@muixer/shared';
import { ATTENDANCE_TONES, GENDER_TONES, ThemeService } from '@muixer/ui';
import { paperGrain } from '../../theme/paper-grain';
import { AssignmentDetail } from '../../models/assignment.model';
import { NodeAppearanceInput } from '../../node-render/appearance';
import { CanvasNode, FigureCanvasComponent } from './figure-canvas.component';

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
        const layer = () => ({ destroyChildren: jest.fn(), add: jest.fn(), batchDraw: jest.fn() });
        internals['linkLayer'] = layer();
        internals['pinLayer'] = layer();
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
