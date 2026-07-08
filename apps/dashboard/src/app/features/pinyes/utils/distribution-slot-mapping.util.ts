import { DistributionItem } from '../models/distribution.model';
import { CompositionSlotWithNodes } from '../components/figure-canvas/figure-canvas.component';
import { filterNodesByFigureMode } from './figure-mode-filter.util';
import { figureExtentFromNodes, placeNewFigure } from './figure-placement.util';
import { repositionCordoObertNodes } from './cordo-obert.util';

/**
 * Maps segment distribution items into canvas slots, shared by the standalone
 * distribution editor and the workspace's Distribució tab. Items without a
 * saved position (`projectionX === null`) are auto-placed with the placement
 * mock, to the right of whatever is already placed (stored or auto-placed).
 */
export function mapDistributionItemsToSlots(
  items: DistributionItem[],
): CompositionSlotWithNodes[] {
  const placedExtents: { x: number; width: number }[] = [];

  return items.map((item, index) => {
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
    const extent = figureExtentFromNodes(item.instanceId, positionedNodes);

    let offsetX: number;
    let offsetY: number;
    let angle: number;
    if (item.projectionX !== null) {
      offsetX = item.projectionX;
      offsetY = item.projectionY ?? 0;
      angle = item.projectionAngle ?? 0;
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
      troncGridRows: item.troncGridRows,
      troncPanelX: item.troncPanelX,
      troncPanelY: item.troncPanelY,
      figureTemplate: {
        id: item.figureTemplate.id,
        name: item.figureTemplate.name,
        hasPinya: positionedNodes.some((n) => n.zone === 'PINYA'),
        nodes: positionedNodes as unknown as CompositionSlotWithNodes['figureTemplate']['nodes'],
      },
    };
  });
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
