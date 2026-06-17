import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Component, input } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { LUCIDE_ICONS, LucideIconProvider, ArrowLeft, Maximize2, HelpCircle } from 'lucide-angular';
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
  readonly assignments = input<AssignmentDetail[]>([]);
  readonly mode = input<string>('projection');
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
  compositionSlotId: null,
  node: { id: nodeId, label: '', zone: FigureZone.PINYA, z: 0, positionType: null, sortOrder: 0, ringLevel: null, originNodeId: null, sourceNodeId: null },
  person: { id: 'p1', alias: 'Pepet', name: 'Pere', firstSurname: 'G', shoulderHeight: null },
});

const makeInstance = (nodes: InstanceNodeItem[], assignedIds: string[]): ProjectionInstance => ({
  id: 'inst-1',
  label: null,
  sortOrder: 0,
  projectionX: 0, projectionY: 0, projectionScale: 1,
  figureTemplate: { id: 'fig-1', name: 'pd4' },
  nodes,
  assignments: assignedIds.map(makeAssignment),
});

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('ProjectionViewComponent', () => {
  let fixture: ComponentFixture<ProjectionViewComponent>;
  let component: ProjectionViewComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectionViewComponent],
      providers: [
        { provide: ProjectionService, useValue: { getProjection: vi.fn().mockReturnValue(of({ segment: { id: 's1', name: null, sortOrder: 0, prevSegmentId: null, nextSegmentId: null }, instances: [] })) } },
        { provide: ToastService, useValue: { error: vi.fn() } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: { params: { eventId: 'e1', segmentId: 's1' } } } },
        { provide: LUCIDE_ICONS, multi: true, useFactory: () => new LucideIconProvider({ ArrowLeft, Maximize2, HelpCircle }) },
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

    it('keeps unassigned BASE nodes (base is always shown)', () => {
      const base = makeNode({ id: 'b1', zone: FigureZone.BASE });
      const instance = makeInstance([base], []);

      const result = component.getInstanceProjectionNodes(instance);

      expect(result.map((n) => n.id)).toContain('b1');
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
});
