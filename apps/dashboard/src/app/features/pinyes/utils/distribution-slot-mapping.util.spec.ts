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
  positionType: null,
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
  cordonsObertsEnabled: true,
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

  it('wraps fully-unplaced segments into multiple rows when one row would limit the zoom', () => {
    const items = Array.from({ length: 6 }, (_, i) => ({
      ...itemWithPosition(`f${i}`, null, null),
      figureTemplate: {
        id: `fig-${i}`,
        name: `f${i}`,
        nodes: [makeDistributionNode('n1', 'PINYA', { width: 400, height: 300 })],
      },
    }));

    const slots = mapDistributionItemsToSlots(items);

    expect(new Set(slots.map((s) => s.offsetY)).size).toBeGreaterThan(1);
  });

  it('gives fully-unplaced segments explicit non-overlapping tronc panel positions', () => {
    const items = ['a', 'b'].map((id) => ({
      ...itemWithPosition(id, null, null),
      figureTemplate: {
        id: `fig-${id}`,
        name: id,
        nodes: [makeDistributionNode('n1', 'PINYA', { width: 400, height: 300 })],
      },
    }));

    const [a, b] = mapDistributionItemsToSlots(items);

    expect(a.troncPanelX).not.toBeNull();
    expect(a.troncPanelY).not.toBeNull();
    expect(b.troncPanelX).not.toBeNull();
    expect(b.troncPanelY).not.toBeNull();
    expect({ x: a.troncPanelX, y: a.troncPanelY }).not.toEqual({ x: b.troncPanelX, y: b.troncPanelY });
  });

  it('adds the base row to troncGridRows so the panel size matches what projection renders', () => {
    const item = {
      ...itemWithPosition('a', 0, 0),
      troncGridRows: 3,
      figureTemplate: {
        id: 'fig-1',
        name: 'Pilar',
        nodes: [makeDistributionNode('p1', 'PINYA'), makeDistributionNode('b1', 'BASE')],
      },
    };

    const [slot] = mapDistributionItemsToSlots([item]);

    // Backend troncGridRows excludes the base row; the projected TroncView
    // panel adds one row for BASE nodes, so the slot must reserve it too.
    expect(slot.troncGridRows).toBe(4);
  });

  it('does not add a base row for REMAT instances (their base is hidden)', () => {
    const item = {
      ...itemWithPosition('a', 0, 0),
      troncGridRows: 3,
      figureMode: 'REMAT',
      figureTemplate: {
        id: 'fig-1',
        name: 'Pilar',
        nodes: [makeDistributionNode('p1', 'PINYA'), makeDistributionNode('b1', 'BASE')],
      },
    };

    const [slot] = mapDistributionItemsToSlots([item]);

    expect(slot.troncGridRows).toBe(3);
  });

  it('positions the figure by its PINYA+BASE bbox only, so a DECORATION node does not shift the pivot (must match the Konva renderer)', () => {
    // The Konva composition-slot renderer computes its rotation pivot
    // (slotGroup.offsetX/Y) from PINYA+BASE nodes only, excluding DECORATION;
    // if placement used a different pivot, everything the figure renders
    // (including its BASE nodes) would shift relative to what placement
    // assumed, misaligning the tronc panel against the real render.
    const pivotOnlyItems = [
      {
        ...itemWithPosition('a', null, null),
        figureTemplate: {
          id: 'fig-a',
          name: 'a',
          nodes: [makeDistributionNode('p1', 'PINYA', { x: 0, y: 0, width: 200, height: 100 })],
        },
      },
    ];
    const withDecorationItems = [
      {
        ...itemWithPosition('a', null, null),
        figureTemplate: {
          id: 'fig-a',
          name: 'a',
          nodes: [
            makeDistributionNode('p1', 'PINYA', { x: 0, y: 0, width: 200, height: 100 }),
            // Decoration far outside the PINYA bbox — must not move the pivot.
            makeDistributionNode('d1', 'DECORATION', { x: 900, y: 900, width: 100, height: 100 }),
          ],
        },
      },
    ];

    const [pivotOnly] = mapDistributionItemsToSlots(pivotOnlyItems);
    const [withDecoration] = mapDistributionItemsToSlots(withDecorationItems);

    expect(withDecoration.offsetX).toBe(pivotOnly.offsetX);
    expect(withDecoration.offsetY).toBe(pivotOnly.offsetY);
  });

  it('ignores TRONC-zone grid coordinates when computing auto-placement extents', () => {
    const items = [
      {
        ...itemWithPosition('a', null, null),
        figureTemplate: {
          id: 'fig-a',
          name: 'a',
          nodes: [
            makeDistributionNode('p1', 'PINYA', { width: 100, height: 100 }),
            // Tronc nodes use grid units, not canvas px; a stray large value
            // must not stretch the figure's placement footprint.
            makeDistributionNode('t1', 'TRONC', { x: 5000, y: 0, width: 1, height: 1 }),
          ],
        },
      },
      {
        ...itemWithPosition('b', null, null),
        figureTemplate: {
          id: 'fig-b',
          name: 'b',
          nodes: [makeDistributionNode('p2', 'PINYA', { width: 100, height: 100 })],
        },
      },
    ];

    const [, b] = mapDistributionItemsToSlots(items);

    // Without the stray TRONC coordinate both small figures share one row.
    expect(b.offsetY).toBe(0);
    expect(b.offsetX).toBeLessThan(1000);
  });

  it('keeps a stored tronc panel position on auto-placed items when one exists', () => {
    const items = [
      {
        ...itemWithPosition('a', null, null),
        troncPanelX: 500,
        troncPanelY: -300,
        figureTemplate: {
          id: 'fig-a',
          name: 'a',
          nodes: [makeDistributionNode('n1', 'PINYA', { width: 400, height: 300 })],
        },
      },
    ];

    const [slot] = mapDistributionItemsToSlots(items);

    expect(slot.troncPanelX).toBe(500);
    expect(slot.troncPanelY).toBe(-300);
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

  it('always includes a cordo-obert PINYA node even when its renglaPosition exceeds numberOfCordons', () => {
    const item = {
      ...itemWithPosition('a', 0, 0),
      numberOfCordons: 1,
      figureTemplate: {
        id: 'fig-1',
        name: 'Pilar',
        nodes: [
          makeDistributionNode('b1', 'BASE'),
          makeDistributionNode('n1', 'PINYA', { renglaId: 'r1', renglaPosition: 1 }),
          makeDistributionNode('n2', 'PINYA', { renglaId: 'r1', renglaPosition: 2, positionType: 'cordo-obert' }),
        ],
      },
    };

    const [slot] = mapDistributionItemsToSlots([item]);

    expect(slot.figureTemplate.nodes.map((n) => n.id).sort()).toEqual(['b1', 'n1', 'n2']);
  });

  it('excludes cordo-obert nodes entirely when cordonsObertsEnabled is false, regardless of numberOfCordons', () => {
    const item = {
      ...itemWithPosition('a', 0, 0),
      numberOfCordons: null,
      cordonsObertsEnabled: false,
      figureTemplate: {
        id: 'fig-1',
        name: 'Pilar',
        nodes: [
          makeDistributionNode('b1', 'BASE'),
          makeDistributionNode('n1', 'PINYA', { renglaId: 'r1', renglaPosition: 1 }),
          makeDistributionNode('n2', 'PINYA', { renglaId: 'r1', renglaPosition: 2, positionType: 'cordo-obert' }),
        ],
      },
    };

    const [slot] = mapDistributionItemsToSlots([item]);

    expect(slot.figureTemplate.nodes.map((n) => n.id).sort()).toEqual(['b1', 'n1']);
  });

  it('repositions a cordo-obert node to the position of the first hidden node in its rengla', () => {
    const item = {
      ...itemWithPosition('a', 0, 0),
      numberOfCordons: 1,
      figureTemplate: {
        id: 'fig-1',
        name: 'Pilar',
        nodes: [
          makeDistributionNode('n1', 'PINYA', { renglaId: 'r1', renglaPosition: 1, x: 10, y: 10 }),
          makeDistributionNode('n2', 'PINYA', { renglaId: 'r1', renglaPosition: 2, x: 20, y: 20 }),
          makeDistributionNode('co', 'PINYA', {
            renglaId: 'r1',
            renglaPosition: 3,
            positionType: 'cordo-obert',
            x: 30,
            y: 30,
          }),
        ],
      },
    };

    const [slot] = mapDistributionItemsToSlots([item]);

    const cordoObert = slot.figureTemplate.nodes.find((n) => n.id === 'co');
    expect(cordoObert?.x).toBe(20);
    expect(cordoObert?.y).toBe(20);
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
