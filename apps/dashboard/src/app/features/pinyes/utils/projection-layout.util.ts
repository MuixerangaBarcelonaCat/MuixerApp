import { FigureZone } from '@muixer/shared';
import { InstanceNodeItem } from '../models/assignment.model';
import { ProjectionInstance } from '../models/projection.model';

// ── Constants (calibrated to tronc-view.component.scss projection-mode) ──────

/** Figure name header row height (text-base + pt-1 + pb-0.5 + border-b). */
const NAME_HEADER_PX = 28;
/** One tronc floor row (min-height 1.75rem) + inter-row gap (2px). */
const TRONC_ROW_PX = 30;
/** Vertical padding inside the tronc-view in projection mode (0.25rem × 2). */
const TRONC_PADDING_PX = 8;
/** Base pixel budget for tronc columns + padding regardless of position count. */
const MIN_WIDTH_BASE_PX = 200;
/** Extra pixels per tronc position in the widest floor. */
const MIN_WIDTH_PER_POSITION_PX = 50;

// ── Internal types ────────────────────────────────────────────────────────────

interface FigureMetrics {
  instanceId: string;
  pinyaW: number;
  pinyaH: number;
  troncPx: number;
  minWidth: number;
}

// ── Node metric helpers ───────────────────────────────────────────────────────

function computePinyaBbox(nodes: InstanceNodeItem[]): { w: number; h: number } | null {
  const relevant = nodes.filter(
    (n) =>
      n.zone === FigureZone.PINYA ||
      n.zone === FigureZone.BASE ||
      n.zone === FigureZone.DECORATION,
  );
  if (!relevant.length) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of relevant) {
    minX = Math.min(minX, n.x - n.width / 2);
    minY = Math.min(minY, n.y - n.height / 2);
    maxX = Math.max(maxX, n.x + n.width / 2);
    maxY = Math.max(maxY, n.y + n.height / 2);
  }

  const w = maxX - minX;
  const h = maxY - minY;
  return w > 0 && h > 0 ? { w, h } : null;
}

function computeTroncPx(nodes: InstanceNodeItem[]): number {
  const zLevels = new Set(nodes.filter((n) => n.zone === FigureZone.TRONC).map((n) => n.z));
  const hasBase = nodes.some((n) => n.zone === FigureZone.BASE);
  const floorCount = zLevels.size + (hasBase ? 1 : 0);
  return NAME_HEADER_PX + TRONC_PADDING_PX + floorCount * TRONC_ROW_PX;
}

/** Minimum cell width based on the widest tronc floor's position count. */
function computeMinWidth(nodes: InstanceNodeItem[]): number {
  const byFloor = new Map<number, number>();
  for (const n of nodes.filter((n) => n.zone === FigureZone.TRONC)) {
    byFloor.set(n.z, (byFloor.get(n.z) ?? 0) + 1);
  }
  const maxPositions = byFloor.size > 0 ? Math.max(...byFloor.values()) : 0;
  return MIN_WIDTH_BASE_PX + MIN_WIDTH_PER_POSITION_PX * maxPositions;
}

function toMetrics(instance: ProjectionInstance): FigureMetrics {
  const isNeta = instance.figureTemplate?.hasPinya === false;

  let bbox: { w: number; h: number } | null = null;
  if (!isNeta) {
    // Mirror getInstanceProjectionNodes: only assigned PINYA nodes are rendered;
    // BASE and DECORATION are always shown. Use the same set for the bbox so the
    // allocated cell reflects what the canvas actually draws.
    const assignedIds = new Set(instance.assignments.map((a) => a.node.id));
    const visibleNodes = instance.nodes.filter(
      (n) =>
        n.zone === FigureZone.BASE ||
        n.zone === FigureZone.DECORATION ||
        (n.zone === FigureZone.PINYA && assignedIds.has(n.id)),
    );
    bbox = computePinyaBbox(visibleNodes);
  }

  return {
    instanceId: instance.id,
    pinyaW: bbox?.w ?? 0,
    pinyaH: bbox?.h ?? 0,
    troncPx: computeTroncPx(instance.nodes),
    minWidth: computeMinWidth(instance.nodes),
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Natural (unscaled) footprint of a figure in the unified projection canvas:
 * the PINYA+BASE+DECORATION bounding box widened to fit its tronc panel,
 * and the total height including the tronc panel above it. Used both to fit
 * the canvas transform and to size figures for the auto-placement mock.
 */
export function computeInstanceNaturalExtent(instance: ProjectionInstance): { width: number; height: number } {
  const m = toMetrics(instance);
  return {
    width: Math.max(m.minWidth, m.pinyaW > 0 ? m.pinyaW : m.minWidth),
    height: m.troncPx + (m.pinyaH > 0 ? m.pinyaH : 0),
  };
}

export interface DistributionTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Compute the scale + translation that maps canvas-space distribution coordinates to
 * screen-space, fitting all instance bounding boxes within the given screen dimensions.
 *
 * Expects every instance to already carry a resolved projectionX/Y (real, saved
 * position or a mock-placed one — see ProjectionViewComponent.effectiveInstances).
 */
export function computeDistributionTransform(
  instances: ProjectionInstance[],
  screenW: number,
  screenH: number,
): DistributionTransform {
  if (instances.length === 0) return { scale: 1, offsetX: 0, offsetY: 0 };

  const PADDING = 24;

  const rawRects = instances.map((inst) => {
    const { width, height } = computeInstanceNaturalExtent(inst);
    return {
      x: inst.projectionX ?? 0,
      y: inst.projectionY ?? 0,
      width,
      height,
    };
  });

  const minX = Math.min(...rawRects.map((r) => r.x));
  const minY = Math.min(...rawRects.map((r) => r.y));
  const maxX = Math.max(...rawRects.map((r) => r.x + r.width));
  const maxY = Math.max(...rawRects.map((r) => r.y + r.height));
  const bbW = maxX - minX;
  const bbH = maxY - minY;

  if (bbW <= 0 || bbH <= 0) return { scale: 1, offsetX: 0, offsetY: 0 };

  const scale = Math.min(
    (screenW - PADDING * 2) / bbW,
    (screenH - PADDING * 2) / bbH,
  );
  const offsetX = (screenW - bbW * scale) / 2 - minX * scale;
  const offsetY = (screenH - bbH * scale) / 2 - minY * scale;

  return { scale, offsetX, offsetY };
}
