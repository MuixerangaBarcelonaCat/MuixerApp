import { isNodeVisibleByModeAndCordons } from '@muixer/shared';

export interface FigureModeFilterableNode {
  zone: string;
  renglaId: string | null;
  renglaPosition: number | null;
  positionType?: string | null;
}

/**
 * Which nodes stay visible when packing/repositioning a figure for a given mode + cordons.
 * A thin wrapper around the shared `isNodeVisibleByModeAndCordons` — cordo-obert nodes are
 * always kept here regardless of the cap (`cordonsObertsEnabled: true`) since callers still
 * need them present to reposition (`repositionCordoObertNodes`) before applying the instance's
 * real `cordonsObertsEnabled` as a separate, later filter step.
 */
export function filterNodesByFigureMode<T extends FigureModeFilterableNode>(
  nodes: T[],
  figureMode: string,
  numberOfCordons: number | null,
): T[] {
  return nodes.filter((n) => isNodeVisibleByModeAndCordons(n, { figureMode, numberOfCordons, cordonsObertsEnabled: true }));
}

export interface CordonsCountableNode {
  zone: string;
  positionType?: string | null;
  renglaPosition: number | null;
}

/** Highest rengla position among a figure's PINYA nodes — the number of cordons it has. */
export function computeMaxCordons(nodes: CordonsCountableNode[]): number {
  return nodes.reduce(
    (max, n) =>
      n.zone === 'PINYA' &&
      n.positionType !== 'cordo-obert' &&
      n.renglaPosition !== null &&
      n.renglaPosition > max
        ? n.renglaPosition
        : max,
    0,
  );
}
