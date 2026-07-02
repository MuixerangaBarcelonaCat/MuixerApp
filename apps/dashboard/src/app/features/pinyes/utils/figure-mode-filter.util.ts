export interface FigureModeFilterableNode {
  zone: string;
  renglaId: string | null;
  renglaPosition: number | null;
}

export function filterNodesByFigureMode<T extends FigureModeFilterableNode>(
  nodes: T[],
  figureMode: string,
  numberOfCordons: number | null,
): T[] {
  const isRematOrNeta = figureMode === 'REMAT' || figureMode === 'NETA';
  return nodes.filter((n) => {
    if (n.zone === 'PINYA' && isRematOrNeta) return false;
    if (n.zone !== 'PINYA') return true;
    if (numberOfCordons === null) return true;
    return !n.renglaId || n.renglaPosition === null || n.renglaPosition <= numberOfCordons;
  });
}
