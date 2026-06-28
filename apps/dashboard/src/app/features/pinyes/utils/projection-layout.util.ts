import { FigureZone } from '@muixer/shared';
import { InstanceNodeItem } from '../models/assignment.model';
import { ProjectionInstance } from '../models/projection.model';

// ── Constants (calibrated to tronc-view.component.scss projection-mode) ──────

const GAP_PX = 4;
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

// ── Public types ──────────────────────────────────────────────────────────────

export interface ProjectionCell {
  instanceId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DistributionCell extends ProjectionCell {
  angle: number;
}

// ── Internal types ────────────────────────────────────────────────────────────

interface FigureMetrics {
  instanceId: string;
  pinyaW: number;
  pinyaH: number;
  troncPx: number;
  minWidth: number;
}

interface LayoutResult {
  minZoom: number;
  cells: ProjectionCell[];
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

// ── Greedy row packing ────────────────────────────────────────────────────────

/**
 * Greedy row packing (justified-image-grid).
 *
 * At scale s, a pinya figure contributes s × pinyaW pixels to a row; a figura
 * neta contributes a fixed MIN_FIGURE_WIDTH_PX. Figures are appended greedily;
 * a new row starts when the next figure would overflow screenW.
 *
 * Because each row is later stretched to fill screenW exactly, the actual zoom
 * for every row is ≥ s — so s is truly the minimum-zoom floor.
 */
function greedyRowPack(metrics: FigureMetrics[], s: number, screenW: number): FigureMetrics[][] {
  const rows: FigureMetrics[][] = [];
  let row: FigureMetrics[] = [];
  let usedW = 0;

  for (const fig of metrics) {
    const figW = Math.max(fig.minWidth, fig.pinyaW > 0 ? s * fig.pinyaW : 0);
    const gap = row.length > 0 ? GAP_PX : 0;

    if (row.length > 0 && usedW + gap + figW > screenW) {
      rows.push(row);
      row = [fig];
      usedW = figW;
    } else {
      row.push(fig);
      usedW += gap + figW;
    }
  }

  if (row.length > 0) rows.push(row);
  return rows;
}

/** Actual zoom scale when a row is stretched to fill screenW. */
function rowScale(row: FigureMetrics[], screenW: number): number {
  const sumPinyaW = row.reduce((a, f) => (f.pinyaW > 0 ? a + f.pinyaW : a), 0);
  const fixedW = row.reduce((a, f) => (f.pinyaW === 0 ? a + f.minWidth : a), 0);
  const gaps = (row.length - 1) * GAP_PX;
  return sumPinyaW > 0 ? (screenW - fixedW - gaps) / sumPinyaW : 0;
}

/** Height of the tallest cell in a row once stretched to screenW. */
function rowHeight(row: FigureMetrics[], screenW: number): number {
  const s = rowScale(row, screenW);
  return Math.max(...row.map((f) => (f.pinyaH > 0 ? s * f.pinyaH : 0) + f.troncPx));
}

/** Total pixel height for a set of rows including inter-row gaps. */
function totalRowHeight(rows: FigureMetrics[][], screenW: number): number {
  if (rows.length === 0) return 0;
  return (
    rows.reduce((a, row) => a + rowHeight(row, screenW), 0) +
    (rows.length - 1) * GAP_PX
  );
}

// ── Greedy column packing ─────────────────────────────────────────────────────

/**
 * Greedy column packing — the vertical dual of greedyRowPack.
 *
 * At scale s, a pinya figure contributes (s × pinyaH + troncPx) pixels of height
 * to a column; a figura neta contributes only its troncPx. A new column starts
 * when the next figure would overflow screenH.
 *
 * Each column is later stretched to fill screenH exactly, so the actual zoom
 * per column is ≥ s.
 */
function greedyColPack(metrics: FigureMetrics[], s: number, screenH: number): FigureMetrics[][] {
  const cols: FigureMetrics[][] = [];
  let col: FigureMetrics[] = [];
  let usedH = 0;

  for (const fig of metrics) {
    const figH = (fig.pinyaH > 0 ? s * fig.pinyaH : 0) + fig.troncPx;
    const gap = col.length > 0 ? GAP_PX : 0;

    if (col.length > 0 && usedH + gap + figH > screenH) {
      cols.push(col);
      col = [fig];
      usedH = figH;
    } else {
      col.push(fig);
      usedH += gap + figH;
    }
  }

  if (col.length > 0) cols.push(col);
  return cols;
}

/** Actual zoom scale when a column is stretched to fill screenH. */
function colScale(col: FigureMetrics[], screenH: number): number {
  const sumPinyaH = col.reduce((a, f) => a + f.pinyaH, 0);
  const sumTroncPx = col.reduce((a, f) => a + f.troncPx, 0);
  const gaps = (col.length - 1) * GAP_PX;
  return sumPinyaH > 0 ? (screenH - sumTroncPx - gaps) / sumPinyaH : 0;
}

/** Width of a column once stretched to screenH. */
function colWidth(col: FigureMetrics[], screenH: number): number {
  const s = colScale(col, screenH);
  const maxPinyaW = col.reduce((a, f) => Math.max(a, f.pinyaW), 0);
  const maxMinWidth = col.reduce((a, f) => Math.max(a, f.minWidth), 0);
  return Math.max(maxMinWidth, maxPinyaW > 0 ? s * maxPinyaW : 0);
}

/** Total pixel width for a set of columns including inter-column gaps. */
function totalColWidth(cols: FigureMetrics[][], screenH: number): number {
  if (cols.length === 0) return 0;
  return (
    cols.reduce((a, col) => a + colWidth(col, screenH), 0) +
    (cols.length - 1) * GAP_PX
  );
}

// ── Cell builders ─────────────────────────────────────────────────────────────

/**
 * Build absolutely-positioned cells from a row packing.
 * Rows are expanded proportionally to fill screenH; cells within each row are
 * expanded proportionally to fill screenW. The last row / cell absorbs remainders.
 */
function buildRowCells(rows: FigureMetrics[][], screenW: number, screenH: number): LayoutResult {
  const numRows = rows.length;
  const totalRowGaps = (numRows - 1) * GAP_PX;

  const initialRowHeights = rows.map((row) => rowHeight(row, screenW));
  const usedH = initialRowHeights.reduce((a, h) => a + h, 0) + totalRowGaps;
  const extraH = Math.max(0, screenH - usedH);
  const totalH = initialRowHeights.reduce((a, h) => a + h, 0);

  const finalRowHeights = initialRowHeights.map((h) =>
    totalH > 0 ? h + extraH * (h / totalH) : h,
  );
  if (numRows > 0) {
    const allocated = finalRowHeights.slice(0, -1).reduce((a, h) => a + Math.round(h), 0);
    finalRowHeights[numRows - 1] = screenH - allocated - totalRowGaps;
  }

  const cells: ProjectionCell[] = [];
  let curY = 0;
  let minZoom = Infinity;

  for (let r = 0; r < numRows; r++) {
    const row = rows[r];
    const rowH = Math.max(1, Math.round(finalRowHeights[r]));
    const s = rowScale(row, screenW);
    const rowGaps = (row.length - 1) * GAP_PX;

    const initialWidths = row.map((f) =>
      Math.max(f.minWidth, f.pinyaW > 0 ? s * f.pinyaW : 0),
    );
    const usedW = initialWidths.reduce((a, w) => a + w, 0) + rowGaps;
    const extraW = Math.max(0, screenW - usedW);
    const scalableW = initialWidths.reduce((a, w, i) => (row[i].pinyaW > 0 ? a + w : a), 0);

    const finalWidths = initialWidths.map((w, i) =>
      row[i].pinyaW > 0 && scalableW > 0 ? w + extraW * (w / scalableW) : w,
    );
    if (row.length > 0) {
      const allocated = finalWidths.slice(0, -1).reduce((a, w) => a + Math.round(w), 0);
      finalWidths[row.length - 1] = screenW - allocated - rowGaps;
    }

    let curX = 0;
    for (let i = 0; i < row.length; i++) {
      const fig = row[i];
      const cellW = Math.max(1, Math.round(finalWidths[i]));
      cells.push({ instanceId: fig.instanceId, x: Math.round(curX), y: Math.round(curY), width: cellW, height: rowH });

      if (fig.pinyaW > 0 && fig.pinyaH > 0) {
        const pinyaAreaH = rowH - fig.troncPx;
        if (pinyaAreaH > 0)
          minZoom = Math.min(minZoom, Math.min(cellW / fig.pinyaW, pinyaAreaH / fig.pinyaH));
      }

      curX += cellW + GAP_PX;
    }
    curY += rowH + GAP_PX;
  }

  return { minZoom: isFinite(minZoom) ? minZoom : 0, cells };
}

/**
 * Build absolutely-positioned cells from a column packing.
 * Columns are expanded proportionally to fill screenW; cells within each column
 * are expanded proportionally to fill screenH. The last column / cell absorbs remainders.
 */
function buildColCells(cols: FigureMetrics[][], screenW: number, screenH: number): LayoutResult {
  const numCols = cols.length;
  const totalColGaps = (numCols - 1) * GAP_PX;

  const initialColWidths = cols.map((col) => colWidth(col, screenH));
  const usedW = initialColWidths.reduce((a, w) => a + w, 0) + totalColGaps;
  const extraW = Math.max(0, screenW - usedW);
  const totalW = initialColWidths.reduce((a, w) => a + w, 0);

  const finalColWidths = initialColWidths.map((w) =>
    totalW > 0 ? w + extraW * (w / totalW) : w,
  );
  if (numCols > 0) {
    const allocated = finalColWidths.slice(0, -1).reduce((a, w) => a + Math.round(w), 0);
    finalColWidths[numCols - 1] = screenW - allocated - totalColGaps;
  }

  const cells: ProjectionCell[] = [];
  let curX = 0;
  let minZoom = Infinity;

  for (let c = 0; c < numCols; c++) {
    const col = cols[c];
    const colW = Math.max(1, Math.round(finalColWidths[c]));
    const s = colScale(col, screenH);
    const colGaps = (col.length - 1) * GAP_PX;

    const initialHeights = col.map((f) =>
      (f.pinyaH > 0 ? s * f.pinyaH : 0) + f.troncPx,
    );
    const usedH = initialHeights.reduce((a, h) => a + h, 0) + colGaps;
    const extraH = Math.max(0, screenH - usedH);
    const sumPinyaH = col.reduce((a, f) => a + f.pinyaH, 0);

    const finalHeights = initialHeights.map((h, i) =>
      sumPinyaH > 0 ? h + extraH * (col[i].pinyaH / sumPinyaH) : h,
    );
    if (col.length > 0) {
      const allocated = finalHeights.slice(0, -1).reduce((a, h) => a + Math.round(h), 0);
      finalHeights[col.length - 1] = screenH - allocated - colGaps;
    }

    let curY = 0;
    for (let i = 0; i < col.length; i++) {
      const fig = col[i];
      const cellH = Math.max(1, Math.round(finalHeights[i]));
      cells.push({ instanceId: fig.instanceId, x: Math.round(curX), y: Math.round(curY), width: colW, height: cellH });

      if (fig.pinyaW > 0 && fig.pinyaH > 0) {
        const pinyaAreaH = cellH - fig.troncPx;
        if (pinyaAreaH > 0)
          minZoom = Math.min(minZoom, Math.min(colW / fig.pinyaW, pinyaAreaH / fig.pinyaH));
      }

      curY += cellH + GAP_PX;
    }
    curX += colW + GAP_PX;
  }

  return { minZoom: isFinite(minZoom) ? minZoom : 0, cells };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Compute the optimal absolutely-positioned layout for a set of projection figures,
 * filling the entire screenW × screenH container.
 *
 * Algorithm: binary search on minimum zoom scale s.
 * At each s, both greedy row packing and greedy column packing are checked —
 * s is feasible if EITHER fits (total height ≤ screenH for rows, or total width
 * ≤ screenW for columns). The binary search finds the largest feasible s.
 *
 * At the optimal s, both packings are built and the one with the higher actual
 * minimum zoom (after space-filling expansion) is returned.
 *
 * Rows/columns are stretched to fill the container exactly; remaining space is
 * distributed proportionally so the layout tiles to the edges with no gaps.
 * Tronc height is treated as fixed pixel overhead.
 * Figures netes (no pinya) get a fixed minimum width.
 */
export function computeProjectionLayout(
  instances: ProjectionInstance[],
  screenW: number,
  screenH: number,
): ProjectionCell[] {
  const N = instances.length;
  if (N === 0) return [];
  if (N === 1) {
    return [{ instanceId: instances[0].id, x: 0, y: 0, width: screenW, height: screenH }];
  }

  const metrics = instances.map(toMetrics);
  console.log(metrics);

  // Upper bound: the scale at which even a single figure fills the full screen height.
  // Above this, no layout can be feasible.
  const pinyaFigs = metrics.filter((f) => f.pinyaH > 0);
  const hiInit =
    pinyaFigs.length > 0
      ? pinyaFigs.reduce((m, f) => Math.min(m, (screenH - f.troncPx) / f.pinyaH), Infinity)
      : 0;

  let lo = 0;
  let hi = isFinite(hiInit) && hiInit > 0 ? hiInit : 0;

  for (let i = 0; i < 52; i++) {
    const mid = (lo + hi) / 2;
    const rowOK = totalRowHeight(greedyRowPack(metrics, mid, screenW), screenW) <= screenH;
    const colOK = totalColWidth(greedyColPack(metrics, mid, screenH), screenH) <= screenW;
    if (rowOK || colOK) lo = mid; else hi = mid;
  }

  // Build both candidate layouts; only compare minZoom for feasible packings.
  // The binary search guarantees at least one of them fits — don't let an infeasible
  // packing's (artificially high) minZoom override the feasible one.
  const rowPack = greedyRowPack(metrics, lo, screenW);
  const colPack = greedyColPack(metrics, lo, screenH);
  const rowFits = totalRowHeight(rowPack, screenW) <= screenH;
  const colFits = totalColWidth(colPack, screenH) <= screenW;

  const rowResult = buildRowCells(rowPack, screenW, screenH);
  const colResult = buildColCells(colPack, screenW, screenH);

  console.log(rowResult);
  console.log(colResult);

  if (rowFits && colFits) {
    return rowResult.minZoom >= colResult.minZoom ? rowResult.cells : colResult.cells;
  }
  return rowFits ? rowResult.cells : colResult.cells;
}

/**
 * Compute absolutely-positioned layout cells for a segment with a custom distribution.
 *
 * Uses stored `projectionX/Y` as canvas-space positions. All positions are scaled
 * uniformly to fit the screen while preserving the relative spatial layout the user
 * defined in the distribution editor. Each cell carries the stored rotation angle.
 */
export function computeDistributionLayout(
  instances: ProjectionInstance[],
  screenW: number,
  screenH: number,
): DistributionCell[] {
  if (instances.length === 0) return [];

  const PADDING = 24;

  const rawCells: DistributionCell[] = instances.map((inst, index) => {
    const m = toMetrics(inst);
    const naturalW = Math.max(m.minWidth, m.pinyaW > 0 ? m.pinyaW : m.minWidth);
    const naturalH = m.troncPx + (m.pinyaH > 0 ? m.pinyaH : 0);

    return {
      instanceId: inst.id,
      x: inst.projectionX ?? index * (naturalW + GAP_PX),
      y: inst.projectionY ?? 0,
      width: naturalW,
      height: naturalH,
      angle: inst.projectionAngle ?? 0,
    };
  });

  const minX = Math.min(...rawCells.map((c) => c.x));
  const minY = Math.min(...rawCells.map((c) => c.y));
  const maxX = Math.max(...rawCells.map((c) => c.x + c.width));
  const maxY = Math.max(...rawCells.map((c) => c.y + c.height));
  const bbW = maxX - minX;
  const bbH = maxY - minY;

  if (bbW <= 0 || bbH <= 0) return rawCells;

  const scale = Math.min(
    (screenW - PADDING * 2) / bbW,
    (screenH - PADDING * 2) / bbH,
  );

  const offsetX = (screenW - bbW * scale) / 2 - minX * scale;
  const offsetY = (screenH - bbH * scale) / 2 - minY * scale;

  return rawCells.map((c) => ({
    ...c,
    x: Math.round(c.x * scale + offsetX),
    y: Math.round(c.y * scale + offsetY),
    width: Math.round(c.width * scale),
    height: Math.round(c.height * scale),
  }));
}
