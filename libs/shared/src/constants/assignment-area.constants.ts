import { FigureZone } from '../enums/figure-zone.enum';
import { AssignmentArea } from '../enums/assignment-area.enum';

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
