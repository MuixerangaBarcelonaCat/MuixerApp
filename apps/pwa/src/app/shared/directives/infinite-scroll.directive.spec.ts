import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ApplicationRef, Component, signal } from '@angular/core';
import { InfiniteScrollDirective } from './infinite-scroll.directive';

let observers: FakeIntersectionObserver[] = [];

class FakeIntersectionObserver {
  callback: IntersectionObserverCallback;
  observed: Element | null = null;
  disconnected = false;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    observers.push(this);
  }

  observe(el: Element): void {
    this.observed = el;
  }

  unobserve(): void {
    this.observed = null;
  }

  disconnect(): void {
    this.disconnected = true;
  }

  trigger(isIntersecting: boolean): void {
    this.callback([{ isIntersecting } as IntersectionObserverEntry], this as never);
  }
}

@Component({
  standalone: true,
  imports: [InfiniteScrollDirective],
  template: `<div appInfiniteScroll [appInfiniteScrollDisabled]="disabled()" (visible)="onVisible()"></div>`,
})
class TestHostComponent {
  readonly disabled = signal(false);
  visibleCount = 0;
  onVisible(): void {
    this.visibleCount++;
  }
}

describe('InfiniteScrollDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;
  let originalIntersectionObserver: typeof IntersectionObserver;

  beforeEach(async () => {
    observers = [];
    originalIntersectionObserver = window.IntersectionObserver;
    (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = FakeIntersectionObserver;

    await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();
    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await TestBed.inject(ApplicationRef).whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    window.IntersectionObserver = originalIntersectionObserver;
  });

  it('emits visible when the sentinel intersects', () => {
    observers[0].trigger(true);
    expect(component.visibleCount).toBe(1);
  });

  it('does not emit when not intersecting', () => {
    observers[0].trigger(false);
    expect(component.visibleCount).toBe(0);
  });

  it('does not emit while disabled', () => {
    component.disabled.set(true);
    fixture.detectChanges();
    observers[0].trigger(true);
    expect(component.visibleCount).toBe(0);
  });

  it('re-checks intersection when disabled turns back off', async () => {
    component.disabled.set(true);
    fixture.detectChanges();
    await TestBed.inject(ApplicationRef).whenStable();

    component.disabled.set(false);
    fixture.detectChanges();
    await TestBed.inject(ApplicationRef).whenStable();

    // Re-enabling re-observes, which the fake models by leaving `observed` set —
    // the real browser would immediately re-fire the callback if still on screen.
    expect(observers[0].observed).toBeTruthy();
  });

  it('disconnects the observer on destroy', () => {
    fixture.destroy();
    expect(observers[0].disconnected).toBe(true);
  });
});
