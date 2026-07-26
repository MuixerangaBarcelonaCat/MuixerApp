import { FigureZone } from '@muixer/shared';
import {
  AssignmentOrderNode,
  buildPinyaBuckets,
  buildTroncBuckets,
  pickNextAssignableNode,
} from './assignment-order.util';

function n(
  id: string,
  zone: string,
  positionType: string | null,
  renglaPosition: number | null,
  opts: { x?: number; y?: number; z?: number; sortOrder?: number } = {},
): AssignmentOrderNode {
  return {
    id,
    zone,
    positionType,
    renglaPosition,
    x: opts.x ?? 0,
    y: opts.y ?? 0,
    z: opts.z ?? 0,
    sortOrder: opts.sortOrder ?? 0,
  };
}

// ── buildPinyaBuckets ────────────────────────────────────────────────────────

describe('buildPinyaBuckets', () => {
  it('returns empty array for empty input', () => {
    expect(buildPinyaBuckets([])).toEqual([]);
  });

  it('excludes DECORATION nodes', () => {
    expect(buildPinyaBuckets([n('d1', FigureZone.DECORATION, null, null)])).toEqual([]);
  });

  it('excludes TRONC and DIRECTION nodes', () => {
    const nodes = [
      n('tr', FigureZone.TRONC, null, null),
      n('fd', FigureZone.FIGURE_DIRECTION, null, null),
      n('xd', FigureZone.XICALLA_DIRECTION, null, null),
    ];
    expect(buildPinyaBuckets(nodes)).toEqual([]);
  });

  it('places BASE nodes in a single bucket sorted by sortOrder', () => {
    const buckets = buildPinyaBuckets([
      n('b2', FigureZone.BASE, null, null, { sortOrder: 1 }),
      n('b1', FigureZone.BASE, null, null, { sortOrder: 0 }),
    ]);
    expect(buckets).toHaveLength(1);
    expect(buckets[0].map((x) => x.id)).toEqual(['b1', 'b2']);
  });

  it('orders BASE → agulla → crossa → contrafort as separate buckets', () => {
    const buckets = buildPinyaBuckets([
      n('cf', FigureZone.PINYA, 'contrafort', null),
      n('cr', FigureZone.PINYA, 'crossa', null),
      n('ag', FigureZone.PINYA, 'agulla', null),
      n('base', FigureZone.BASE, null, null),
    ]);
    expect(buckets).toHaveLength(4);
    expect(buckets[0].map((x) => x.id)).toEqual(['base']);
    expect(buckets[1].map((x) => x.id)).toEqual(['ag']);
    expect(buckets[2].map((x) => x.id)).toEqual(['cr']);
    expect(buckets[3].map((x) => x.id)).toEqual(['cf']);
  });

  it('groups mans/vents/laterals for cordo 1 as separate buckets after contrafort', () => {
    const buckets = buildPinyaBuckets([
      n('l1', FigureZone.PINYA, 'laterals', 1),
      n('v1', FigureZone.PINYA, 'vents', 1),
      n('m1', FigureZone.PINYA, 'mans', 1),
      n('cf', FigureZone.PINYA, 'contrafort', null),
    ]);
    expect(buckets).toHaveLength(4);
    expect(buckets[0].map((x) => x.id)).toEqual(['cf']);
    expect(buckets[1].map((x) => x.id)).toEqual(['m1']);
    expect(buckets[2].map((x) => x.id)).toEqual(['v1']);
    expect(buckets[3].map((x) => x.id)).toEqual(['l1']);
  });

  it('places cordo 1 buckets before cordo 2 buckets', () => {
    const buckets = buildPinyaBuckets([
      n('m2', FigureZone.PINYA, 'mans', 2),
      n('v2', FigureZone.PINYA, 'vents', 2),
      n('m1', FigureZone.PINYA, 'mans', 1),
      n('v1', FigureZone.PINYA, 'vents', 1),
    ]);
    expect(buckets).toHaveLength(4);
    expect(buckets[0].map((x) => x.id)).toEqual(['m1']);
    expect(buckets[1].map((x) => x.id)).toEqual(['v1']);
    expect(buckets[2].map((x) => x.id)).toEqual(['m2']);
    expect(buckets[3].map((x) => x.id)).toEqual(['v2']);
  });

  it('groups "other" PINYA nodes with a cordon after laterals in that cordon', () => {
    const buckets = buildPinyaBuckets([
      n('c1', FigureZone.PINYA, 'custom-type', 1),
      n('m1', FigureZone.PINYA, 'mans', 1),
    ]);
    expect(buckets).toHaveLength(2);
    expect(buckets[0].map((x) => x.id)).toEqual(['m1']);
    expect(buckets[1].map((x) => x.id)).toEqual(['c1']);
  });

  it('places cordo-obert after all cordon buckets and before pinya-rest', () => {
    const buckets = buildPinyaBuckets([
      n('tap', FigureZone.PINYA, 'tap', null),
      n('co', FigureZone.PINYA, 'cordo-obert', null),
      n('m1', FigureZone.PINYA, 'mans', 1),
    ]);
    expect(buckets).toHaveLength(3);
    expect(buckets[0].map((x) => x.id)).toEqual(['m1']);
    expect(buckets[1].map((x) => x.id)).toEqual(['co']);
    expect(buckets[2].map((x) => x.id)).toEqual(['tap']);
  });

  it('places mans/vents/laterals without a cordon after cordo-obert, grouped mans → vents → laterals, followed by the rest', () => {
    const buckets = buildPinyaBuckets([
      n('tap', FigureZone.PINYA, 'tap', null),
      n('l0', FigureZone.PINYA, 'laterals', null),
      n('v0', FigureZone.PINYA, 'vents', null),
      n('m0', FigureZone.PINYA, 'mans', null),
      n('m1', FigureZone.PINYA, 'mans', 1),
      n('co', FigureZone.PINYA, 'cordo-obert', null),
    ]);
    expect(buckets).toHaveLength(6);
    expect(buckets[0].map((x) => x.id)).toEqual(['m1']);
    expect(buckets[1].map((x) => x.id)).toEqual(['co']);
    expect(buckets[2].map((x) => x.id)).toEqual(['m0']);
    expect(buckets[3].map((x) => x.id)).toEqual(['v0']);
    expect(buckets[4].map((x) => x.id)).toEqual(['l0']);
    expect(buckets[5].map((x) => x.id)).toEqual(['tap']);
  });

  it('places PINYA nodes with no renglaPosition and no named type in the rest bucket', () => {
    const buckets = buildPinyaBuckets([
      n('tap', FigureZone.PINYA, 'tap', null),
      n('m1', FigureZone.PINYA, 'mans', 1),
    ]);
    expect(buckets).toHaveLength(2);
    expect(buckets[0].map((x) => x.id)).toEqual(['m1']);
    expect(buckets[1].map((x) => x.id)).toEqual(['tap']);
  });
});

// ── buildTroncBuckets ────────────────────────────────────────────────────────

describe('buildTroncBuckets', () => {
  it('returns empty array for empty input', () => {
    expect(buildTroncBuckets([])).toEqual([]);
  });

  it('excludes PINYA and DECORATION nodes', () => {
    const nodes = [
      n('p1', FigureZone.PINYA, 'mans', 1),
      n('d1', FigureZone.DECORATION, null, null),
    ];
    expect(buildTroncBuckets(nodes)).toEqual([]);
  });

  it('places BASE nodes in a single bucket sorted by sortOrder', () => {
    const buckets = buildTroncBuckets([
      n('b2', FigureZone.BASE, null, null, { sortOrder: 1 }),
      n('b1', FigureZone.BASE, null, null, { sortOrder: 0 }),
    ]);
    expect(buckets).toHaveLength(1);
    expect(buckets[0].map((x) => x.id)).toEqual(['b1', 'b2']);
  });

  it('groups TRONC nodes by z floor (ascending), each floor is one bucket', () => {
    const buckets = buildTroncBuckets([
      n('t2', FigureZone.TRONC, null, null, { z: 2, x: 10 }),
      n('t1', FigureZone.TRONC, null, null, { z: 1, x: 10 }),
    ]);
    expect(buckets).toHaveLength(2);
    expect(buckets[0].map((x) => x.id)).toEqual(['t1']); // z=1 first
    expect(buckets[1].map((x) => x.id)).toEqual(['t2']); // z=2 second
  });

  it('sorts nodes within the same floor left-to-right (ascending x)', () => {
    const buckets = buildTroncBuckets([
      n('tr', FigureZone.TRONC, null, null, { z: 1, x: 20 }),
      n('tl', FigureZone.TRONC, null, null, { z: 1, x: 10 }),
    ]);
    expect(buckets).toHaveLength(1);
    expect(buckets[0].map((x) => x.id)).toEqual(['tl', 'tr']);
  });

  it('all nodes in the same floor are in one bucket', () => {
    const buckets = buildTroncBuckets([
      n('ta', FigureZone.TRONC, null, null, { z: 1, x: 10 }),
      n('tb', FigureZone.TRONC, null, null, { z: 1, x: 20 }),
      n('tc', FigureZone.TRONC, null, null, { z: 1, x: 30 }),
    ]);
    expect(buckets).toHaveLength(1);
    expect(buckets[0]).toHaveLength(3);
    expect(buckets[0].map((x) => x.id)).toEqual(['ta', 'tb', 'tc']);
  });

  it('places BASE before TRONC floors', () => {
    const buckets = buildTroncBuckets([
      n('t1', FigureZone.TRONC, null, null, { z: 1, x: 10 }),
      n('base', FigureZone.BASE, null, null),
    ]);
    expect(buckets).toHaveLength(2);
    expect(buckets[0].map((x) => x.id)).toEqual(['base']);
    expect(buckets[1].map((x) => x.id)).toEqual(['t1']);
  });

  it('places DIRECTION nodes after all TRONC floors', () => {
    const buckets = buildTroncBuckets([
      n('fd', FigureZone.FIGURE_DIRECTION, null, null),
      n('t1', FigureZone.TRONC, null, null, { z: 1, x: 10 }),
    ]);
    expect(buckets).toHaveLength(2);
    expect(buckets[0].map((x) => x.id)).toEqual(['t1']);
    expect(buckets[1].map((x) => x.id)).toEqual(['fd']);
  });

  it('places XICALLA_DIRECTION in the same bucket as FIGURE_DIRECTION', () => {
    const buckets = buildTroncBuckets([
      n('xd', FigureZone.XICALLA_DIRECTION, null, null),
      n('fd', FigureZone.FIGURE_DIRECTION, null, null),
    ]);
    expect(buckets).toHaveLength(1);
    expect(buckets[0]).toHaveLength(2);
  });

  it('produces full tronc order: BASE → floor1 → floor2 → DIRECTION', () => {
    const buckets = buildTroncBuckets([
      n('dir', FigureZone.FIGURE_DIRECTION, null, null),
      n('t2a', FigureZone.TRONC, null, null, { z: 2, x: 10 }),
      n('t1b', FigureZone.TRONC, null, null, { z: 1, x: 20 }),
      n('t1a', FigureZone.TRONC, null, null, { z: 1, x: 10 }),
      n('base', FigureZone.BASE, null, null),
    ]);
    expect(buckets).toHaveLength(4);
    expect(buckets[0].map((x) => x.id)).toEqual(['base']);
    expect(buckets[1].map((x) => x.id)).toEqual(['t1a', 't1b']); // floor z=1, left-to-right
    expect(buckets[2].map((x) => x.id)).toEqual(['t2a']); // floor z=2
    expect(buckets[3].map((x) => x.id)).toEqual(['dir']);
  });
});

// ── pickNextAssignableNode ───────────────────────────────────────────────────

describe('pickNextAssignableNode', () => {
  it('returns null when buckets are empty', () => {
    expect(pickNextAssignableNode([], 'x', new Set(), new Set())).toBeNull();
  });

  it('returns null when justAssignedId is not in any bucket', () => {
    const buckets = [[n('a', FigureZone.BASE, null, null)]];
    expect(pickNextAssignableNode(buckets, 'missing', new Set(), new Set(['a']))).toBeNull();
  });

  it('returns null when all nodes are assigned or hidden', () => {
    const a = n('a', FigureZone.BASE, null, null);
    const b = n('b', FigureZone.PINYA, 'mans', 1);
    const buckets = [[a], [b]];
    expect(
      pickNextAssignableNode(buckets, 'a', new Set(['a', 'b']), new Set(['a', 'b'])),
    ).toBeNull();
  });

  it('never returns the justAssignedId node even if it is not in assignedIds', () => {
    const a = n('a', FigureZone.PINYA, 'mans', 1);
    const b = n('b', FigureZone.PINYA, 'mans', 1);
    const buckets = [[a, b]];
    const result = pickNextAssignableNode(buckets, 'a', new Set(), new Set(['a', 'b']));
    expect(result?.id).toBe('b');
  });

  it('picks the next empty node in the same bucket first', () => {
    const a = n('a', FigureZone.PINYA, 'mans', 1);
    const b = n('b', FigureZone.PINYA, 'mans', 1);
    const c = n('c', FigureZone.PINYA, 'vents', 1);
    const buckets = [[a, b], [c]];
    const result = pickNextAssignableNode(buckets, 'a', new Set(['a']), new Set(['a', 'b', 'c']));
    expect(result?.id).toBe('b');
  });

  it('moves to the next bucket when the current bucket is fully assigned', () => {
    const a = n('a', FigureZone.PINYA, 'mans', 1);
    const b = n('b', FigureZone.PINYA, 'vents', 1);
    const buckets = [[a], [b]];
    const result = pickNextAssignableNode(buckets, 'a', new Set(['a']), new Set(['a', 'b']));
    expect(result?.id).toBe('b');
  });

  it('skips hidden nodes (not in visibleIds)', () => {
    const a = n('a', FigureZone.PINYA, 'mans', 1);
    const b = n('b', FigureZone.PINYA, 'mans', 1); // hidden
    const c = n('c', FigureZone.PINYA, 'mans', 1);
    const buckets = [[a, b, c]];
    const result = pickNextAssignableNode(
      buckets,
      'a',
      new Set(['a']),
      new Set(['a', 'c']), // b not visible
    );
    expect(result?.id).toBe('c');
  });

  it('wraps around from the last bucket to the first', () => {
    const a = n('a', FigureZone.PINYA, 'vents', 1);
    const b = n('b', FigureZone.BASE, null, null);
    const buckets = [[b], [a]];
    const result = pickNextAssignableNode(buckets, 'a', new Set(['a']), new Set(['a', 'b']));
    expect(result?.id).toBe('b');
  });

  it('does not select a node from a previous bucket if the same bucket has an empty node', () => {
    const prev = n('prev', FigureZone.BASE, null, null);
    const a = n('a', FigureZone.PINYA, 'mans', 1);
    const b = n('b', FigureZone.PINYA, 'mans', 1);
    const buckets = [[prev], [a, b]];
    const result = pickNextAssignableNode(
      buckets,
      'a',
      new Set(['a']),
      new Set(['prev', 'a', 'b']),
    );
    expect(result?.id).toBe('b');
  });

  it('skips over fully-assigned intermediate buckets to find the next empty one', () => {
    const a = n('a', FigureZone.PINYA, 'mans', 1);
    const full = n('full', FigureZone.PINYA, 'vents', 1);
    const c = n('c', FigureZone.PINYA, 'laterals', 1);
    const buckets = [[a], [full], [c]];
    const result = pickNextAssignableNode(
      buckets,
      'a',
      new Set(['a', 'full']),
      new Set(['a', 'full', 'c']),
    );
    expect(result?.id).toBe('c');
  });
});
