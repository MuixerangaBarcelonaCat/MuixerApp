import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { injectCanvasTheme } from '../../theme/inject-canvas-theme';
import { CardEdge, PIN_RADIUS, pinDiscs } from '../../utils/figure-link.util';

/** Where the pin sits on the card, as a CSS position: the middle of an edge. */
const PIN_AT: Record<CardEdge, { left: string; top: string }> = {
  top: { left: '50%', top: '0%' },
  bottom: { left: '50%', top: '100%' },
  left: { left: '0%', top: '50%' },
  right: { left: '100%', top: '50%' },
};

/**
 * A tronc panel as a paper card pinned to the page: a clean-cut paper face on a flat edge of darker
 * paper (no shadow), held by one pin in the figure colour on the middle of an edge, slightly askew
 * around that pin. A segment's lone figure gets no pin: there is no other panel to tell it from. In
 * the projection the pin is the string's first end, so it goes on the edge facing the figure
 * (`cardPin`). On the dark canvas the card is a step lighter than the canvas, on a darker edge.
 */
@Component({
  selector: 'lib-pinned-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [':host { display: block; }'],
  template: `
    <div
      data-role="card"
      style="position: relative; height: 100%"
      [style.transform]="tilt() ? 'rotate(' + tilt() + 'deg)' : null"
      [style.transform-origin]="pinAt().left + ' ' + pinAt().top"
    >
      <div
        data-role="edge"
        aria-hidden="true"
        style="position: absolute; inset: 0; transform: translate(4px, 5px)"
        [style.background-color]="theme().cardEdge"
      ></div>
      <div
        data-role="face"
        style="position: relative; height: 100%; border-width: 1px; border-style: solid"
        [style.background-color]="theme().card"
        [style.border-color]="theme().cardBorder"
      >
        <ng-content />
      </div>
      @if (discs(); as discs) {
      <svg
        data-role="pin"
        aria-hidden="true"
        focusable="false"
        width="0"
        height="0"
        overflow="visible"
        style="position: absolute; display: block"
        [style.left]="pinAt().left"
        [style.top]="pinAt().top"
      >
        @for (disc of discs; track $index) {
          <circle [attr.cx]="disc.x" [attr.cy]="disc.y" [attr.r]="disc.radius" [attr.fill]="disc.fill" [attr.stroke]="disc.stroke" [attr.stroke-width]="disc.strokeWidth" />
        }
      </svg>
      }
    </div>
  `,
})
export class PinnedCardComponent {
  /** The figure colour: the pin's, and its string's. `null` draws no pin (a lone figure). */
  readonly color = input<string | null>(null);
  /** The edge holding the pin. */
  readonly edge = input<CardEdge>('top');
  /** Degrees the card turns around its pin; a degree or so reads as pinned by hand. */
  readonly tilt = input(0);

  protected readonly theme = injectCanvasTheme();
  protected readonly pinAt = computed(() => PIN_AT[this.edge()]);
  protected readonly discs = computed(() => {
    const color = this.color();
    return color ? pinDiscs(0, 0, PIN_RADIUS, color, this.theme()) : null;
  });
}
