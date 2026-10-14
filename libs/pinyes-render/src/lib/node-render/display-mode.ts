import { AttendanceStatus, AttendanceStatusValue, EventPhase, Gender, PINYA_NODE_PRESETS, attendanceStatusLabel, isStartedPhase } from '@muixer/shared';
import {
  ATTENDANCE_TONES,
  ATTENDANCE_TONES_DARK,
  AttendanceTone,
  GENDER_TONES,
  GENDER_TONES_DARK,
  GenderGroup,
  NODE_TYPE_NEUTRAL,
  NODE_TYPE_NEUTRAL_DARK,
  NODE_TYPE_PALETTE,
  NODE_TYPE_PALETTE_DARK,
  NodeTones,
  ThemeMode,
  heightRampTones,
} from '@muixer/ui';
import { ATTENDANCE_STATUS_ORDER, AttendanceFill, joinAttendanceLabels } from './attendance';

/**
 * The segment workspace's display modes: what a node's color stands for. `position` is the type
 * palette (today's look); the others recolor the nodes of assigned people by one criterion and draw
 * empty nodes neutral, so a type color never reads as a mode color.
 */
export type DisplayMode = 'position' | 'height' | 'attendance' | 'gender';

/** `attendance` keeps the fill showing attendance (solid, hatched, empty); `solid` always fills. */
export type NodeFillPolicy = 'attendance' | 'solid';

/** The known heights of the people a tab draws, shortest first: Alçada colors by rank among them. */
export interface HeightDomain {
  heights: number[];
}

/** What the modes know about the person on a node. */
export interface DisplayFacts {
  shoulderHeight: number | null;
  gender: Gender | `${Gender}` | null;
  /** No status is PENDENT (no attendance row). */
  attendance: AttendanceStatusValue | null;
  nextActuacio: boolean;
}

export interface DisplayContext {
  mode: DisplayMode;
  phase: EventPhase;
  /** The tab's assigned people's known heights; null when no one has a known height. */
  heightDomain: HeightDomain | null;
  themeMode: ThemeMode;
}

export type DisplayCategory =
  | { kind: 'height'; t: number }
  | { kind: 'unknown-height' }
  | { kind: 'gender'; group: GenderGroup }
  | { kind: 'attendance'; tone: AttendanceTone; strong: boolean };

/** A known shoulder height: null and 0 both mean unset. */
const knownHeight = (cm: number | null): cm is number => cm != null && cm !== 0;

/** The heights the ramp ranks people among: the known ones, shortest first. */
export function heightDomain(heights: (number | null)[]): HeightDomain | null {
  const known = heights.filter(knownHeight).sort((a, b) => a - b);
  return known.length === 0 ? null : { heights: known };
}

/**
 * Where a height sits on the ramp: its rank among the tab's heights, 0 (shortest) to 1 (tallest).
 * Ranks, not cm, because most people crowd the middle heights: spread by cm, they would all share a
 * few close colors. People of the same height share the middle of their ranks; a height the tab
 * lacks sits between its neighbours, and one beyond the tab at its end. A single height is the middle.
 */
function heightRank(cm: number, { heights }: HeightDomain): number {
  if (heights.length === 1) return 0.5;
  const below = heights.filter((h) => h < cm).length;
  const equal = heights.filter((h) => h === cm).length;
  const rank = equal > 0 ? below + (equal - 1) / 2 : below - 0.5;
  return Math.min(1, Math.max(0, rank / (heights.length - 1)));
}

/** The cm at each quarter of the ranks (shortest, ¼, median, ¾, tallest), as the key's bar marks them; one mark for a single height. */
function heightQuarters({ heights }: HeightDomain): number[] {
  if (heights[0] === heights[heights.length - 1]) return [heights[0]];
  return [0, 0.25, 0.5, 0.75, 1].map((q) => {
    const i = q * (heights.length - 1);
    const lo = Math.floor(i);
    return Math.round(heights[lo] + (heights[Math.ceil(i)] - heights[lo]) * (i - lo));
  });
}

/**
 * The app's semantic reading of an attendance status, as the attendance list and the node panel
 * badge it: until the start, coming is success; from the start, coming but not here is a warning.
 */
export function attendanceTone(status: AttendanceStatusValue | null, phase: EventPhase): AttendanceTone {
  switch (status) {
    case AttendanceStatus.ASSISTIT:
      return 'success';
    case AttendanceStatus.ANIRE:
      return isStartedPhase(phase) ? 'warning' : 'success';
    case AttendanceStatus.NO_VAIG:
      return 'error';
    default:
      return 'warning';
  }
}

function genderGroup(gender: DisplayFacts['gender']): GenderGroup {
  if (gender === Gender.FEMALE) return 'female';
  if (gender === Gender.MALE) return 'male';
  return 'other';
}

/** Where a person falls in the mode; null in Posició. */
export function displayCategory(facts: DisplayFacts, ctx: DisplayContext): DisplayCategory | null {
  switch (ctx.mode) {
    case 'position':
      return null;
    case 'height': {
      const domain = ctx.heightDomain;
      if (!knownHeight(facts.shoulderHeight) || !domain) return { kind: 'unknown-height' };
      return { kind: 'height', t: heightRank(facts.shoulderHeight, domain) };
    }
    case 'gender':
      return { kind: 'gender', group: genderGroup(facts.gender) };
    case 'attendance':
      return { kind: 'attendance', tone: attendanceTone(facts.attendance, ctx.phase), strong: facts.nextActuacio };
  }
}

function tonesOf(category: DisplayCategory, themeMode: ThemeMode): NodeTones {
  const dark = themeMode === 'dark';
  switch (category.kind) {
    case 'height':
      return heightRampTones(category.t, themeMode);
    case 'unknown-height':
      return dark ? NODE_TYPE_NEUTRAL_DARK : NODE_TYPE_NEUTRAL;
    case 'gender':
      return (dark ? GENDER_TONES_DARK : GENDER_TONES)[category.group];
    case 'attendance': {
      const shades = (dark ? ATTENDANCE_TONES_DARK : ATTENDANCE_TONES)[category.tone];
      return category.strong ? shades.strong : shades.base;
    }
  }
}

/** The tones a person's node takes in the mode; null in Posició (the type palette applies). */
export function displayTones(facts: DisplayFacts, ctx: DisplayContext): NodeTones | null {
  const category = displayCategory(facts, ctx);
  return category ? tonesOf(category, ctx.themeMode) : null;
}

/** The roster maps the canvas and the tronc panel already take, keyed by person id. */
export interface DisplayFactSources {
  attendance: ReadonlyMap<string, string>;
  nextPerformance: ReadonlyMap<string, string | null>;
  details: ReadonlyMap<string, { gender?: Gender | `${Gender}` | null }>;
}

/**
 * What the modes know about an assigned person: the height comes with the assignment, the rest
 * from the roster. Someone missing from the roster is unknown everywhere.
 */
export function personDisplayFacts(person: { id: string; shoulderHeight: number | null }, sources: DisplayFactSources): DisplayFacts {
  return {
    shoulderHeight: person.shoulderHeight,
    gender: sources.details.get(person.id)?.gender ?? null,
    attendance: (sources.attendance.get(person.id) as AttendanceStatusValue | undefined) ?? null,
    nextActuacio: sources.nextPerformance.get(person.id) === AttendanceStatus.ANIRE,
  };
}

/** What a mode changes in a node's appearance input; empty in Posició. */
export interface DisplayOverrides {
  tones?: NodeTones;
  palette?: 'neutral';
  fillPolicy?: NodeFillPolicy;
  /** Overrides the attendance fill: in Assistència only «No vindrà» is struck. */
  attendance?: AttendanceFill;
}

/**
 * The one place the canvas and the tronc panel turn a mode into appearance input, so the two can't
 * drift. `facts` is null for an empty node. Modes only recolor: the height, the observation and
 * the next-actuació star stay in every mode (in Assistència the star sits on the darker shade
 * that says the same, so the shade's meaning is obvious).
 */
export function displayModeOverrides(facts: DisplayFacts | null, ctx: DisplayContext): DisplayOverrides {
  if (ctx.mode === 'position') return {};
  if (!facts) return { palette: 'neutral' };
  const tones = displayTones(facts, ctx) as NodeTones;
  if (ctx.mode !== 'attendance') return { tones };
  return {
    tones,
    fillPolicy: 'solid',
    attendance: facts.attendance === AttendanceStatus.NO_VAIG ? 'absent' : 'confirmed',
  };
}

/** One sample in a key row: its tones, and the next-actuació star when the canvas draws one on it. */
export interface KeySwatch {
  tones: NodeTones;
  star: boolean;
}

export interface DisplayKeyRow {
  id: string;
  label: string;
  swatches: KeySwatch[];
  /** How many of the tab's nodes fall in the row; null where counting means nothing (Posició). */
  count: number | null;
}

export interface DisplayKey {
  /** Alçada: the cm the gradient bar marks at each quarter of the ranks. */
  gradient: { quarters: number[] } | null;
  rows: DisplayKeyRow[];
  /** A line under the rows, in smaller type: who comes to the next actuació (Assistència), with the star where the squares go. */
  note: { label: string; count: number } | null;
}

const GENDER_ORDER: GenderGroup[] = ['female', 'male', 'other'];
const GENDER_LABEL: Record<GenderGroup, string> = { female: 'Dona', male: 'Home', other: 'Altre o sense dades' };
const TONE_ORDER: AttendanceTone[] = ['success', 'warning', 'error'];

/**
 * The key of a mode for the people drawn in a tab (one entry per node): only the rows that appear,
 * each with its count. Posició has no rows here: its key comes from the nodes' types.
 */
export function displayModeKey(people: DisplayFacts[], ctx: DisplayContext): DisplayKey {
  const dark = ctx.themeMode === 'dark';
  const row = (id: string, label: string, swatches: KeySwatch[], count: number): DisplayKeyRow => ({ id, label, swatches, count });
  const plain = (tones: NodeTones): KeySwatch => ({ tones, star: false });
  // The darker shade means «comes to the next actuació», and the canvas draws the star on it too.
  const starred = (tones: NodeTones): KeySwatch => ({ tones, star: true });
  switch (ctx.mode) {
    case 'position':
      return { gradient: null, rows: [], note: null };
    case 'height': {
      const unknown = people.filter((p) => displayCategory(p, ctx)?.kind === 'unknown-height').length;
      const rows = unknown > 0 ? [row('unknown-height', 'Sense alçada', [plain(dark ? NODE_TYPE_NEUTRAL_DARK : NODE_TYPE_NEUTRAL)], unknown)] : [];
      return { gradient: ctx.heightDomain ? { quarters: heightQuarters(ctx.heightDomain) } : null, rows, note: null };
    }
    case 'gender': {
      const tones = dark ? GENDER_TONES_DARK : GENDER_TONES;
      const rows = GENDER_ORDER.map((group) => row(group, GENDER_LABEL[group], [plain(tones[group])], people.filter((p) => genderGroup(p.gender) === group).length));
      return { gradient: null, rows: rows.filter((r) => (r.count ?? 0) > 0), note: null };
    }
    case 'attendance': {
      const tones = dark ? ATTENDANCE_TONES_DARK : ATTENDANCE_TONES;
      const status = (p: DisplayFacts) => (p.attendance ?? AttendanceStatus.PENDENT) as AttendanceStatus;
      const rows: DisplayKeyRow[] = [];
      // Once anyone comes to the next actuació, every row shows both shades, so the squares line up
      // in two columns; with no one coming, the darker shade means nothing and isn't shown.
      const coming = people.filter((p) => p.nextActuacio).length;
      for (const tone of TONE_ORDER) {
        const inTone = people.filter((p) => attendanceTone(p.attendance, ctx.phase) === tone);
        if (inTone.length === 0) continue;
        const present = ATTENDANCE_STATUS_ORDER.filter((s) => inTone.some((p) => status(p) === s));
        const swatches = coming > 0 ? [plain(tones[tone].base), starred(tones[tone].strong)] : [plain(tones[tone].base)];
        const label = joinAttendanceLabels(present.map((s) => attendanceStatusLabel(s, ctx.phase)));
        rows.push(row(tone, label, swatches, inTone.length));
      }
      return { gradient: null, rows, note: coming > 0 ? { label: 'Ve a la propera actuació', count: coming } : null };
    }
  }
}

/** Pinya preset labels are the uppercase node captions; the key names the type as people say it. */
function presetKeyLabel(positionType: string, label: string): string {
  if (positionType === 'comodin') return 'Comodí';
  return label.charAt(0) + label.slice(1).toLowerCase();
}

/**
 * Posició's key: the pinya types among the nodes a tab draws, in the presets' order, each in its
 * palette. No counts: a type isn't a group of people. Nodes with no type color (bases, decorations,
 * untyped) are left out, and so is a custom color: it belongs to one node, not to a type.
 */
export function positionKey(positionTypes: (string | null)[], themeMode: ThemeMode): DisplayKey {
  const palette = themeMode === 'dark' ? NODE_TYPE_PALETTE_DARK : NODE_TYPE_PALETTE;
  const present = new Set(positionTypes);
  const rows: DisplayKeyRow[] = [];
  for (const { positionType, label } of PINYA_NODE_PRESETS) {
    if (!positionType || !present.has(positionType) || !palette[positionType]) continue;
    rows.push({ id: positionType, label: presetKeyLabel(positionType, label), swatches: [{ tones: palette[positionType], star: false }], count: null });
  }
  return { gradient: null, rows, note: null };
}
