import { describe, it, expect } from 'vitest';
import {
  boundingBoxCenter,
  buildSegmentRenderNodes,
  pivotNodesFor,
  stageToSlotLocal,
} from './segment-assignment-render.util';
import { CompositionSlotWithNodes } from '../components/figure-canvas/figure-canvas.component';
import { AssignmentDetail } from '../models/assignment.model';

const makeSlotNode = (id: string, overrides: Partial<Record<string, unknown>> = {}) => ({
  id,
  label: id,
  zone: 'PINYA',
  positionType: null,
  x: 0,
  y: 0,
  z: 0,
  width: 30,
  height: 30,
  rotation: 0,
  color: null,
  shape: 'RECTANGLE',
  sortOrder: 0,
  climbIndicator: null,
  ringLevel: null,
  originNodeId: null,
  renglaId: null,
  renglaPosition: null,
  ...overrides,
});

const makeSlot = (
  slotId: string,
  nodeIds: string[],
  overrides: Partial<CompositionSlotWithNodes> = {},
): CompositionSlotWithNodes => ({
  slotId,
  label: slotId,
  offsetX: 0,
  offsetY: 0,
  sortOrder: 0,
  angle: 0,
  figureTemplate: {
    id: `tpl-${slotId}`,
    name: slotId,
    hasPinya: true,
    nodes: nodeIds.map((id) => makeSlotNode(id)) as CompositionSlotWithNodes['figureTemplate']['nodes'],
  },
  ...overrides,
});

const makeAssignment = (id: string, instanceId: string, nodeId: string): AssignmentDetail => ({
  id,
  figureInstanceId: instanceId,
  node: {
    id: nodeId,
    label: nodeId,
    zone: 'PINYA',
    z: 0,
    positionType: null,
    sortOrder: 0,
    climbIndicator: null,
    ringLevel: null,
    originNodeId: null,
    sourceNodeId: null,
  },
  person: {
    id: `p-${id}`,
    alias: `Alias ${id}`,
    name: 'Nom',
    firstSurname: 'Cognom',
    shoulderHeight: null,
    notes: null,
    notesEmoji: null,
  },
});

describe('buildSegmentRenderNodes', () => {
  it('builds a render node per slot node with a composite key unique across slots', () => {
    // Two pre-snapshot instances of the same template share node ids.
    const slots = [makeSlot('inst-a', ['n1']), makeSlot('inst-b', ['n1'])];

    const result = buildSegmentRenderNodes(slots, [], null, new Set(), new Set());

    expect(result).toHaveLength(2);
    const keys = result.map((r) => r.key);
    expect(new Set(keys).size).toBe(2);
    expect(result.map((r) => r.slotId)).toEqual(['inst-a', 'inst-b']);
  });

  it('attaches an assignment only when both instance and node match', () => {
    const slots = [makeSlot('inst-a', ['n1']), makeSlot('inst-b', ['n1'])];
    const assignment = makeAssignment('as-1', 'inst-b', 'n1');

    const result = buildSegmentRenderNodes(slots, [assignment], null, new Set(), new Set());

    expect(result.find((r) => r.slotId === 'inst-a')?.assignment).toBeNull();
    expect(result.find((r) => r.slotId === 'inst-b')?.assignment).toBe(assignment);
  });

  it('marks selected only the node in the selected slot', () => {
    const slots = [makeSlot('inst-a', ['n1']), makeSlot('inst-b', ['n1'])];

    const result = buildSegmentRenderNodes(
      slots,
      [],
      { slotId: 'inst-b', nodeId: 'n1' },
      new Set(),
      new Set(),
    );

    expect(result.find((r) => r.slotId === 'inst-a')?.isSelected).toBe(false);
    expect(result.find((r) => r.slotId === 'inst-b')?.isSelected).toBe(true);
  });

  it('dims all nodes of dimmed slots', () => {
    const slots = [makeSlot('inst-a', ['n1', 'n2']), makeSlot('inst-b', ['n3'])];

    const result = buildSegmentRenderNodes(slots, [], null, new Set(['inst-a']), new Set());

    expect(result.filter((r) => r.isDimmed).map((r) => r.key).sort()).toEqual([
      'inst-a:n1',
      'inst-a:n2',
    ]);
  });

  it('marks highlighted nodes by node id', () => {
    const slots = [makeSlot('inst-a', ['n1', 'n2'])];

    const result = buildSegmentRenderNodes(slots, [], null, new Set(), new Set(['n2']));

    expect(result.find((r) => r.node.id === 'n2')?.isHighlighted).toBe(true);
    expect(result.find((r) => r.node.id === 'n1')?.isHighlighted).toBe(false);
  });

  it('orders nodes by slot sortOrder so lower slots paint first', () => {
    const slots = [
      makeSlot('inst-b', ['n2'], { sortOrder: 1 }),
      makeSlot('inst-a', ['n1'], { sortOrder: 0 }),
    ];

    const result = buildSegmentRenderNodes(slots, [], null, new Set(), new Set());

    expect(result.map((r) => r.slotId)).toEqual(['inst-a', 'inst-b']);
  });
});

describe('boundingBoxCenter', () => {
  it('returns the origin for an empty node set', () => {
    expect(boundingBoxCenter([])).toEqual({ x: 0, y: 0 });
  });

  it('returns the center of the union bounding box', () => {
    const center = boundingBoxCenter([
      { x: 0, y: 0, width: 20, height: 20 },
      { x: 100, y: 40, width: 20, height: 20 },
    ]);
    expect(center).toEqual({ x: 50, y: 20 });
  });
});

describe('pivotNodesFor', () => {
  it('keeps only PINYA and BASE nodes — matching the pivot every other canvas mode uses', () => {
    const nodes = [
      makeSlotNode('p1', { zone: 'PINYA' }),
      makeSlotNode('b1', { zone: 'BASE' }),
      makeSlotNode('d1', { zone: 'DECORATION' }),
      makeSlotNode('t1', { zone: 'TRONC' }),
    ];

    expect(pivotNodesFor(nodes).map((n) => n.id).sort()).toEqual(['b1', 'p1']);
  });

  it('returns an empty array when there are no PINYA/BASE nodes (e.g. a NETA figure)', () => {
    const nodes = [makeSlotNode('d1', { zone: 'DECORATION' })];

    expect(pivotNodesFor(nodes)).toEqual([]);
  });
});

describe('stageToSlotLocal', () => {
  it('subtracts the slot offset when there is no rotation and the pivot is at the origin', () => {
    const slot = makeSlot('inst-a', [], { offsetX: 100, offsetY: 50, angle: 0 });

    const result = stageToSlotLocal({ x: 110, y: 60 }, slot, { x: 0, y: 0 });

    expect(result).toEqual({ x: 10, y: 10 });
  });

  it('maps a click at the slot origin to the pivot', () => {
    const slot = makeSlot('inst-a', [], { offsetX: 500, offsetY: 300, angle: 0 });

    const result = stageToSlotLocal({ x: 500, y: 300 }, slot, { x: 100, y: 100 });

    expect(result).toEqual({ x: 100, y: 100 });
  });

  it('accounts for the slot rotation (inverse-rotates the click around the pivot)', () => {
    const slot = makeSlot('inst-a', [], { offsetX: 0, offsetY: 0, angle: 90 });

    const result = stageToSlotLocal({ x: 0, y: 10 }, slot, { x: 0, y: 0 });

    expect(result).toEqual({ x: 10, y: 0 });
  });
});
