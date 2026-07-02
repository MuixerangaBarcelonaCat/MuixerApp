import { describe, it, expect } from 'vitest';
import { filterNodesByFigureMode, FigureModeFilterableNode } from './figure-mode-filter.util';

interface TestNode extends FigureModeFilterableNode {
  id: string;
}

const node = (
  id: string,
  zone: string,
  renglaId: string | null = null,
  renglaPosition: number | null = null,
): TestNode => ({ id, zone, renglaId, renglaPosition });

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
});
