import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Component, input } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { ProjectionViewComponent } from './projection-view.component';
import { ProjectionInstance } from '../../models/projection.model';
import { InstanceNodeItem, AssignmentDetail } from '../../models/assignment.model';
import { ProjectionService } from '../../services/projection.service';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';
import { LayoutService } from '../../../../core/services/layout.service';
import { FigureZone, NodeShape } from '@muixer/shared';
import { CanvasNode, CanvasMode, FigureCanvasComponent } from '../figure-canvas/figure-canvas.component';
import { TroncNodeItem, TroncViewComponent } from '../tronc-view/tronc-view.component';

@Component({ selector: 'app-figure-canvas', standalone: true, template: '' })
class FigureCanvasStub {
  readonly nodes = input<CanvasNode[]>([]);
  readonly mode = input<CanvasMode>('readonly');
  readonly assignments = input<AssignmentDetail[]>([]);
  readonly gridEnabled = input<boolean>(true);
  readonly attendanceMap = input<Map<string, string>>(new Map());
  readonly isPast = input<boolean>(false);
  readonly fitExtraBounds = input<{ x: number; y: number; width: number; height: number }[]>([]);
  readonly outlineBoxes = input<unknown[]>([]);
}

@Component({ selector: 'app-tronc-view', standalone: true, template: '' })
class TroncViewStub {
  readonly troncNodes = input<TroncNodeItem[]>([]);
  readonly baseNodes = input<TroncNodeItem[]>([]);
  readonly directionNodes = input<TroncNodeItem[]>([]);
  readonly assignments = input<AssignmentDetail[]>([]);
  readonly mode = input<string>('projection');
  readonly isNetaFigure = input<boolean>(false);
  readonly attendanceMap = input<Map<string, string>>(new Map());
  readonly isPast = input<boolean>(false);
  readonly panelColor = input<string>('');
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

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('ProjectionViewComponent', () => {
  let fixture: ComponentFixture<ProjectionViewComponent>;
  let component: ProjectionViewComponent;

  beforeEach(async () => {
    class ResizeObserverStub {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);

    await TestBed.configureTestingModule({
      imports: [ProjectionViewComponent],
      providers: [
        { provide: ProjectionService, useValue: { getProjection: vi.fn().mockReturnValue(of({ segment: { id: 's1', name: null, sortOrder: 0, prevSegmentId: null, nextSegmentId: null }, instances: [], personAttendance: {}, hasDistribution: false })) } },
        { provide: ToastService, useValue: { error: vi.fn() } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: { params: { eventId: 'e1', segmentId: 's1' } } } },
        allLucideIconsProvider,
      ],
    })
    .overrideComponent(ProjectionViewComponent, {
      remove: { imports: [FigureCanvasComponent, TroncViewComponent] },
      add: { imports: [FigureCanvasStub, TroncViewStub] },
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProjectionViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ── attendanceMap ────────────────────────────────────────────────────────────

  describe('attendanceMap', () => {
    it('is empty map when personAttendance is not provided', () => {
      expect(component.attendanceMap().size).toBe(0);
    });

    it('builds Map from personAttendance object', () => {
      component.segmentData.set({
        segment: { id: 's1', name: null, sortOrder: 0, prevSegmentId: null, nextSegmentId: null },
        instances: [],
        personAttendance: { 'person-1': 'ASSISTIT', 'person-2': 'NO_VAIG' },
        hasDistribution: false,
      } as Parameters<typeof component.segmentData.set>[0]);

      const map = component.attendanceMap();
      expect(map.get('person-1')).toBe('ASSISTIT');
      expect(map.get('person-2')).toBe('NO_VAIG');
    });

    it('returns an empty map when personAttendance is empty', () => {
      component.segmentData.set({
        segment: { id: 's1', name: null, sortOrder: 0, prevSegmentId: null, nextSegmentId: null },
        instances: [],
        personAttendance: {},
        hasDistribution: false,
      } as Parameters<typeof component.segmentData.set>[0]);

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
      // vent1 + co assigned; vent2 and vent3 unassigned
      const instance = makeInstance([vent1, vent2, vent3, co], ['v1', 'co']);

      const result = component.getInstanceProjectionNodes(instance);
      const coResult = result.find((n) => n.id === 'co')!;

      // cordo-obert should appear at vent2's position (first gap)
      expect(coResult.x).toBe(150);
      expect(coResult.y).toBe(100);
    });

    it('does not move cordo-obert when it is unassigned', () => {
      const vent1 = makeNode({ id: 'v1', renglaId: 'r1', renglaPosition: 1, x: 100, y: 100 });
      const vent2 = makeNode({ id: 'v2', renglaId: 'r1', renglaPosition: 2, x: 150, y: 100 });
      const co   = makeNode({ id: 'co', renglaId: 'r1', renglaPosition: 3, positionType: 'cordo-obert', x: 200, y: 100 });
      // vent2 and co unassigned
      const instance = makeInstance([vent1, vent2, co], ['v1']);

      const result = component.getInstanceProjectionNodes(instance);
      // co is not assigned → filtered out, not in result
      expect(result.find((n) => n.id === 'co')).toBeUndefined();
    });

    it('handles multiple rengles independently', () => {
      const r1v1 = makeNode({ id: 'r1v1', renglaId: 'r1', renglaPosition: 1, x: 100, y: 100 });
      const r1v2 = makeNode({ id: 'r1v2', renglaId: 'r1', renglaPosition: 2, x: 150, y: 100 });
      const r1co = makeNode({ id: 'r1co', renglaId: 'r1', renglaPosition: 3, positionType: 'cordo-obert', x: 200, y: 100 });
      // rengla 2: all assigned, co stays
      const r2v1 = makeNode({ id: 'r2v1', renglaId: 'r2', renglaPosition: 1, x: 100, y: 200 });
      const r2co = makeNode({ id: 'r2co', renglaId: 'r2', renglaPosition: 2, positionType: 'cordo-obert', x: 150, y: 200 });

      const instance = makeInstance([r1v1, r1v2, r1co, r2v1, r2co], ['r1v1', 'r1co', 'r2v1', 'r2co']);

      const result = component.getInstanceProjectionNodes(instance);

      // r1: v2 unassigned → co moves to v2's slot
      expect(result.find((n) => n.id === 'r1co')!.x).toBe(150);
      // r2: no gaps → co stays at original position
      expect(result.find((n) => n.id === 'r2co')!.x).toBe(150);
      expect(result.find((n) => n.id === 'r2co')!.y).toBe(200);
    });
  });

  // ── effectivePositions / effectiveInstances ─────────────────────────────────

  describe('effectivePositions', () => {
    it('keeps the stored position when projectionX is set', () => {
      const inst = makeInstance([], [], { id: 'inst-A', projectionX: 100, projectionY: 200, projectionAngle: 30 });
      component.segmentData.set({
        segment: { id: 's1', name: null, sortOrder: 0, prevSegmentId: null, nextSegmentId: null },
        instances: [inst],
        personAttendance: {},
        hasDistribution: true,
      });
      expect(component.effectivePositions().get('inst-A')).toEqual({ x: 100, y: 200, angle: 30 });
    });

    it('auto-places instances with no saved position in reading order (right of, or below, the previous one)', () => {
      const inst1 = makeInstance([makeNode({ zone: FigureZone.PINYA })], [], { id: 'i1', projectionX: null });
      const inst2 = makeInstance([makeNode({ zone: FigureZone.PINYA })], [], { id: 'i2', projectionX: null });
      component.segmentData.set({
        segment: { id: 's1', name: null, sortOrder: 0, prevSegmentId: null, nextSegmentId: null },
        instances: [inst1, inst2],
        personAttendance: {},
        hasDistribution: false,
      });
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
      component.segmentData.set({
        segment: { id: 's1', name: null, sortOrder: 0, prevSegmentId: null, nextSegmentId: null },
        instances,
        personAttendance: {},
        hasDistribution: false,
      });

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
      component.segmentData.set({
        segment: { id: 's1', name: null, sortOrder: 0, prevSegmentId: null, nextSegmentId: null },
        instances: [stored, mock],
        personAttendance: {},
        hasDistribution: true,
      });
      const positions = component.effectivePositions();
      expect(positions.get('mock')!.x).toBeGreaterThan(positions.get('stored')!.x);
    });
  });

  describe('effectiveInstances', () => {
    it('fills in projectionX/Y/Angle for instances with no saved position', () => {
      const inst = makeInstance([makeNode({ zone: FigureZone.PINYA })], [], { id: 'i1', projectionX: null });
      component.segmentData.set({
        segment: { id: 's1', name: null, sortOrder: 0, prevSegmentId: null, nextSegmentId: null },
        instances: [inst],
        personAttendance: {},
        hasDistribution: false,
      });
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
      component.segmentData.set({
        segment: { id: 's1', name: null, sortOrder: 0, prevSegmentId: null, nextSegmentId: null },
        instances: [makeInstance(nodes, [], { id: 'i1', projectionX: null })],
        personAttendance: {},
        hasDistribution: false,
      });

      const [effective] = component.effectiveInstances();
      expect(effective.troncPanelX).not.toBeNull();
      expect(effective.troncPanelY).not.toBeNull();
    });

    it('does not waste packing space on an unassigned PINYA node (occupancy, not the raw pivot, drives spacing)', () => {
      // The pivot (raw PINYA+BASE) still determines rotation/position
      // internally, but PACKING SPACE is reserved from occupancy — what
      // getInstanceProjectionNodes actually draws. An unassigned PINYA node
      // (e.g. beyond numberOfCordons) is invisible, so it must not push a
      // neighboring figure away — this is what lets cordons/assignment still
      // shape the auto-placed layout, without breaking pivot/render alignment.
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
      component.segmentData.set({
        segment: { id: 's1', name: null, sortOrder: 0, prevSegmentId: null, nextSegmentId: null },
        instances: [a, b],
        personAttendance: {},
        hasDistribution: false,
      });

      const positions = component.effectivePositions();
      expect(positions.get('b')!.x).toBeLessThan(500);
    });


    it('always includes BASE nodes in the pivot bbox, even when unassigned', () => {
      // BASE nodes are assignable but must count toward the figure's pivot
      // regardless of assignment status (they represent real physical structure).
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
      component.segmentData.set({
        segment: { id: 's1', name: null, sortOrder: 0, prevSegmentId: null, nextSegmentId: null },
        instances: [a, b],
        personAttendance: {},
        hasDistribution: false,
      });

      const positions = component.effectivePositions();
      expect(positions.get('b')!.x).toBeGreaterThan(1500);
    });

    it('still blocks tronc placement with a DECORATION node, even though it is excluded from the pivot bbox', () => {
      // Decoration must never affect where the figure is *placed* (see the
      // pivot test above), but it is real, always-drawn content, so a tronc
      // panel must never be positioned on top of it.
      const nodes = [
        makeNode({ id: 'p1', zone: FigureZone.PINYA, x: 0, y: 0, width: 600, height: 400 }),
        makeNode({ id: 'd1', zone: FigureZone.DECORATION, x: -450, y: 0, width: 300, height: 400 }),
      ];
      const troncNode = makeNode({ id: 't1', zone: FigureZone.TRONC, x: 0, y: 0, z: 0, width: 2, height: 1 });
      const a = makeInstance([...nodes, troncNode], ['p1'], { id: 'a', projectionX: null });
      component.segmentData.set({
        segment: { id: 's1', name: null, sortOrder: 0, prevSegmentId: null, nextSegmentId: null },
        instances: [a],
        personAttendance: {},
        hasDistribution: false,
      });

      const [effective] = component.effectiveInstances();
      expect(effective.troncPanelX).not.toBeNull();
      // Decoration world box: pivot (PINYA-only bbox center = 0,0) + local
      // offset (-450,0), half-extent 150×200.
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

    it('lays out fully-unplaced segments exactly like the distribution mapping when every cordon position is assigned (Distribució parity)', async () => {
      const { mapDistributionItemsToSlots } = await import('../../utils/distribution-slot-mapping.util');

      const figNodes = (idPrefix: string) => [
        makeNode({ id: `${idPrefix}-p1`, zone: FigureZone.PINYA, x: 200, y: 150, width: 400, height: 300 }),
        makeNode({ id: `${idPrefix}-b1`, zone: FigureZone.BASE, x: 200, y: 320, width: 100, height: 40 }),
        makeNode({ id: `${idPrefix}-t1`, zone: FigureZone.TRONC, x: 0, y: 0, z: 0, width: 2, height: 1 }),
      ];
      const ids = ['i1', 'i2', 'i3'];
      component.segmentData.set({
        segment: { id: 's1', name: null, sortOrder: 0, prevSegmentId: null, nextSegmentId: null },
        instances: ids.map((id) =>
          makeInstance(figNodes(id), [`${id}-p1`], { id, projectionX: null }),
        ),
        personAttendance: {},
        hasDistribution: false,
      });

      // Backend-shaped distribution items for the same figures: troncGridCols =
      // max(x + width) over tronc nodes (2), troncGridRows = distinct z levels (1).
      const slots = mapDistributionItemsToSlots(
        ids.map((id) => ({
          instanceId: id,
          label: null,
          figureMode: 'COMPLETA',
          numberOfCordons: null,
          cordonsObertsEnabled: true,
          assignments: [],
          figureTemplate: { id: `fig-${id}`, name: id, nodes: figNodes(id) },
          troncGridCols: 2,
          troncGridRows: 1,
          projectionX: null,
          projectionY: null,
          projectionAngle: null,
          troncPanelX: null,
          troncPanelY: null,
          troncPanelWidth: null,
          troncPanelHeight: null,
        })),
      );

      const effective = component.effectiveInstances();
      for (const slot of slots) {
        const inst = effective.find((i) => i.id === slot.slotId)!;
        expect(inst.projectionX).toBe(slot.offsetX);
        expect(inst.projectionY).toBe(slot.offsetY);
        expect(inst.troncPanelX).toBe(slot.troncPanelX);
        expect(inst.troncPanelY).toBe(slot.troncPanelY);
      }
    });
  });

  // ── distributionNodes ────────────────────────────────────────────────────────

  describe('distributionNodes', () => {
    it('mock-places and renders nodes even when no distribution was ever saved', () => {
      component.segmentData.set({
        segment: { id: 's1', name: null, sortOrder: 0, prevSegmentId: null, nextSegmentId: null },
        instances: [makeInstance([makeNode({ id: 'n1', zone: FigureZone.PINYA })], ['n1'])],
        personAttendance: {},
        hasDistribution: false,
      });
      expect(component.distributionNodes().length).toBe(1);
    });

    it('returns combined nodes from all instances when hasDistribution is true', () => {
      const n1 = makeNode({ id: 'n1', zone: FigureZone.PINYA, x: 0, y: 0 });
      const n2 = makeNode({ id: 'n2', zone: FigureZone.PINYA, x: 0, y: 0 });
      const inst1 = makeInstance([n1], ['n1'], { id: 'i1', projectionX: 0, projectionY: 0 });
      const inst2 = makeInstance([n2], ['n2'], { id: 'i2', projectionX: 300, projectionY: 0 });
      component.segmentData.set({
        segment: { id: 's1', name: null, sortOrder: 0, prevSegmentId: null, nextSegmentId: null },
        instances: [inst1, inst2],
        personAttendance: {},
        hasDistribution: true,
      });
      expect(component.distributionNodes().length).toBe(2);
    });

    it('applies projectionX/Y offset so horizontally-separated instances produce different node x positions', () => {
      const n1 = makeNode({ id: 'n1', zone: FigureZone.PINYA, x: 0, y: 0 });
      const n2 = makeNode({ id: 'n2', zone: FigureZone.PINYA, x: 0, y: 0 });
      const inst1 = makeInstance([n1], ['n1'], { id: 'i1', projectionX: 0, projectionY: 0 });
      const inst2 = makeInstance([n2], ['n2'], { id: 'i2', projectionX: 400, projectionY: 0 });
      component.segmentData.set({
        segment: { id: 's1', name: null, sortOrder: 0, prevSegmentId: null, nextSegmentId: null },
        instances: [inst1, inst2],
        personAttendance: {},
        hasDistribution: true,
      });
      const nodes = component.distributionNodes();
      const xValues = nodes.map((n) => n.x);
      expect(xValues[0]).not.toEqual(xValues[1]);
    });
  });

  // ── distributionAssignments ──────────────────────────────────────────────────

  describe('distributionAssignments', () => {
    it('returns assignments even when no distribution was ever saved', () => {
      const inst = makeInstance([], ['n1'], { id: 'i1' });
      component.segmentData.set({
        segment: { id: 's1', name: null, sortOrder: 0, prevSegmentId: null, nextSegmentId: null },
        instances: [inst],
        personAttendance: {},
        hasDistribution: false,
      });
      expect(component.distributionAssignments().length).toBe(1);
    });

    it('returns assignments from all instances when hasDistribution is true', () => {
      const inst1 = makeInstance([], ['n1'], { id: 'i1' });
      const inst2 = makeInstance([], ['n2'], { id: 'i2' });
      component.segmentData.set({
        segment: { id: 's1', name: null, sortOrder: 0, prevSegmentId: null, nextSegmentId: null },
        instances: [inst1, inst2],
        personAttendance: {},
        hasDistribution: true,
      });
      expect(component.distributionAssignments().length).toBe(2);
    });
  });

  // ── browser back button ─────────────────────────────────────────────────────

  describe('browser back button', () => {
    it('navigates back to the event (like the HUD arrow) when the browser back button is pressed', () => {
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate');
      component.eventId = 'e1';

      window.dispatchEvent(new PopStateEvent('popstate'));

      expect(navigateSpy).toHaveBeenCalledWith(['/events', 'e1']);
    });
  });

  // ── embedded mode ─────────────────────────────────────────────────────────────

  describe('embedded mode', () => {
    async function createEmbedded(embedded: boolean, instanceIdParam = 'inst-x') {
      class ResizeObserverStub {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      }
      vi.stubGlobal('ResizeObserver', ResizeObserverStub);

      const layoutService = { requestFullscreen: vi.fn(), exitFullscreen: vi.fn() };

      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [ProjectionViewComponent],
        providers: [
          { provide: ProjectionService, useValue: { getProjection: vi.fn().mockReturnValue(of({ segment: { id: 's1', name: null, sortOrder: 0, prevSegmentId: null, nextSegmentId: null }, instances: [], personAttendance: {}, hasDistribution: false })) } },
          { provide: ToastService, useValue: { error: vi.fn() } },
          { provide: Router, useValue: { navigate: vi.fn() } },
          { provide: ActivatedRoute, useValue: { snapshot: { params: { eventId: 'e1', segmentId: 's1', instanceId: instanceIdParam } } } },
          { provide: LayoutService, useValue: layoutService },
          allLucideIconsProvider,
        ],
      })
        .overrideComponent(ProjectionViewComponent, {
          remove: { imports: [FigureCanvasComponent, TroncViewComponent] },
          add: { imports: [FigureCanvasStub, TroncViewStub] },
        })
        .compileComponents();

      const embeddedFixture = TestBed.createComponent(ProjectionViewComponent);
      embeddedFixture.componentRef.setInput('embedded', embedded);
      embeddedFixture.detectChanges();
      return { fixture: embeddedFixture, layoutService };
    }

    it('does not manage fullscreen when embedded', async () => {
      const { fixture: f, layoutService } = await createEmbedded(true);
      expect(layoutService.requestFullscreen).not.toHaveBeenCalled();
      f.destroy();
      expect(layoutService.exitFullscreen).not.toHaveBeenCalled();
    });

    it('manages fullscreen when not embedded (default)', async () => {
      const { fixture: f, layoutService } = await createEmbedded(false);
      expect(layoutService.requestFullscreen).toHaveBeenCalled();
      f.destroy();
      expect(layoutService.exitFullscreen).toHaveBeenCalled();
    });

    it('ignores the route instanceId param when embedded, always showing the full segment', async () => {
      const { fixture: f } = await createEmbedded(true, 'inst-x');
      expect(f.componentInstance.instanceId).toBe('');
    });

    it('hides the floating HUD nav when embedded', async () => {
      const { fixture: f } = await createEmbedded(true);
      expect(f.nativeElement.querySelector('nav')).toBeNull();
    });

    it('shows the floating HUD nav when not embedded', async () => {
      const { fixture: f } = await createEmbedded(false);
      expect(f.nativeElement.querySelector('nav')).not.toBeNull();
    });

    it('ignores segment-navigation arrow keys when embedded', async () => {
      const { fixture: f } = await createEmbedded(true);
      const navigateSpy = vi.spyOn(f.componentInstance, 'navigateSegment');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      expect(navigateSpy).not.toHaveBeenCalled();
    });

    it('handles segment-navigation arrow keys when not embedded', async () => {
      const { fixture: f } = await createEmbedded(false);
      const navigateSpy = vi.spyOn(f.componentInstance, 'navigateSegment');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      expect(navigateSpy).toHaveBeenCalledWith('prev');
    });

    it('ignores the browser back button when embedded — the host shell owns it', async () => {
      const { fixture: f } = await createEmbedded(true);
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate');

      window.dispatchEvent(new PopStateEvent('popstate'));

      expect(navigateSpy).not.toHaveBeenCalled();
    });
  });
});
