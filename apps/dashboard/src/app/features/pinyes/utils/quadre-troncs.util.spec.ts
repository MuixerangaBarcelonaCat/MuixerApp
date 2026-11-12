import type { AvailablePersonPosition } from '@muixer/pinyes-render';
import { TagCategory } from '@muixer/shared';
import type { ParticipationPerson, ParticipationPlacement } from '../../events/models/participation.model';
import {
  buildQuadre,
  figureCount,
  formatShoulderHeight,
  participationDots,
  rowState,
} from './quadre-troncs.util';

const TAG_A = { id: 'tag-a', name: 'Terces' };
const TAG_B = { id: 'tag-b', name: 'Alçadores' };
const TAG_OTHER = { id: 'tag-x', name: '1es Vents' };

function tag(t: { id: string; name: string }): AvailablePersonPosition {
  return { ...t, slug: t.id, color: null, positionTypes: [], category: TagCategory.TRONC };
}

function placement(instanceId: string, positionType: string | null = 'segona'): ParticipationPlacement {
  return {
    assignmentId: `as-${instanceId}-${positionType}`,
    instanceId,
    figureName: 'F',
    nodeId: `n-${instanceId}-${positionType}`,
    nodeLabel: 'N',
    zone: 'TRONC',
    area: 'TRONC',
    positionType,
    z: 1,
    renglaPosition: null,
  } as ParticipationPlacement;
}

let seq = 0;
function person(overrides: Partial<ParticipationPerson> = {}): ParticipationPerson {
  seq += 1;
  return {
    id: `p${seq}`,
    alias: `P${seq}`,
    name: 'Nom',
    firstSurname: 'Cognom',
    shoulderHeight: 150,
    isXicalla: false,
    isActive: true,
    notes: null,
    notesEmoji: null,
    attendanceStatus: 'ANIRE',
    nextPerformanceStatus: 'PENDENT',
    positions: [tag(TAG_A)],
    placements: {},
    assignedSegmentCount: 0,
    placementCount: 0,
    troncPlacementCount: 0,
    conflictSegmentIds: [],
    ...overrides,
  } as ParticipationPerson;
}

describe('participationDots', () => {
  it('maps counts to dots, capping at 3 with a plus', () => {
    expect([0, 1, 2, 3, 4, 7].map(participationDots)).toEqual(['', '●', '●●', '●●●', '●●●+', '●●●+']);
  });
});

describe('figureCount', () => {
  it('counts distinct figures across segments, not placements', () => {
    const p = person({ placements: { s1: [placement('i1', 'mans'), placement('i1', 'segona')], s2: [placement('i1')] } });
    expect(figureCount(p)).toBe(1);
  });

  it('counts each different figure', () => {
    expect(figureCount(person({ placements: { s1: [placement('i1')], s2: [placement('i2')] } }))).toBe(2);
  });

  it('ignores direcció de pinya', () => {
    expect(figureCount(person({ placements: { s1: [placement('i1', 'direccio-pinya')] } }))).toBe(0);
  });

  it('counts direcció de tronc and de xicalla', () => {
    const p = person({ placements: { s1: [placement('i1', 'direccio-tronc')], s2: [placement('i2', 'direccio-xicalla')] } });
    expect(figureCount(p)).toBe(2);
  });
});

describe('formatShoulderHeight', () => {
  it('shows nothing for a missing or zero height', () => {
    expect(formatShoulderHeight(null, 'relative', 170)).toBe('-');
    expect(formatShoulderHeight(0, 'absolute', 170)).toBe('-');
  });

  it('formats relative to the baseline', () => {
    expect(formatShoulderHeight(175, 'relative', 170)).toBe('+5');
    expect(formatShoulderHeight(165, 'relative', 170)).toBe('-5');
  });

  it('formats absolute in cm', () => {
    expect(formatShoulderHeight(175, 'absolute', 170)).toBe('175 cm');
  });
});

describe('rowState', () => {
  it('coming to both → both', () => {
    expect(rowState(person({ attendanceStatus: 'ASSISTIT', nextPerformanceStatus: 'ANIRE' }))).toBe('both');
  });

  it('coming, not to the performance → notPerformance', () => {
    expect(rowState(person({ nextPerformanceStatus: 'NO_VAIG' }))).toBe('notPerformance');
  });

  it('coming, performance unanswered → unanswered', () => {
    expect(rowState(person({ nextPerformanceStatus: 'PENDENT' }))).toBe('unanswered');
  });

  it('coming, no next performance → neutral', () => {
    expect(rowState(person({ nextPerformanceStatus: null }))).toBe('neutral');
  });

  it('not coming, coming to the performance → performanceOnly', () => {
    expect(rowState(person({ attendanceStatus: 'NO_VAIG', nextPerformanceStatus: 'ANIRE' }))).toBe('performanceOnly');
  });

  it('not coming but placed → assignedAbsent, winning over performanceOnly', () => {
    const p = person({ attendanceStatus: 'NO_VAIG', nextPerformanceStatus: 'ANIRE', placements: { s1: [placement('i1')] } });
    expect(rowState(p)).toBe('assignedAbsent');
  });

  it('placed on direcció de pinya only and not coming is still assignedAbsent', () => {
    const p = person({ attendanceStatus: 'NO_VAIG', placements: { s1: [placement('i1', 'direccio-pinya')] } });
    expect(rowState(p)).toBe('assignedAbsent');
  });

  it('pending, unplaced, not coming to the performance → hidden', () => {
    expect(rowState(person({ attendanceStatus: 'PENDENT', nextPerformanceStatus: 'NO_VAIG' }))).toBeNull();
  });

  it('inactive → hidden', () => {
    expect(rowState(person({ isActive: false }))).toBeNull();
  });
});

describe('buildQuadre', () => {
  const columns = [TAG_A, TAG_B];

  it('puts a multi-tag person in every matching column and counts them once globally', () => {
    const p = person({ positions: [tag(TAG_A), tag(TAG_B)] });
    const q = buildQuadre([p], columns);

    expect(q.columns.map((c) => c.entries.map((e) => e.person.id))).toEqual([[p.id], [p.id], []]);
    expect(q.columns[0].comingCount).toBe(1);
    expect(q.columns[1].comingCount).toBe(1);
    expect(q.uniqueComing).toBe(1);
  });

  it('always ends with «Altres», holding people with none of the column tags', () => {
    const p = person({ positions: [tag(TAG_OTHER)] });
    const q = buildQuadre([p], columns);
    const last = q.columns[q.columns.length - 1];

    expect(last).toMatchObject({ id: null, name: 'Altres', comingCount: 1 });
    expect(last.entries[0].person.id).toBe(p.id);
  });

  it('sorts by height desc, missing heights last, then alias; performance-only at the end', () => {
    const late = person({ alias: 'AA', shoulderHeight: 190, attendanceStatus: 'NO_VAIG', nextPerformanceStatus: 'ANIRE' });
    const zero = person({ alias: 'ZERO', shoulderHeight: 0 });
    const none = person({ alias: 'BB', shoulderHeight: null });
    const short = person({ alias: 'C', shoulderHeight: 170 });
    const tallB = person({ alias: 'TB', shoulderHeight: 180 });
    const tallA = person({ alias: 'TA', shoulderHeight: 180 });

    const q = buildQuadre([late, zero, none, short, tallB, tallA], columns);

    expect(q.columns[0].entries.map((e) => e.person.alias)).toEqual(['TA', 'TB', 'C', 'BB', 'ZERO', 'AA']);
  });

  it('counts performance-only apart and assigned-absent nowhere', () => {
    const coming = person();
    const perfOnly = person({ attendanceStatus: 'PENDENT', nextPerformanceStatus: 'ANIRE' });
    const absent = person({ attendanceStatus: 'NO_VAIG', nextPerformanceStatus: 'ANIRE', placements: { s1: [placement('i1')] } });

    const q = buildQuadre([coming, perfOnly, absent], columns);

    expect(q.columns[0].entries).toHaveLength(3);
    expect(q.columns[0].comingCount).toBe(1);
    expect(q.columns[0].performanceOnlyCount).toBe(1);
    expect(q.uniqueComing).toBe(1);
  });

  it('with no next performance, nobody is coloured or performance-only', () => {
    const a = person({ nextPerformanceStatus: null });
    const b = person({ attendanceStatus: 'NO_VAIG', nextPerformanceStatus: null });

    const q = buildQuadre([a, b], columns);
    const states = q.columns.flatMap((c) => c.entries.map((e) => e.state));

    expect(states).toEqual(['neutral']);
    expect(q.columns[0].performanceOnlyCount).toBe(0);
  });

  it('carries the figure count on each entry', () => {
    const p = person({ placements: { s1: [placement('i1')], s2: [placement('i2')] } });
    expect(buildQuadre([p], columns).columns[0].entries[0].figureCount).toBe(2);
  });
});
