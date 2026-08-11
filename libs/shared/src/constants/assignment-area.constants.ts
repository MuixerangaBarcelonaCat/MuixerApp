import { FigureZone } from '../enums/figure-zone.enum';
import { AssignmentArea } from '../enums/assignment-area.enum';
import { SegmentConflictKind } from '../enums/segment-conflict.enum';

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
    case FigureZone.FIGURE_DIRECTION:
    case FigureZone.XICALLA_DIRECTION:
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
