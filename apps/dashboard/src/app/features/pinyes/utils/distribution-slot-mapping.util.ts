import { DistributionItem } from '../models/distribution.model';
import { CompositionSlotWithNodes } from '../components/figure-canvas/figure-canvas.component';
import { filterNodesByFigureMode } from './figure-mode-filter.util';
import {
  figureExtentFromNodes,
  placeFigures,
  placeNewFigure,
  PlacedFigurePosition,
} from './figure-placement.util';
import { repositionCordoObertNodes } from './cordo-obert.util';
import { computeTroncNaturalSize } from './tronc-size.util';

/**
 * Maps segment distribution items into canvas slots, shared by the standalone
 * distribution editor and the workspace's Distribució tab.
 *
 * When no item has a saved position, the whole segment is laid out with the
 * space-optimizing `placeFigures` (rows sized to the reference screen,
 * explicit tronc panel positions). When only some items lack a position, each
 * of those is appended to the right of what is already placed with
 * `placeNewFigure`, so saved positions are never disturbed.
 */
export function mapDistributionItemsToSlots(
  items: DistributionItem[],
): CompositionSlotWithNodes[] {
  const placedExtents: { x: number; width: number }[] = [];

  const nodesByInstance = new Map(
    items.map((item) => {
      const filteredNodes = filterNodesByFigureMode(
        item.figureTemplate.nodes,
        item.figureMode,
        item.numberOfCordons,
        { keepCordoObert: true },
      );
      const positionedNodes = repositionCordoObertNodes(
        item.figureTemplate.nodes,
        filteredNodes,
        item.numberOfCordons,
      );
      const visibleNodes = item.cordonsObertsEnabled
        ? positionedNodes
        : positionedNodes.filter((n) => n.positionType !== 'cordo-obert');
      return [item.instanceId, visibleNodes] as const;
    }),
  );

  // Fully-unplaced segment → optimize the whole layout in one pass.
  let optimizedByInstance = new Map<string, PlacedFigurePosition>();
  if (items.length > 0 && items.every((item) => item.projectionX === null)) {
    const specs = items.map((item) => {
      const positionedNodes = nodesByInstance.get(item.instanceId) ?? [];
      // Pivot: PINYA+BASE only, matching the Konva composition-slot renderer's
      // own rotation pivot exactly (see pinyaBaseNodes doc). Occupancy adds
      // DECORATION, which is rendered but must not shift the pivot.
      const pivotNodes = pinyaBaseNodes(positionedNodes);
      const occupiedNodes = pinyaCanvasNodes(positionedNodes);
      const { naturalW, naturalH } = computeTroncNaturalSize(
        item.troncGridCols,
        effectiveTroncGridRows(item, positionedNodes),
      );
      return {
        ...figureExtentFromNodes(item.instanceId, pivotNodes),
        nodes: pivotNodes,
        occupiedNodes,
        tronc: { width: naturalW, height: naturalH },
      };
    });
    optimizedByInstance = new Map(placeFigures(specs).map((p) => [p.instanceId, p]));
  }

  return items.map((item, index) => {
    const positionedNodes = nodesByInstance.get(item.instanceId) ?? [];
    const extent = figureExtentFromNodes(item.instanceId, pinyaBaseNodes(positionedNodes));

    let offsetX: number;
    let offsetY: number;
    let angle: number;
    let troncPanelX = item.troncPanelX;
    let troncPanelY = item.troncPanelY;
    const optimized = optimizedByInstance.get(item.instanceId);
    if (item.projectionX !== null) {
      offsetX = item.projectionX;
      offsetY = item.projectionY ?? 0;
      angle = item.projectionAngle ?? 0;
    } else if (optimized) {
      offsetX = optimized.x;
      offsetY = optimized.y;
      angle = optimized.angle;
      troncPanelX = item.troncPanelX ?? optimized.troncPanelX;
      troncPanelY = item.troncPanelY ?? optimized.troncPanelY;
    } else {
      const placed = placeNewFigure(placedExtents, extent);
      offsetX = placed.x;
      offsetY = placed.y;
      angle = placed.angle;
    }
    placedExtents.push({ x: offsetX, width: extent.width });

    return {
      slotId: item.instanceId,
      label: computeSlotLabel(item),
      offsetX,
      offsetY,
      sortOrder: index,
      angle,
      assignments: item.assignments,
      troncGridCols: item.troncGridCols,
      troncGridRows: effectiveTroncGridRows(item, positionedNodes),
      troncPanelX,
      troncPanelY,
      figureTemplate: {
        id: item.figureTemplate.id,
        name: item.figureTemplate.name,
        hasPinya: positionedNodes.some((n) => n.zone === 'PINYA'),
        nodes: positionedNodes as unknown as CompositionSlotWithNodes['figureTemplate']['nodes'],
      },
    };
  });
}

/**
 * PINYA+BASE only — matches exactly the node set the Konva composition-slot
 * renderer uses to compute its rotation pivot (`slotGroup.offsetX/Y` in
 * figure-canvas.component.ts's renderCompositionSlots/renderTroncPanel). This
 * must be the basis for a figure's placed position, or the figure will render
 * shifted from where placement assumed — misaligning the tronc panel against
 * real nodes (including its own BASE row).
 */
function pinyaBaseNodes<T extends { zone: string }>(nodes: T[]): T[] {
  return nodes.filter((n) => n.zone === 'PINYA' || n.zone === 'BASE');
}

/** Nodes actually rendered on the pinya canvas — used only to block tronc placement. */
function pinyaCanvasNodes<T extends { zone: string }>(nodes: T[]): T[] {
  return nodes.filter((n) => n.zone === 'PINYA' || n.zone === 'BASE' || n.zone === 'DECORATION');
}

/**
 * Backend troncGridRows excludes the base row; the projected TroncView panel
 * adds one row when the (mode-filtered) figure still shows BASE nodes, so
 * placeholders and placement must reserve it too.
 */
function effectiveTroncGridRows(
  item: DistributionItem,
  modeFilteredNodes: { zone: string }[],
): number {
  const showsBase = item.figureMode !== 'REMAT' && modeFilteredNodes.some((n) => n.zone === 'BASE');
  return item.troncGridRows + (showsBase ? 1 : 0);
}

export function computeSlotLabel(item: DistributionItem): string {
  const base = item.label ?? item.figureTemplate.name;
  if (item.figureMode === 'PEU') return `Peu de ${base}`;
  if (item.figureMode === 'REMAT') return `Remat de ${base}`;
  if (item.figureMode === 'NETA') {
    const firstWord = base.trim().split(/\s+/)[0] ?? '';
    const suffix = firstWord.endsWith('a') ? 'neta' : 'net';
    return `${base} ${suffix}`;
  }
  return base;
}
