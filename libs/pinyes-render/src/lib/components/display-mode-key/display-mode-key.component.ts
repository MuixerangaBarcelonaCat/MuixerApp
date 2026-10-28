import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { ChevronDown, ChevronUp, LucideAngularModule, Star } from 'lucide-angular';
import { ButtonComponent, NodeTones, heightRampTones } from '@muixer/ui';
import { EventPhase } from '@muixer/shared';
import { HeightMode } from '../../models/assignment.model';
import { injectCanvasTheme } from '../../theme/inject-canvas-theme';
import { formatShoulderHeight } from '../../node-render/appearance';
import { injectPinyesRenderSettings } from '../../settings/render-settings';
import { SketchPath, hashSeed, sketchShape } from '../../node-render/sketch';
import { DisplayFacts, DisplayMode, HeightDomain, displayModeKey, positionKey } from '../../node-render/display-mode';
import { NodeLegendComponent } from '../node-legend/node-legend.component';

const MODE_TITLE: Record<DisplayMode, string> = {
  position: 'Posició',
  height: 'Alçada',
  attendance: 'Assistència',
  gender: 'Gènere',
};

/** Stops of the height gradient bar: enough for the quick turn from apricot to rose to read smooth. */
const GRADIENT_STOPS = 21;

/** The height bar's box (w-48 × h-3); the pen is inset like a node's, so its wobble stays inside. */
const BAR_WIDTH = 192;
const BAR_HEIGHT = 12;
const BAR_INSET = 2;

/** A key square, drawn 16px wide with the pen inset like a node's, so its wobble stays inside. */
const SQUARE = 13;
const SQUARE_OUTLINE_WIDTH = 1.2;

/** A key square with the canvas pen: the wash as a fill, the pencil as the outline; `key` seeds the wobble. */
function sketchSquare(tones: NodeTones, key: string): SketchPath[] {
  return sketchShape(
    { kind: 'rect', width: SQUARE, height: SQUARE, cornerRadius: 0 },
    { fill: { style: 'solid', color: tones.wash }, stroke: tones.pencil, strokeWidth: SQUARE_OUTLINE_WIDTH, dash: null },
    hashSeed(key),
  );
}

let nextKeyId = 0;

interface KeyRowView {
  id: string;
  label: string;
  count: number | null;
  swatches: { key: string; tones: NodeTones; star: boolean; paths: SketchPath[] }[];
}

/**
 * What the node colors mean in the segment workspace's display mode: one row per color that appears
 * in the tab (with how many nodes carry it), or the height gradient over the tab's people, marked
 * with the cm at each quarter of their ranks. Each color is a square drawn with the canvas pen (rough.js), filled with the
 * node's wash and outlined in its pencil; the darker attendance shade carries the star, as the node does. It also hosts the «Altres marques» of the marks.
 *
 * `card` floats under the pinya canvas toolbar, right-aligned toward the toolbar with the square
 * last; `inline` sits in the Troncs tab's toolbar strip, where nothing may float over the panels.
 */
@Component({
  selector: 'app-display-mode-key',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, LucideAngularModule, NgTemplateOutlet, NodeLegendComponent],
  templateUrl: './display-mode-key.component.html',
})
export class DisplayModeKeyComponent {
  readonly mode = input.required<DisplayMode>();
  /** One entry per staffed node the tab draws (a person placed twice counts twice, as the canvas shows). */
  readonly people = input<DisplayFacts[]>([]);
  /** Posició: the types of the nodes the tab draws. */
  readonly positionTypes = input<(string | null)[]>([]);
  readonly heightDomain = input<HeightDomain | null>(null);
  readonly heightMode = input<HeightMode>('relative');
  readonly phase = input<EventPhase>('before');
  readonly layout = input<'card' | 'inline'>('card');
  /** The «Altres marques» samples' palette: `neutral` beside the tronc panels. */
  readonly legendPalette = input<'type' | 'neutral'>('type');

  protected readonly ChevronUp = ChevronUp;
  protected readonly ChevronDown = ChevronDown;
  protected readonly Star = Star;
  protected readonly bodyId = `display-mode-key-${nextKeyId++}`;
  protected readonly open = signal(true);

  private readonly theme = injectCanvasTheme();
  private readonly renderSettings = injectPinyesRenderSettings();

  protected readonly title = computed(() => MODE_TITLE[this.mode()]);

  private readonly key = computed(() => {
    const themeMode = this.theme().mode;
    if (this.mode() === 'position') return positionKey(this.positionTypes(), themeMode);
    return displayModeKey(this.people(), { mode: this.mode(), phase: this.phase(), heightDomain: this.heightDomain(), themeMode });
  });

  /** The star's color on a node (the canvas theme's dark mark), so the key's star matches the figure's. */
  protected readonly starColor = computed(() => this.theme().nodeOutline);

  protected readonly rows = computed<KeyRowView[]>(() =>
    this.key().rows.map((row) => ({
      id: row.id,
      label: row.label,
      count: row.count,
      swatches: row.swatches.map((swatch, i) => {
        const key = `${row.id}-${i}`;
        return { key, tones: swatch.tones, star: swatch.star, paths: sketchSquare(swatch.tones, key) };
      }),
    })),
  );

  /**
   * Alçada's bar, drawn with the canvas pen like a node: one rough rectangle whose fill runs through
   * the ramp's washes and whose outline runs through its pencils, as SVG gradients.
   */
  protected readonly gradient = computed(() => {
    const domain = this.key().gradient;
    if (!domain) return null;
    const themeMode = this.theme().mode;
    const ramp = Array.from({ length: GRADIENT_STOPS }, (_, i) => {
      const t = i / (GRADIENT_STOPS - 1);
      return { offset: `${t * 100}%`, ...heightRampTones(t, themeMode) };
    });
    const washId = `${this.bodyId}-wash`;
    const pencilId = `${this.bodyId}-pencil`;
    const paths = sketchShape(
      { kind: 'rect', width: BAR_WIDTH - 2 * BAR_INSET, height: BAR_HEIGHT - 2 * BAR_INSET, cornerRadius: 0 },
      { fill: { style: 'solid', color: `url(#${washId})` }, stroke: `url(#${pencilId})`, strokeWidth: SQUARE_OUTLINE_WIDTH, dash: null },
      hashSeed(`height-bar-${themeMode}`),
    );
    // Ranks spread the quarters evenly along the bar, so the marks space out evenly too. Five
    // labels share the bar's width: only the last carries the unit.
    const { quarters } = domain;
    const baselineCm = this.renderSettings().shoulderHeightBaselineCm;
    const ticks = quarters.map((cm, i) => `${formatShoulderHeight(cm, this.heightMode(), baselineCm) ?? cm}${i === quarters.length - 1 ? ' cm' : ''}`);
    return { ramp, washId, pencilId, paths, viewBox: `${-BAR_WIDTH / 2} ${-BAR_HEIGHT / 2} ${BAR_WIDTH} ${BAR_HEIGHT}`, ticks };
  });

  protected readonly note = computed(() => this.key().note);

  /** A mode about people, with no one placed yet: nothing to color. */
  protected readonly empty = computed(() => this.mode() !== 'position' && this.people().length === 0);

  protected readonly barWidth = BAR_WIDTH;
  protected readonly barHeight = BAR_HEIGHT;

  protected toggle(): void {
    this.open.update((o) => !o);
  }
}
