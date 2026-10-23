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
