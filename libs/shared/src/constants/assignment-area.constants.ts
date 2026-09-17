import { FigureZone } from '../enums/figure-zone.enum';
import { AssignmentArea } from '../enums/assignment-area.enum';
import { SegmentConflictKind } from '../enums/segment-conflict.enum';
import { FigureMode } from '../enums/figure-mode.enum';
import { DIRECCIO_PINYA_POSITION_TYPE } from './node-preset.constants';

/**
 * Single source of truth for "which physical area does this zone belong to" for
 * conflict classification and per-area dotació (D10).
 *
 * BASE → TRONC on purpose: a person in a BASE node is standing on the ground
 * structure, so for conflicts and dotació it counts as tronc. This is
 * deliberately inconsistent with the completeness/occupancy counters, which group
 * `zone IN ('PINYA', 'BASE')` because the BASE is drawn on the pinya canvas
 * (§5.3). Do NOT unify the two readings — a test pins both on purpose.
 *
 * Returns `null` for zones that are not assignable to an area (DECORATION).
 */
export function areaForZone(zone: FigureZone): AssignmentArea | null {
  switch (zone) {
    case FigureZone.TRONC:
    case FigureZone.BASE:
      return AssignmentArea.TRONC;
    case FigureZone.PINYA:
      return AssignmentArea.PINYA;
    case FigureZone.DIRECTION:
      return AssignmentArea.DIRECTION;
    case FigureZone.DECORATION:
      return null;
  }
}

/**
 * Single source of truth for the conflict-kind precedence rule (§4.1), given the
 * areas of a person's >1 placements within ONE segment.
 *
 * Precedence for the mixed case: if there are >=2 TRONC/BASE placements the whole
 * conflict is TRONC_TRONC, even when a pinya is also involved — it is the most
 * expensive case and must not hide behind a TRONC_PINYA. Exactly one tronc →
 * TRONC_PINYA; none → PINYA_PINYA.
 *
 * Both callers — `classifySegmentConflicts` (the canonical engine, D13) and the
 * participation overview — go through here so the `kind` can never diverge.
 */
export function classifyPlacementKind(areas: AssignmentArea[]): SegmentConflictKind {
  const troncCount = areas.filter((a) => a === AssignmentArea.TRONC).length;
  if (troncCount >= 2) return SegmentConflictKind.TRONC_TRONC;
  if (troncCount === 1) return SegmentConflictKind.TRONC_PINYA;
  return SegmentConflictKind.PINYA_PINYA;
}

/**
 * Narrows a person's set of placements *within one segment* to those that actually count
 * toward a conflict (>1 placement = the person would be in two places at once).
 *
 * The one exemption (D-«direcció pinya»): a `direccio-pinya` placement is excused when the
 * same person also holds a PINYA placement in the *same figure instance* — a pinya director
 * standing in their own figure's pinya is not "in two places". Every other pairing still
 * counts: `direccio-pinya` + tronc / base / another direcció of the same figure, or
 * `direccio-pinya` + pinya of a *different* figure in the segment.
 *
 * Returns the same objects, same order, minus the excused ones. Callers then apply the
 * normal ">= 2 placements → conflict" + {@link classifyPlacementKind} rules to the result.
 * Both conflict engines (`classifySegmentConflicts` and the participation overview) go
 * through here so they can never diverge (D13).
 */
export function conflictRelevantPlacements<T>(
  placements: readonly T[],
  // `area` is `string` (not `AssignmentArea`) so the dashboard's own string-union placement
  // type is accepted without a cast — only `=== AssignmentArea.PINYA` is ever checked.
  select: (p: T) => { positionType: string | null; area: string; instanceId: string },
): T[] {
  const pinyaInstanceIds = new Set<string>();
  for (const p of placements) {
    const s = select(p);
    if (s.area === AssignmentArea.PINYA) pinyaInstanceIds.add(s.instanceId);
  }

  return placements.filter((p) => {
    const s = select(p);
    const isExcusedDireccioPinya =
      s.positionType === DIRECCIO_PINYA_POSITION_TYPE && pinyaInstanceIds.has(s.instanceId);
    return !isExcusedDireccioPinya;
  });
}

/**
 * Single source of truth for "is this node visible given the instance's figureMode/cordons
 * setup" (R9). TRONC/direction nodes are always visible. BASE is hidden in REMAT (its
 * assignments are wiped on switching to REMAT — see `hiddenZonesForFigureModeChange`) and
 * visible otherwise. A PINYA node is hidden entirely in REMAT/NETA mode; a `cordo-obert` node's
 * visibility follows `cordonsObertsEnabled` instead of `renglaPosition`; everything else with no
 * rengla or within `numberOfCordons` is visible.
 *
 * Backend (`computeInstanceAreaSummary`, `computeFreedPinyaNodeIds`) and dashboard
 * (`SegmentWorkspaceStateService.refreshInstance`) both go through here so a node's visibility
 * can never diverge between the completeness counters and the "review" banners.
 */
export function isNodeVisibleByModeAndCordons(
  node: {
    zone: FigureZone | string;
    positionType?: string | null;
    renglaPosition?: number | null;
  },
  opts: {
    figureMode: FigureMode | string;
    numberOfCordons: number | null;
    cordonsObertsEnabled: boolean;
  },
): boolean {
  if (node.zone === FigureZone.BASE) return opts.figureMode !== FigureMode.REMAT;
  if (node.zone !== FigureZone.PINYA) return true;
  if (opts.figureMode === FigureMode.REMAT || opts.figureMode === FigureMode.NETA) return false;
  if (node.positionType === 'cordo-obert') return opts.cordonsObertsEnabled;
  if (opts.numberOfCordons === null) return true;
  return node.renglaPosition === null || node.renglaPosition === undefined
    ? true
    : node.renglaPosition <= opts.numberOfCordons;
}
