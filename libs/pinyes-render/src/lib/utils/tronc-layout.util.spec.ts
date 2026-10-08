import {
  baseNodeGridColumn,
  layoutTroncFloors,
  sortTroncBases,
  troncNodeGridColumn,
  troncTotalColumns,
  TroncLayoutNode,
} from './tronc-layout.util';

const node = (overrides: Partial<TroncLayoutNode> & { id: string }): TroncLayoutNode => ({
  label: overrides.id,
  positionType: null,
  x: 0,
  z: 1,
  width: 1,
  sortOrder: 0,
  ...overrides,
});

describe('sortTroncBases', () => {
  it('orders bases by sortOrder without mutating the input', () => {
    const bases = [node({ id: 'b2', z: 0, sortOrder: 1 }), node({ id: 'b1', z: 0, sortOrder: 0 })];

    expect(sortTroncBases(bases).map((b) => b.id)).toEqual(['b1', 'b2']);
    expect(bases.map((b) => b.id)).toEqual(['b2', 'b1']);
  });
});

describe('layoutTroncFloors', () => {
  it('returns no floors for an empty tronc', () => {
    expect(layoutTroncFloors([], [])).toEqual([]);
  });

  it('groups tronc nodes by z and puts the base floor last, top floor first', () => {
    const floors = layoutTroncFloors(
      [node({ id: 't1', z: 2 }), node({ id: 's1', z: 1 }), node({ id: 's2', z: 1, x: 1 })],
      [node({ id: 'b1', z: 0 })],
    );

    expect(floors.map((f) => f.z)).toEqual([2, 1, 0]);
    expect(floors.map((f) => f.pisLabel)).toEqual(['P3', 'P2', 'P1']);
    expect(floors.map((f) => f.isBase)).toEqual([false, false, true]);
    expect(floors[1].nodes.map((n) => n.id)).toEqual(['s1', 's2']);
  });

  it('labels the base floor «Bases» and orders its nodes by sortOrder', () => {
    const [base] = layoutTroncFloors([], [
      node({ id: 'b2', z: 0, sortOrder: 1 }),
      node({ id: 'b1', z: 0, sortOrder: 0 }),
    ]);

    expect(base.positionTypeLabel).toBe('Bases');
    expect(base.nodes.map((n) => n.id)).toEqual(['b1', 'b2']);
  });

  it('orders the nodes of a tronc floor by sortOrder, then x', () => {
    const [floor] = layoutTroncFloors(
      [
        node({ id: 'right', x: 2, sortOrder: 0 }),
        node({ id: 'left', x: 0, sortOrder: 0 }),
        node({ id: 'first', x: 5, sortOrder: -1 }),
      ],
      [],
    );

    expect(floor.nodes.map((n) => n.id)).toEqual(['first', 'left', 'right']);
  });

  it('labels a tronc floor with its most common node label', () => {
    const [floor] = layoutTroncFloors(
      [node({ id: 'a', label: 'Segon' }), node({ id: 'b', label: 'Segon' }), node({ id: 'c', label: 'Puntal' })],
      [],
    );

    expect(floor.positionTypeLabel).toBe('Segon');
  });

  it('falls back to positionType, then «desconegut», when nodes have no label', () => {
    expect(layoutTroncFloors([node({ id: 'a', label: '', positionType: 'terça' })], [])[0].positionTypeLabel).toBe(
      'terça',
    );
    expect(layoutTroncFloors([node({ id: 'a', label: '' })], [])[0].positionTypeLabel).toBe('desconegut');
  });
});

describe('troncTotalColumns', () => {
  it('counts half-unit columns from the widest tronc span', () => {
    expect(troncTotalColumns([node({ id: 'a', x: 1, width: 1.5 })], 0)).toBe(5);
  });

  it('is at least two half-columns per base', () => {
    expect(troncTotalColumns([node({ id: 'a', width: 1 })], 4)).toBe(8);
  });

  it('is never smaller than 2', () => {
    expect(troncTotalColumns([], 0)).toBe(2);
  });
});

describe('grid columns', () => {
  it('maps a tronc node span onto the doubled grid', () => {
    expect(troncNodeGridColumn(node({ id: 'a', x: 1.5, width: 2 }))).toBe('4 / span 4');
  });

  it('places a base by its sorted index, two half-columns each', () => {
    expect(baseNodeGridColumn(0)).toBe('1 / span 2');
    expect(baseNodeGridColumn(2)).toBe('5 / span 2');
  });
});
