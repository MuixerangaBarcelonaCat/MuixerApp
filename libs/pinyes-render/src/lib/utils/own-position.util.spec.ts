import { FigureZone } from '@muixer/shared';
import { AssignmentDetail } from '../models/assignment.model';
import { ProjectionInstance, ProjectionSegmentData } from '../models/projection.model';
import {
  describeOwnPlacement,
  findOwnPlacements,
  findRenglaPredecessor,
  findTroncNeighbours,
  OwnPlacement,
} from './own-position.util';

type NodeOverrides = Partial<ProjectionInstance['nodes'][number]>;

let nodeSeq = 0;

const makeNode = (overrides: NodeOverrides = {}): ProjectionInstance['nodes'][number] => ({
  id: overrides.id ?? `node-${++nodeSeq}`,
  label: 'Node',
  zone: FigureZone.PINYA,
  positionType: null,
  x: 0,
  y: 0,
  z: 0,
  width: 1,
  height: 1,
  rotation: 0,
  color: null,
  shape: 'rect',
  sortOrder: 0,
  climbIndicator: null,
  ringLevel: null,
  originNodeId: null,
  renglaId: null,
  renglaPosition: null,
  sourceNodeId: null,
  isSnapshotted: true,
  isAdHoc: false,
  createdById: null,
  ...overrides,
});

const makeAssignment = (
  node: ProjectionInstance['nodes'][number],
  personId: string,
  alias: string,
): AssignmentDetail => ({
  id: `assignment-${node.id}`,
  figureInstanceId: 'instance-1',
  node: {
    id: node.id,
    label: node.label,
    zone: node.zone,
    z: node.z,
    positionType: node.positionType,
    sortOrder: node.sortOrder,
    climbIndicator: node.climbIndicator,
    ringLevel: node.ringLevel,
    originNodeId: node.originNodeId,
    sourceNodeId: node.sourceNodeId,
    renglaPosition: node.renglaPosition,
  },
  person: {
    id: personId,
    alias,
    name: alias,
    firstSurname: '',
    shoulderHeight: null,
    notes: null,
    notesEmoji: null,
  },
});

type InstanceOverrides = Partial<ProjectionInstance>;

const makeInstance = (overrides: InstanceOverrides = {}): ProjectionInstance => ({
  id: 'instance-1',
  label: null,
  sortOrder: 0,
  numberOfCordons: null,
  projectionX: 0,
  projectionY: 0,
  projectionScale: 1,
  projectionAngle: 0,
  troncPanelX: null,
  troncPanelY: null,
  troncPanelWidth: null,
  troncPanelHeight: null,
  figureMode: 'COMPLETA',
  figureTemplate: { id: 'template-1', name: 'Roscana', hasPinya: true },
  nodes: [],
  assignments: [],
  ...overrides,
});

const makeData = (instances: ProjectionInstance[]): ProjectionSegmentData => ({
  segment: { id: 'segment-1', name: null, sortOrder: 0, prevSegmentId: null, nextSegmentId: null },
  instances,
  personAttendance: {},
  hasDistribution: true,
  conflicts: [],
});

describe('findOwnPlacements', () => {
  it('returns an empty array when the person holds no assignment', () => {
    const node = makeNode();
    const instance = makeInstance({ nodes: [node], assignments: [makeAssignment(node, 'someone-else', 'X')] });
    expect(findOwnPlacements(makeData([instance]), 'me')).toEqual([]);
  });

  it('returns the single placement, with its instance index', () => {
    const node = makeNode();
    const instance = makeInstance({ nodes: [node], assignments: [makeAssignment(node, 'me', 'Marta')] });
    const data = makeData([makeInstance({ id: 'instance-0', nodes: [] }), instance]);

    const placements = findOwnPlacements(data, 'me');

    expect(placements).toHaveLength(1);
    expect(placements[0]).toMatchObject({ instanceIndex: 1, node });
  });

  it('returns every placement when the person holds more than one (invariant 4)', () => {
    const nodeA = makeNode();
    const nodeB = makeNode();
    const instanceA = makeInstance({ id: 'instance-a', nodes: [nodeA], assignments: [makeAssignment(nodeA, 'me', 'Marta')] });
    const instanceB = makeInstance({ id: 'instance-b', nodes: [nodeB], assignments: [makeAssignment(nodeB, 'me', 'Marta')] });

    const placements = findOwnPlacements(makeData([instanceA, instanceB]), 'me');

    expect(placements).toHaveLength(2);
  });
});

describe('findRenglaPredecessor', () => {
  it('returns null when the node has no rengla', () => {
    const node = makeNode({ renglaId: null, renglaPosition: null });
    const instance = makeInstance({ nodes: [node] });
    expect(findRenglaPredecessor(node, instance)).toBeNull();
  });

  it('returns null for the innermost position (1)', () => {
    const node = makeNode({ renglaId: 'rengla-1', renglaPosition: 1 });
    const instance = makeInstance({ nodes: [node] });
    expect(findRenglaPredecessor(node, instance)).toBeNull();
  });

  it("returns the predecessor's alias for position > 1", () => {
    const predecessor = makeNode({ renglaId: 'rengla-1', renglaPosition: 1 });
    const own = makeNode({ renglaId: 'rengla-1', renglaPosition: 2 });
    const instance = makeInstance({
      nodes: [predecessor, own],
      assignments: [makeAssignment(predecessor, 'other', 'Marta')],
    });
    expect(findRenglaPredecessor(own, instance)).toBe('Marta');
  });

  it('returns null when the predecessor node exists but is unassigned', () => {
    const predecessor = makeNode({ renglaId: 'rengla-1', renglaPosition: 1 });
    const own = makeNode({ renglaId: 'rengla-1', renglaPosition: 2 });
    const instance = makeInstance({ nodes: [predecessor, own], assignments: [] });
    expect(findRenglaPredecessor(own, instance)).toBeNull();
  });

  it('does not confuse positions across different rengles', () => {
    const otherRenglaNode = makeNode({ renglaId: 'rengla-2', renglaPosition: 1 });
    const own = makeNode({ renglaId: 'rengla-1', renglaPosition: 2 });
    const instance = makeInstance({
      nodes: [otherRenglaNode, own],
      assignments: [makeAssignment(otherRenglaNode, 'other', 'Marta')],
    });
    expect(findRenglaPredecessor(own, instance)).toBeNull();
  });
});

describe('findTroncNeighbours', () => {
  it('finds one node directly below and one directly above', () => {
    const below = makeNode({ zone: FigureZone.TRONC, z: 1, x: 0, width: 1, sortOrder: 0 });
    const own = makeNode({ zone: FigureZone.TRONC, z: 2, x: 0, width: 1, sortOrder: 0 });
    const above = makeNode({ zone: FigureZone.TRONC, z: 3, x: 0, width: 1, sortOrder: 0 });
    const instance = makeInstance({
      nodes: [below, own, above],
      assignments: [
        makeAssignment(below, 'p-below', 'Joan'),
        makeAssignment(above, 'p-above', 'Marta'),
      ],
    });

    expect(findTroncNeighbours(own, instance)).toEqual({ below: ['Joan'], above: ['Marta'] });
  });

  it('finds two people below one (a wide node spanning two narrow ones)', () => {
    const belowLeft = makeNode({ zone: FigureZone.TRONC, z: 1, x: 0, width: 1, sortOrder: 0 });
    const belowRight = makeNode({ zone: FigureZone.TRONC, z: 1, x: 1, width: 1, sortOrder: 1 });
    const own = makeNode({ zone: FigureZone.TRONC, z: 2, x: 0, width: 2, sortOrder: 0 });
    const instance = makeInstance({
      nodes: [belowLeft, belowRight, own],
      assignments: [
        makeAssignment(belowLeft, 'p1', 'Joan'),
        makeAssignment(belowRight, 'p2', 'Pere'),
      ],
    });

    expect(findTroncNeighbours(own, instance).below).toEqual(['Joan', 'Pere']);
  });

  it('finds two people above one (a wide node underneath two narrow ones)', () => {
    const own = makeNode({ zone: FigureZone.TRONC, z: 1, x: 0, width: 2, sortOrder: 0 });
    const aboveLeft = makeNode({ zone: FigureZone.TRONC, z: 2, x: 0, width: 1, sortOrder: 0 });
    const aboveRight = makeNode({ zone: FigureZone.TRONC, z: 2, x: 1, width: 1, sortOrder: 1 });
    const instance = makeInstance({
      nodes: [own, aboveLeft, aboveRight],
      assignments: [
        makeAssignment(aboveLeft, 'p1', 'Joan'),
        makeAssignment(aboveRight, 'p2', 'Pere'),
      ],
    });

    expect(findTroncNeighbours(own, instance).above).toEqual(['Joan', 'Pere']);
  });

  it('only counts a node whose span actually overlaps, not merely adjacent', () => {
    const own = makeNode({ zone: FigureZone.TRONC, z: 1, x: 0, width: 1, sortOrder: 0 });
    const adjacentNotOverlapping = makeNode({ zone: FigureZone.TRONC, z: 2, x: 1, width: 1, sortOrder: 0 });
    const instance = makeInstance({
      nodes: [own, adjacentNotOverlapping],
      assignments: [makeAssignment(adjacentNotOverlapping, 'p1', 'Joan')],
    });

    expect(findTroncNeighbours(own, instance).above).toEqual([]);
  });

  it('crosses into the BASE floor for the bottom TRONC level, using sorted index as span', () => {
    const base0 = makeNode({ zone: FigureZone.BASE, z: 0, sortOrder: 0 });
    const base1 = makeNode({ zone: FigureZone.BASE, z: 0, sortOrder: 1 });
    const own = makeNode({ zone: FigureZone.TRONC, z: 1, x: 0, width: 2, sortOrder: 0 });
    const instance = makeInstance({
      nodes: [base0, base1, own],
      assignments: [makeAssignment(base0, 'p1', 'Joan'), makeAssignment(base1, 'p2', 'Pere')],
    });

    expect(findTroncNeighbours(own, instance).below).toEqual(['Joan', 'Pere']);
  });

  it('skips an empty floor and walks to the nearest occupied one', () => {
    const own = makeNode({ zone: FigureZone.TRONC, z: 1, x: 0, width: 1, sortOrder: 0 });
    // z=2 has no nodes at all — a gap in the data.
    const twoUp = makeNode({ zone: FigureZone.TRONC, z: 3, x: 0, width: 1, sortOrder: 0 });
    const instance = makeInstance({
      nodes: [own, twoUp],
      assignments: [makeAssignment(twoUp, 'p1', 'Marta')],
    });

    expect(findTroncNeighbours(own, instance).above).toEqual(['Marta']);
  });

  it('returns no neighbours below the base floor', () => {
    const base0 = makeNode({ zone: FigureZone.BASE, z: 0, sortOrder: 0 });
    const own = makeNode({ zone: FigureZone.TRONC, z: 1, x: 5, width: 1, sortOrder: 0 });
    const instance = makeInstance({ nodes: [base0, own], assignments: [] });

    expect(findTroncNeighbours(own, instance).below).toEqual([]);
  });

  it('returns no neighbours above the top of the tronc', () => {
    const own = makeNode({ zone: FigureZone.TRONC, z: 5, x: 0, width: 1, sortOrder: 0 });
    const instance = makeInstance({ nodes: [own], assignments: [] });

    expect(findTroncNeighbours(own, instance).above).toEqual([]);
  });

  it('ignores unassigned overlapping nodes — there is nobody to name', () => {
    const below = makeNode({ zone: FigureZone.TRONC, z: 1, x: 0, width: 1, sortOrder: 0 });
    const own = makeNode({ zone: FigureZone.TRONC, z: 2, x: 0, width: 1, sortOrder: 0 });
    const instance = makeInstance({ nodes: [below, own], assignments: [] });

    expect(findTroncNeighbours(own, instance).below).toEqual([]);
  });
});

describe('describeOwnPlacement', () => {
  const toPlacement = (instance: ProjectionInstance, node: ProjectionInstance['nodes'][number], instanceIndex = 0): OwnPlacement => {
    const assignment = instance.assignments.find((a) => a.node.id === node.id);
    if (!assignment) throw new Error('fixture error: node has no assignment');
    return { instance, instanceIndex, node, assignment };
  };

  it('classifies a PINYA node as kind PINYA', () => {
    const node = makeNode({ zone: FigureZone.PINYA, label: 'Lateral' });
    const instance = makeInstance({ nodes: [node], assignments: [makeAssignment(node, 'me', 'Marta')] });

    const description = describeOwnPlacement(toPlacement(instance, node), 1);

    expect(description.kind).toBe('PINYA');
  });

  it('classifies a BASE node as kind PINYA — it is drawn on the canvas, not just the tronc panel', () => {
    const node = makeNode({ zone: FigureZone.BASE, label: 'Base' });
    const instance = makeInstance({ nodes: [node], assignments: [makeAssignment(node, 'me', 'Marta')] });

    const description = describeOwnPlacement(toPlacement(instance, node), 1);

    expect(description.kind).toBe('PINYA');
  });

  it('classifies a TRONC node as kind TRONC', () => {
    const node = makeNode({ zone: FigureZone.TRONC, label: 'Segons', z: 1 });
    const instance = makeInstance({ nodes: [node], assignments: [makeAssignment(node, 'me', 'Marta')] });

    const description = describeOwnPlacement(toPlacement(instance, node), 1);

    expect(description.kind).toBe('TRONC');
  });

  it.each([FigureZone.FIGURE_DIRECTION, FigureZone.XICALLA_DIRECTION])(
    'classifies a %s node as kind TRONC, with no floor neighbours',
    (zone) => {
      const node = makeNode({ zone, label: 'Cap' });
      const instance = makeInstance({ nodes: [node], assignments: [makeAssignment(node, 'me', 'Marta')] });

      const description = describeOwnPlacement(toPlacement(instance, node), 1);

      expect(description).toMatchObject({ kind: 'TRONC', below: [], above: [] });
    },
  );

  it('includes the figure name when the segment has more than one figure', () => {
    const node = makeNode({ zone: FigureZone.PINYA, label: 'Lateral' });
    const instance = makeInstance({
      id: 'instance-1',
      figureTemplate: { id: 't1', name: 'Roscana', hasPinya: true },
      nodes: [node],
      assignments: [makeAssignment(node, 'me', 'Marta')],
    });

    const description = describeOwnPlacement(toPlacement(instance, node), 2);

    expect(description.figureName).toBe('Roscana');
  });

  it('omits the figure name entirely when the segment holds a single figure', () => {
    const node = makeNode({ zone: FigureZone.PINYA, label: 'Lateral' });
    const instance = makeInstance({
      figureTemplate: { id: 't1', name: 'Roscana', hasPinya: true },
      nodes: [node],
      assignments: [makeAssignment(node, 'me', 'Marta')],
    });

    const description = describeOwnPlacement(toPlacement(instance, node), 1);

    expect(description.figureName).toBeNull();
  });

  it('carries the cordó and the rengla predecessor for a PINYA node', () => {
    const predecessor = makeNode({ zone: FigureZone.PINYA, renglaId: 'r1', renglaPosition: 1 });
    const node = makeNode({ zone: FigureZone.PINYA, label: 'Lateral', renglaId: 'r1', renglaPosition: 2 });
    const instance = makeInstance({
      nodes: [predecessor, node],
      assignments: [makeAssignment(predecessor, 'other', 'Anna'), makeAssignment(node, 'me', 'Marta')],
    });

    const description = describeOwnPlacement(toPlacement(instance, node), 1);

    expect(description).toMatchObject({ kind: 'PINYA', cordon: 2, behind: 'Anna' });
  });

  it('carries the tronc neighbours for a TRONC node', () => {
    const below = makeNode({ zone: FigureZone.TRONC, z: 1, x: 0, width: 1, sortOrder: 0 });
    const node = makeNode({ zone: FigureZone.TRONC, label: 'Segons', z: 2, x: 0, width: 1, sortOrder: 0 });
    const instance = makeInstance({
      nodes: [below, node],
      assignments: [makeAssignment(below, 'other', 'Joan'), makeAssignment(node, 'me', 'Marta')],
    });

    const description = describeOwnPlacement(toPlacement(instance, node), 1);

    expect(description).toMatchObject({ kind: 'TRONC', below: ['Joan'], above: [] });
  });
});
