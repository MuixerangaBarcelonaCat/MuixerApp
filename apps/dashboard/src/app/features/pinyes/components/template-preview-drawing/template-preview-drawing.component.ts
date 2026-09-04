import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import rough from 'roughjs';
import type { RoughSVG } from 'roughjs/bin/svg';
import { hashSeed, layoutTroncGroup, computeGroundY } from '../../utils/tronc-silhouette-layout.util';
import { buildSilhouetteMarkup, buildPinyaMarkup, buildGroundLineMarkup } from './template-preview-drawing.render';

const PRIMARY_COLOR = 'oklch(var(--p))';
const SECONDARY_COLOR = 'oklch(var(--s))';

/**
 * The sketched "tronc + bases" preview drawn on a figure-template or composition card —
 * replaces the old decorative gradient panel. Never draws the pinya as part of the tronc
 * itself; every floor gets the same treatment, bases are not emphasized.
 *
 * One component for both: a figure-template card passes its single `troncProfile` as
 * `[profile]`; a composition card passes one profile per entry — `layoutTroncGroup` treats a
 * single profile as its own n=1 case, so there's no branching here for "one figure vs many."
 * When there are more than 3 profiles, only the 3 tallest are drawn, tallest centered.
 *
 * A single figure always draws standing on a ground line. `hasPinya` — whether it also has a
 * bracing crowd (the pinya, at ground level, not on top) — only applies to that single-figure
 * case (a figure-template card); a composition has no single hasPinya of its own, so the flag
 * is ignored whenever there's more than one profile. When true, a few extra people are drawn
 * flanking the base, reaching in toward the tronc rather than braced outward — this is the
 * only visual difference between a normal figure and a "figura neta" (no pinya), since the
 * pinya itself is otherwise never part of the tronc drawing.
 *
 * `seedKey` should be something stable per card (the figure's or composition's own name) so
 * the drawing is hand-made-looking but doesn't reshuffle on every re-render.
 */
@Component({
  selector: 'app-template-preview-drawing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.viewBox]="viewBox()"
      role="img"
      [attr.aria-label]="ariaLabel()"
      [innerHTML]="drawing()"
    ></svg>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
    }
  `,
})
export class TemplatePreviewDrawingComponent {
  readonly profiles = input<number[][]>([]);
  readonly seedKey = input<string>('');
  readonly hasPinya = input<boolean>(false);

  private readonly sanitizer = inject(DomSanitizer);
  private readonly rc: RoughSVG = rough.svg(
    document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement,
  );

  private readonly layout = computed(() => {
    const profiles = this.profiles();
    const seed = hashSeed(`${this.seedKey()}|${profiles.map((p) => p.join(',')).join(';')}`);
    return { seed, ...layoutTroncGroup(profiles, seed) };
  });

  readonly ariaLabel = computed(() => {
    const profiles = this.profiles();
    if (profiles.length === 0) return 'Sense figures';
    if (profiles.length === 1) {
      const label = profiles[0].length ? `Tronc de ${profiles[0].join(' · ')}` : 'Figura sense tronc';
      return this.hasPinya() ? `${label}, amb pinya` : label;
    }
    return `Composició de ${profiles.length} figures`;
  });

  private readonly render = computed(() => {
    const { seed, ...layout } = this.layout();
    let markup = buildSilhouetteMarkup(this.rc, layout, seed, PRIMARY_COLOR);
    let minX = 0;
    let maxX = layout.width;

    // The ground line grounds any drawing with people in it — a single figure (neta or not)
    // and a composition alike, since layoutTroncGroup already baseline-aligns every figure to
    // one shared bottom edge. The pinya people are the single-figure-and-hasPinya-only addition.
    if (layout.people.length > 0) {
      if (this.hasPinya() && this.profiles().length === 1) {
        const pinya = buildPinyaMarkup(this.rc, layout, seed, SECONDARY_COLOR);
        markup += pinya.markup;
        minX = pinya.minX;
        maxX = pinya.maxX;
      }
      const groundY = computeGroundY(layout);
      markup += buildGroundLineMarkup(this.rc, minX, maxX, groundY, seed, PRIMARY_COLOR);
    }

    const viewBox = `${minX - 6} -14 ${maxX - minX + 12} ${layout.height + 20}`;
    return { markup, viewBox };
  });

  readonly viewBox = computed(() => this.render().viewBox);

  readonly drawing = computed<SafeHtml>(() => this.sanitizer.bypassSecurityTrustHtml(this.render().markup));
}
