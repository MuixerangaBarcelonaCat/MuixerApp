import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  InjectionToken,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { NodeShape } from '@muixer/shared';
import { buildCanvasTheme } from '../../theme/canvas-theme';
import { NodeAppearance } from '../../node-render/appearance';
import { DrawPrimitive, nodeDrawPlan } from '../../node-render/draw-plan';
import { NodeOutline, nodeOutline } from '../../node-render/outline';
import { NODE_ICON_PATHS } from '../../node-render/icons';

/** Width of a text drawn bold at a font size in a font family, for fitting names to a node. */
export type NameMeasure = (text: string, fontSize: number, fontFamily: string) => number;

/** Measures names with a canvas 2D context, the way the browser will draw the SVG text. */
export const NODE_NAME_MEASURE = new InjectionToken<NameMeasure>('NODE_NAME_MEASURE', {
  providedIn: 'root',
  factory: () => {
    let ctx: CanvasRenderingContext2D | null | undefined;
    return (text, fontSize, fontFamily) => {
      ctx ??= document.createElement('canvas').getContext('2d');
      if (!ctx) return text.length * fontSize * 0.6;
      ctx.font = `700 ${fontSize}px ${fontFamily}`;
      return ctx.measureText(text).width;
    };
  },
});

const THEME = buildCanvasTheme();
/** Hatching for a pending node, as a Phase 2 stand-in for rough.js: lines 6 apart at −41°, as on the canvas. */
const HATCH_GAP = 6;
const HATCH_WEIGHT = 1;
const HATCH_ANGLE = -41;

let nextDrawingId = 0;

type ShapeItem = {
  kind: 'shape';
  outline: NodeOutline;
  points: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
  dash: string | null;
};
type IconItem = Extract<DrawPrimitive, { kind: 'icon' }> & { transform: string; paths: string[]; scale: number };
type Item = ShapeItem | IconItem | Exclude<DrawPrimitive, { kind: 'shape' } | { kind: 'icon' }>;

/**
 * SVG side of the node renderer: fills its (positioned) parent and paints the node draw plan
 * (`nodeDrawPlan`) for the size it is given, so a DOM node — a tronc panel cell — is drawn exactly
 * like a node on the Konva canvas. Purely visual: the parent element carries the interaction and
 * the accessible name.
 */
@Component({
  selector: 'app-node-drawing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  styles: [':host { position: absolute; inset: 0; display: block; pointer-events: none; }'],
  template: `
    @if (view(); as v) {
      <svg
        data-layer="node"
        [attr.width]="v.width"
        [attr.height]="v.height"
        [attr.viewBox]="v.viewBox"
        overflow="visible"
        aria-hidden="true"
        focusable="false"
        style="display: block"
      >
        @if (v.hatch) {
          <defs>
            <pattern
              [attr.id]="hatchId"
              patternUnits="userSpaceOnUse"
              [attr.width]="hatchGap"
              [attr.height]="hatchGap"
              [attr.patternTransform]="hatchTransform"
            >
              <rect [attr.y]="(hatchGap - hatchWeight) / 2" [attr.width]="hatchGap" [attr.height]="hatchWeight" [attr.fill]="v.hatch" />
            </pattern>
          </defs>
        }
        <ng-container *ngTemplateOutlet="primitives; context: { $implicit: v.items, v }" />
      </svg>
      <!-- What reaches past the cell (the conflict loop, the sticker, the move badge). Positioned
           with a z-index while the cell sets none, so it stacks above every other cell's body. -->
      @if (v.raised.length > 0) {
        <svg
          data-layer="raised"
          [attr.width]="v.width"
          [attr.height]="v.height"
          [attr.viewBox]="v.viewBox"
          overflow="visible"
          aria-hidden="true"
          focusable="false"
          style="position: absolute; inset: 0; z-index: 1; display: block"
        >
          <ng-container *ngTemplateOutlet="primitives; context: { $implicit: v.raised, v }" />
        </svg>
      }
    }

    <!-- svg:g: content at the top of an ng-template would otherwise be created as HTML. -->
    <ng-template #primitives let-items let-v="v">
      <svg:g>
  @for (item of items; track $index) {
        @switch (item.kind) {
          @case ('shape') {
            @switch (item.outline.kind) {
              @case ('rect') {
                <rect
                  data-role="outline"
                  [attr.x]="-v.width / 2"
                  [attr.y]="-v.height / 2"
                  [attr.width]="v.width"
                  [attr.height]="v.height"
                  [attr.rx]="$any(item.outline).cornerRadius"
                  [attr.fill]="item.fill"
                  [attr.stroke]="item.stroke"
                  [attr.stroke-width]="item.strokeWidth"
                  [attr.stroke-dasharray]="item.dash"
                />
              }
              @case ('ellipse') {
                <ellipse
                  data-role="outline"
                  [attr.rx]="$any(item.outline).radiusX"
                  [attr.ry]="$any(item.outline).radiusY"
                  [attr.fill]="item.fill"
                  [attr.stroke]="item.stroke"
                  [attr.stroke-width]="item.strokeWidth"
                  [attr.stroke-dasharray]="item.dash"
                />
              }
              @case ('polygon') {
                <polygon
                  data-role="outline"
                  [attr.points]="item.points"
                  [attr.fill]="item.fill"
                  [attr.stroke]="item.stroke"
                  [attr.stroke-width]="item.strokeWidth"
                  [attr.stroke-dasharray]="item.dash"
                  stroke-linejoin="round"
                />
              }
            }
          }
          @case ('loop') {
            <ellipse data-role="loop" [attr.rx]="item.radiusX" [attr.ry]="item.radiusY" fill="none" [attr.stroke]="item.color" [attr.stroke-width]="item.width" />
          }
          @case ('text') {
            @if (item.wrap) {
              <foreignObject
                [attr.data-role]="item.role"
                [attr.x]="item.x - item.boxWidth / 2"
                [attr.y]="item.y - item.boxHeight / 2"
                [attr.width]="item.boxWidth"
                [attr.height]="item.boxHeight"
              >
                <xhtml:div
                  [style.height.px]="item.boxHeight"
                  [style.font-family]="item.fontFamily"
                  [style.font-size.px]="item.fontSize"
                  [style.font-weight]="item.fontStyle === 'bold' ? 700 : 400"
                  [style.color]="item.fill"
                  style="display: flex; align-items: center; justify-content: center; text-align: center; line-height: 1.1; overflow: hidden; overflow-wrap: anywhere"
                >
                  {{ item.text }}
                </xhtml:div>
              </foreignObject>
            } @else {
              <text
                [attr.data-role]="item.role"
                [attr.x]="item.x"
                [attr.y]="item.y"
                [attr.text-anchor]="item.align === 'center' ? 'middle' : 'start'"
                dominant-baseline="central"
                [attr.font-family]="item.fontFamily"
                [attr.font-size]="item.fontSize"
                [attr.font-weight]="item.fontStyle === 'bold' ? 700 : 400"
                [attr.fill]="item.fill"
                [attr.stroke]="item.halo?.color ?? null"
                [attr.stroke-width]="item.halo?.width ?? null"
                [attr.paint-order]="item.halo ? 'stroke' : null"
                [attr.stroke-linejoin]="item.halo ? 'round' : null"
              >{{ item.text }}</text>
            }
          }
          @case ('strike') {
            <line data-role="strike" [attr.x1]="item.x1" [attr.x2]="item.x2" [attr.y1]="item.y" [attr.y2]="item.y" [attr.stroke]="item.color" [attr.stroke-width]="item.width" stroke-linecap="round" />
          }
          @case ('icon') {
            <g [attr.data-icon]="item.icon" [attr.transform]="item.transform">
              @for (d of item.paths; track $index) {
                <path
                  [attr.d]="d"
                  [attr.fill]="item.filled ? item.color : 'none'"
                  [attr.stroke]="item.color"
                  [attr.stroke-width]="item.strokeWidth"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              }
            </g>
          }
          @case ('disc') {
            <circle [attr.cx]="item.x" [attr.cy]="item.y" [attr.r]="item.radius" [attr.fill]="item.fill" [attr.stroke]="item.stroke" [attr.stroke-width]="item.strokeWidth" />
          }
        }
      }
      </svg:g>
    </ng-template>
  `,
})
export class NodeDrawingComponent {
  readonly appearance = input.required<NodeAppearance>();
  readonly shape = input<string>(NodeShape.RECTANGLE);

  protected readonly hatchId = `node-hatch-${nextDrawingId++}`;
  protected readonly hatchGap = HATCH_GAP;
  protected readonly hatchWeight = HATCH_WEIGHT;
  protected readonly hatchTransform = `rotate(${HATCH_ANGLE})`;

  private readonly measure = inject(NODE_NAME_MEASURE);
  private readonly size = signal<{ width: number; height: number } | null>(null);

  protected readonly view = computed(() => {
    const size = this.size();
    if (!size) return null;
    const { width, height } = size;
    const plan = nodeDrawPlan(this.appearance(), { width, height, shape: this.shape() }, THEME, this.measure);
    const hatch = plan.find((p) => p.kind === 'shape' && p.fill.style === 'hatch');
    return {
      width,
      height,
      viewBox: `${-width / 2} ${-height / 2} ${width} ${height}`,
      hatch: hatch?.kind === 'shape' && hatch.fill.style === 'hatch' ? hatch.fill.color : null,
      items: plan.filter((p) => !p.raised).map((p) => this.toItem(p)),
      raised: plan.filter((p) => p.raised).map((p) => this.toItem(p)),
    };
  });

  constructor() {
    const host = inject(ElementRef<HTMLElement>).nativeElement;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      this.size.set(width > 0 && height > 0 ? { width, height } : null);
    });
    observer.observe(host);
    inject(DestroyRef).onDestroy(() => observer.disconnect());
  }

  private toItem(p: DrawPrimitive): Item {
    if (p.kind === 'shape') {
      const outline = nodeOutline(p.shape, p.width, p.height);
      return {
        kind: 'shape',
        outline,
        points: outline.kind === 'polygon' ? outline.points.join(' ') : '',
        fill: p.fill.style === 'none' ? 'none' : p.fill.style === 'hatch' ? `url(#${this.hatchId})` : p.fill.color,
        stroke: p.stroke,
        strokeWidth: p.strokeWidth,
        dash: p.dash ? p.dash.join(' ') : null,
      };
    }
    if (p.kind === 'icon') {
      const scale = p.size / 24;
      return {
        ...p,
        scale,
        paths: NODE_ICON_PATHS[p.icon],
        transform: `translate(${p.x - p.size / 2} ${p.y - p.size / 2}) scale(${scale})`,
      };
    }
    return p;
  }
}
