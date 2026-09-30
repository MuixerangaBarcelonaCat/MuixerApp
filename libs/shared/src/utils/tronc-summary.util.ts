import { FigureMode } from '../enums/figure-mode.enum';

/** One tronc/base floor of a figure: its height and the assigned aliases (null = empty slot). */
export interface TroncSummaryFloor {
  z: number;
  isBase: boolean;
  slots: readonly (string | null)[];
}

/**
 * A figure's tronc as one line per floor, base → top — «Pepet - ? - Maria», «Joan - ?»: slots
 * joined by « - », empty slots as «?». REMAT drops the base; PEU trims the unassigned topmost
 * floors. Null when nothing is left to show.
 */
export function formatTroncFloors(
  floors: readonly TroncSummaryFloor[],
  figureMode: FigureMode | `${FigureMode}`,
): string[] | null {
  let displayFloors = [...floors].sort((a, b) => {
    if (a.isBase !== b.isBase) return a.isBase ? -1 : 1;
    return a.z - b.z;
  });

  if (figureMode === FigureMode.REMAT) {
    displayFloors = displayFloors.filter((f) => !f.isBase);
  }

  if (figureMode === FigureMode.PEU) {
    let lastAssignedIdx = displayFloors.length - 1;
    while (lastAssignedIdx >= 0 && displayFloors[lastAssignedIdx].slots.every((s) => s === null)) {
      lastAssignedIdx--;
    }
    displayFloors = displayFloors.slice(0, lastAssignedIdx + 1);
  }

  if (displayFloors.length === 0) return null;

  return displayFloors.map((f) => f.slots.map((s) => s ?? '?').join(' - '));
}

/**
 * The same floors on one line — «Pepet - ? - Maria // Joan - ?». Shared so the segment list
 * (Troncs mode) and the event PDF summary can never word this differently.
 */
export function formatTroncSummary(
  floors: readonly TroncSummaryFloor[],
  figureMode: FigureMode | `${FigureMode}`,
): string | null {
  return formatTroncFloors(floors, figureMode)?.join(' // ') ?? null;
}
