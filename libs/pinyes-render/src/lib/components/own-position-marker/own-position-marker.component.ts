import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ChevronRight, LucideAngularModule } from 'lucide-angular';
import { StageTransform, stageToScreen } from '../../utils/rengla-coordinates.util';

/**
 * `world`: a point in Konva stage-local ("canvas-world") coordinates — a pinya/base node centre,
 * converted via `stageToScreen`. `screen`: an already screen-space point — a tronc panel's
 * top-centre, which `distributionTroncPanels()` computes directly and re-derives on every
 * `stageTransformChanged` tick, so no further conversion is wanted here.
 */
export type MarkerTarget = { kind: 'world'; x: number; y: number } | { kind: 'screen'; x: number; y: number };

export interface MarkerViewport {
  width: number;
  height: number;
}

/** Screen px kept clear between the chevron and the true viewport edge. */
const EDGE_MARGIN = 24;

/**
 * "You are here": a pulsing dot fixed at a constant screen size over the target, or — once panned
 * or zoomed off the visible area — a chevron pinned to the nearest viewport edge and rotated
 * toward it. Pure DOM/CSS over the canvas, not Konva: that's what gives the marker its constant
 * size regardless of stage zoom, with no extra math needed.
 */
@Component({
  selector: 'lib-own-position-marker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  imports: [LucideAngularModule],
  templateUrl: './own-position-marker.component.html',
})
export class OwnPositionMarkerComponent {
  protected readonly ChevronRight = ChevronRight;

  readonly target = input<MarkerTarget | null>(null);
  readonly stageTransform = input<StageTransform>({ x: 0, y: 0, scaleX: 1, scaleY: 1 });
  readonly viewport = input.required<MarkerViewport>();

  /** Emitted by the chevron. The pin has no handler — once it's visible, there's nothing to tap. */
  readonly troba = output<void>();

  protected readonly screenPosition = computed((): { x: number; y: number } | null => {
    const t = this.target();
    if (!t) return null;
    return t.kind === 'world' ? stageToScreen(t.x, t.y, this.stageTransform()) : { x: t.x, y: t.y };
  });

  protected readonly isOffscreen = computed(() => {
    const p = this.screenPosition();
    if (!p) return false;
    const { width, height } = this.viewport();
    return p.x < 0 || p.x > width || p.y < 0 || p.y > height;
  });

  private readonly clamped = computed(() => {
    const p = this.screenPosition();
    if (!p || !this.isOffscreen()) return null;
    return clampToViewportEdge(p, this.viewport(), EDGE_MARGIN);
  });

  protected readonly chevronPosition = computed(() => this.clamped()?.position ?? null);
  protected readonly chevronAngleDeg = computed(() => this.clamped()?.angleDeg ?? null);
}

/**
 * Clips the ray from the viewport centre to `target` against the viewport's boundary (inset by
 * `margin`), and returns both that intersection point and the ray's angle — one formula handles
 * every edge and every corner without special-casing them.
 */
function clampToViewportEdge(
  target: { x: number; y: number },
  viewport: MarkerViewport,
  margin: number,
): { position: { x: number; y: number }; angleDeg: number } {
  const cx = viewport.width / 2;
  const cy = viewport.height / 2;
  const dx = target.x - cx;
  const dy = target.y - cy;

  const halfW = Math.max(0, cx - margin);
  const halfH = Math.max(0, cy - margin);
  const tX = dx === 0 ? Infinity : halfW / Math.abs(dx);
  const tY = dy === 0 ? Infinity : halfH / Math.abs(dy);
  const t = dx === 0 && dy === 0 ? 0 : Math.min(tX, tY);

  return {
    position: { x: cx + dx * t, y: cy + dy * t },
    angleDeg: (Math.atan2(dy, dx) * 180) / Math.PI,
  };
}
