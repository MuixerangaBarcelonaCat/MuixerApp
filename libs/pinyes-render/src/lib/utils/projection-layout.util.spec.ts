import { FigureZone, NodeShape } from '@muixer/shared';
import { InstanceNodeItem } from '../models/assignment.model';
import { ProjectionInstance } from '../models/projection.model';
import { computeInstanceNaturalExtent } from './projection-layout.util';

const makeNode = (overrides: Partial<InstanceNodeItem> = {}): InstanceNodeItem => ({
  id: `node-${Math.random()}`,
  label: '',
  zone: FigureZone.PINYA,
  positionType: null,
  x: 0, y: 0, z: 0,
  width: 60, height: 40, rotation: 0,
  color: null, shape: NodeShape.RECTANGLE,
  sortOrder: 0, climbIndicator: null, ringLevel: null,
  originNodeId: null, renglaId: null, renglaPosition: null,
  sourceNodeId: null, isSnapshotted: true, isAdHoc: false, createdById: null,
  ...overrides,
});

const makeInstance = (nodes: InstanceNodeItem[], overrides: Partial<ProjectionInstance> = {}): ProjectionInstance => ({
  id: 'inst-1',
  label: null,
  sortOrder: 0,
  numberOfCordons: null,
  projectionX: 0, projectionY: 0, projectionScale: 1,
  projectionAngle: 0,
  troncPanelX: null, troncPanelY: null, troncPanelWidth: null, troncPanelHeight: null,
  figureMode: 'COMPLETA',
  figureTemplate: { id: 'fig-1', name: 'pd4', hasPinya: true },
  nodes,
  assignments: [],
  ...overrides,
});

// What the API sends for a REMAT figure: no pinya drawn, so `hasPinya` is false.
const remat = (nodes: InstanceNodeItem[]) =>
  makeInstance(nodes, { figureMode: 'REMAT', figureTemplate: { id: 'fig-1', name: 'pd4', hasPinya: false } });

describe('computeInstanceNaturalExtent', () => {
  const tronc = () => makeNode({ zone: FigureZone.TRONC, z: 0, width: 1 });

  it('does not reserve a tronc-panel row for the base a REMAT figure hides', () => {
    const withHiddenBase = remat([tronc(), makeNode({ zone: FigureZone.BASE })]);
    const withoutBase = remat([tronc()]);

    expect(computeInstanceNaturalExtent(withHiddenBase).height).toBe(computeInstanceNaturalExtent(withoutBase).height);
  });

  it('still reserves the base row for a NETA figure, which shows its base', () => {
    const neta = (nodes: InstanceNodeItem[]) =>
      makeInstance(nodes, { figureMode: 'NETA', figureTemplate: { id: 'fig-1', name: 'pd4', hasPinya: false } });

    expect(computeInstanceNaturalExtent(neta([tronc(), makeNode({ zone: FigureZone.BASE })])).height).toBeGreaterThan(
      computeInstanceNaturalExtent(neta([tronc()])).height,
    );
  });

  it('makes room for the REMAT marker (a 240px circle) below the tronc panel', () => {
    const bare = computeInstanceNaturalExtent(remat([tronc()]));
    const troncOnly = computeInstanceNaturalExtent(
      makeInstance([tronc()], { figureTemplate: { id: 'fig-1', name: 'pd4', hasPinya: false } }),
    );

    expect(bare.height).toBe(troncOnly.height + 240);
  });

  it('makes room for the decoration nodes of a REMAT figure around its marker', () => {
    const bare = computeInstanceNaturalExtent(remat([tronc()]));
    const decorated = computeInstanceNaturalExtent(
      remat([tronc(), makeNode({ zone: FigureZone.DECORATION, isAdHoc: true, width: 900, height: 300 })]),
    );

    expect(decorated.width).toBe(900);
    expect(decorated.height).toBe(bare.height + 60);
  });
});
