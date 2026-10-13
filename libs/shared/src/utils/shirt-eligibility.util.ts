import { SHIRT_REQUIREMENTS } from '../constants/person.constants';

export interface ShirtAttendanceCounts {
  performancesAttended: number;
  rehearsalsAttended: number;
}

export interface ShirtProgress {
  missingPerformances: number;
  missingRehearsals: number;
  /** Esdeveniments que encara li falten, sumant tots dos tipus. 0 ≡ té dret a camisa. */
  missingTotal: number;
  isEligible: boolean;
}

/** Quant li falta a una persona per a tindre dret a camisa. Els excedents d'un tipus no compensen l'altre. */
export function shirtProgress({ performancesAttended, rehearsalsAttended }: ShirtAttendanceCounts): ShirtProgress {
  const missingPerformances = Math.max(0, SHIRT_REQUIREMENTS.performances - performancesAttended);
  const missingRehearsals = Math.max(0, SHIRT_REQUIREMENTS.rehearsals - rehearsalsAttended);
  const missingTotal = missingPerformances + missingRehearsals;
  return { missingPerformances, missingRehearsals, missingTotal, isEligible: missingTotal === 0 };
}

/** Camps que fan servir l'ordre de la pantalla de camises. */
export interface ShirtSortable extends ShirtAttendanceCounts {
  alias: string;
  /** Data (`YYYY-MM-DD`) del darrer esdeveniment comptat amb assistència marcada; `null` si no n'hi ha cap. */
  lastAttendedDate: string | null;
}

/** Més recent primer; qui no ha vingut mai, al final. Les dates `YYYY-MM-DD` s'ordenen com a text. */
function byLastAttendedDesc(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? 1 : -1;
}

/**
 * Ordre de la pantalla de camises: primer qui ja té dret, després de més a menys a prop; a
 * igualtat de faltes, qui ha vingut a més esdeveniments. Els empats es desfan per la darrera
 * assistència (més recent primer) i, finalment, per àlies.
 */
export function compareShirtCandidates(a: ShirtSortable, b: ShirtSortable): number {
  const missingA = shirtProgress(a).missingTotal;
  const missingB = shirtProgress(b).missingTotal;
  const tieBreak = () =>
    byLastAttendedDesc(a.lastAttendedDate, b.lastAttendedDate) || a.alias.localeCompare(b.alias, 'ca');
  if (missingA === 0 && missingB === 0) return tieBreak();
  if (missingA !== missingB) return missingA - missingB;
  const attendedA = a.performancesAttended + a.rehearsalsAttended;
  const attendedB = b.performancesAttended + b.rehearsalsAttended;
  return attendedB - attendedA || tieBreak();
}
