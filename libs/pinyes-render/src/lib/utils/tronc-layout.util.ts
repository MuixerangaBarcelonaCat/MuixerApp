/**
 * Geometry of a tronc panel, shared by every view that draws one floor per row (the tronc panel
 * itself and the template editor's «who stands on whom» diagram), so both line nodes up the same.
 *
 * The grid is doubled: 0.5u = one CSS column, so fractional `x`/`width` land on whole grid lines.
 */

/** The minimum a node needs to be laid out on the panel. */
export interface TroncLayoutNode {
  id: string;
  label: string;
  positionType: string | null;
  /** TRONC: relative start (0-based units). BASE: ignored — placed by sorted index. */
  x: number;
  z: number;
  /** TRONC: relative span (1u = one person). BASE: always one unit. */
  width: number;
  sortOrder: number;
}

export interface TroncLayoutFloor<T extends TroncLayoutNode> {
  z: number;
  /** «P1» for the bases, «P2» for z=1, … */
  pisLabel: string;
  /** «Bases», or the most common label on the floor. */
  positionTypeLabel: string;
  nodes: T[];
  isBase: boolean;
}

export function sortTroncBases<T extends TroncLayoutNode>(bases: readonly T[]): T[] {
  return [...bases].sort((a, b) => a.sortOrder - b.sortOrder);
}

export interface TroncLayoutOptions {
  /**
   * Editor only: add an empty floor for every `z` left without nodes below the top floor, so a
   * floor whose nodes were all deleted can be refilled without removing the floors above it.
   */
  fillGaps?: boolean;
}

/** One floor per `z`, top floor first, with the bases (if any) as the last floor at z=0. */
export function layoutTroncFloors<T extends TroncLayoutNode>(
  troncNodes: readonly T[],
  baseNodes: readonly T[],
  { fillGaps = false }: TroncLayoutOptions = {},
): TroncLayoutFloor<T>[] {
  const byZ = new Map<number, T[]>();
  for (const node of troncNodes) {
    const floor = byZ.get(node.z);
    if (floor) floor.push(node);
    else byZ.set(node.z, [node]);
  }

  const floors: TroncLayoutFloor<T>[] = Array.from(byZ.entries()).map(([z, nodes]) => ({
    z,
    pisLabel: `P${z + 1}`,
    positionTypeLabel: dominantLabel(nodes),
    nodes: nodes.sort((a, b) => a.sortOrder - b.sortOrder || a.x - b.x),
    isBase: false,
  }));

  if (fillGaps) {
    const topZ = Math.max(0, ...byZ.keys());
    for (let z = 1; z < topZ; z++) {
      if (!byZ.has(z)) {
        floors.push({ z, pisLabel: `P${z + 1}`, positionTypeLabel: 'Pis buit', nodes: [], isBase: false });
      }
    }
  }

  const bases = sortTroncBases(baseNodes);
  if (bases.length > 0) {
    floors.push({ z: 0, pisLabel: 'P1', positionTypeLabel: 'Bases', nodes: bases, isBase: true });
  }

  return floors.sort((a, b) => b.z - a.z);
}

/** Half-unit columns the panel needs: the widest tronc span, or two per base, at least 2. */
export function troncTotalColumns(troncNodes: readonly TroncLayoutNode[], baseCount: number): number {
  const troncMax = troncNodes.reduce((max, n) => Math.max(max, Math.round((n.x + n.width) * 2)), 0);
  return Math.max(troncMax, baseCount * 2, 2);
}

/** CSS `grid-column` of a TRONC node on the doubled grid. */
export function troncNodeGridColumn(node: Pick<TroncLayoutNode, 'x' | 'width'>): string {
  return `${Math.round(node.x * 2) + 1} / span ${Math.round(node.width * 2)}`;
}

/** CSS `grid-column` of a BASE node by its sorted index — each base is two half-columns. */
export function baseNodeGridColumn(index: number): string {
  return `${index * 2 + 1} / span 2`;
}

function dominantLabel(nodes: readonly TroncLayoutNode[]): string {
  const counts = new Map<string, number>();
  for (const node of nodes) {
    const label = node.label || node.positionType || 'desconegut';
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  let dominant = 'desconegut';
  let maxCount = 0;
  for (const [label, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      dominant = label;
    }
  }
  return dominant;
}
