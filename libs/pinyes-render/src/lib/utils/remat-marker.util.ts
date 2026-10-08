import { FigureMode, FigureZone, NodeShape } from '@muixer/shared';
import { InstanceNodeItem } from '../models/assignment.model';
import { getFigureTint } from './figure-palette.util';

/** Radius of the circle that marks where a REMAT figure stands. */
export const REMAT_MARKER_RADIUS = 120;

/** `positionType` that tells the marker apart from a real (user-placed) circular decoration. */
const REMAT_MARKER_POSITION_TYPE = 'remat-marker';

export function isRematMarker(node: { positionType?: string | null }): boolean {
  return node.positionType === REMAT_MARKER_POSITION_TYPE;
}

/**
 * The marker drawn where a REMAT figure stands — it shows no pinya and no base, so otherwise
 * nothing on the canvas says where it is. It looks like a circular decoration node in the
 * figure's light tint (`getFigureTint`, like the projection's tronc panel background), with no
 * text, but it is never stored: every view (segment workspace, Distribució,
 * composition editor, projection) puts it first among the figure's drawn nodes — so its
 * decorations are drawn on top of it — and it disappears as soon as the mode changes. The
 * canvas never lets it be clicked, dragged or dropped on (`SegmentRenderNode.isInteractive`).
 *
 * It sits at the center of the figure's hidden PINYA+BASE nodes (ad-hoc ones excluded), the
 * point the figure was pivoted on before switching to REMAT, so the figure doesn't move on the
 * switch and its decoration nodes keep their place around it. `pivotNodesFor` counts it as the
 * figure's pivot. Null for every other mode.
 */
export function rematMarkerNode(figure: {
  instanceId: string;
  figureMode: string;
  sortOrder: number;
  nodes: readonly { zone: string; x: number; y: number; width: number; height: number; isAdHoc?: boolean }[];
}): InstanceNodeItem | null {
  const { instanceId, figureMode, sortOrder, nodes } = figure;
  if (figureMode !== FigureMode.REMAT) return null;

  const pinyaBase = nodes.filter((n) => (n.zone === FigureZone.PINYA || n.zone === FigureZone.BASE) && !n.isAdHoc);
  let x = 0;
  let y = 0;
  if (pinyaBase.length > 0) {
    const minX = Math.min(...pinyaBase.map((n) => n.x - n.width / 2));
    const maxX = Math.max(...pinyaBase.map((n) => n.x + n.width / 2));
    const minY = Math.min(...pinyaBase.map((n) => n.y - n.height / 2));
    const maxY = Math.max(...pinyaBase.map((n) => n.y + n.height / 2));
    x = (minX + maxX) / 2;
    y = (minY + maxY) / 2;
  }

  return {
    id: `remat-marker:${instanceId}`,
    label: '',
    zone: FigureZone.DECORATION,
    positionType: REMAT_MARKER_POSITION_TYPE,
    x,
    y,
    z: 0,
    width: REMAT_MARKER_RADIUS * 2,
    height: REMAT_MARKER_RADIUS * 2,
    rotation: 0,
    color: getFigureTint(sortOrder),
    shape: NodeShape.CIRCLE,
    sortOrder: 0,
    climbIndicator: null,
    ringLevel: null,
    originNodeId: null,
    renglaId: null,
    renglaPosition: null,
    sourceNodeId: null,
    isSnapshotted: false,
    isAdHoc: false,
    createdById: null,
  };
}
