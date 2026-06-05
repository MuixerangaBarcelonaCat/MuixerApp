import { describe, it, expect } from 'vitest';
import { FigureZone } from '@muixer/shared';
import { floorVariance, varianceLevel } from './floor-variance.util';
import { AssignmentDetail } from '../models/assignment.model';

function makeAssignment(nodeId: string, shoulderHeight: number | null): AssignmentDetail {
  return {
    id: `assign-${nodeId}`,
    figureInstanceId: 'instance-1',
    compositionSlotId: null,
    node: {
      id: nodeId,
      label: 'Node',
      zone: FigureZone.TRONC,
      z: 1,
      positionType: 'segon',
      sortOrder: 0,
      ringLevel: null,
      originNodeId: null,
      sourceNodeId: null,
    },
    person: {
      id: `person-${nodeId}`,
      alias: 'Alias',
      name: 'Test',
      firstSurname: 'Person',
      shoulderHeight,
    },
  };
}

describe('floorVariance', () => {
  it('returns null when 0 nodes have assignments', () => {
    expect(floorVariance(['node-1', 'node-2'], [])).toBeNull();
  });

  it('returns null when only 1 node is assigned', () => {
    const assignments = [makeAssignment('node-1', 165)];
    expect(floorVariance(['node-1', 'node-2'], assignments)).toBeNull();
  });

  it('returns null when assigned persons have null shoulderHeight', () => {
    const assignments = [
      makeAssignment('node-1', null),
      makeAssignment('node-2', null),
    ];
    expect(floorVariance(['node-1', 'node-2'], assignments)).toBeNull();
  });

  it('returns null when only 1 person has a height', () => {
    const assignments = [
      makeAssignment('node-1', 165),
      makeAssignment('node-2', null),
    ];
    expect(floorVariance(['node-1', 'node-2'], assignments)).toBeNull();
  });

  it('returns 0 when all heights are equal', () => {
    const assignments = [
      makeAssignment('node-1', 165),
      makeAssignment('node-2', 165),
    ];
    expect(floorVariance(['node-1', 'node-2'], assignments)).toBe(0);
  });

  it('returns the correct difference for two different heights', () => {
    const assignments = [
      makeAssignment('node-1', 160),
      makeAssignment('node-2', 165),
    ];
    expect(floorVariance(['node-1', 'node-2'], assignments)).toBe(5);
  });

  it('returns max - min across multiple assigned nodes', () => {
    const assignments = [
      makeAssignment('node-1', 155),
      makeAssignment('node-2', 165),
      makeAssignment('node-3', 170),
    ];
    expect(floorVariance(['node-1', 'node-2', 'node-3'], assignments)).toBe(15);
  });

  it('only considers nodes in the provided nodeIds list', () => {
    const assignments = [
      makeAssignment('node-1', 155),
      makeAssignment('node-2', 175), // not in the floor
    ];
    // Only node-1 is in this floor, so variance is null (< 2 assigned in floor)
    expect(floorVariance(['node-1'], assignments)).toBeNull();
  });

  it('correctly handles the boundary: exactly 2 assigned nodes', () => {
    const assignments = [
      makeAssignment('n1', 162),
      makeAssignment('n2', 164),
    ];
    expect(floorVariance(['n1', 'n2', 'n3'], assignments)).toBe(2);
  });
});

describe('varianceLevel', () => {
  it('returns "success" for 0 cm variance', () => {
    expect(varianceLevel(0)).toBe('success');
  });

  it('returns "success" for 2 cm variance (boundary)', () => {
    expect(varianceLevel(2)).toBe('success');
  });

  it('returns "warning" for 3 cm variance (boundary)', () => {
    expect(varianceLevel(3)).toBe('warning');
  });

  it('returns "warning" for 4 cm variance (boundary)', () => {
    expect(varianceLevel(4)).toBe('warning');
  });

  it('returns "error" for 5 cm variance (boundary)', () => {
    expect(varianceLevel(5)).toBe('error');
  });

  it('returns "error" for large variance', () => {
    expect(varianceLevel(20)).toBe('error');
  });
});
