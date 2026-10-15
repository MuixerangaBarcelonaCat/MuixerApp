import { FigureZone } from '../enums/figure-zone.enum';
import { isValidStandsOnTarget, sanitizeStandsOn, TroncSupportNode } from './tronc-support.util';

const node = (
  id: string,
  zone: FigureZone,
  z: number,
  standsOnNodeIds: string[] = [],
): TroncSupportNode => ({ id, zone, z, standsOnNodeIds });

describe('isValidStandsOnTarget', () => {
  it('accepts a TRONC node standing on a BASE node of the floor directly below', () => {
    expect(isValidStandsOnTarget(node('s1', FigureZone.TRONC, 1), node('b1', FigureZone.BASE, 0))).toBe(true);
  });

  it('accepts a TRONC node standing on a TRONC node of the floor directly below', () => {
    expect(isValidStandsOnTarget(node('t1', FigureZone.TRONC, 2), node('s1', FigureZone.TRONC, 1))).toBe(true);
  });

  it('rejects a target two floors below', () => {
    expect(isValidStandsOnTarget(node('t1', FigureZone.TRONC, 2), node('b1', FigureZone.BASE, 0))).toBe(false);
  });

  it('rejects a target on the same floor or above', () => {
    expect(isValidStandsOnTarget(node('s1', FigureZone.TRONC, 1), node('s2', FigureZone.TRONC, 1))).toBe(false);
    expect(isValidStandsOnTarget(node('s1', FigureZone.TRONC, 1), node('t1', FigureZone.TRONC, 2))).toBe(false);
  });

  it('rejects a holder that is not TRONC', () => {
    expect(isValidStandsOnTarget(node('b1', FigureZone.BASE, 1), node('b0', FigureZone.BASE, 0))).toBe(false);
    expect(isValidStandsOnTarget(node('p1', FigureZone.PINYA, 1), node('b0', FigureZone.BASE, 0))).toBe(false);
  });

  it('rejects a target that is neither BASE nor TRONC', () => {
    expect(isValidStandsOnTarget(node('s1', FigureZone.TRONC, 1), node('p1', FigureZone.PINYA, 0))).toBe(false);
    expect(isValidStandsOnTarget(node('s1', FigureZone.TRONC, 1), node('d1', FigureZone.DIRECTION, 0))).toBe(false);
  });

  it('rejects the node itself', () => {
    const s1 = node('s1', FigureZone.TRONC, 1);
    expect(isValidStandsOnTarget(s1, s1)).toBe(false);
  });
});

describe('sanitizeStandsOn', () => {
  it('keeps valid links untouched', () => {
    const nodes = [
      node('b1', FigureZone.BASE, 0),
      node('b2', FigureZone.BASE, 0),
      node('s1', FigureZone.TRONC, 1, ['b1', 'b2']),
    ];
    expect(sanitizeStandsOn(nodes).find((n) => n.id === 's1')?.standsOnNodeIds).toEqual(['b1', 'b2']);
  });

  it('drops ids of nodes that are not in the list', () => {
    const nodes = [node('b1', FigureZone.BASE, 0), node('s1', FigureZone.TRONC, 1, ['b1', 'gone'])];
    expect(sanitizeStandsOn(nodes).find((n) => n.id === 's1')?.standsOnNodeIds).toEqual(['b1']);
  });

  it('drops ids of nodes that are not on the floor directly below', () => {
    const nodes = [
      node('b1', FigureZone.BASE, 0),
      node('s1', FigureZone.TRONC, 1),
      node('t1', FigureZone.TRONC, 2, ['s1', 'b1']),
    ];
    expect(sanitizeStandsOn(nodes).find((n) => n.id === 't1')?.standsOnNodeIds).toEqual(['s1']);
  });

  it('removes duplicated ids', () => {
    const nodes = [node('b1', FigureZone.BASE, 0), node('s1', FigureZone.TRONC, 1, ['b1', 'b1'])];
    expect(sanitizeStandsOn(nodes).find((n) => n.id === 's1')?.standsOnNodeIds).toEqual(['b1']);
  });

  it('clears the links of nodes that are not TRONC', () => {
    const nodes = [node('b0', FigureZone.BASE, 0), node('b1', FigureZone.BASE, 1, ['b0'])];
    expect(sanitizeStandsOn(nodes).find((n) => n.id === 'b1')?.standsOnNodeIds).toEqual([]);
  });

  it('treats a missing standsOnNodeIds as no links', () => {
    const nodes = [{ id: 's1', zone: FigureZone.TRONC, z: 1 }];
    expect(sanitizeStandsOn(nodes)[0].standsOnNodeIds).toEqual([]);
  });

  it('keeps every other property of the nodes and does not mutate the input', () => {
    const input = [
      { ...node('b1', FigureZone.BASE, 0), label: 'Base 1' },
      { ...node('s1', FigureZone.TRONC, 1, ['b1', 'gone']), label: 'Segon' },
    ];
    const result = sanitizeStandsOn(input);

    expect(result[1]).toEqual({ ...input[1], standsOnNodeIds: ['b1'] });
    expect(input[1].standsOnNodeIds).toEqual(['b1', 'gone']);
  });
});
