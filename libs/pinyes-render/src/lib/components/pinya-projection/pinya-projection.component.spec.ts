import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, input, output } from '@angular/core';
import { By } from '@angular/platform-browser';
import { FigureZone, NodeShape } from '@muixer/shared';
import { PinyaProjectionComponent, PINYA_FLIGHT_MAX_SCALE } from './pinya-projection.component';
import { allLucideIconsProvider } from '../../../testing/lucide-test-provider';
import {
  ProjectionInstance,
  ProjectionSegmentData,
  InstanceNodeItem,
  AssignmentDetail,
  CanvasNode,
  CanvasMode,
  FigureCanvasComponent,
  TroncNodeItem,
  TroncViewComponent,
  OwnPositionBannerComponent,
  OwnPositionMarkerComponent,
  findOwnTroncCellRect,
  computeDistributionTransform,
} from '../../../index';

@Component({ selector: 'app-figure-canvas', standalone: true, template: '' })
class FigureCanvasStub {
  readonly nodes = input<CanvasNode[]>([]);
  readonly mode = input<CanvasMode>('readonly');
  readonly assignments = input<AssignmentDetail[]>([]);
  readonly conflictPersonIds = input<Set<string>>(new Set());
  readonly gridEnabled = input<boolean>(true);
  readonly attendanceMap = input<Map<string, string>>(new Map());
  readonly isPast = input<boolean>(false);
  readonly fitExtraBounds = input<{ x: number; y: number; width: number; height: number }[]>([]);
  readonly outlineBoxes = input<unknown[]>([]);
  readonly showZoomControls = input<boolean>(true);
  readonly flightLanded = output<void>();
  readonly flyToBounds = jest.fn();
  readonly cancelFlight = jest.fn();
}

@Component({ selector: 'app-tronc-view', standalone: true, template: '' })
class TroncViewStub {
  readonly troncNodes = input<TroncNodeItem[]>([]);
  readonly baseNodes = input<TroncNodeItem[]>([]);
  readonly directionNodes = input<TroncNodeItem[]>([]);
  readonly assignments = input<AssignmentDetail[]>([]);
  readonly conflictPersonIds = input<Set<string>>(new Set());
  readonly mode = input<string>('projection');
  readonly isNetaFigure = input<boolean>(false);
  readonly attendanceMap = input<Map<string, string>>(new Map());
  readonly isPast = input<boolean>(false);
  readonly panelColor = input<string>('');
  readonly panelBorderColor = input<string>('');
  readonly figureName = input<string>('');
}

// ── Factories ────────────────────────────────────────────────────────────────

const makeNode = (overrides: Partial<InstanceNodeItem> = {}): InstanceNodeItem => ({
  id: `node-${Math.random()}`,
  label: 'vent-1',
  zone: FigureZone.PINYA,
  positionType: 'mans',
  x: 100, y: 100, z: 0,
  width: 60, height: 40, rotation: 0,
  color: null, shape: NodeShape.ELLIPSE,
  sortOrder: 0, climbIndicator: null, ringLevel: null,
  originNodeId: null, renglaId: null, renglaPosition: null,
  sourceNodeId: null, isSnapshotted: true, isAdHoc: false, createdById: null,
  ...overrides,
});

const makeAssignment = (nodeId: string): AssignmentDetail => ({
  id: `asgn-${nodeId}`,
  figureInstanceId: 'inst-1',
  node: { id: nodeId, label: '', zone: FigureZone.PINYA, z: 0, positionType: null, sortOrder: 0, climbIndicator: null, ringLevel: null, originNodeId: null, sourceNodeId: null },
  person: { id: 'p1', alias: 'Pepet', name: 'Pere', firstSurname: 'G', shoulderHeight: null, notes: null, notesEmoji: null },
});

const makeInstance = (nodes: InstanceNodeItem[], assignedIds: string[], overrides: Partial<ProjectionInstance> = {}): ProjectionInstance => ({
  id: 'inst-1',
  label: null,
  sortOrder: 0,
  numberOfCordons: null,
  projectionX: null, projectionY: null, projectionScale: 1,
  projectionAngle: 0,
  troncPanelX: null, troncPanelY: null, troncPanelWidth: null, troncPanelHeight: null,
  figureMode: 'COMPLETA',
  figureTemplate: { id: 'fig-1', name: 'pd4', hasPinya: true },
  nodes,
  assignments: assignedIds.map(makeAssignment),
  ...overrides,
});

const makeSegmentData = (
  instances: ProjectionInstance[],
  overrides: Partial<ProjectionSegmentData> = {},
): ProjectionSegmentData => ({
  segment: { id: 's1', name: null, sortOrder: 0, prevSegmentId: null, nextSegmentId: null },
  instances,
  personAttendance: {},
  hasDistribution: false,
  conflicts: [],
  ...overrides,
});

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('PinyaProjectionComponent', () => {
  let fixture: ComponentFixture<PinyaProjectionComponent>;
  let component: PinyaProjectionComponent;

  const setData = (data: ProjectionSegmentData) => {
    fixture.componentRef.setInput('data', data);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    class ResizeObserverStub {
      observe = jest.fn();
      unobserve = jest.fn();
      disconnect = jest.fn();
    }
    (globalThis as unknown as Record<string, unknown>)['ResizeObserver'] = ResizeObserverStub;

    await TestBed.configureTestingModule({
      imports: [PinyaProjectionComponent],
      providers: [allLucideIconsProvider],
    })
      .overrideComponent(PinyaProjectionComponent, {
        remove: { imports: [FigureCanvasComponent, TroncViewComponent] },
        add: { imports: [FigureCanvasStub, TroncViewStub] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PinyaProjectionComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('data', makeSegmentData([]));
    fixture.detectChanges();
  });

  // ── instanceId reactivity (design decision 6) ───────────────────────────────

  describe('instanceId', () => {
    it('shows all instances when instanceId is null', () => {
      const a = makeInstance([], [], { id: 'a' });
      const b = makeInstance([], [], { id: 'b' });
      setData(makeSegmentData([a, b]));

      expect(component.filteredInstances().map((i) => i.id)).toEqual(['a', 'b']);
    });

    it('filters to one instance when instanceId is set', () => {
      const a = makeInstance([], [], { id: 'a' });
      const b = makeInstance([], [], { id: 'b' });
      setData(makeSegmentData([a, b]));
      fixture.componentRef.setInput('instanceId', 'b');
      fixture.detectChanges();

      expect(component.filteredInstances().map((i) => i.id)).toEqual(['b']);
    });

    it('re-filters when instanceId changes after data is already set (both signals tracked)', () => {
      const a = makeInstance([], [], { id: 'a' });
      const b = makeInstance([], [], { id: 'b' });
      setData(makeSegmentData([a, b]));

      // instanceId starts null → unfiltered.
      expect(component.filteredInstances().map((i) => i.id)).toEqual(['a', 'b']);

      fixture.componentRef.setInput('instanceId', 'a');
      fixture.detectChanges();
      expect(component.filteredInstances().map((i) => i.id)).toEqual(['a']);

      // Switching data (new segment) while instanceId is still set must re-evaluate too.
      const c = makeInstance([], [], { id: 'a' });
      const d = makeInstance([], [], { id: 'd' });
      setData(makeSegmentData([c, d]));
      expect(component.filteredInstances().map((i) => i.id)).toEqual(['a']);
    });
  });

  // ── showZoomControls (forwarded to FigureCanvasComponent) ───────────────────

  describe('showZoomControls', () => {
    it('defaults to true, forwarded to the figure canvas', () => {
      const canvas = fixture.debugElement.query(By.directive(FigureCanvasStub));
      expect(canvas.componentInstance.showZoomControls()).toBe(true);
    });

    it('forwards false to the figure canvas when set', () => {
      fixture.componentRef.setInput('showZoomControls', false);
      fixture.detectChanges();

      const canvas = fixture.debugElement.query(By.directive(FigureCanvasStub));
      expect(canvas.componentInstance.showZoomControls()).toBe(false);
    });
  });

  // ── attendanceMap ────────────────────────────────────────────────────────────

  describe('attendanceMap', () => {
    it('is empty map when personAttendance is not provided', () => {
      expect(component.attendanceMap().size).toBe(0);
    });

    it('builds Map from personAttendance object', () => {
      setData(makeSegmentData([], { personAttendance: { 'person-1': 'ASSISTIT', 'person-2': 'NO_VAIG' } }));

      const map = component.attendanceMap();
      expect(map.get('person-1')).toBe('ASSISTIT');
      expect(map.get('person-2')).toBe('NO_VAIG');
    });

    it('returns an empty map when personAttendance is empty', () => {
      setData(makeSegmentData([], { personAttendance: {} }));
      expect(component.attendanceMap().size).toBe(0);
    });
  });

  // ── getInstanceProjectionNodes ───────────────────────────────────────────────

  describe('getInstanceProjectionNodes', () => {
    it('excludes TRONC nodes', () => {
      const pinya = makeNode({ id: 'p1', zone: FigureZone.PINYA });
      const tronc = makeNode({ id: 't1', zone: FigureZone.TRONC });
      const instance = makeInstance([pinya, tronc], ['p1']);

      const result = component.getInstanceProjectionNodes(instance);

      expect(result.map((n) => n.id)).toEqual(['p1']);
    });

    it('excludes unassigned PINYA nodes', () => {
      const assigned = makeNode({ id: 'p1', zone: FigureZone.PINYA });
      const unassigned = makeNode({ id: 'p2', zone: FigureZone.PINYA });
      const instance = makeInstance([assigned, unassigned], ['p1']);

      const result = component.getInstanceProjectionNodes(instance);

      expect(result.map((n) => n.id)).toEqual(['p1']);
    });

    it('includes BASE but excludes DIRECTION nodes', () => {
      const base = makeNode({ id: 'b1', zone: FigureZone.BASE });
      const dir = makeNode({ id: 'd1', zone: FigureZone.FIGURE_DIRECTION });
      const pinya = makeNode({ id: 'p1', zone: FigureZone.PINYA });
      const instance = makeInstance([base, dir, pinya], ['p1']);

      const result = component.getInstanceProjectionNodes(instance);

      expect(result.map((n) => n.id)).toEqual(['b1', 'p1']);
    });

    it('keeps DECORATION nodes regardless of assignment', () => {
      const deco = makeNode({ id: 'dec1', zone: FigureZone.DECORATION });
      const pinya = makeNode({ id: 'p1', zone: FigureZone.PINYA });
      const instance = makeInstance([deco, pinya], ['p1']);

      const result = component.getInstanceProjectionNodes(instance);

      expect(result.map((n) => n.id)).toEqual(['dec1', 'p1']);
    });
  });

  // ── getInstanceDirectionNodes ───────────────────────────────────────────────

  describe('getInstanceDirectionNodes', () => {
    it('extracts FIGURE_DIRECTION and XICALLA_DIRECTION nodes', () => {
      const figDir = makeNode({ id: 'fd1', zone: FigureZone.FIGURE_DIRECTION });
      const xicDir = makeNode({ id: 'xd1', zone: FigureZone.XICALLA_DIRECTION });
      const tronc = makeNode({ id: 't1', zone: FigureZone.TRONC });
      const pinya = makeNode({ id: 'p1', zone: FigureZone.PINYA });
      const instance = makeInstance([figDir, xicDir, tronc, pinya], []);

      const result = component.getInstanceDirectionNodes(instance);
      expect(result.map((n) => n.id)).toEqual(['fd1', 'xd1']);
    });

    it('returns empty array when no direction nodes exist', () => {
      const tronc = makeNode({ id: 't1', zone: FigureZone.TRONC });
      const instance = makeInstance([tronc], []);

      expect(component.getInstanceDirectionNodes(instance)).toEqual([]);
    });
  });

  // ── cordo-obert collapse ─────────────────────────────────────────────────────

  describe('cordo-obert position collapse', () => {
    it('does not move cordo-obert when all rengla slots are assigned', () => {
      const vent1 = makeNode({ id: 'v1', renglaId: 'r1', renglaPosition: 1, x: 100, y: 100 });
      const vent2 = makeNode({ id: 'v2', renglaId: 'r1', renglaPosition: 2, x: 150, y: 100 });
      const co   = makeNode({ id: 'co', renglaId: 'r1', renglaPosition: 3, positionType: 'cordo-obert', x: 200, y: 100 });
      const instance = makeInstance([vent1, vent2, co], ['v1', 'v2', 'co']);

      const result = component.getInstanceProjectionNodes(instance);
      const coResult = result.find((n) => n.id === 'co')!;

      expect(coResult.x).toBe(200);
      expect(coResult.y).toBe(100);
    });

    it('moves assigned cordo-obert to the first unassigned slot', () => {
      const vent1 = makeNode({ id: 'v1', renglaId: 'r1', renglaPosition: 1, x: 100, y: 100 });
      const vent2 = makeNode({ id: 'v2', renglaId: 'r1', renglaPosition: 2, x: 150, y: 100 });
      const vent3 = makeNode({ id: 'v3', renglaId: 'r1', renglaPosition: 3, x: 200, y: 100 });
      const co   = makeNode({ id: 'co', renglaId: 'r1', renglaPosition: 4, positionType: 'cordo-obert', x: 250, y: 100 });
      const instance = makeInstance([vent1, vent2, vent3, co], ['v1', 'co']);

      const result = component.getInstanceProjectionNodes(instance);
      const coResult = result.find((n) => n.id === 'co')!;

      expect(coResult.x).toBe(150);
      expect(coResult.y).toBe(100);
    });

    it('does not move cordo-obert when it is unassigned', () => {
      const vent1 = makeNode({ id: 'v1', renglaId: 'r1', renglaPosition: 1, x: 100, y: 100 });
      const vent2 = makeNode({ id: 'v2', renglaId: 'r1', renglaPosition: 2, x: 150, y: 100 });
      const co   = makeNode({ id: 'co', renglaId: 'r1', renglaPosition: 3, positionType: 'cordo-obert', x: 200, y: 100 });
      const instance = makeInstance([vent1, vent2, co], ['v1']);

      const result = component.getInstanceProjectionNodes(instance);
      expect(result.find((n) => n.id === 'co')).toBeUndefined();
    });

    it('handles multiple rengles independently', () => {
      const r1v1 = makeNode({ id: 'r1v1', renglaId: 'r1', renglaPosition: 1, x: 100, y: 100 });
      const r1v2 = makeNode({ id: 'r1v2', renglaId: 'r1', renglaPosition: 2, x: 150, y: 100 });
      const r1co = makeNode({ id: 'r1co', renglaId: 'r1', renglaPosition: 3, positionType: 'cordo-obert', x: 200, y: 100 });
      const r2v1 = makeNode({ id: 'r2v1', renglaId: 'r2', renglaPosition: 1, x: 100, y: 200 });
      const r2co = makeNode({ id: 'r2co', renglaId: 'r2', renglaPosition: 2, positionType: 'cordo-obert', x: 150, y: 200 });

      const instance = makeInstance([r1v1, r1v2, r1co, r2v1, r2co], ['r1v1', 'r1co', 'r2v1', 'r2co']);

      const result = component.getInstanceProjectionNodes(instance);

      expect(result.find((n) => n.id === 'r1co')!.x).toBe(150);
      expect(result.find((n) => n.id === 'r2co')!.x).toBe(150);
      expect(result.find((n) => n.id === 'r2co')!.y).toBe(200);
    });
  });

  // ── effectivePositions / effectiveInstances ─────────────────────────────────

  describe('effectivePositions', () => {
    it('keeps the stored position when projectionX is set', () => {
      const inst = makeInstance([], [], { id: 'inst-A', projectionX: 100, projectionY: 200, projectionAngle: 30 });
      setData(makeSegmentData([inst], { hasDistribution: true }));
      expect(component.effectivePositions().get('inst-A')).toEqual({ x: 100, y: 200, angle: 30 });
    });

    it('auto-places instances with no saved position in reading order (right of, or below, the previous one)', () => {
      const inst1 = makeInstance([makeNode({ zone: FigureZone.PINYA })], [], { id: 'i1', projectionX: null });
      const inst2 = makeInstance([makeNode({ zone: FigureZone.PINYA })], [], { id: 'i2', projectionX: null });
      setData(makeSegmentData([inst1, inst2]));
      const positions = component.effectivePositions();
      const p1 = positions.get('i1');
      const p2 = positions.get('i2');
      expect(p1).toBeDefined();
      expect(p2).toBeDefined();
      const sameRow = p2!.y === p1!.y;
      expect(sameRow ? p2!.x > p1!.x : p2!.y > p1!.y).toBe(true);
    });

    it('wraps fully-unplaced segments into multiple rows when one row would limit the fit-to-screen zoom', () => {
      const instances = ['i1', 'i2', 'i3', 'i4', 'i5', 'i6'].map((id) =>
        makeInstance([makeNode({ zone: FigureZone.PINYA, width: 400, height: 300 })], [], {
          id,
          projectionX: null,
        }),
      );
      setData(makeSegmentData(instances));

      const positions = component.effectivePositions();
      const ys = new Set([...positions.values()].map((p) => p.y));
      expect(ys.size).toBeGreaterThan(1);
    });

    it('places a mock instance to the right of an already-distributed one, without overlap', () => {
      const stored = makeInstance([makeNode({ zone: FigureZone.PINYA, width: 200, height: 200 })], [], {
        id: 'stored',
        projectionX: 0,
        projectionY: 0,
      });
      const mock = makeInstance([makeNode({ zone: FigureZone.PINYA })], [], { id: 'mock', projectionX: null });
      setData(makeSegmentData([stored, mock], { hasDistribution: true }));
      const positions = component.effectivePositions();
      expect(positions.get('mock')!.x).toBeGreaterThan(positions.get('stored')!.x);
    });
  });

  describe('effectiveInstances', () => {
    it('fills in projectionX/Y/Angle for instances with no saved position', () => {
      const inst = makeInstance([makeNode({ zone: FigureZone.PINYA })], [], { id: 'i1', projectionX: null });
      setData(makeSegmentData([inst]));
      const [effective] = component.effectiveInstances();
      expect(effective.projectionX).not.toBeNull();
      expect(effective.projectionY).not.toBeNull();
    });

    it('fills in troncPanelX/Y for fully-unplaced segments so tronc panels render detached', () => {
      const nodes = [
        makeNode({ id: 'p1', zone: FigureZone.PINYA, x: 200, y: 150, width: 400, height: 300 }),
        makeNode({ id: 'b1', zone: FigureZone.BASE, x: 200, y: 320, width: 100, height: 40 }),
        makeNode({ id: 't1', zone: FigureZone.TRONC, x: 0, y: 0, z: 0, width: 2, height: 1 }),
      ];
      setData(makeSegmentData([makeInstance(nodes, [], { id: 'i1', projectionX: null })]));

      const [effective] = component.effectiveInstances();
      expect(effective.troncPanelX).not.toBeNull();
      expect(effective.troncPanelY).not.toBeNull();
    });

    it('does not waste packing space on an unassigned PINYA node (occupancy, not the raw pivot, drives spacing)', () => {
      const small = makeNode({ id: 'small', zone: FigureZone.PINYA, x: 50, y: 50, width: 100, height: 100 });
      const unassignedPinya = makeNode({
        id: 'unassigned',
        zone: FigureZone.PINYA,
        x: 1000,
        y: 1000,
        width: 2000,
        height: 2000,
      });
      const a = makeInstance([small, unassignedPinya], ['small'], { id: 'a', projectionX: null, numberOfCordons: 1 });
      const b = makeInstance(
        [makeNode({ id: 'b-small', zone: FigureZone.PINYA, x: 50, y: 50, width: 100, height: 100 })],
        ['b-small'],
        { id: 'b', projectionX: null },
      );
      setData(makeSegmentData([a, b]));

      const positions = component.effectivePositions();
      expect(positions.get('b')!.x).toBeLessThan(500);
    });

    it('always includes BASE nodes in the pivot bbox, even when unassigned', () => {
      const a = makeInstance(
        [makeNode({ id: 'base', zone: FigureZone.BASE, x: 1000, y: 1000, width: 1800, height: 1800 })],
        [],
        { id: 'a', projectionX: null },
      );
      const b = makeInstance(
        [makeNode({ id: 'b-small', zone: FigureZone.PINYA, x: 50, y: 50, width: 100, height: 100 })],
        ['b-small'],
        { id: 'b', projectionX: null },
      );
      setData(makeSegmentData([a, b]));

      const positions = component.effectivePositions();
      expect(positions.get('b')!.x).toBeGreaterThan(1500);
    });

    it('still blocks tronc placement with a DECORATION node, even though it is excluded from the pivot bbox', () => {
      const nodes = [
        makeNode({ id: 'p1', zone: FigureZone.PINYA, x: 0, y: 0, width: 600, height: 400 }),
        makeNode({ id: 'd1', zone: FigureZone.DECORATION, x: -450, y: 0, width: 300, height: 400 }),
      ];
      const troncNode = makeNode({ id: 't1', zone: FigureZone.TRONC, x: 0, y: 0, z: 0, width: 2, height: 1 });
      const a = makeInstance([...nodes, troncNode], ['p1'], { id: 'a', projectionX: null });
      setData(makeSegmentData([a]));

      const [effective] = component.effectiveInstances();
      expect(effective.troncPanelX).not.toBeNull();
      const pivotX = component.effectivePositions().get('a')!.x;
      const pivotY = component.effectivePositions().get('a')!.y;
      const decoBox = { left: pivotX - 450 - 150, right: pivotX - 450 + 150, top: pivotY - 200, bottom: pivotY + 200 };
      const { naturalW, naturalH } = component['getTroncPanelNaturalSize'](effective);
      const troncBox = {
        left: effective.troncPanelX as number,
        right: (effective.troncPanelX as number) + naturalW,
        top: effective.troncPanelY as number,
        bottom: (effective.troncPanelY as number) + naturalH,
      };
      const overlaps =
        troncBox.left < decoBox.right &&
        decoBox.left < troncBox.right &&
        troncBox.top < decoBox.bottom &&
        decoBox.top < troncBox.bottom;
      expect(overlaps).toBe(false);
    });
  });

  // ── distributionNodes ────────────────────────────────────────────────────────

  describe('distributionNodes', () => {
    it('mock-places and renders nodes even when no distribution was ever saved', () => {
      setData(makeSegmentData([makeInstance([makeNode({ id: 'n1', zone: FigureZone.PINYA })], ['n1'])]));
      expect(component.distributionNodes().length).toBe(1);
    });

    it('returns combined nodes from all instances when hasDistribution is true', () => {
      const n1 = makeNode({ id: 'n1', zone: FigureZone.PINYA, x: 0, y: 0 });
      const n2 = makeNode({ id: 'n2', zone: FigureZone.PINYA, x: 0, y: 0 });
      const inst1 = makeInstance([n1], ['n1'], { id: 'i1', projectionX: 0, projectionY: 0 });
      const inst2 = makeInstance([n2], ['n2'], { id: 'i2', projectionX: 300, projectionY: 0 });
      setData(makeSegmentData([inst1, inst2], { hasDistribution: true }));
      expect(component.distributionNodes().length).toBe(2);
    });

    it('applies projectionX/Y offset so horizontally-separated instances produce different node x positions', () => {
      const n1 = makeNode({ id: 'n1', zone: FigureZone.PINYA, x: 0, y: 0 });
      const n2 = makeNode({ id: 'n2', zone: FigureZone.PINYA, x: 0, y: 0 });
      const inst1 = makeInstance([n1], ['n1'], { id: 'i1', projectionX: 0, projectionY: 0 });
      const inst2 = makeInstance([n2], ['n2'], { id: 'i2', projectionX: 400, projectionY: 0 });
      setData(makeSegmentData([inst1, inst2], { hasDistribution: true }));
      const nodes = component.distributionNodes();
      const xValues = nodes.map((n) => n.x);
      expect(xValues[0]).not.toEqual(xValues[1]);
    });
  });

  // ── distributionAssignments ──────────────────────────────────────────────────

  describe('distributionAssignments', () => {
    it('returns assignments even when no distribution was ever saved', () => {
      const inst = makeInstance([], ['n1'], { id: 'i1' });
      setData(makeSegmentData([inst]));
      expect(component.distributionAssignments().length).toBe(1);
    });

    it('returns assignments from all instances when hasDistribution is true', () => {
      const inst1 = makeInstance([], ['n1'], { id: 'i1' });
      const inst2 = makeInstance([], ['n2'], { id: 'i2' });
      setData(makeSegmentData([inst1, inst2], { hasDistribution: true }));
      expect(component.distributionAssignments().length).toBe(2);
    });
  });

  // ── highlightPersonId / own-position banner ──────────────────────────────────

  describe('highlightPersonId', () => {
    it('renders no banner when highlightPersonId is null (the default)', () => {
      const inst = makeInstance([makeNode({ id: 'n1' })], ['n1'], { id: 'i1' });
      setData(makeSegmentData([inst]));

      expect(fixture.debugElement.query(By.directive(OwnPositionBannerComponent))).toBeNull();
    });

    it('renders the banner, fed the derived description, when highlightPersonId matches an assignment', () => {
      const node = makeNode({ id: 'n1', label: 'Lateral' });
      const inst = makeInstance([node], ['n1'], { id: 'i1' });
      setData(makeSegmentData([inst]));
      fixture.componentRef.setInput('highlightPersonId', 'p1');
      fixture.detectChanges();

      const banner = fixture.debugElement.query(By.directive(OwnPositionBannerComponent));
      expect(banner.componentInstance.state()).toEqual({
        kind: 'PINYA',
        instanceIndex: 0,
        nodeLabel: 'Lateral',
        cordon: null,
        figureName: null,
        behind: null,
      });
    });

    it('feeds the banner a NONE state when highlightPersonId matches nobody in this segment', () => {
      const inst = makeInstance([makeNode({ id: 'n1' })], [], { id: 'i1' });
      setData(makeSegmentData([inst]));
      fixture.componentRef.setInput('highlightPersonId', 'someone-else');
      fixture.detectChanges();

      const banner = fixture.debugElement.query(By.directive(OwnPositionBannerComponent));
      expect(banner.componentInstance.state()).toEqual({ kind: 'NONE' });
    });
  });

  // ── ownPositionTarget / the marker ───────────────────────────────────────────

  describe('ownPositionTarget', () => {
    it('renders no marker when there is no own-position state', () => {
      const inst = makeInstance([makeNode({ id: 'n1' })], [], { id: 'i1' });
      setData(makeSegmentData([inst]));

      expect(fixture.debugElement.query(By.directive(OwnPositionMarkerComponent))).toBeNull();
    });

    it('targets the distribution-adjusted node for a PINYA placement', () => {
      const node = makeNode({ id: 'n1', zone: FigureZone.PINYA, x: 100, y: 50 });
      const inst = makeInstance([node], ['n1'], { id: 'i1' });
      setData(makeSegmentData([inst]));
      fixture.componentRef.setInput('highlightPersonId', 'p1');
      fixture.detectChanges();

      const distNode = component.distributionNodes().find((n) => n.id === 'n1')!;
      const marker = fixture.debugElement.query(By.directive(OwnPositionMarkerComponent));
      expect(marker.componentInstance.target()).toEqual({ kind: 'world', x: distNode.x, y: distNode.y });
    });

    it("targets the caller's own cell centre for a TRONC placement, not the panel as a whole", () => {
      const node = makeNode({ id: 'n1', zone: FigureZone.TRONC, z: 1, x: 0, width: 1 });
      const inst = makeInstance([node], ['n1'], { id: 'i1' });
      setData(makeSegmentData([inst]));
      fixture.componentRef.setInput('highlightPersonId', 'p1');
      fixture.detectChanges();

      const panel = component.distributionTroncPanels().find((p) => p.instance.id === 'i1')!;
      const cell = findOwnTroncCellRect(node, inst);
      const marker = fixture.debugElement.query(By.directive(OwnPositionMarkerComponent));
      expect(marker.componentInstance.target()).toEqual({
        kind: 'screen',
        x: panel.screenX + (cell.x + cell.width / 2) * panel.scale,
        y: panel.screenY + (cell.y + cell.height / 2) * panel.scale,
      });
    });

    it('renders no marker for the MULTIPLE state — pointing at one of several would mislead', () => {
      const n1 = makeNode({ id: 'n1' });
      const n2 = makeNode({ id: 'n2' });
      const inst1 = makeInstance([n1], ['n1'], { id: 'i1' });
      const inst2 = makeInstance([n2], ['n2'], { id: 'i2' });
      setData(makeSegmentData([inst1, inst2]));
      fixture.componentRef.setInput('highlightPersonId', 'p1');
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.directive(OwnPositionMarkerComponent))).toBeNull();
    });

    it('renders no marker for the NONE state', () => {
      const inst = makeInstance([makeNode({ id: 'n1' })], [], { id: 'i1' });
      setData(makeSegmentData([inst]));
      fixture.componentRef.setInput('highlightPersonId', 'someone-else');
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.directive(OwnPositionMarkerComponent))).toBeNull();
    });

    it('passes the live stage transform through to the marker', () => {
      const node = makeNode({ id: 'n1' });
      const inst = makeInstance([node], ['n1'], { id: 'i1' });
      setData(makeSegmentData([inst]));
      fixture.componentRef.setInput('highlightPersonId', 'p1');
      fixture.detectChanges();

      component.onStageTransformChanged({ x: 10, y: 20, scaleX: 2, scaleY: 2 });
      fixture.detectChanges();

      const marker = fixture.debugElement.query(By.directive(OwnPositionMarkerComponent));
      expect(marker.componentInstance.stageTransform()).toEqual({ x: 10, y: 20, scaleX: 2, scaleY: 2 });
    });
  });

  // ── flight (Troba'm motion) ──────────────────────────────────────────────────

  describe('flight', () => {
    const arrive = () => {
      component.onStageTransformChanged({ x: 0, y: 0, scaleX: 1, scaleY: 1 });
      fixture.detectChanges();
    };

    it('flies to the node, tight, for a PINYA placement on arrival', () => {
      const node = makeNode({ id: 'n1', zone: FigureZone.PINYA, x: 100, y: 50 });
      const inst = makeInstance([node], ['n1'], { id: 'i1' });
      setData(makeSegmentData([inst]));
      fixture.componentRef.setInput('highlightPersonId', 'p1');
      fixture.detectChanges();
      arrive();

      const distNode = component.distributionNodes().find((n) => n.id === 'n1')!;
      const { scale: distScale } = computeDistributionTransform(
        component.effectiveInstances(),
        component.containerWidth(),
        component.containerHeight(),
      );
      const canvas = fixture.debugElement.query(By.directive(FigureCanvasStub));
      expect(canvas.componentInstance.flyToBounds).toHaveBeenCalledTimes(1);
      expect(canvas.componentInstance.flyToBounds).toHaveBeenCalledWith(
        [{ x: distNode.x, y: distNode.y, width: distNode.width, height: distNode.height }],
        expect.objectContaining({ maxScale: PINYA_FLIGHT_MAX_SCALE / distScale }),
      );
    });

    it('caps the PINYA flight at the same absolute on-screen size regardless of segment size', () => {
      // A segment with one tiny figure gets a large, uncapped `distScale` (computeDistributionTransform
      // inflates small content to fill the viewport) — without normalising against it, the same literal
      // `maxScale` would land on a very different absolute zoom for a small segment vs. a large one.
      const canvas = fixture.debugElement.query(By.directive(FigureCanvasStub));
      const smallNode = makeNode({ id: 'n1', zone: FigureZone.PINYA, x: 0, y: 0, width: 60, height: 40 });
      const smallInst = makeInstance([smallNode], ['n1'], { id: 'i1' });
      setData(makeSegmentData([smallInst]));
      fixture.componentRef.setInput('highlightPersonId', 'p1');
      fixture.detectChanges();
      arrive();
      const smallMaxScale = (canvas.componentInstance.flyToBounds as jest.Mock).mock.calls[0][1].maxScale;
      const { scale: smallDistScale } = computeDistributionTransform(
        component.effectiveInstances(),
        component.containerWidth(),
        component.containerHeight(),
      );
      (canvas.componentInstance.flyToBounds as jest.Mock).mockClear();

      // A big, spread-out segment (a second instance far away) gets a much smaller `distScale`.
      const bigNode = makeNode({ id: 'n2', zone: FigureZone.PINYA, x: 0, y: 0, width: 60, height: 40 });
      const bigInst = makeInstance([bigNode], ['n2'], { id: 'i2', projectionX: 3000, projectionY: 3000 });
      const farInst = makeInstance([makeNode({ id: 'n3' })], [], { id: 'i3', projectionX: -3000, projectionY: -3000 });
      setData(makeSegmentData([bigInst, farInst]));
      fixture.componentRef.setInput('highlightPersonId', 'p1');
      fixture.detectChanges();
      arrive();
      const bigMaxScale = (canvas.componentInstance.flyToBounds as jest.Mock).mock.calls[0][1].maxScale;
      const { scale: bigDistScale } = computeDistributionTransform(
        component.effectiveInstances(),
        component.containerWidth(),
        component.containerHeight(),
      );

      expect(smallDistScale).toBeGreaterThan(bigDistScale);
      expect(smallMaxScale * smallDistScale).toBeCloseTo(bigMaxScale * bigDistScale, 5);
    });

    it('flies to the whole panel — not the cell — for a TRONC placement on arrival', () => {
      const node = makeNode({ id: 'n1', zone: FigureZone.TRONC, z: 1, x: 0, width: 1 });
      const inst = makeInstance([node], ['n1'], { id: 'i1' });
      setData(makeSegmentData([inst]));
      fixture.componentRef.setInput('highlightPersonId', 'p1');
      fixture.detectChanges();
      arrive();

      const idx = component.effectiveInstances().findIndex((i) => i.id === 'i1');
      const panelBounds = component.distributionFitBounds()[idx];
      const canvas = fixture.debugElement.query(By.directive(FigureCanvasStub));
      expect(canvas.componentInstance.flyToBounds).toHaveBeenCalledWith([panelBounds], expect.any(Object));
    });

    it('does not fly for a multi-placement description', () => {
      const n1 = makeNode({ id: 'n1' });
      const n2 = makeNode({ id: 'n2' });
      const inst1 = makeInstance([n1], ['n1'], { id: 'i1' });
      const inst2 = makeInstance([n2], ['n2'], { id: 'i2' });
      setData(makeSegmentData([inst1, inst2]));
      fixture.componentRef.setInput('highlightPersonId', 'p1');
      fixture.detectChanges();
      arrive();

      const canvas = fixture.debugElement.query(By.directive(FigureCanvasStub));
      expect(canvas.componentInstance.flyToBounds).not.toHaveBeenCalled();
    });

    it('flies only once on arrival, not again on every later stage-transform tick', () => {
      const node = makeNode({ id: 'n1', zone: FigureZone.PINYA });
      const inst = makeInstance([node], ['n1'], { id: 'i1' });
      setData(makeSegmentData([inst]));
      fixture.componentRef.setInput('highlightPersonId', 'p1');
      fixture.detectChanges();
      arrive();
      arrive();
      component.onStageTransformChanged({ x: 5, y: 5, scaleX: 1.2, scaleY: 1.2 });
      fixture.detectChanges();

      const canvas = fixture.debugElement.query(By.directive(FigureCanvasStub));
      expect(canvas.componentInstance.flyToBounds).toHaveBeenCalledTimes(1);
    });

    it("flies again when the banner's Troba'm button is clicked", () => {
      const node = makeNode({ id: 'n1', zone: FigureZone.PINYA });
      const inst = makeInstance([node], ['n1'], { id: 'i1' });
      setData(makeSegmentData([inst]));
      fixture.componentRef.setInput('highlightPersonId', 'p1');
      fixture.detectChanges();
      arrive();

      const canvas = fixture.debugElement.query(By.directive(FigureCanvasStub));
      canvas.componentInstance.flyToBounds.mockClear();

      const banner = fixture.debugElement.query(By.directive(OwnPositionBannerComponent));
      banner.componentInstance.troba.emit();
      fixture.detectChanges();

      expect(canvas.componentInstance.flyToBounds).toHaveBeenCalledTimes(1);
    });

    it('flies again when the chevron is tapped', () => {
      const node = makeNode({ id: 'n1', zone: FigureZone.PINYA });
      const inst = makeInstance([node], ['n1'], { id: 'i1' });
      setData(makeSegmentData([inst]));
      fixture.componentRef.setInput('highlightPersonId', 'p1');
      fixture.detectChanges();
      arrive();

      const canvas = fixture.debugElement.query(By.directive(FigureCanvasStub));
      canvas.componentInstance.flyToBounds.mockClear();

      const marker = fixture.debugElement.query(By.directive(OwnPositionMarkerComponent));
      marker.componentInstance.troba.emit();
      fixture.detectChanges();

      expect(canvas.componentInstance.flyToBounds).toHaveBeenCalledTimes(1);
    });

    it('bumps arrivedTick on the marker whenever the canvas reports a landed flight', () => {
      const node = makeNode({ id: 'n1', zone: FigureZone.PINYA });
      const inst = makeInstance([node], ['n1'], { id: 'i1' });
      setData(makeSegmentData([inst]));
      fixture.componentRef.setInput('highlightPersonId', 'p1');
      fixture.detectChanges();
      arrive();

      const canvas = fixture.debugElement.query(By.directive(FigureCanvasStub));
      const before = fixture.debugElement.query(By.directive(OwnPositionMarkerComponent)).componentInstance.arrivedTick();

      canvas.componentInstance.flightLanded.emit();
      fixture.detectChanges();

      const after = fixture.debugElement.query(By.directive(OwnPositionMarkerComponent)).componentInstance.arrivedTick();
      expect(after).toBe(before + 1);
    });
  });
});
