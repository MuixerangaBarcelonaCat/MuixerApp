import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  LUCIDE_ICONS, LucideIconProvider,
  ArrowDownUp, ArrowUpDown, Plus, Trash2, X,
} from 'lucide-angular';
import { TroncViewComponent, TroncNodeItem } from './tronc-view.component';
import { AssignmentDetail } from '../../models/assignment.model';

function makeNode(overrides: Partial<TroncNodeItem> = {}): TroncNodeItem {
  return {
    id: 'node-1',
    label: 'Segon',
    zone: 'TRONC',
    positionType: 'segon',
    x: 0,
    z: 1,
    width: 1,
    sortOrder: 0,
    ...overrides,
  };
}

function makeBaseNode(overrides: Partial<TroncNodeItem> = {}): TroncNodeItem {
  return {
    id: 'base-1',
    label: 'Base',
    zone: 'BASE',
    positionType: 'base',
    x: 500,  // pinya canvas pixel coordinate, ignored in tronc view
    z: 0,
    width: 80, // pinya canvas pixel dimension, treated as 1 in tronc view
    sortOrder: 0,
    ...overrides,
  };
}

function makeAssignment(nodeId: string, alias: string, shoulderHeight: number | null = 165): AssignmentDetail {
  return {
    id: `assign-${nodeId}`,
    figureInstanceId: 'instance-1',
    compositionSlotId: null,
    node: {
      id: nodeId,
      label: 'Node',
      zone: 'TRONC',
      z: 1,
      positionType: 'segon',
      sortOrder: 0,
      ringLevel: null,
      originNodeId: null,
      sourceNodeId: null,
    },
    person: {
      id: `person-${nodeId}`,
      alias,
      name: 'Test',
      firstSurname: 'User',
      shoulderHeight,
    },
  };
}

describe('TroncViewComponent', () => {
  let component: TroncViewComponent;
  let fixture: ComponentFixture<TroncViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TroncViewComponent],
      providers: [
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useFactory: () => new LucideIconProvider({ ArrowDownUp, ArrowUpDown, Plus, Trash2, X }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TroncViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ── Floor grouping ────────────────────────────────────────────────────────

  it('shows no floors when no nodes are provided', () => {
    expect(component.floors().length).toBe(1); // P1 (bases) always rendered
    expect(component.floors()[0].isBase).toBe(true);
  });

  it('groups TRONC nodes by z into separate floors', () => {
    fixture.componentRef.setInput('troncNodes', [
      makeNode({ id: 'n1', z: 1 }),
      makeNode({ id: 'n2', z: 2 }),
      makeNode({ id: 'n3', z: 2 }),
    ]);
    fixture.detectChanges();

    const nonBaseFloors = component.floors().filter((f) => !f.isBase);
    expect(nonBaseFloors.length).toBe(2);
    expect(nonBaseFloors.find((f) => f.z === 1)?.nodes.length).toBe(1);
    expect(nonBaseFloors.find((f) => f.z === 2)?.nodes.length).toBe(2);
  });

  it('always includes the BASE floor as P1 (z=0)', () => {
    fixture.componentRef.setInput('baseNodes', [makeBaseNode()]);
    fixture.detectChanges();

    const baseFloor = component.floors().find((f) => f.isBase);
    expect(baseFloor).toBeDefined();
    expect(baseFloor!.pisLabel).toBe('P1');
    expect(baseFloor!.nodes.length).toBe(1);
  });

  // ── totalColumns ──────────────────────────────────────────────────────────

  it('computes totalColumns as max(x+width) across TRONC nodes', () => {
    fixture.componentRef.setInput('troncNodes', [
      makeNode({ x: 0, width: 2 }),
      makeNode({ id: 'n2', x: 2, width: 1 }),
    ]);
    fixture.detectChanges();
    expect(component.totalColumns()).toBe(3);
  });

  it('computes totalColumns as base node count when greater than TRONC max', () => {
    fixture.componentRef.setInput('troncNodes', [makeNode({ x: 0, width: 1 })]);
    fixture.componentRef.setInput('baseNodes', [
      makeBaseNode({ id: 'b1' }),
      makeBaseNode({ id: 'b2' }),
      makeBaseNode({ id: 'b3' }),
      makeBaseNode({ id: 'b4' }),
    ]);
    fixture.detectChanges();
    expect(component.totalColumns()).toBe(4);
  });

  it('defaults totalColumns to 1 when no nodes exist', () => {
    expect(component.totalColumns()).toBe(1);
  });

  // ── Grid column values ────────────────────────────────────────────────────

  it('computes correct grid-column for TRONC node at x=0, width=1', () => {
    const node = makeNode({ x: 0, width: 1 });
    expect(component.getTroncNodeGridColumn(node)).toBe('1 / span 1');
  });

  it('computes correct grid-column for TRONC node at x=2, width=2', () => {
    const node = makeNode({ x: 2, width: 2 });
    expect(component.getTroncNodeGridColumn(node)).toBe('3 / span 2');
  });

  it('computes correct grid-column for BASE node by index', () => {
    expect(component.getBaseNodeGridColumn(0)).toBe('1 / span 1');
    expect(component.getBaseNodeGridColumn(3)).toBe('4 / span 1');
  });

  // ── Orientation toggle ────────────────────────────────────────────────────

  it('defaults to not inverted', () => {
    expect(component.inverted()).toBe(false);
  });

  it('toggleOrientation inverts the flag', () => {
    component.toggleOrientation();
    expect(component.inverted()).toBe(true);
    component.toggleOrientation();
    expect(component.inverted()).toBe(false);
  });

  it('reverses floor order when inverted', () => {
    fixture.componentRef.setInput('troncNodes', [
      makeNode({ id: 'n1', z: 1 }),
      makeNode({ id: 'n2', z: 2 }),
    ]);
    fixture.detectChanges();

    const normalOrder = component.floors().map((f) => f.z);
    component.toggleOrientation();
    const invertedOrder = component.floors().map((f) => f.z);

    expect(normalOrder[0]).toBeGreaterThan(normalOrder[normalOrder.length - 1]);
    expect(invertedOrder[0]).toBeLessThan(invertedOrder[invertedOrder.length - 1]);
  });

  // ── Assignment info ───────────────────────────────────────────────────────

  it('isAssigned returns false for unassigned node', () => {
    expect(component.isAssigned('node-1')).toBe(false);
  });

  it('isAssigned returns true after assignment', () => {
    fixture.componentRef.setInput('assignments', [makeAssignment('node-1', 'Pepet')]);
    fixture.detectChanges();
    expect(component.isAssigned('node-1')).toBe(true);
  });

  it('getAssignment returns the correct assignment for a node', () => {
    const assignment = makeAssignment('node-1', 'Pepet', 165);
    fixture.componentRef.setInput('assignments', [assignment]);
    fixture.detectChanges();
    expect(component.getAssignment('node-1')).toEqual(assignment);
    expect(component.getAssignment('node-2')).toBeUndefined();
  });

  // ── Height display ────────────────────────────────────────────────────────

  it('getHeightDisplay returns empty string for null height', () => {
    expect(component.getHeightDisplay(null)).toBe('');
  });

  it('getHeightDisplay returns relative height (positive diff)', () => {
    expect(component.getHeightDisplay(145)).toBe('+5');
  });

  it('getHeightDisplay returns relative height (negative diff)', () => {
    expect(component.getHeightDisplay(135)).toBe('-5');
  });

  it('getHeightDisplay returns absolute value when heightMode is absolute', () => {
    fixture.componentRef.setInput('heightMode', 'absolute');
    fixture.detectChanges();
    expect(component.getHeightDisplay(165)).toBe('165');
  });

  // ── Variance ──────────────────────────────────────────────────────────────

  it('getVarianceDisplay returns "—" when fewer than 2 assigned', () => {
    fixture.componentRef.setInput('troncNodes', [makeNode({ id: 'n1', z: 1 })]);
    fixture.componentRef.setInput('assignments', [makeAssignment('n1', 'P', 160)]);
    fixture.detectChanges();
    expect(component.getVarianceDisplay(1)).toBe('—');
  });

  it('getVarianceDisplay returns Δ value when 2+ persons assigned', () => {
    fixture.componentRef.setInput('troncNodes', [
      makeNode({ id: 'n1', z: 1 }),
      makeNode({ id: 'n2', z: 1 }),
    ]);
    fixture.componentRef.setInput('assignments', [
      makeAssignment('n1', 'P1', 160),
      makeAssignment('n2', 'P2', 165),
    ]);
    fixture.detectChanges();
    expect(component.getVarianceDisplay(1)).toBe('Δ 5cm');
  });

  it('getVarianceLevel returns success for ≤2cm variance', () => {
    fixture.componentRef.setInput('troncNodes', [
      makeNode({ id: 'n1', z: 1 }),
      makeNode({ id: 'n2', z: 1 }),
    ]);
    fixture.componentRef.setInput('assignments', [
      makeAssignment('n1', 'P1', 162),
      makeAssignment('n2', 'P2', 164),
    ]);
    fixture.detectChanges();
    expect(component.getVarianceLevel(1)).toBe('success');
  });

  it('getVarianceLevel returns error for ≥5cm variance', () => {
    fixture.componentRef.setInput('troncNodes', [
      makeNode({ id: 'n1', z: 1 }),
      makeNode({ id: 'n2', z: 1 }),
    ]);
    fixture.componentRef.setInput('assignments', [
      makeAssignment('n1', 'P1', 155),
      makeAssignment('n2', 'P2', 165),
    ]);
    fixture.detectChanges();
    expect(component.getVarianceLevel(1)).toBe('error');
  });

  // ── Progress ──────────────────────────────────────────────────────────────

  it('progressByFloor reflects assigned/total counts correctly', () => {
    fixture.componentRef.setInput('troncNodes', [
      makeNode({ id: 'n1', z: 1 }),
      makeNode({ id: 'n2', z: 1 }),
    ]);
    fixture.componentRef.setInput('assignments', [makeAssignment('n1', 'P', 160)]);
    fixture.detectChanges();

    const progress = component.progressByFloor().get(1);
    expect(progress?.assigned).toBe(1);
    expect(progress?.total).toBe(2);
  });

  it('getProgressDisplay returns "assigned/total" string', () => {
    fixture.componentRef.setInput('troncNodes', [
      makeNode({ id: 'n1', z: 2 }),
      makeNode({ id: 'n2', z: 2 }),
    ]);
    fixture.componentRef.setInput('assignments', [
      makeAssignment('n1', 'P1'),
      makeAssignment('n2', 'P2'),
    ]);
    fixture.detectChanges();
    expect(component.getProgressDisplay(2)).toBe('2/2');
  });

  // ── Selection ──────────────────────────────────────────────────────────────

  it('isSelected returns false initially', () => {
    expect(component.isSelected('node-1')).toBe(false);
  });

  it('isSelected returns true when input selectedNodeId matches', () => {
    fixture.componentRef.setInput('selectedNodeId', 'node-1');
    fixture.detectChanges();
    expect(component.isSelected('node-1')).toBe(true);
    expect(component.isSelected('node-2')).toBe(false);
  });

  it('selectedTroncNode returns null when BASE is selected', () => {
    fixture.componentRef.setInput('baseNodes', [makeBaseNode({ id: 'base-1' })]);
    fixture.componentRef.setInput('selectedNodeId', 'base-1');
    fixture.detectChanges();
    expect(component.selectedTroncNode()).toBeNull();
  });

  it('selectedTroncNode returns the matching TRONC node when selected', () => {
    const node = makeNode({ id: 'tronc-1' });
    fixture.componentRef.setInput('troncNodes', [node]);
    fixture.componentRef.setInput('selectedNodeId', 'tronc-1');
    fixture.detectChanges();
    expect(component.selectedTroncNode()?.id).toBe('tronc-1');
  });

  // ── Editor outputs ────────────────────────────────────────────────────────

  it('nodeRemoved emits node id when onNodeDelete is called', () => {
    const emitted: string[] = [];
    fixture.componentRef.instance.nodeRemoved.subscribe((id: string) => emitted.push(id));
    const node = makeNode({ id: 'tronc-del' });
    component.onNodeDelete(node);
    expect(emitted).toEqual(['tronc-del']);
  });

  it('nodeUpdated emits with clamped width when onNodeWidthChange is called', () => {
    const emitted: { nodeId: string; x: number; width: number }[] = [];
    fixture.componentRef.instance.nodeUpdated.subscribe((e) => emitted.push(e));
    const node = makeNode({ id: 'n1', x: 0, width: 1 });
    component.onNodeWidthChange(node, 5); // 5 should be clamped to 4
    expect(emitted[0]).toEqual({ nodeId: 'n1', x: 0, width: 4 });
  });

  it('nodeUpdated emits with floor(x) when onNodeXChange is called', () => {
    const emitted: { nodeId: string; x: number; width: number }[] = [];
    fixture.componentRef.instance.nodeUpdated.subscribe((e) => emitted.push(e));
    const node = makeNode({ id: 'n1', x: 0, width: 2 });
    component.onNodeXChange(node, 1.9); // should floor to 1
    expect(emitted[0]).toEqual({ nodeId: 'n1', x: 1, width: 2 });
  });

  it('baseAdded emits with sortOrder = current base count', () => {
    const emitted: { sortOrder: number }[] = [];
    fixture.componentRef.instance.baseAdded.subscribe((e) => emitted.push(e));
    fixture.componentRef.setInput('baseNodes', [makeBaseNode({ id: 'b1' })]);
    fixture.detectChanges();
    component.onAddBase();
    expect(emitted[0]).toEqual({ sortOrder: 1 });
  });

  it('baseRemoved emits the base node id', () => {
    const emitted: string[] = [];
    fixture.componentRef.instance.baseRemoved.subscribe((id: string) => emitted.push(id));
    component.onRemoveBase('base-99');
    expect(emitted).toEqual(['base-99']);
  });

  // ── No-tronc state ────────────────────────────────────────────────────────

  it('hasTronc is false when no nodes exist', () => {
    expect(component.hasTronc()).toBe(false);
  });

  it('hasTronc is true when baseNodes are provided', () => {
    fixture.componentRef.setInput('baseNodes', [makeBaseNode()]);
    fixture.detectChanges();
    expect(component.hasTronc()).toBe(true);
  });

  it('hasTronc is true when troncNodes are provided', () => {
    fixture.componentRef.setInput('troncNodes', [makeNode()]);
    fixture.detectChanges();
    expect(component.hasTronc()).toBe(true);
  });

  // ── nextFloorOptions ─────────────────────────────────────────────────────

  it('nextFloorOptions shows floor types for nextZ when no tronc floors exist', () => {
    expect(component.nextFloorOptions().length).toBeGreaterThan(0);
    expect(component.nextFloorOptions()[0].z).toBe(1);
  });

  it('nextFloorOptions shows options for the next available z', () => {
    fixture.componentRef.setInput('troncNodes', [makeNode({ z: 2 })]);
    fixture.detectChanges();
    expect(component.nextFloorOptions()[0].z).toBe(3);
  });

  it('nextFloorOptions is empty when max z reaches MAX_TRONC_Z', () => {
    fixture.componentRef.setInput('troncNodes', [makeNode({ z: 5 })]);
    fixture.detectChanges();
    expect(component.nextFloorOptions().length).toBe(0);
  });
});
