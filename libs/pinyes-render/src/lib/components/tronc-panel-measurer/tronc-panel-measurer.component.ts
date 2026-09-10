import { ChangeDetectionStrategy, Component, ElementRef, effect, input, output, signal, viewChildren } from '@angular/core';
import { TroncViewComponent, TroncNodeItem } from '../tronc-view/tronc-view.component';
import { ProjectionAssignment } from '../../models/projection.model';

export interface TroncPanelMeasureSpec {
  instanceId: string;
  troncNodes: TroncNodeItem[];
  baseNodes: TroncNodeItem[];
  directionNodes: TroncNodeItem[];
  /** Only DIRECTION-node assignments matter for sizing (see the two-element doc comment below);
   *  harmless to pass every assignment, the rest are simply never matched. */
  assignments: ProjectionAssignment[];
  figureName: string | null;
}

/**
 * Renders each given panel's real `<app-tronc-view mode="projection">` off-screen and reports
 * back its actual rendered pixel size via `sizesReady`, once every panel has been measured.
 * Used wherever a real DOM measurement is needed before positioning is computed (e.g. the
 * Distribució tab's auto-layout and live tronc panel overlay, `PinyaProjectionComponent`'s
 * panel/camera sizing) — see `docs/PINYES_MODULE.md`.
 *
 * Renders each panel TWICE, off-screen:
 * - a **probe**, with no direction nodes at all, giving the tronc/base grid's true natural
 *   width — a long assigned-directions line has no sibling element to compete with here, so it
 *   can never influence it.
 * - the real **final** panel (real direction nodes + assignments), width-constrained to the
 *   probe's measured width once known. This is what makes the directions row actually *wrap*
 *   inside the grid's width (matching the live rendering — `TroncViewComponent`'s
 *   `.direction-names` wraps text) instead of stretching the whole panel wider to fit
 *   unwrapped: `.tronc-view`'s children stretch to its own auto-determined width by default
 *   (flex column, `align-items: stretch`), so measuring the *unconstrained* full panel directly
 *   would let a long names line grow the whole panel and never wrap, since nothing bounds it.
 */
@Component({
  selector: 'lib-tronc-panel-measurer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TroncViewComponent],
  template: `
    <div style="position:fixed; left:-99999px; top:0; visibility:hidden; pointer-events:none;" aria-hidden="true">
      @for (p of panels(); track p.instanceId) {
        <div #probeEl [attr.data-tronc-probe-id]="p.instanceId" style="display:inline-block;">
          <app-tronc-view
            mode="projection"
            [troncNodes]="p.troncNodes"
            [baseNodes]="p.baseNodes"
            [directionNodes]="[]"
            [figureName]="p.figureName"
          />
        </div>
        <div
          #finalEl
          [attr.data-tronc-final-id]="p.instanceId"
          style="display:inline-block;"
          [style.width.px]="gridWidth(p.instanceId)"
        >
          <app-tronc-view
            mode="projection"
            [troncNodes]="p.troncNodes"
            [baseNodes]="p.baseNodes"
            [directionNodes]="p.directionNodes"
            [assignments]="p.assignments"
            [figureName]="p.figureName"
          />
        </div>
      }
    </div>
  `,
})
export class TroncPanelMeasurerComponent {
  readonly panels = input<TroncPanelMeasureSpec[]>([]);
  readonly sizesReady = output<Map<string, { width: number; height: number }>>();

  private readonly probeEls = viewChildren<ElementRef<HTMLDivElement>>('probeEl');
  private readonly finalEls = viewChildren<ElementRef<HTMLDivElement>>('finalEl');

  private readonly gridWidths = signal<Map<string, number>>(new Map());

  private probeObserver: ResizeObserver | null = null;
  private finalObserver: ResizeObserver | null = null;
  private emitted = false;

  protected gridWidth(instanceId: string): number | null {
    return this.gridWidths().get(instanceId) ?? null;
  }

  constructor() {
    // Probe pass: establishes each panel's grid-only natural width.
    effect((onCleanup) => {
      const specs = this.panels();
      const probes = this.probeEls();
      this.probeObserver?.disconnect();
      this.emitted = false;
      this.gridWidths.set(new Map());

      if (specs.length === 0) {
        this.sizesReady.emit(new Map());
        return;
      }
      if (probes.length !== specs.length) return;

      const widths = new Map<string, number>();
      this.probeObserver = new ResizeObserver((entries) => {
        let changed = false;
        for (const entry of entries) {
          const instanceId = (entry.target as HTMLElement).dataset['troncProbeId'];
          if (!instanceId || widths.has(instanceId)) continue;
          widths.set(instanceId, entry.contentRect.width);
          changed = true;
        }
        if (changed) this.gridWidths.set(new Map(widths));
      });
      for (const el of probes) this.probeObserver.observe(el.nativeElement);

      onCleanup(() => this.probeObserver?.disconnect());
    });

    // Final pass: once every panel's grid width is known (so every `finalEl` is already
    // width-constrained), measure the real, direction-wrapped height.
    effect((onCleanup) => {
      const specs = this.panels();
      const finals = this.finalEls();
      const widths = this.gridWidths();
      this.finalObserver?.disconnect();
      if (specs.length === 0 || finals.length !== specs.length) return;
      if (!specs.every((p) => widths.has(p.instanceId))) return;

      const finalSizes = new Map<string, { width: number; height: number }>();
      this.finalObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const instanceId = (entry.target as HTMLElement).dataset['troncFinalId'];
          if (!instanceId || finalSizes.has(instanceId)) continue;
          const expectedWidth = widths.get(instanceId) ?? 0;
          // Discard a stale callback from before the width constraint actually took effect.
          if (Math.abs(entry.contentRect.width - expectedWidth) > 1) continue;
          finalSizes.set(instanceId, { width: expectedWidth, height: entry.contentRect.height });
        }
        if (finalSizes.size >= specs.length && !this.emitted) {
          this.emitted = true;
          this.finalObserver?.disconnect();
          this.sizesReady.emit(new Map(finalSizes));
        }
      });
      for (const el of finals) this.finalObserver.observe(el.nativeElement);

      onCleanup(() => this.finalObserver?.disconnect());
    });
  }
}
