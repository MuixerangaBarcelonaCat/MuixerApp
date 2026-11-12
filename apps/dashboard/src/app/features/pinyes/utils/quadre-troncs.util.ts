import type { HeightMode } from '@muixer/pinyes-render';
import { DIRECCIO_PINYA_POSITION_TYPE } from '@muixer/shared';
import type { ParticipationPerson } from '../../events/models/participation.model';

/**
 * The «quadre de persones» of the Troncs workspace: the event's people grouped by tag
 * columns, sorted by height, coloured by rehearsal + next-performance attendance.
 * Pure: all grouping, ordering and counting lives here; the modal only renders it.
 */

export type QuadreRowState =
  | 'both' // coming + coming to the performance
  | 'notPerformance' // coming + not coming to the performance
  | 'unanswered' // coming + no answer for the performance
  | 'neutral' // coming, and there is no next performance to speak of
  | 'performanceOnly' // not coming, but coming to the performance
  | 'assignedAbsent'; // not coming, yet holds a placement

/** A column: one tag. */
export interface QuadreColumnDef {
  id: string;
  name: string;
}

export interface QuadreEntry {
  person: ParticipationPerson;
  state: QuadreRowState;
  figureCount: number;
}

export interface QuadreColumn {
  /** `null` for the fixed last «Altres» column. */
  id: string | null;
  name: string;
  entries: QuadreEntry[];
  /** People coming to the rehearsal in this column. */
  comingCount: number;
  /** Shown apart as «+N actuació». */
  performanceOnlyCount: number;
}

export interface Quadre {
  columns: QuadreColumn[];
  /** Distinct people coming to the rehearsal: a person in several columns counts once. */
  uniqueComing: number;
}

const OTHERS_LABEL = 'Altres';

const isComing = (p: ParticipationPerson) => p.attendanceStatus === 'ANIRE' || p.attendanceStatus === 'ASSISTIT';

const allPlacements = (p: ParticipationPerson) => Object.values(p.placements).flat();

const isCountedComing = (state: QuadreRowState) => state !== 'performanceOnly' && state !== 'assignedAbsent';

/** Distinct figures the person is placed in across the whole event; direcció de pinya doesn't count. */
export function figureCount(person: ParticipationPerson): number {
  const instances = new Set(
    allPlacements(person)
      .filter((pl) => pl.positionType !== DIRECCIO_PINYA_POSITION_TYPE)
      .map((pl) => pl.instanceId),
  );
  return instances.size;
}

export function participationDots(count: number): string {
  return count >= 4 ? '●●●+' : '●'.repeat(Math.max(0, count));
}

/** Same rule as the person panel: '-' for no height; relative to the colla baseline or absolute. */
export function formatShoulderHeight(h: number | null, mode: HeightMode, baselineCm: number): string {
  if (h === null || h === 0) return '-';
  if (mode === 'relative') {
    const diff = h - baselineCm;
    return diff >= 0 ? `+${diff}` : `${diff}`;
  }
  return `${h} cm`;
}

/** `null` = the person is not shown. */
export function rowState(person: ParticipationPerson): QuadreRowState | null {
  if (!person.isActive) return null;
  const next = person.nextPerformanceStatus;
  if (!isComing(person)) {
    if (allPlacements(person).length > 0) return 'assignedAbsent';
    return next === 'ANIRE' ? 'performanceOnly' : null;
  }
  if (next === null) return 'neutral';
  if (next === 'ANIRE') return 'both';
  if (next === 'NO_VAIG') return 'notPerformance';
  return 'unanswered';
}

function compareEntries(a: QuadreEntry, b: QuadreEntry): number {
  const late = Number(a.state === 'performanceOnly') - Number(b.state === 'performanceOnly');
  if (late !== 0) return late;
  const ha = a.person.shoulderHeight || null; // 0 counts as missing, like the person panel
  const hb = b.person.shoulderHeight || null;
  if (ha !== hb) {
    if (ha === null) return 1;
    if (hb === null) return -1;
    return hb - ha;
  }
  return a.person.alias.localeCompare(b.person.alias, 'ca');
}

function toColumn(id: string | null, name: string, entries: QuadreEntry[]): QuadreColumn {
  return {
    id,
    name,
    entries: [...entries].sort(compareEntries),
    comingCount: entries.filter((e) => isCountedComing(e.state)).length,
    performanceOnlyCount: entries.filter((e) => e.state === 'performanceOnly').length,
  };
}

export function buildQuadre(persons: ParticipationPerson[], columns: QuadreColumnDef[]): Quadre {
  const entries: QuadreEntry[] = [];
  for (const person of persons) {
    const state = rowState(person);
    if (state) entries.push({ person, state, figureCount: figureCount(person) });
  }

  const columnIds = new Set(columns.map((c) => c.id));
  const hasTag = (e: QuadreEntry, tagId: string) => e.person.positions.some((t) => t.id === tagId);

  return {
    columns: [
      ...columns.map((c) => toColumn(c.id, c.name, entries.filter((e) => hasTag(e, c.id)))),
      toColumn(
        null,
        OTHERS_LABEL,
        entries.filter((e) => !e.person.positions.some((t) => columnIds.has(t.id))),
      ),
    ],
    uniqueComing: entries.filter((e) => isCountedComing(e.state)).length,
  };
}
