import { describe, it, expect } from 'vitest';
import { computeSlotLabel, mapDistributionItemsToSlots } from './distribution-slot-mapping.util';
import { DistributionItem } from '../models/distribution.model';
import { DEFAULT_PLACEMENT_GAP } from './figure-placement.util';

const makeDistributionNode = (
  id: string,
  zone: string,
  overrides: Partial<DistributionItem['figureTemplate']['nodes'][number]> = {},
) => ({
  id,
  label: id,
  zone,
  x: 0,
  y: 0,
  width: 30,
  height: 30,
  rotation: 0,
  color: null,
  shape: 'RECTANGLE',
  renglaId: null,
  renglaPosition: null,
  ...overrides,
});

const itemWithPosition = (
  instanceId: string,
  x: number | null,
  y: number | null,
  angle: number | null = 0,
  overrides: Partial<DistributionItem> = {},
): DistributionItem => ({
  instanceId,
  label: null,
  figureMode: 'COMPLETA',
  numberOfCordons: null,
  assignments: [],
  figureTemplate: { id: 'fig-1', name: 'pd4', nodes: [] },
  troncGridCols: 2,
  troncGridRows: 3,
  projectionX: x,
  projectionY: y,
  projectionAngle: angle,
  troncPanelX: null,
  troncPanelY: null,
  troncPanelWidth: null,
  troncPanelHeight: null,
  ...overrides,
});

describe('mapDistributionItemsToSlots', () => {
  it('uses stored positions when projectionX is set', () => {
    const [slot] = mapDistributionItemsToSlots([itemWithPosition('a', 150, 250, 30)]);

    expect(slot.offsetX).toBe(150);
    expect(slot.offsetY).toBe(250);
    expect(slot.angle).toBe(30);
  });

  it('auto-places items in a row when projectionX is null', () => {
    const [a, b] = mapDistributionItemsToSlots([
      itemWithPosition('a', null, null),
      itemWithPosition('b', null, null),
    ]);

    expect(a.offsetX).toBe(0);
    expect(b.offsetX).toBeGreaterThan(0);
    expect(a.offsetY).toBe(0);
    expect(b.offsetY).toBe(0);
  });

  it('places an unpositioned item to the right of an already-positioned one', () => {
    const [, b] = mapDistributionItemsToSlots([
      {
        ...itemWithPosition('a', 400, 100, 0),
        figureTemplate: { id: 'fig-1', name: 'a', nodes: [makeDistributionNode('n1', 'PINYA', { x: 0, width: 100 })] },
      },
      itemWithPosition('b', null, null),
    ]);

    expect(b.offsetX).toBeGreaterThan(400 + 50 + DEFAULT_PLACEMENT_GAP - 1);
  });

  it('passes assignments through to the slot', () => {
    const item = {
      ...itemWithPosition('a', 0, 0),
      assignments: [{ figureNodeId: 'n1', personAlias: 'JoanP' }],
    };

    const [slot] = mapDistributionItemsToSlots([item]);

    expect(slot.assignments).toEqual([{ figureNodeId: 'n1', personAlias: 'JoanP' }]);
  });

  it('maps troncGridCols/Rows and troncPanelX/Y (including null for linked mode)', () => {
    const item = {
      ...itemWithPosition('a', 0, 0),
      troncGridCols: 3,
      troncGridRows: 5,
      troncPanelX: 50,
      troncPanelY: 80,
    };

    const [slot] = mapDistributionItemsToSlots([item]);

    expect(slot.troncGridCols).toBe(3);
    expect(slot.troncGridRows).toBe(5);
    expect(slot.troncPanelX).toBe(50);
    expect(slot.troncPanelY).toBe(80);
  });

  it('hides PINYA nodes whose renglaPosition exceeds numberOfCordons but always includes BASE', () => {
    const item = {
      ...itemWithPosition('a', 0, 0),
      numberOfCordons: 1,
      figureTemplate: {
        id: 'fig-1',
        name: 'Pilar',
        nodes: [
          makeDistributionNode('b1', 'BASE'),
          makeDistributionNode('n1', 'PINYA', { renglaId: 'r1', renglaPosition: 1 }),
          makeDistributionNode('n2', 'PINYA', { renglaId: 'r1', renglaPosition: 2 }),
        ],
      },
    };

    const [slot] = mapDistributionItemsToSlots([item]);

    expect(slot.figureTemplate.nodes.map((n) => n.id).sort()).toEqual(['b1', 'n1']);
  });
});

describe('computeSlotLabel', () => {
  it('uses the template name when label is null and figureMode is COMPLETA', () => {
    const item = itemWithPosition('a', 0, 0, 0, {
      figureMode: 'COMPLETA',
      label: null,
      figureTemplate: { id: 'fig-1', name: 'Pilar', nodes: [] },
    });
    expect(computeSlotLabel(item)).toBe('Pilar');
  });

  it('uses the instance label over the template name', () => {
    const item = itemWithPosition('a', 0, 0, 0, {
      figureMode: 'COMPLETA',
      label: 'Pilar central',
      figureTemplate: { id: 'fig-1', name: 'Pilar', nodes: [] },
    });
    expect(computeSlotLabel(item)).toBe('Pilar central');
  });

  it('prefixes "Peu de" when figureMode is PEU', () => {
    const item = itemWithPosition('a', 0, 0, 0, {
      figureMode: 'PEU',
      label: null,
      figureTemplate: { id: 'fig-1', name: 'Pilar', nodes: [] },
    });
    expect(computeSlotLabel(item)).toBe('Peu de Pilar');
  });

  it('prefixes "Remat de" when figureMode is REMAT', () => {
    const item = itemWithPosition('a', 0, 0, 0, {
      figureMode: 'REMAT',
      label: null,
      figureTemplate: { id: 'fig-1', name: 'Pilar', nodes: [] },
    });
    expect(computeSlotLabel(item)).toBe('Remat de Pilar');
  });

  it('adds "neta" suffix for a name ending in "a" when figureMode is NETA', () => {
    const item = itemWithPosition('a', 0, 0, 0, {
      figureMode: 'NETA',
      label: null,
      figureTemplate: { id: 'fig-1', name: 'Castella', nodes: [] },
    });
    expect(computeSlotLabel(item)).toBe('Castella neta');
  });

  it('adds "net" suffix for a non-feminine name when figureMode is NETA', () => {
    const item = itemWithPosition('a', 0, 0, 0, {
      figureMode: 'NETA',
      label: null,
      figureTemplate: { id: 'fig-1', name: 'Pilar', nodes: [] },
    });
    expect(computeSlotLabel(item)).toBe('Pilar net');
  });
});
