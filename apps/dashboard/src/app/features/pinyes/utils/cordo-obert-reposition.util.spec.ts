import { repositionCordoObertNodes } from './cordo-obert-reposition.util';
import { InstanceNodeItem } from '../models/assignment.model';
import { NodeShape } from '@muixer/shared';

function makeNode(overrides: Partial<InstanceNodeItem>): InstanceNodeItem {
  return {
    id: crypto.randomUUID(),
    label: 'node',
    zone: 'PINYA',
    positionType: null,
    x: 0,
    y: 0,
    z: 0,
    width: 60,
    height: 40,
    rotation: 0,
    color: null,
    shape: NodeShape.ELLIPSE,
    sortOrder: 0,
    ringLevel: null,
    originNodeId: null,
    renglaId: null,
    renglaPosition: null,
    sourceNodeId: null,
    isSnapshotted: false,
    ...overrides,
  };
}

describe('repositionCordoObertNodes', () => {
  const RENGLA_A = 'rengla-a';
  const RENGLA_B = 'rengla-b';

  it('returns nodes unchanged when numberOfCordons is null', () => {
    const nodes = [
      makeNode({ positionType: 'cordo-obert', renglaId: RENGLA_A, renglaPosition: 5, x: 500, y: 500 }),
      makeNode({ renglaId: RENGLA_A, renglaPosition: 1, x: 100, y: 100 }),
    ];
    const result = repositionCordoObertNodes(nodes, null);
    expect(result).toBe(nodes);
  });

  it('repositions CO node to one step beyond the last visible cordon', () => {
    const nodes = [
      makeNode({ renglaId: RENGLA_A, renglaPosition: 1, x: 100, y: 200 }),
      makeNode({ renglaId: RENGLA_A, renglaPosition: 2, x: 150, y: 250 }),
      makeNode({ renglaId: RENGLA_A, renglaPosition: 3, x: 200, y: 300 }),
      makeNode({ positionType: 'cordo-obert', renglaId: RENGLA_A, renglaPosition: 4, x: 999, y: 999 }),
    ];

    const result = repositionCordoObertNodes(nodes, 2);
    const co = result.find((n) => n.positionType === 'cordo-obert')!;

    // Vector from pos=1 to pos=2: dx=50, dy=50
    // New position: pos=2 + vector = (150+50, 250+50) = (200, 300)
    expect(co.x).toBe(200);
    expect(co.y).toBe(300);
  });

  it('leaves CO unchanged if reference sibling not found', () => {
    const nodes = [
      makeNode({ renglaId: RENGLA_A, renglaPosition: 1, x: 100, y: 100 }),
      makeNode({ positionType: 'cordo-obert', renglaId: RENGLA_A, renglaPosition: 5, x: 500, y: 500 }),
    ];

    // numberOfCordons = 3 but there's no sibling at position 3
    const result = repositionCordoObertNodes(nodes, 3);
    const co = result.find((n) => n.positionType === 'cordo-obert')!;
    expect(co.x).toBe(500);
    expect(co.y).toBe(500);
  });

  it('handles multiple rengles independently', () => {
    const nodes = [
      makeNode({ renglaId: RENGLA_A, renglaPosition: 1, x: 100, y: 100 }),
      makeNode({ renglaId: RENGLA_A, renglaPosition: 2, x: 200, y: 100 }),
      makeNode({ positionType: 'cordo-obert', renglaId: RENGLA_A, renglaPosition: 4, x: 900, y: 900 }),
      makeNode({ renglaId: RENGLA_B, renglaPosition: 1, x: 100, y: 300 }),
      makeNode({ renglaId: RENGLA_B, renglaPosition: 2, x: 100, y: 400 }),
      makeNode({ positionType: 'cordo-obert', renglaId: RENGLA_B, renglaPosition: 4, x: 800, y: 800 }),
    ];

    const result = repositionCordoObertNodes(nodes, 2);
    const coA = result.find((n) => n.positionType === 'cordo-obert' && n.renglaId === RENGLA_A)!;
    const coB = result.find((n) => n.positionType === 'cordo-obert' && n.renglaId === RENGLA_B)!;

    // Rengla A: vector (200-100, 100-100) = (100, 0) → CO at (300, 100)
    expect(coA.x).toBe(300);
    expect(coA.y).toBe(100);

    // Rengla B: vector (100-100, 400-300) = (0, 100) → CO at (100, 500)
    expect(coB.x).toBe(100);
    expect(coB.y).toBe(500);
  });

  it('uses zero offset when only one cordon visible (no prev sibling)', () => {
    const nodes = [
      makeNode({ renglaId: RENGLA_A, renglaPosition: 1, x: 150, y: 250 }),
      makeNode({ positionType: 'cordo-obert', renglaId: RENGLA_A, renglaPosition: 3, x: 900, y: 900 }),
    ];

    const result = repositionCordoObertNodes(nodes, 1);
    const co = result.find((n) => n.positionType === 'cordo-obert')!;

    // No prev → offset (0,0) → CO placed at ref position
    expect(co.x).toBe(150);
    expect(co.y).toBe(250);
  });

  it('does not modify non-cordo-obert nodes', () => {
    const regular = makeNode({ renglaId: RENGLA_A, renglaPosition: 1, x: 100, y: 200 });
    const nodes = [
      regular,
      makeNode({ renglaId: RENGLA_A, renglaPosition: 2, x: 200, y: 300 }),
      makeNode({ positionType: 'cordo-obert', renglaId: RENGLA_A, renglaPosition: 3, x: 800, y: 800 }),
    ];

    const result = repositionCordoObertNodes(nodes, 2);
    const resultRegular = result.find((n) => n.id === regular.id)!;
    expect(resultRegular.x).toBe(100);
    expect(resultRegular.y).toBe(200);
  });
});
