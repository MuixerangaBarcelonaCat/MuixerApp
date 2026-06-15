import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  LUCIDE_ICONS,
  LucideAngularModule,
  LucideIconProvider,
  ArrowLeft,
  ArrowDownUp,
  ArrowUpDown,
  Plus,
  Trash2,
  PanelLeft,
  LayoutGrid,
  GripVertical,
  X,
} from 'lucide-angular';
import { Component, input } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FigureProjectionComponent } from './figure-projection.component';
import { ProjectionInstance } from '../../models/projection.model';
import { AssignmentDetail } from '../../models/assignment.model';
import { FigureZone } from '@muixer/shared';
import { CanvasNode, CanvasMode } from '../figure-canvas/figure-canvas.component';
import { TroncNodeItem } from '../tronc-view/tronc-view.component';

@Component({ selector: 'app-figure-canvas', standalone: true, template: '' })
class FigureCanvasStub {
  readonly nodes = input<CanvasNode[]>([]);
  readonly mode = input<CanvasMode>('readonly');
  readonly assignments = input<AssignmentDetail[]>([]);
  readonly gridEnabled = input<boolean>(true);
}

@Component({ selector: 'app-tronc-view', standalone: true, template: '' })
class TroncViewStub {
  readonly troncNodes = input<TroncNodeItem[]>([]);
  readonly baseNodes = input<TroncNodeItem[]>([]);
  readonly assignments = input<AssignmentDetail[]>([]);
  readonly mode = input<string>('assignment');
}

const makeInstance = (overrides: Partial<ProjectionInstance> = {}): ProjectionInstance => ({
  id: 'inst-uuid',
  label: null,
  sortOrder: 0,
  numberOfCordons: null,
  openCordons: null,
  projectionX: 100,
  projectionY: 200,
  projectionScale: 1,
  figureTemplate: { id: 'fig-uuid', name: 'Pinet Doble de 4' },
  nodes: [
    {
      id: 'node-pinya',
      label: 'Base 1',
      zone: FigureZone.PINYA,
      positionType: 'base',
      x: 500, y: 500, z: 0,
      width: 60, height: 40, rotation: 0,
      color: null, shape: 'ELLIPSE', sortOrder: 0,
      ringLevel: null, originNodeId: null,
      renglaId: null, renglaPosition: null,
      sourceNodeId: null, isSnapshotted: false,
      isAdHoc: false, createdById: null,
    },
    {
      id: 'node-tronc',
      label: 'Segon',
      zone: FigureZone.TRONC,
      positionType: 'segon',
      x: 0, y: 0, z: 1,
      width: 1, height: 1, rotation: 0,
      color: null, shape: 'RECT', sortOrder: 0,
      ringLevel: null, originNodeId: null,
      renglaId: null, renglaPosition: null,
      sourceNodeId: null, isSnapshotted: false,
      isAdHoc: false, createdById: null,
    },
    {
      id: 'node-base',
      label: 'Base',
      zone: FigureZone.BASE,
      positionType: 'base',
      x: 0, y: 0, z: 0,
      width: 1, height: 1, rotation: 0,
      color: null, shape: 'ELLIPSE', sortOrder: 0,
      ringLevel: null, originNodeId: null,
      renglaId: null, renglaPosition: null,
      sourceNodeId: null, isSnapshotted: false,
      isAdHoc: false, createdById: null,
    },
  ],
  assignments: [],
  ...overrides,
});

describe('FigureProjectionComponent', () => {
  let component: FigureProjectionComponent;
  let fixture: ComponentFixture<FigureProjectionComponent>;
  let routerSpy: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    routerSpy = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [FigureProjectionComponent],
      providers: [
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useFactory: () =>
            new LucideIconProvider({
              ArrowLeft, ArrowDownUp, ArrowUpDown, Plus, Trash2,
              PanelLeft, LayoutGrid, GripVertical, X,
            }),
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { params: {} } },
        },
        { provide: Router, useValue: routerSpy },
      ],
    })
      .overrideComponent(FigureProjectionComponent, {
        set: { imports: [LucideAngularModule, FigureCanvasStub, TroncViewStub] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(FigureProjectionComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('instance', makeInstance());
    fixture.detectChanges();
  });

  // ── Node filtering ─────────────────────────────────────────────────────────

  it('pinya nodes include PINYA and BASE zones (excludes TRONC)', () => {
    const pinyaNodes = component.pinyaNodes();
    expect(pinyaNodes.every((n) => n.zone !== FigureZone.TRONC)).toBe(true);
    expect(pinyaNodes.length).toBe(2);
  });

  it('separates tronc nodes (zone === TRONC)', () => {
    const troncNodes = component.troncNodes();
    expect(troncNodes.every((n) => n.zone === FigureZone.TRONC)).toBe(true);
    expect(troncNodes.length).toBe(1);
  });

  it('separates base nodes (zone === BASE)', () => {
    const baseNodes = component.baseNodes();
    expect(baseNodes.every((n) => n.zone === FigureZone.BASE)).toBe(true);
    expect(baseNodes.length).toBe(1);
  });

  it('displays the figure template name', () => {
    const name = fixture.nativeElement.textContent;
    expect(name).toContain('Pinet Doble de 4');
  });

  // ── Floating panel toggle ──────────────────────────────────────────────────

  it('tronc panel is open by default', () => {
    expect(component.troncPanelOpen()).toBe(true);
    const panel = fixture.nativeElement.querySelector('[aria-label="Tronc de la figura"]');
    expect(panel).not.toBeNull();
  });

  it('closing tronc panel hides it and shows toggle button', () => {
    component.troncPanelOpen.set(false);
    fixture.detectChanges();

    const panel = fixture.nativeElement.querySelector('[aria-label="Tronc de la figura"]');
    expect(panel).toBeNull();

    const toggleBtn = fixture.nativeElement.querySelector('[aria-label="Obrir panell del Tronc"]');
    expect(toggleBtn).not.toBeNull();
  });

  it('clicking toggle button re-opens the tronc panel', () => {
    component.troncPanelOpen.set(false);
    fixture.detectChanges();

    const toggleBtn = fixture.nativeElement.querySelector('[aria-label="Obrir panell del Tronc"]');
    toggleBtn.click();
    fixture.detectChanges();

    expect(component.troncPanelOpen()).toBe(true);
    const panel = fixture.nativeElement.querySelector('[aria-label="Tronc de la figura"]');
    expect(panel).not.toBeNull();
  });

  // ── Navigation (embedded mode) ─────────────────────────────────────────────

  it('emits backToSegment when navigateToAssignment called in embedded mode', () => {
    const emitSpy = vi.spyOn(component.backToSegment, 'emit');
    component.navigateToAssignment();
    expect(emitSpy).toHaveBeenCalledOnce();
  });

  it('renders the assignment back button', () => {
    const btn = fixture.nativeElement.querySelector('[aria-label="Tornar a l\'assignació"]');
    expect(btn).not.toBeNull();
  });

  it('does not render projection button in embedded mode', () => {
    const btn = fixture.nativeElement.querySelector('[aria-label="Projecció del segment"]');
    expect(btn).toBeNull();
  });

  // ── Navigation (standalone mode) ───────────────────────────────────────────

  describe('standalone route mode', () => {
    beforeEach(() => {
      component.standaloneMode.set(true);
      const route = TestBed.inject(ActivatedRoute);
      route.snapshot.params = { eventId: 'ev-1', segmentId: 'seg-1', instanceId: 'inst-uuid' };
      fixture.detectChanges();
    });

    it('navigateToAssignment navigates to /assign route', () => {
      component.navigateToAssignment();
      expect(routerSpy.navigate).toHaveBeenCalledWith([
        '/pinyes/events', 'ev-1', 'segments', 'seg-1', 'assign',
      ]);
    });

    it('navigateToProjection navigates to /project route', () => {
      component.navigateToProjection();
      expect(routerSpy.navigate).toHaveBeenCalledWith([
        '/pinyes/events', 'ev-1', 'segments', 'seg-1', 'project',
      ]);
    });

    it('renders projection button in standalone mode', () => {
      const btn = fixture.nativeElement.querySelector('[aria-label="Projecció del segment"]');
      expect(btn).not.toBeNull();
    });
  });
});
