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

  // The mode/step toggles are lib-button instances (display:contents host) — data-testid lands
  // on that inert host, so queries scope to the real inner <button> the same way modal.component's
  // own spec does (see its "close button" comment).
  const modeButton = (mode: 'position' | 'size' | 'rotation') =>
    el.querySelector<HTMLButtonElement>(`[data-testid="dpad-mode-${mode}"] button`)!;
  const stepToggleButton = () => el.querySelector<HTMLButtonElement>('[data-testid="dpad-step-toggle"] button')!;

  describe('mode toggle', () => {
    it('starts in position mode', () => {
      expect(component.mode()).toBe('position');
      expect(modeButton('position').getAttribute('aria-pressed')).toBe('true');
    });

    it('switches to size mode on click', () => {
      modeButton('size').click();
      fixture.detectChanges();
      expect(component.mode()).toBe('size');
    });

    it('switches back to position mode', () => {
      modeButton('size').click();
      fixture.detectChanges();
      modeButton('position').click();
      fixture.detectChanges();
      expect(component.mode()).toBe('position');
    });

    it('switches to rotation mode on click', () => {
      modeButton('rotation').click();
      fixture.detectChanges();
      expect(component.mode()).toBe('rotation');
    });
  });

  describe('step toggle', () => {
    it('starts at step 10', () => {
      expect(component.step()).toBe(10);
    });

    it('toggles to step 1', () => {
      stepToggleButton().click();
      fixture.detectChanges();
      expect(component.step()).toBe(1);
    });

    it('toggles back to step 10', () => {
      stepToggleButton().click();
      fixture.detectChanges();
      stepToggleButton().click();
      fixture.detectChanges();
      expect(component.step()).toBe(10);
    });
  });

  describe('position mode arrows', () => {
    it('emits nodeMoved with positive dx on right arrow click', () => {
      const emitted: { dx: number; dy: number }[] = [];
      component.nodeMoved.subscribe((v) => emitted.push(v));

      component.onArrowPointerDown('right', new PointerEvent('pointerdown'));
      expect(emitted).toEqual([{ dx: 10, dy: 0 }]);
    });

    it('emits nodeMoved with negative dy on up arrow click', () => {
      const emitted: { dx: number; dy: number }[] = [];
      component.nodeMoved.subscribe((v) => emitted.push(v));

      component.onArrowPointerDown('up', new PointerEvent('pointerdown'));
      expect(emitted).toEqual([{ dx: 0, dy: -10 }]);
    });

    it('emits nodeMoved with step=1 when step toggled', () => {
      const emitted: { dx: number; dy: number }[] = [];
      component.nodeMoved.subscribe((v) => emitted.push(v));

      component.toggleStep();
      component.onArrowPointerDown('right', new PointerEvent('pointerdown'));
      expect(emitted).toEqual([{ dx: 1, dy: 0 }]);
    });

    it('emits nodeMoved.left with negative dx', () => {
      const emitted: { dx: number; dy: number }[] = [];
      component.nodeMoved.subscribe((v) => emitted.push(v));

      component.onArrowPointerDown('left', new PointerEvent('pointerdown'));
      expect(emitted).toEqual([{ dx: -10, dy: 0 }]);
    });

    it('emits nodeMoved.down with positive dy', () => {
      const emitted: { dx: number; dy: number }[] = [];
      component.nodeMoved.subscribe((v) => emitted.push(v));

      component.onArrowPointerDown('down', new PointerEvent('pointerdown'));
      expect(emitted).toEqual([{ dx: 0, dy: 10 }]);
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
      expect(emitted).toEqual([{ dw: 10, dh: 0 }]);
    });

    it('emits nodeResized with negative dw on left arrow', () => {
      const emitted: { dw: number; dh: number }[] = [];
      component.nodeResized.subscribe((v) => emitted.push(v));

      component.onArrowPointerDown('left', new PointerEvent('pointerdown'));
      expect(emitted).toEqual([{ dw: -10, dh: 0 }]);
    });

    it('emits nodeResized with negative dh on up arrow', () => {
      const emitted: { dw: number; dh: number }[] = [];
      component.nodeResized.subscribe((v) => emitted.push(v));

      component.onArrowPointerDown('up', new PointerEvent('pointerdown'));
      expect(emitted).toEqual([{ dw: 0, dh: -10 }]);
    });

    it('emits nodeResized with positive dh on down arrow', () => {
      const emitted: { dw: number; dh: number }[] = [];
      component.nodeResized.subscribe((v) => emitted.push(v));

      component.onArrowPointerDown('down', new PointerEvent('pointerdown'));
      expect(emitted).toEqual([{ dw: 0, dh: 10 }]);
    });
  });

  describe('rotation mode', () => {
    beforeEach(() => {
      component.setMode('rotation');
      fixture.detectChanges();
    });

    it('starts at rotation step 15°', () => {
      expect(component.rotationStep()).toBe(15);
      expect(component.stepLabel()).toBe('15°');
    });

    it('toggles rotation step to 1° independently of the px step', () => {
      stepToggleButton().click();
      fixture.detectChanges();
      expect(component.rotationStep()).toBe(1);
      expect(component.step()).toBe(10);
    });

    it('emits nodeRotated with positive dRotation on clockwise click', () => {
      const emitted: { dRotation: number }[] = [];
      component.nodeRotated.subscribe((v) => emitted.push(v));

      component.onRotatePointerDown('cw', new PointerEvent('pointerdown'));
      expect(emitted).toEqual([{ dRotation: 15 }]);
    });

    it('emits nodeRotated with negative dRotation on counterclockwise click', () => {
      const emitted: { dRotation: number }[] = [];
      component.nodeRotated.subscribe((v) => emitted.push(v));

      component.onRotatePointerDown('ccw', new PointerEvent('pointerdown'));
      expect(emitted).toEqual([{ dRotation: -15 }]);
    });

    it('emits nodeRotated with the 1° step when toggled', () => {
      const emitted: { dRotation: number }[] = [];
      component.nodeRotated.subscribe((v) => emitted.push(v));

      component.toggleStep();
      component.onRotatePointerDown('cw', new PointerEvent('pointerdown'));
      expect(emitted).toEqual([{ dRotation: 1 }]);
    });

    it('does not emit nodeRotated when disabled', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();
      const emitted: unknown[] = [];
      component.nodeRotated.subscribe((v) => emitted.push(v));

      component.onRotatePointerDown('cw', new PointerEvent('pointerdown'));
      expect(emitted.length).toBe(0);
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
