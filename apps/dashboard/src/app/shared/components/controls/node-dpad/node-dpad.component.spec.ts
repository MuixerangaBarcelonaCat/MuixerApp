import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { NodeDpadComponent } from './node-dpad.component';

describe('NodeDpadComponent', () => {
  let fixture: ComponentFixture<NodeDpadComponent>;
  let component: NodeDpadComponent;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NodeDpadComponent],
      providers: [allLucideIconsProvider],
    }).compileComponents();

    fixture = TestBed.createComponent(NodeDpadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  afterEach(() => {
    fixture.destroy();
  });

  describe('mode toggle', () => {
    it('starts in position mode', () => {
      expect(component.mode()).toBe('position');
      const posBtn = el.querySelector<HTMLElement>('[data-testid="dpad-mode-position"]')!;
      expect(posBtn.classList.contains('btn-primary')).toBe(true);
    });

    it('switches to size mode on click', () => {
      el.querySelector<HTMLElement>('[data-testid="dpad-mode-size"]')!.click();
      fixture.detectChanges();
      expect(component.mode()).toBe('size');
    });

    it('switches back to position mode', () => {
      el.querySelector<HTMLElement>('[data-testid="dpad-mode-size"]')!.click();
      fixture.detectChanges();
      el.querySelector<HTMLElement>('[data-testid="dpad-mode-position"]')!.click();
      fixture.detectChanges();
      expect(component.mode()).toBe('position');
    });
  });

  describe('step toggle', () => {
    it('starts at step 1', () => {
      expect(component.step()).toBe(1);
    });

    it('toggles to step 10', () => {
      el.querySelector<HTMLElement>('[data-testid="dpad-step-toggle"]')!.click();
      fixture.detectChanges();
      expect(component.step()).toBe(10);
    });

    it('toggles back to step 1', () => {
      el.querySelector<HTMLElement>('[data-testid="dpad-step-toggle"]')!.click();
      fixture.detectChanges();
      el.querySelector<HTMLElement>('[data-testid="dpad-step-toggle"]')!.click();
      fixture.detectChanges();
      expect(component.step()).toBe(1);
    });
  });

  describe('position mode arrows', () => {
    it('emits nodeMoved with positive dx on right arrow click', () => {
      const emitted: { dx: number; dy: number }[] = [];
      component.nodeMoved.subscribe((v) => emitted.push(v));

      component.onArrowPointerDown('right', new PointerEvent('pointerdown'));
      expect(emitted).toEqual([{ dx: 1, dy: 0 }]);
    });

    it('emits nodeMoved with negative dy on up arrow click', () => {
      const emitted: { dx: number; dy: number }[] = [];
      component.nodeMoved.subscribe((v) => emitted.push(v));

      component.onArrowPointerDown('up', new PointerEvent('pointerdown'));
      expect(emitted).toEqual([{ dx: 0, dy: -1 }]);
    });

    it('emits nodeMoved with step=10 when step toggled', () => {
      const emitted: { dx: number; dy: number }[] = [];
      component.nodeMoved.subscribe((v) => emitted.push(v));

      component.toggleStep();
      component.onArrowPointerDown('right', new PointerEvent('pointerdown'));
      expect(emitted).toEqual([{ dx: 10, dy: 0 }]);
    });

    it('emits nodeMoved.left with negative dx', () => {
      const emitted: { dx: number; dy: number }[] = [];
      component.nodeMoved.subscribe((v) => emitted.push(v));

      component.onArrowPointerDown('left', new PointerEvent('pointerdown'));
      expect(emitted).toEqual([{ dx: -1, dy: 0 }]);
    });

    it('emits nodeMoved.down with positive dy', () => {
      const emitted: { dx: number; dy: number }[] = [];
      component.nodeMoved.subscribe((v) => emitted.push(v));

      component.onArrowPointerDown('down', new PointerEvent('pointerdown'));
      expect(emitted).toEqual([{ dx: 0, dy: 1 }]);
    });
  });

  describe('size mode arrows', () => {
    beforeEach(() => {
      component.setMode('size');
    });

    it('emits nodeResized with positive dw on right arrow', () => {
      const emitted: { dw: number; dh: number }[] = [];
      component.nodeResized.subscribe((v) => emitted.push(v));

      component.onArrowPointerDown('right', new PointerEvent('pointerdown'));
      expect(emitted).toEqual([{ dw: 1, dh: 0 }]);
    });

    it('emits nodeResized with negative dw on left arrow', () => {
      const emitted: { dw: number; dh: number }[] = [];
      component.nodeResized.subscribe((v) => emitted.push(v));

      component.onArrowPointerDown('left', new PointerEvent('pointerdown'));
      expect(emitted).toEqual([{ dw: -1, dh: 0 }]);
    });

    it('emits nodeResized with negative dh on up arrow', () => {
      const emitted: { dw: number; dh: number }[] = [];
      component.nodeResized.subscribe((v) => emitted.push(v));

      component.onArrowPointerDown('up', new PointerEvent('pointerdown'));
      expect(emitted).toEqual([{ dw: 0, dh: -1 }]);
    });

    it('emits nodeResized with positive dh on down arrow', () => {
      const emitted: { dw: number; dh: number }[] = [];
      component.nodeResized.subscribe((v) => emitted.push(v));

      component.onArrowPointerDown('down', new PointerEvent('pointerdown'));
      expect(emitted).toEqual([{ dw: 0, dh: 1 }]);
    });
  });

  describe('disabled state', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();
    });

    it('does not emit nodeMoved when disabled', () => {
      const emitted: unknown[] = [];
      component.nodeMoved.subscribe((v) => emitted.push(v));

      component.onArrowPointerDown('right', new PointerEvent('pointerdown'));
      expect(emitted.length).toBe(0);
    });

    it('does not emit nodeResized when disabled', () => {
      const emitted: unknown[] = [];
      component.nodeResized.subscribe((v) => emitted.push(v));

      component.setMode('size');
      component.onArrowPointerDown('right', new PointerEvent('pointerdown'));
      expect(emitted.length).toBe(0);
    });
  });

  describe('long press repeat', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('emits repeatedly while button is held down', () => {
      const emitted: { dx: number; dy: number }[] = [];
      component.nodeMoved.subscribe((v) => emitted.push(v));

      component.onArrowPointerDown('right', new PointerEvent('pointerdown'));
      // Initial emit
      expect(emitted.length).toBe(1);

      // After 300ms delay, repeat starts
      vi.advanceTimersByTime(300);
      // After one repeat interval
      vi.advanceTimersByTime(100);
      expect(emitted.length).toBeGreaterThan(1);

      component.onArrowPointerUp();
      const countAfterRelease = emitted.length;
      vi.advanceTimersByTime(200);
      // No more emits after release
      expect(emitted.length).toBe(countAfterRelease);
    });
  });

  describe('aria labels', () => {
    it('updates aria-label text for position mode', () => {
      const label = component.arrowLabel('right');
      expect(label).toContain('dreta');
    });

    it('updates aria-label text for size mode', () => {
      component.setMode('size');
      const label = component.arrowLabel('right');
      expect(label).toContain('amplada');
    });
  });
});
