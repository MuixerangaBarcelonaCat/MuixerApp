import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FitTextDirective, TEXT_WIDTH_MEASURER, TextWidthMeasurer } from './fit-text.directive';

/** Fake measurer: every character is exactly `fontSizePx * 0.6` wide. */
const fakeMeasurer: TextWidthMeasurer = (text, fontSizePx) => text.length * fontSizePx * 0.6;

@Component({
  standalone: true,
  imports: [FitTextDirective],
  template: `
    <span
      appFitText
      [fitTextEnabled]="enabled"
      [fitTextValue]="text"
      [fitTextMinPx]="minPx"
      [fitTextMaxPx]="maxPx"
    >{{ text }}</span>
  `,
})
class HostComponent {
  enabled = true;
  text = 'Marta (X)';
  minPx = 9;
  maxPx = 16;
}

let capturedRoCallback: (() => void) | null = null;
let activeFixture: ComponentFixture<HostComponent> | null = null;

function setup(overrides: Partial<HostComponent> = {}) {
  TestBed.configureTestingModule({
    imports: [HostComponent],
    providers: [{ provide: TEXT_WIDTH_MEASURER, useValue: fakeMeasurer }],
  });
  const fixture: ComponentFixture<HostComponent> = TestBed.createComponent(HostComponent);
  activeFixture = fixture;
  Object.assign(fixture.componentInstance, overrides);
  fixture.detectChanges();
  const target = fixture.nativeElement.querySelector('span') as HTMLElement;
  return { fixture, target };
}

/** Stubs clientWidth then re-runs the fit logic via the captured ResizeObserver callback. */
function refitWithWidth(target: HTMLElement, width: number): void {
  Object.defineProperty(target, 'clientWidth', { value: width, configurable: true });
  capturedRoCallback?.();
}

describe('FitTextDirective', () => {
  beforeEach(() => {
    capturedRoCallback = null;
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = vi.fn().mockImplementation(
      function (this: unknown, cb: () => void) {
        capturedRoCallback = cb;
        return { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() };
      },
    );
  });

  afterEach(() => {
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));
    activeFixture?.destroy();
    activeFixture = null;
  });

  it('keeps the max font size when the text fits at max size', () => {
    const { target } = setup();
    // 'Marta (X)'.length = 9, at 16px: 9 * 16 * 0.6 = 86.4 <= 200
    refitWithWidth(target, 200);

    expect(target.style.fontSize).toBe('16px');
  });

  it('shrinks the font size until the text fits within the available width', () => {
    const { target } = setup();
    refitWithWidth(target, 40);

    const size = parseFloat(target.style.fontSize);
    expect(size).toBeLessThan(16);
    expect(size).toBeGreaterThanOrEqual(9);
  });

  it('does not go below the configured minimum font size', () => {
    const { target } = setup();
    refitWithWidth(target, 1);

    expect(target.style.fontSize).toBe('9px');
  });

  it('does not set an inline font size when disabled', () => {
    const { target } = setup({ enabled: false });
    refitWithWidth(target, 40);

    expect(target.style.fontSize).toBe('');
  });
});
