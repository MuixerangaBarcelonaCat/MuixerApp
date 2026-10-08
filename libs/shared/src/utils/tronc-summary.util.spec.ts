import { FigureMode } from '../enums/figure-mode.enum';
import { formatTroncFloors, formatTroncSummary, TroncSummaryFloor } from './tronc-summary.util';

describe('formatTroncSummary', () => {
  const floors: TroncSummaryFloor[] = [
    { z: 0, isBase: true, slots: ['Pepet', null, 'Maria'] },
    { z: 1, isBase: false, slots: ['Joan', '?'] },
    { z: 2, isBase: false, slots: [null] },
  ];

  it('returns null when there are no floors', () => {
    expect(formatTroncSummary([], FigureMode.COMPLETA)).toBeNull();
  });

  it('formats COMPLETA with every floor, base to top, empty slots as «?»', () => {
    expect(formatTroncSummary(floors, FigureMode.COMPLETA)).toBe('Pepet - ? - Maria // Joan - ? // ?');
  });

  it('puts the base first and orders the rest by z, whatever the input order', () => {
    const shuffled = [floors[2], floors[1], floors[0]];
    expect(formatTroncSummary(shuffled, FigureMode.COMPLETA)).toBe('Pepet - ? - Maria // Joan - ? // ?');
  });

  it('does not mutate the input array', () => {
    const shuffled = [floors[2], floors[0], floors[1]];
    formatTroncSummary(shuffled, FigureMode.COMPLETA);
    expect(shuffled.map((f) => f.z)).toEqual([2, 0, 1]);
  });

  it('excludes the base floor for REMAT', () => {
    expect(formatTroncSummary(floors, FigureMode.REMAT)).toBe('Joan - ? // ?');
  });

  it('trims the unassigned topmost floors for PEU', () => {
    expect(formatTroncSummary(floors, FigureMode.PEU)).toBe('Pepet - ? - Maria // Joan - ?');
  });

  it('returns null for PEU when every floor is unassigned', () => {
    const empty: TroncSummaryFloor[] = [
      { z: 0, isBase: true, slots: [null, null] },
      { z: 1, isBase: false, slots: [null] },
    ];
    expect(formatTroncSummary(empty, FigureMode.PEU)).toBeNull();
  });

  it('returns null for REMAT when the only floor is the base', () => {
    expect(formatTroncSummary([floors[0]], FigureMode.REMAT)).toBeNull();
  });

  it('accepts the figure mode as a plain string literal', () => {
    expect(formatTroncSummary(floors, 'REMAT')).toBe('Joan - ? // ?');
  });
});

describe('formatTroncFloors', () => {
  const floors: TroncSummaryFloor[] = [
    { z: 1, isBase: false, slots: ['Joan', null] },
    { z: 0, isBase: true, slots: ['Pepet', 'Maria'] },
    { z: 2, isBase: false, slots: [null] },
  ];

  it('returns one line per floor, base to top, empty slots as «?»', () => {
    expect(formatTroncFloors(floors, FigureMode.COMPLETA)).toEqual(['Pepet - Maria', 'Joan - ?', '?']);
  });

  it('applies the same figure-mode rules as the one-line summary', () => {
    expect(formatTroncFloors(floors, FigureMode.REMAT)).toEqual(['Joan - ?', '?']);
    expect(formatTroncFloors(floors, FigureMode.PEU)).toEqual(['Pepet - Maria', 'Joan - ?']);
  });

  it('returns null when nothing is left to show', () => {
    expect(formatTroncFloors([], FigureMode.COMPLETA)).toBeNull();
    expect(formatTroncFloors([{ z: 0, isBase: true, slots: [null] }], FigureMode.PEU)).toBeNull();
  });
});
