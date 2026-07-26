export interface FigureModeFilterableNode {
  zone: string;
  renglaId: string | null;
  renglaPosition: number | null;
  positionType?: string | null;
}

export interface FilterNodesByFigureModeOptions {
  /** Keep cordo-obert PINYA nodes even when their renglaPosition exceeds numberOfCordons. */
  keepCordoObert?: boolean;
}

export function filterNodesByFigureMode<T extends FigureModeFilterableNode>(
  nodes: T[],
  figureMode: string,
  numberOfCordons: number | null,
  options: FilterNodesByFigureModeOptions = {},
): T[] {
  const isRematOrNeta = figureMode === 'REMAT' || figureMode === 'NETA';
  return nodes.filter((n) => {
    if (n.zone === 'PINYA' && isRematOrNeta) return false;
    if (n.zone !== 'PINYA') return true;
    if (numberOfCordons === null) return true;
    if (options.keepCordoObert && n.positionType === 'cordo-obert') return true;
    return !n.renglaId || n.renglaPosition === null || n.renglaPosition <= numberOfCordons;
  });
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
