import { FigureZone } from '../enums/figure-zone.enum';
import { sanitizeStandsOn, TroncSupportNode } from './tronc-support.util';

export interface HeightGapThreshold {
  warning: number;
  error: number;
}

export interface TroncHeightThresholds {
  /** Spread of cumulative heights across one floor. */
  floor: HeightGapThreshold;
  /** Spread of cumulative heights among the nodes one TRONC node stands on. */
  support: HeightGapThreshold;
}

/** Hard-coded until the colla has its own settings (DEBT.md F20). */
export const TRONC_HEIGHT_THRESHOLDS: TroncHeightThresholds = {
  floor: { warning: 5, error: 10 },
  support: { warning: 3, error: 5 },
};

export type HeightGapLevel = 'ok' | 'warning' | 'error';

/** Why a cumulative height can't be known, most actionable first. */
export type UnknownHeightReason = 'missing-height' | 'unlinked' | 'unassigned';

const REASON_PRIORITY: readonly UnknownHeightReason[] = ['missing-height', 'unlinked', 'unassigned'];

export type CumulativeHeight = { known: true; cm: number } | { known: false; reason: UnknownHeightReason };

export type FloorHeightGap =
  | { status: 'ok'; gapCm: number; level: HeightGapLevel; lowestNodeId: string; highestNodeId: string }
  /** An assigned person on the floor (or below it) has no registered height. */
  | { status: 'missing-height' }
  /** Fewer than 2 known heights on the floor. */
  | { status: 'insufficient'; reason: 'unlinked' | 'unassigned' };

export interface TroncHeightAnalysis {
  /** Exact (unrounded) cm per BASE/TRONC node. */
  cumulativeByNodeId: Map<string, CumulativeHeight>;
  /** Keyed by `z`, one entry per floor that has nodes. */
  floors: Map<number, FloorHeightGap>;
  /**
   * Keyed by the upper TRONC node id: only nodes standing on ≥ 2 nodes whose heights are all known.
   * The upper node itself may be empty — the check helps before its person is chosen.
   */
  supports: Map<string, SupportHeightGap>;
}

export interface SupportHeightGap {
  gapCm: number;
  level: HeightGapLevel;
  supporterIds: string[];
}

/** Levels compare the rounded gap — the number shown — so a displayed «5 cm» is never left unflagged. */
export function heightGapLevel(gapCm: number, threshold: HeightGapThreshold): HeightGapLevel {
  const rounded = Math.round(gapCm);
  if (rounded >= threshold.error) return 'error';
  if (rounded >= threshold.warning) return 'warning';
  return 'ok';
}

/**
 * Cumulative shoulder height of every BASE/TRONC node — a base's own height, a tronc node's own
 * height plus the mean of the nodes it stands on — with unknowns propagated upward, never guessed.
 *
 * `shoulderHeightByNodeId` holds the assigned nodes only: an absent key is an empty node, a
 * null/0 value an assigned person with no registered height.
 *
 * Links only ever point at floor `z - 1`, so visiting the nodes by ascending `z` is already a valid
 * evaluation order: one pass, O(N + E) after the sort.
 */
export function analyzeTroncHeights(
  nodes: readonly TroncSupportNode[],
  shoulderHeightByNodeId: ReadonlyMap<string, number | null>,
  thresholds: TroncHeightThresholds = TRONC_HEIGHT_THRESHOLDS,
): TroncHeightAnalysis {
  const structural = sanitizeStandsOn(
    nodes.filter((n) => n.zone === FigureZone.BASE || n.zone === FigureZone.TRONC),
  ).sort((a, b) => a.z - b.z);

  const cumulativeByNodeId = new Map<string, CumulativeHeight>();
  // Sanitised links point at floor z - 1, which the ascending-z loop has always visited first.
  const lookup = (id: string) => cumulativeByNodeId.get(id) as CumulativeHeight;

  const nodesByFloor = new Map<number, string[]>();
  for (const node of structural) {
    const own = ownHeight(node.id, shoulderHeightByNodeId);
    const below = node.zone === FigureZone.BASE ? null : node.standsOnNodeIds.map(lookup);
    cumulativeByNodeId.set(node.id, combine(own, below));
    nodesByFloor.set(node.z, [...(nodesByFloor.get(node.z) ?? []), node.id]);
  }

  const floors = new Map<number, FloorHeightGap>();
  for (const [z, ids] of nodesByFloor) {
    const heights = ids.map((id) => ({ id, height: lookup(id), assigned: shoulderHeightByNodeId.has(id) }));
    floors.set(z, floorGap(heights, thresholds.floor));
  }

  const supports = new Map<string, SupportHeightGap>();
  for (const node of structural) {
    const gap = supportGap(node.standsOnNodeIds, node.standsOnNodeIds.map(lookup), thresholds.support);
    if (gap) supports.set(node.id, gap);
  }

  return { cumulativeByNodeId, floors, supports };
}

/**
 * A missing height anywhere under an assigned person makes the whole floor unknowable: a spread
 * over the remaining people could look fine and be wrong. Empty nodes are skipped instead, so a
 * floor can be checked while it is still being filled.
 */
function floorGap(
  heights: { id: string; height: CumulativeHeight; assigned: boolean }[],
  threshold: HeightGapThreshold,
): FloorHeightGap {
  if (heights.some(({ height, assigned }) => assigned && !height.known && height.reason === 'missing-height')) {
    return { status: 'missing-height' };
  }

  const known = heights.flatMap(({ id, height }) => (height.known ? [{ id, cm: height.cm }] : []));
  if (known.length < 2) {
    const unlinked = heights.some(({ height }) => !height.known && height.reason === 'unlinked');
    return { status: 'insufficient', reason: unlinked ? 'unlinked' : 'unassigned' };
  }

  const lowest = known.reduce((a, b) => (b.cm < a.cm ? b : a));
  const highest = known.reduce((a, b) => (b.cm > a.cm ? b : a));
  const gapCm = highest.cm - lowest.cm;
  return {
    status: 'ok',
    gapCm,
    level: heightGapLevel(gapCm, threshold),
    lowestNodeId: lowest.id,
    highestNodeId: highest.id,
  };
}

/** Only for a node standing on ≥ 2 nodes, all with a known height. */
function supportGap(
  supporterIds: string[],
  below: CumulativeHeight[],
  threshold: HeightGapThreshold,
): SupportHeightGap | null {
  if (below.length < 2 || !below.every(isKnown)) return null;
  const cms = below.map((h) => h.cm);
  const gapCm = Math.max(...cms) - Math.min(...cms);
  return { gapCm, level: heightGapLevel(gapCm, threshold), supporterIds };
}

function ownHeight(nodeId: string, heights: ReadonlyMap<string, number | null>): CumulativeHeight {
  if (!heights.has(nodeId)) return { known: false, reason: 'unassigned' };
  const cm = heights.get(nodeId);
  return cm ? { known: true, cm } : { known: false, reason: 'missing-height' };
}

type KnownHeight = Extract<CumulativeHeight, { known: true }>;

const isKnown = (h: CumulativeHeight): h is KnownHeight => h.known;

/** `below` is null for a base, which stands on the ground; an empty array is a tronc node with no links. */
function combine(own: CumulativeHeight, below: CumulativeHeight[] | null): CumulativeHeight {
  if (below === null) return own;
  if (below.length === 0) return mostActionable([own, { known: false, reason: 'unlinked' }]);
  if (!isKnown(own) || !below.every(isKnown)) return mostActionable([own, ...below]);
  return { known: true, cm: own.cm + mean(below.map((h) => h.cm)) };
}

/** The most actionable reason among the unknown heights given. */
function mostActionable(heights: CumulativeHeight[]): CumulativeHeight {
  const reasons = new Set(heights.flatMap((h) => (h.known ? [] : [h.reason])));
  return { known: false, reason: REASON_PRIORITY.find((r) => reasons.has(r)) ?? 'unassigned' };
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}
