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
} from 'lucide-angular';
import { Component, input, output } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FigureProjectionComponent } from './figure-projection.component';
import { ProjectionInstance } from '../../models/projection.model';
import { AssignmentDetail } from '../../models/assignment.model';
import { FigureZone, NodeShape } from '@muixer/shared';
import { CanvasNode, CanvasMode } from '../figure-canvas/figure-canvas.component';
import { TroncNodeItem } from '../tronc-view/tronc-view.component';

// Stub out Konva-dependent components to avoid canvas errors in test environment
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
  readonly mode = input<string>('assignment');
}

const makeInstance = (overrides: Partial<ProjectionInstance> = {}): ProjectionInstance => ({
  id: 'inst-uuid',
  label: null,
  sortOrder: 0,
  numberOfCordons: null,
  openCordons: null,
  figureTemplate: { id: 'fig-uuid', name: 'Pinet Doble de 4' },
  nodes: [
    {
      id: 'node-pinya',
      label: 'Base 1',
      zone: FigureZone.PINYA,
      positionType: 'base',
      x: 500,
      y: 500,
      z: 0,
      width: 60,
      height: 40,
      rotation: 0,
      color: null,
      shape: NodeShape.ELLIPSE,
      sortOrder: 0,
      ringLevel: null,
      originNodeId: null,
      renglaId: null,
      renglaPosition: null,
      sourceNodeId: null,
      isSnapshotted: false,
    },
    {
      id: 'node-tronc',
      label: 'Segon',
      zone: FigureZone.TRONC,
      positionType: 'segon',
      x: 0,
      y: 0,
      z: 1,
      width: 1,
      height: 1,
      rotation: 0,
      color: null,
      shape: NodeShape.RECTANGLE,
      sortOrder: 0,
      ringLevel: null,
      originNodeId: null,
      renglaId: null,
      renglaPosition: null,
      sourceNodeId: null,
      isSnapshotted: false,
    },
    {
      id: 'node-base',
      label: 'Base',
      zone: FigureZone.BASE,
      positionType: 'base',
      x: 0,
      y: 0,
      z: 0,
      width: 1,
      height: 1,
      rotation: 0,
      color: null,
      shape: NodeShape.ELLIPSE,
      sortOrder: 0,
      ringLevel: null,
      originNodeId: null,
      renglaId: null,
      renglaPosition: null,
      sourceNodeId: null,
      isSnapshotted: false,
    },
  ],
  assignments: [],
  ...overrides,
});

describe('FigureProjectionComponent', () => {
  let component: FigureProjectionComponent;
  let fixture: ComponentFixture<FigureProjectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FigureProjectionComponent],
      providers: [
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useFactory: () => new LucideIconProvider({ ArrowLeft, ArrowDownUp, ArrowUpDown, Plus, Trash2 }),
        },
        {
          // Provide a minimal ActivatedRoute so the component doesn't crash in embedded mode
          provide: ActivatedRoute,
          useValue: { snapshot: { params: {} } },
        },
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

  it('emits backToSegment when back button is clicked in embedded mode', () => {
    const emitSpy = vi.spyOn(component.backToSegment, 'emit');
    const btn = fixture.nativeElement.querySelector('button[aria-label="Tornar a la vista del segment"]');
    expect(btn).not.toBeNull();
    btn.click();
    expect(emitSpy).toHaveBeenCalledOnce();
  });
});
