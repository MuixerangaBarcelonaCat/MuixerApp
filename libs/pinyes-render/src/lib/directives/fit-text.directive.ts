import { Directive, ElementRef, InjectionToken, OnDestroy, effect, inject, input } from '@angular/core';
import { fitFontSize } from '../utils/fit-font-size.util';

export type TextWidthMeasurer = (
  text: string,
  fontSizePx: number,
  fontFamily: string,
  fontWeight: string,
) => number;

let sharedCanvasContext: CanvasRenderingContext2D | null | undefined;

/** Measures text width via an offscreen canvas. Returns 0 (always "fits") where canvas is unavailable. */
function canvasTextWidthMeasurer(
  text: string,
  fontSizePx: number,
  fontFamily: string,
  fontWeight: string,
): number {
  if (sharedCanvasContext === undefined) {
    sharedCanvasContext = document.createElement('canvas').getContext('2d');
  }
  if (!sharedCanvasContext) return 0;
  sharedCanvasContext.font = `${fontWeight} ${fontSizePx}px ${fontFamily}`;
  return sharedCanvasContext.measureText(text).width;
}

export const TEXT_WIDTH_MEASURER = new InjectionToken<TextWidthMeasurer>('TEXT_WIDTH_MEASURER', {
  providedIn: 'root',
  factory: () => canvasTextWidthMeasurer,
});

/**
 * Shrinks the host element's font size (down to `fitTextMinPx`) so its text content fits
 * the available width instead of being clipped with an ellipsis. Below the minimum, the
 * element's own CSS `text-overflow: ellipsis` takes over.
 */
@Directive({
  selector: '[appFitText]',
  standalone: true,
})
export class FitTextDirective implements OnDestroy {
  readonly fitTextEnabled = input(true);
  readonly fitTextValue = input('');
  readonly fitTextMinPx = input(9);
  readonly fitTextMaxPx = input(16);

  private readonly el = inject(ElementRef<HTMLElement>).nativeElement;
  private readonly measure = inject(TEXT_WIDTH_MEASURER);
  private readonly resizeObserver: ResizeObserver | null = null;

  constructor() {
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.fit());
      this.resizeObserver.observe(this.el);
    }
    effect(() => {
      // Track inputs so any change re-triggers a fit.
      this.fitTextEnabled();
      this.fitTextValue();
      this.fitTextMinPx();
      this.fitTextMaxPx();
      this.fit();
    });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  private fit(): void {
    this.el.style.fontSize = '';
    if (!this.fitTextEnabled()) return;

    const text = this.fitTextValue() || this.el.textContent?.trim() || '';
    const availableWidth = this.el.clientWidth;
    if (!text || availableWidth <= 0) return;

    const style = getComputedStyle(this.el);
    const fontSize = fitFontSize(
      this.fitTextMaxPx(),
      this.fitTextMinPx(),
      availableWidth,
      Infinity,
      'none',
      (fs) => ({ width: this.measure(text, fs, style.fontFamily, style.fontWeight), height: 0 }),
    );
    this.el.style.fontSize = `${fontSize}px`;
  }
}
