import { describe, it, expect } from 'vitest';
import { computeMaxCordons, filterNodesByFigureMode, FigureModeFilterableNode } from './figure-mode-filter.util';

interface TestNode extends FigureModeFilterableNode {
  id: string;
  positionType?: string | null;
}

const node = (
  id: string,
  zone: string,
  renglaId: string | null = null,
  renglaPosition: number | null = null,
  positionType: string | null = null,
): TestNode => ({ id, zone, renglaId, renglaPosition, positionType });

describe('filterNodesByFigureMode', () => {
  it('keeps all nodes when figureMode is COMPLETA and numberOfCordons is null', () => {
    const nodes = [node('n1', 'PINYA', 'r1', 1), node('n2', 'PINYA', 'r1', 2), node('b1', 'BASE')];
    const result = filterNodesByFigureMode(nodes, 'COMPLETA', null);
    expect(result.map((n) => n.id)).toEqual(['n1', 'n2', 'b1']);
  });

  it('removes PINYA nodes whose renglaPosition exceeds numberOfCordons', () => {
    const nodes = [node('n1', 'PINYA', 'r1', 1), node('n2', 'PINYA', 'r1', 2)];
    const result = filterNodesByFigureMode(nodes, 'COMPLETA', 1);
    expect(result.map((n) => n.id)).toEqual(['n1']);
  });

  it('keeps a PINYA node with no renglaId regardless of numberOfCordons', () => {
    const nodes = [node('n1', 'PINYA', null, null)];
    const result = filterNodesByFigureMode(nodes, 'COMPLETA', 1);
    expect(result.map((n) => n.id)).toEqual(['n1']);
  });

  it('always keeps non-PINYA nodes regardless of numberOfCordons', () => {
    const nodes = [node('b1', 'BASE'), node('t1', 'TRONC')];
    const result = filterNodesByFigureMode(nodes, 'COMPLETA', 0);
    expect(result.map((n) => n.id)).toEqual(['b1', 't1']);
  });

  it('removes all PINYA nodes when figureMode is REMAT', () => {
    const nodes = [node('n1', 'PINYA'), node('b1', 'BASE')];
    const result = filterNodesByFigureMode(nodes, 'REMAT', null);
    expect(result.map((n) => n.id)).toEqual(['b1']);
  });

  it('removes all PINYA nodes when figureMode is NETA', () => {
    const nodes = [node('n1', 'PINYA'), node('b1', 'BASE')];
    const result = filterNodesByFigureMode(nodes, 'NETA', null);
    expect(result.map((n) => n.id)).toEqual(['b1']);
  });

  it('keeps a cordo-obert PINYA node beyond numberOfCordons when keepCordoObert is set', () => {
    const nodes = [
      node('n1', 'PINYA', 'r1', 1),
      node('n2', 'PINYA', 'r1', 3, 'cordo-obert'),
    ];
    const result = filterNodesByFigureMode(nodes, 'COMPLETA', 1, { keepCordoObert: true });
    expect(result.map((n) => n.id)).toEqual(['n1', 'n2']);
  });

  it('still removes a cordo-obert PINYA node beyond numberOfCordons when keepCordoObert is not set', () => {
    const nodes = [
      node('n1', 'PINYA', 'r1', 1),
      node('n2', 'PINYA', 'r1', 3, 'cordo-obert'),
    ];
    const result = filterNodesByFigureMode(nodes, 'COMPLETA', 1);
    expect(result.map((n) => n.id)).toEqual(['n1']);
  });
});

describe('computeMaxCordons', () => {
  it('returns the highest renglaPosition among PINYA nodes', () => {
    const nodes = [
      node('n1', 'PINYA', 'r1', 1),
      node('n2', 'PINYA', 'r1', 2),
      node('n3', 'PINYA', 'r1', 4),
    ];
    expect(computeMaxCordons(nodes)).toBe(4);
  });

  it('returns 0 when there are no rengla positions', () => {
    expect(computeMaxCordons([node('b1', 'BASE')])).toBe(0);
  });

  it('ignores nodes with positionType cordo-obert', () => {
    const nodes = [node('n1', 'PINYA', 'r1', 1, 'cordo-obert'), node('n2', 'PINYA', 'r1', 3)];
    expect(computeMaxCordons(nodes)).toBe(3);
  });

  it('ignores nodes with no renglaPosition', () => {
    const nodes = [node('n1', 'PINYA', null, null)];
    expect(computeMaxCordons(nodes)).toBe(0);
  });
});
