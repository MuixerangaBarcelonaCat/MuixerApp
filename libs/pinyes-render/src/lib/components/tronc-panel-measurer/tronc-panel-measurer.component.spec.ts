import { Component, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TroncPanelMeasurerComponent, TroncPanelMeasureSpec } from './tronc-panel-measurer.component';
import { TroncViewComponent, TroncNodeItem } from '../tronc-view/tronc-view.component';
import { AssignmentDetail } from '../../models/assignment.model';

@Component({ selector: 'app-tronc-view', standalone: true, template: '' })
class StubTroncView {
  readonly mode = input<string>('assignment');
  readonly troncNodes = input<TroncNodeItem[]>([]);
  readonly baseNodes = input<TroncNodeItem[]>([]);
  readonly directionNodes = input<TroncNodeItem[]>([]);
  readonly assignments = input<AssignmentDetail[]>([]);
  readonly figureName = input<string | null>(null);
}

/**
 * A ResizeObserver test double that lets specs drive `contentRect` values directly instead of
 * depending on jsdom's (non-existent) real layout engine — mirrors how Konva rendering in this
 * lib is verified elsewhere (Playwright), not in jsdom: see the `figure-canvas.component.ts`
 * coverage exclusion note in jest.config.cts. This double tests this component's OWN glue logic
 * (which element measures the grid-only width, which measures the final constrained height),
 * not real CSS layout.
 */
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  readonly observedElements: Element[] = [];
  private callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    FakeResizeObserver.instances.push(this);
  }

  observe(el: Element): void {
    this.observedElements.push(el);
  }

  unobserve(): void {
    // no-op for this double
  }

  disconnect(): void {
    // no-op for this double
  }

  /** Fires the observer callback with one entry per given { el, width, height }. */
  fire(entries: { el: Element; width: number; height: number }[]): void {
    this.callback(
      entries.map(
        (e) =>
          ({
            target: e.el,
            contentRect: { width: e.width, height: e.height } as DOMRectReadOnly,
          }) as ResizeObserverEntry,
      ),
      this as unknown as ResizeObserver,
    );
  }
}

const makeAssignment = (nodeId: string, alias: string): AssignmentDetail => ({
  id: `asgn-${nodeId}`,
  figureInstanceId: 'inst-1',
  node: { id: nodeId, label: '', zone: 'DIRECTION', z: 0, positionType: 'direccio-tronc', sortOrder: 0, climbIndicator: null, ringLevel: null, originNodeId: null, sourceNodeId: null },
  person: { id: `p-${nodeId}`, alias, name: alias, shoulderHeight: null, notes: null, notesEmoji: null },
});

const makePanel = (instanceId: string, overrides: Partial<TroncPanelMeasureSpec> = {}): TroncPanelMeasureSpec => ({
  instanceId,
  troncNodes: [],
  baseNodes: [],
  directionNodes: [],
  assignments: [],
  figureName: null,
  ...overrides,
});

describe('TroncPanelMeasurerComponent', () => {
  let fixture: ComponentFixture<TroncPanelMeasurerComponent>;
  let component: TroncPanelMeasurerComponent;

  beforeEach(async () => {
    FakeResizeObserver.instances = [];
    (globalThis as unknown as Record<string, unknown>)['ResizeObserver'] = FakeResizeObserver;

    await TestBed.configureTestingModule({
      imports: [TroncPanelMeasurerComponent],
    })
      .overrideComponent(TroncPanelMeasurerComponent, {
        remove: { imports: [TroncViewComponent] },
        add: { imports: [StubTroncView] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(TroncPanelMeasurerComponent);
    component = fixture.componentInstance;
  });

  const probeStubFor = (instanceId: string): StubTroncView =>
    fixture.debugElement.query(By.css(`[data-tronc-probe-id="${instanceId}"] app-tronc-view`))
      .componentInstance as StubTroncView;

  const finalStubFor = (instanceId: string): StubTroncView =>
    fixture.debugElement.query(By.css(`[data-tronc-final-id="${instanceId}"] app-tronc-view`))
      .componentInstance as StubTroncView;

  it('probes the grid-only width first, with no direction nodes at all (so the direction row cannot stretch it)', () => {
    fixture.componentRef.setInput('panels', [
      makePanel('a', { directionNodes: [{ id: 'd1' } as TroncNodeItem], assignments: [makeAssignment('d1', 'JoanP')] }),
    ]);
    fixture.detectChanges();

    expect(probeStubFor('a').directionNodes()).toEqual([]);
  });

  it('renders the final (real) panel with the real direction nodes and assignments', () => {
    const assignments = [makeAssignment('d1', 'JoanP')];
    fixture.componentRef.setInput('panels', [
      makePanel('a', { directionNodes: [{ id: 'd1' } as TroncNodeItem], assignments }),
    ]);
    fixture.detectChanges();

    expect(finalStubFor('a').assignments()).toEqual(assignments);
  });

  it('constrains the final panel wrapper to the probe-measured width, once the probe reports it', () => {
    fixture.componentRef.setInput('panels', [makePanel('a')]);
    fixture.detectChanges();

    const probeObserver = FakeResizeObserver.instances[0];
    probeObserver.fire([{ el: probeObserver.observedElements[0], width: 120, height: 40 }]);
    fixture.detectChanges();

    const finalEl = fixture.debugElement.query(By.css('[data-tronc-final-id="a"]')).nativeElement as HTMLElement;
    expect(finalEl.style.width).toBe('120px');
  });

  it('does not emit sizesReady until the final (constrained) measurement arrives', () => {
    const emitted = jest.fn();
    component.sizesReady.subscribe(emitted);
    fixture.componentRef.setInput('panels', [makePanel('a')]);
    fixture.detectChanges();

    const probeObserver = FakeResizeObserver.instances[0];
    probeObserver.fire([{ el: probeObserver.observedElements[0], width: 120, height: 40 }]);
    fixture.detectChanges();

    expect(emitted).not.toHaveBeenCalled();
  });

  it('emits the final size using the probe width and the final (constrained) height', () => {
    const emitted = jest.fn();
    component.sizesReady.subscribe(emitted);
    fixture.componentRef.setInput('panels', [makePanel('a')]);
    fixture.detectChanges();

    const probeObserver = FakeResizeObserver.instances[0];
    probeObserver.fire([{ el: probeObserver.observedElements[0], width: 120, height: 40 }]);
    fixture.detectChanges();

    const finalObserver = FakeResizeObserver.instances[1];
    // Reports the constrained width back (== probe width) with the true wrapped height.
    finalObserver.fire([{ el: finalObserver.observedElements[0], width: 120, height: 90 }]);

    expect(emitted).toHaveBeenCalledTimes(1);
    expect(emitted.mock.calls[0][0].get('a')).toEqual({ width: 120, height: 90 });
  });

  it('ignores a final-observer callback that still reports the old (unconstrained) width', () => {
    const emitted = jest.fn();
    component.sizesReady.subscribe(emitted);
    fixture.componentRef.setInput('panels', [makePanel('a')]);
    fixture.detectChanges();

    const probeObserver = FakeResizeObserver.instances[0];
    probeObserver.fire([{ el: probeObserver.observedElements[0], width: 120, height: 40 }]);
    fixture.detectChanges();

    const finalObserver = FakeResizeObserver.instances[1];
    // Stale callback: the constraint hasn't visibly taken effect yet (still much wider).
    finalObserver.fire([{ el: finalObserver.observedElements[0], width: 500, height: 30 }]);
    expect(emitted).not.toHaveBeenCalled();

    // The real, constrained measurement arrives afterwards.
    finalObserver.fire([{ el: finalObserver.observedElements[0], width: 120, height: 90 }]);
    expect(emitted).toHaveBeenCalledTimes(1);
    expect(emitted.mock.calls[0][0].get('a')).toEqual({ width: 120, height: 90 });
  });

  it('measures multiple panels independently', () => {
    const emitted = jest.fn();
    component.sizesReady.subscribe(emitted);
    fixture.componentRef.setInput('panels', [makePanel('a'), makePanel('b')]);
    fixture.detectChanges();

    const probeObserver = FakeResizeObserver.instances[0];
    probeObserver.fire([
      { el: probeObserver.observedElements[0], width: 100, height: 30 },
      { el: probeObserver.observedElements[1], width: 200, height: 50 },
    ]);
    fixture.detectChanges();

    const finalObserver = FakeResizeObserver.instances[1];
    finalObserver.fire([
      { el: finalObserver.observedElements[0], width: 100, height: 60 },
      { el: finalObserver.observedElements[1], width: 200, height: 70 },
    ]);

    expect(emitted).toHaveBeenCalledTimes(1);
    const sizes = emitted.mock.calls[0][0] as Map<string, { width: number; height: number }>;
    expect(sizes.get('a')).toEqual({ width: 100, height: 60 });
    expect(sizes.get('b')).toEqual({ width: 200, height: 70 });
  });

  it('emits only once even if the final observer fires again afterwards', () => {
    const emitted = jest.fn();
    component.sizesReady.subscribe(emitted);
    fixture.componentRef.setInput('panels', [makePanel('a')]);
    fixture.detectChanges();

    const probeObserver = FakeResizeObserver.instances[0];
    probeObserver.fire([{ el: probeObserver.observedElements[0], width: 100, height: 30 }]);
    fixture.detectChanges();

    const finalObserver = FakeResizeObserver.instances[1];
    finalObserver.fire([{ el: finalObserver.observedElements[0], width: 100, height: 60 }]);
    finalObserver.fire([{ el: finalObserver.observedElements[0], width: 100, height: 999 }]);

    expect(emitted).toHaveBeenCalledTimes(1);
  });

  it('emits an empty map immediately when there are no panels', () => {
    const emitted = jest.fn();
    component.sizesReady.subscribe(emitted);
    fixture.componentRef.setInput('panels', []);
    fixture.detectChanges();

    expect(emitted).toHaveBeenCalledWith(new Map());
  });
});
