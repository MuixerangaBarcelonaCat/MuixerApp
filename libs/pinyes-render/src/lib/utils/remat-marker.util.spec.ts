import { FigureZone, NodeShape } from '@muixer/shared';
import { getFigureTint } from './figure-palette.util';
import { isRematMarker, REMAT_MARKER_RADIUS, rematMarkerNode } from './remat-marker.util';
import { pivotNodesFor } from './segment-assignment-render.util';

const node = (id: string, zone: string, x: number, y: number, width: number, height: number, isAdHoc = false) => ({
  id,
  zone,
  x,
  y,
  width,
  height,
  isAdHoc,
});

const marker = (instanceId: string, figureMode: string, sortOrder: number, nodes: ReturnType<typeof node>[]) =>
  rematMarkerNode({ instanceId, figureMode, sortOrder, nodes });

describe('rematMarkerNode', () => {
  it('is null for every mode but REMAT', () => {
    for (const mode of ['COMPLETA', 'PEU', 'NETA']) {
      expect(marker('inst-1', mode, 0, [node('p1', 'PINYA', 0, 0, 10, 10)])).toBeNull();
    }
  });

  it('looks like a circular decoration node of radius 120 in the light tint of the figure color, with no text', () => {
    const remat = marker('inst-1', 'REMAT', 2, [])!;

    expect(REMAT_MARKER_RADIUS).toBe(120);
    expect(remat).toMatchObject({
      zone: FigureZone.DECORATION,
      shape: NodeShape.CIRCLE,
      width: 240,
      height: 240,
      rotation: 0,
      label: '',
      color: getFigureTint(2),
      isAdHoc: false,
    });
  });

  it('gets an id of its own per figure, so it never collides with a real node', () => {
    expect(marker('inst-1', 'REMAT', 0, [])!.id).not.toBe(marker('inst-2', 'REMAT', 0, [])!.id);
  });

  it('sits at the center of the figure\'s hidden PINYA+BASE nodes, where the figure stood before REMAT', () => {
    const remat = marker('inst-1', 'REMAT', 0, [
      node('p1', 'PINYA', 100, 200, 100, 100),
      node('b1', 'BASE', 300, 400, 100, 100),
      node('t1', 'TRONC', 5000, 5000, 1, 1),
      node('d1', 'DECORATION', -5000, -5000, 10, 10),
      node('x1', 'PINYA', 9000, 9000, 10, 10, true),
    ])!;

    expect([remat.x, remat.y]).toEqual([200, 300]);
  });

  it('sits at the origin when the figure has no PINYA/BASE node at all', () => {
    const remat = marker('inst-1', 'REMAT', 0, [node('t1', 'TRONC', 50, 50, 1, 1)])!;

    expect([remat.x, remat.y]).toEqual([0, 0]);
  });
});

describe('isRematMarker', () => {
  it('recognizes the marker and nothing else, not even a plain circular decoration', () => {
    expect(isRematMarker(marker('inst-1', 'REMAT', 0, [])!)).toBe(true);
    expect(isRematMarker({ positionType: 'circle' })).toBe(false);
    expect(isRematMarker({ positionType: null })).toBe(false);
  });
});

describe('pivotNodesFor with a REMAT marker', () => {
  it('counts the marker as the figure pivot, so placement and the tronc panel are built around it', () => {
    const remat = marker('inst-1', 'REMAT', 0, [])!;
    const decoration = { ...node('d1', 'DECORATION', 0, 0, 10, 10), positionType: 'circle' };

    expect(pivotNodesFor([remat, decoration])).toEqual([remat]);
  });
});
