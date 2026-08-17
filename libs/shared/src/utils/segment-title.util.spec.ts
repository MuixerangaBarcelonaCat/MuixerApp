import { FigureMode } from '../enums/figure-mode.enum';
import { computeSegmentDisplayName, getSegmentInstanceLabel, SegmentTitleInstance } from './segment-title.util';

const makeInstance = (overrides: Partial<SegmentTitleInstance> = {}): SegmentTitleInstance => ({
  label: null,
  figureMode: FigureMode.COMPLETA,
  figureTemplate: null,
  ...overrides,
});

describe('computeSegmentDisplayName', () => {
  it('returns the custom name when set', () => {
    expect(computeSegmentDisplayName('Bloc A', [])).toBe('Bloc A');
  });

  it('auto-generates from instances when name is null', () => {
    const instances = [
      makeInstance({ figureTemplate: { name: 'pd4', hasPinya: true } }),
      makeInstance({ figureTemplate: { name: 'Morera', hasPinya: true } }),
    ];
    expect(computeSegmentDisplayName(null, instances)).toBe('pd4 + Morera');
  });

  it('returns the fallback when name is null and there are no instances', () => {
    expect(computeSegmentDisplayName(null, [])).toBe('Segment sense nom');
  });

  it('groups instances with the same computed label, prefixing the count when there are more than one', () => {
    const instances = [
      makeInstance({ figureTemplate: { name: 'Piló', hasPinya: true } }),
      makeInstance({ figureTemplate: { name: 'Piló', hasPinya: true } }),
      makeInstance({ figureTemplate: { name: 'Piló', hasPinya: true } }),
      makeInstance({ figureMode: FigureMode.PEU, figureTemplate: { name: 'Roscana', hasPinya: true } }),
      makeInstance({ figureMode: FigureMode.PEU, figureTemplate: { name: 'Roscana', hasPinya: true } }),
    ];
    expect(computeSegmentDisplayName(null, instances)).toBe('3 Piló + 2 Peu de Roscana');
  });

  it('does not prefix a count for a label that appears only once', () => {
    const instances = [
      makeInstance({ figureTemplate: { name: 'pd4', hasPinya: true } }),
      makeInstance({ figureMode: FigureMode.PEU, figureTemplate: { name: 'pd4', hasPinya: true } }),
    ];
    expect(computeSegmentDisplayName(null, instances)).toBe('pd4 + Peu de pd4');
  });

  it('preserves the order groups first appear in', () => {
    const instances = [
      makeInstance({ figureTemplate: { name: 'Roscana', hasPinya: true } }),
      makeInstance({ figureTemplate: { name: 'Piló', hasPinya: true } }),
      makeInstance({ figureTemplate: { name: 'Roscana', hasPinya: true } }),
    ];
    expect(computeSegmentDisplayName(null, instances)).toBe('2 Roscana + Piló');
  });
});

describe('getSegmentInstanceLabel', () => {
  it('uses the instance label when set', () => {
    const instance = makeInstance({ label: 'Custom label', figureTemplate: { name: 'pd4', hasPinya: true } });
    expect(getSegmentInstanceLabel(instance)).toBe('Custom label');
  });

  it('falls back to the figure template name when no label is set', () => {
    const instance = makeInstance({ figureTemplate: { name: 'pd4', hasPinya: true } });
    expect(getSegmentInstanceLabel(instance)).toBe('pd4');
  });

  it('falls back to "?" when there is no label nor figure template', () => {
    expect(getSegmentInstanceLabel(makeInstance())).toBe('?');
  });

  it('prefixes with "Peu de" for a PEU figure mode with pinya', () => {
    const instance = makeInstance({ figureMode: FigureMode.PEU, figureTemplate: { name: 'pd4', hasPinya: true } });
    expect(getSegmentInstanceLabel(instance)).toBe('Peu de pd4');
  });

  it('prefixes with "Remat de" for a REMAT figure mode with pinya', () => {
    const instance = makeInstance({ figureMode: FigureMode.REMAT, figureTemplate: { name: 'pd4', hasPinya: true } });
    expect(getSegmentInstanceLabel(instance)).toBe('Remat de pd4');
  });

  it('suffixes with "neta" for a NETA figure mode when the base ends in "a"', () => {
    const instance = makeInstance({ figureMode: FigureMode.NETA, figureTemplate: { name: 'Morera', hasPinya: true } });
    expect(getSegmentInstanceLabel(instance)).toBe('Morera neta');
  });

  it('suffixes with "net" for a NETA figure mode when the base does not end in "a"', () => {
    const instance = makeInstance({ figureMode: FigureMode.NETA, figureTemplate: { name: 'pd4', hasPinya: true } });
    expect(getSegmentInstanceLabel(instance)).toBe('pd4 net');
  });

  it('applies the mode suffix even when figureTemplate.hasPinya is false', () => {
    // `hasPinya` is overloaded across the two endpoints that populate this shape: the segment-list
    // endpoint reports it structurally (does the template have pinya nodes at all), but the
    // projection endpoint reports it mode-collapsed (`hasPinyaNodes && mode !== REMAT && mode !==
    // NETA` — projection.service.ts) — false for precisely the modes this function must describe.
    // Gating the suffix on it made PEU/REMAT/NETA unreachable for any caller fed projection data.
    const instance = makeInstance({ figureMode: FigureMode.PEU, figureTemplate: { name: 'Tronc', hasPinya: false } });
    expect(getSegmentInstanceLabel(instance)).toBe('Peu de Tronc');
  });
});
