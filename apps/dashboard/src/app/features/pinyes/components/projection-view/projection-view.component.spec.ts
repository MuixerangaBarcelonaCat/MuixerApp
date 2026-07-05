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
import { FigureZone, NodeShape } from '@muixer/shared';
import { CanvasNode, CanvasMode } from '../figure-canvas/figure-canvas.component';
import { TroncNodeItem } from '../tronc-view/tronc-view.component';

@Component({ selector: 'app-figure-canvas', standalone: true, template: '' })
class FigureCanvasStub {
  readonly nodes = input<CanvasNode[]>([]);
  readonly mode = input<CanvasMode>('readonly');
  readonly assignments = input<AssignmentDetail[]>([]);
}

@Component({ selector: 'app-tronc-view', standalone: true, template: '' })
class TroncViewStub {
  readonly troncNodes = input<TroncNodeItem[]>([]);
  readonly baseNodes = input<TroncNodeItem[]>([]);
  readonly directionNodes = input<TroncNodeItem[]>([]);
  readonly assignments = input<AssignmentDetail[]>([]);
  readonly mode = input<string>('projection');
  readonly isNetaFigure = input<boolean>(false);
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
  sortOrder: 0, ringLevel: null,
  originNodeId: null, renglaId: null, renglaPosition: null,
  sourceNodeId: null, isSnapshotted: true, isAdHoc: false, createdById: null,
  ...overrides,
});

const makeAssignment = (nodeId: string): AssignmentDetail => ({
  id: `asgn-${nodeId}`,
  figureInstanceId: 'inst-1',
  node: { id: nodeId, label: '', zone: FigureZone.PINYA, z: 0, positionType: null, sortOrder: 0, ringLevel: null, originNodeId: null, sourceNodeId: null },
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
      remove: { imports: [] },
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

  // ── isNetaFigure ─────────────────────────────────────────────────────────────

  describe('isNetaFigure', () => {
    it('returns true when hasPinya is false', () => {
      const instance = makeInstance([], []);
      instance.figureTemplate = { id: 'f1', name: 'Piló', hasPinya: false };
      expect(component.isNetaFigure(instance)).toBe(true);
    });

    it('returns false when hasPinya is true', () => {
      const instance = makeInstance([], []);
      expect(component.isNetaFigure(instance)).toBe(false);
    });

    it('returns false when figureTemplate is null', () => {
      const instance = makeInstance([], []);
      instance.figureTemplate = null;
      expect(component.isNetaFigure(instance)).toBe(false);
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

  // ── hasDistribution ──────────────────────────────────────────────────────────

  describe('hasDistribution', () => {
    it('returns false when segmentData is null', () => {
      component.segmentData.set(null);
      expect(component.hasDistribution()).toBe(false);
    });

    it('returns false when segmentData has hasDistribution=false', () => {
      component.segmentData.set({
        segment: { id: 's1', name: null, sortOrder: 0, prevSegmentId: null, nextSegmentId: null },
        instances: [],
        personAttendance: {},
        hasDistribution: false,
      });
      expect(component.hasDistribution()).toBe(false);
    });

    it('returns true when segmentData has hasDistribution=true', () => {
      component.segmentData.set({
        segment: { id: 's1', name: null, sortOrder: 0, prevSegmentId: null, nextSegmentId: null },
        instances: [],
        personAttendance: {},
        hasDistribution: true,
      });
      expect(component.hasDistribution()).toBe(true);
    });
  });

  // ── distributionCellsById ────────────────────────────────────────────────────

  describe('distributionCellsById', () => {
    it('returns empty map when hasDistribution is false', () => {
      component.segmentData.set({
        segment: { id: 's1', name: null, sortOrder: 0, prevSegmentId: null, nextSegmentId: null },
        instances: [makeInstance([], [], { id: 'inst-A', projectionX: 100, projectionY: 200, projectionAngle: 45 })],
        personAttendance: {},
        hasDistribution: false,
      });
      expect(component.distributionCellsById().size).toBe(0);
    });

    it('maps stored projectionX/Y to cell position and stores angle when hasDistribution is true', () => {
      const inst = makeInstance([], [], { id: 'inst-A', projectionX: 100, projectionY: 200, projectionAngle: 30 });
      component.segmentData.set({
        segment: { id: 's1', name: null, sortOrder: 0, prevSegmentId: null, nextSegmentId: null },
        instances: [inst],
        personAttendance: {},
        hasDistribution: true,
      });
      const cell = component.distributionCellsById().get('inst-A');
      expect(cell).toBeDefined();
      expect(cell!.angle).toBe(30);
    });

    it('two instances are positioned relative to each other, preserving spatial order', () => {
      const inst1 = makeInstance([], [], { id: 'i1', projectionX: 0, projectionY: 0, projectionAngle: 0 });
      const inst2 = makeInstance([], [], { id: 'i2', projectionX: 400, projectionY: 0, projectionAngle: 0 });
      component.segmentData.set({
        segment: { id: 's1', name: null, sortOrder: 0, prevSegmentId: null, nextSegmentId: null },
        instances: [inst1, inst2],
        personAttendance: {},
        hasDistribution: true,
      });
      const cell1 = component.distributionCellsById().get('i1')!;
      const cell2 = component.distributionCellsById().get('i2')!;
      expect(cell1.x).toBeLessThan(cell2.x);
    });
  });

  // ── distributionNodes ────────────────────────────────────────────────────────

  describe('distributionNodes', () => {
    it('returns empty array when hasDistribution is false', () => {
      component.segmentData.set({
        segment: { id: 's1', name: null, sortOrder: 0, prevSegmentId: null, nextSegmentId: null },
        instances: [makeInstance([makeNode({ id: 'n1', zone: FigureZone.PINYA })], ['n1'])],
        personAttendance: {},
        hasDistribution: false,
      });
      expect(component.distributionNodes().length).toBe(0);
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
    it('returns empty array when hasDistribution is false', () => {
      const inst = makeInstance([], ['n1'], { id: 'i1' });
      component.segmentData.set({
        segment: { id: 's1', name: null, sortOrder: 0, prevSegmentId: null, nextSegmentId: null },
        instances: [inst],
        personAttendance: {},
        hasDistribution: false,
      });
      expect(component.distributionAssignments().length).toBe(0);
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
});
