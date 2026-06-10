import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  LUCIDE_ICONS, LucideIconProvider,
  ArrowDownUp, ArrowUpDown, Plus, Minus, Trash2, X,
} from 'lucide-angular';
import { TroncViewComponent, TroncNodeItem, PositionOption } from './tronc-view.component';
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
        provideRouter([]),
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useFactory: () => new LucideIconProvider({ ArrowDownUp, ArrowUpDown, Plus, Minus, Trash2, X }),
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

  // ── totalColumns (doubled internally: 0.5u = 1 CSS column) ──────────────

  it('computes totalColumns as 2x max(x+width) across TRONC nodes', () => {
    fixture.componentRef.setInput('troncNodes', [
      makeNode({ x: 0, width: 2 }),
      makeNode({ id: 'n2', x: 2, width: 1 }),
    ]);
    fixture.detectChanges();
    expect(component.totalColumns()).toBe(6); // 3 * 2
  });

  it('computes totalColumns from base count when greater', () => {
    fixture.componentRef.setInput('troncNodes', [makeNode({ x: 0, width: 1 })]);
    fixture.componentRef.setInput('baseNodes', [
      makeBaseNode({ id: 'b1' }),
      makeBaseNode({ id: 'b2' }),
      makeBaseNode({ id: 'b3' }),
      makeBaseNode({ id: 'b4' }),
    ]);
    fixture.detectChanges();
    expect(component.totalColumns()).toBe(8); // 4 bases * 2
  });

  it('defaults totalColumns to 2 when no nodes exist', () => {
    expect(component.totalColumns()).toBe(2);
  });

  // ── Grid column values (doubled grid) ───────────────────────────────────

  it('computes correct grid-column for TRONC node at x=0, width=1', () => {
    const node = makeNode({ x: 0, width: 1 });
    expect(component.getTroncNodeGridColumn(node)).toBe('1 / span 2');
  });

  it('computes correct grid-column for TRONC node at x=2, width=2', () => {
    const node = makeNode({ x: 2, width: 2 });
    expect(component.getTroncNodeGridColumn(node)).toBe('5 / span 4');
  });

  it('computes correct grid-column for TRONC node at x=0.5, width=1.5', () => {
    const node = makeNode({ x: 0.5, width: 1.5 });
    expect(component.getTroncNodeGridColumn(node)).toBe('2 / span 3');
  });

  it('computes correct grid-column for BASE node by index', () => {
    expect(component.getBaseNodeGridColumn(0)).toBe('1 / span 2');
    expect(component.getBaseNodeGridColumn(3)).toBe('7 / span 2');
  });

  it('computes correct grid-column for add-node button', () => {
    // With no nodes, totalColumns = 2, so button at 3 / span 2
    expect(component.getAddNodeButtonGridColumn()).toBe('3 / span 2');
    
    // With nodes at x=0 w=2, x=2 w=2, totalColumns = 8, so button at 9 / span 2
    fixture.componentRef.setInput('troncNodes', [
      makeNode({ x: 0, width: 2 }),
      makeNode({ x: 2, width: 2 }),
    ]);
    fixture.detectChanges();
    expect(component.getAddNodeButtonGridColumn()).toBe('9 / span 2');
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

  it('floors data order is always descending (CSS handles inversion)', () => {
    fixture.componentRef.setInput('troncNodes', [
      makeNode({ id: 'n1', z: 1 }),
      makeNode({ id: 'n2', z: 2 }),
    ]);
    fixture.detectChanges();

    const order = component.floors().map((f) => f.z);
    expect(order[0]).toBeGreaterThan(order[order.length - 1]);

    component.toggleOrientation();
    const orderAfter = component.floors().map((f) => f.z);
    expect(orderAfter).toEqual(order);
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

  // ── Stepper controls (base-bound constraints) ────────────────────────────

  it('onStepX increments x by 0.5', () => {
    const emitted: { nodeId: string; x: number; width: number }[] = [];
    fixture.componentRef.instance.nodeUpdated.subscribe((e) => emitted.push(e));
    fixture.componentRef.setInput('baseNodes', [
      makeBaseNode({ id: 'b1', sortOrder: 0 }),
      makeBaseNode({ id: 'b2', sortOrder: 1 }),
      makeBaseNode({ id: 'b3', sortOrder: 2 }),
      makeBaseNode({ id: 'b4', sortOrder: 3 }),
    ]);
    fixture.detectChanges();
    const node = makeNode({ id: 'n1', x: 0, width: 1 });
    component.onStepX(node, 0.5);
    expect(emitted[0]).toEqual({ nodeId: 'n1', x: 0.5, width: 1 });
  });

  it('onStepX clamps at min 0', () => {
    const emitted: { nodeId: string; x: number; width: number }[] = [];
    fixture.componentRef.instance.nodeUpdated.subscribe((e) => emitted.push(e));
    fixture.componentRef.setInput('baseNodes', [makeBaseNode({ id: 'b1' })]);
    fixture.detectChanges();
    const node = makeNode({ id: 'n1', x: 0, width: 1 });
    component.onStepX(node, -0.5);
    expect(emitted[0].x).toBe(0);
  });

  it('onStepX clamps at max baseCount - width', () => {
    const emitted: { nodeId: string; x: number; width: number }[] = [];
    fixture.componentRef.instance.nodeUpdated.subscribe((e) => emitted.push(e));
    fixture.componentRef.setInput('baseNodes', [
      makeBaseNode({ id: 'b1', sortOrder: 0 }),
      makeBaseNode({ id: 'b2', sortOrder: 1 }),
    ]);
    fixture.detectChanges();
    const node = makeNode({ id: 'n1', x: 1, width: 1 });
    component.onStepX(node, 0.5);
    expect(emitted[0].x).toBe(1);
  });

  it('onStepWidth clamps at min 0.5', () => {
    const emitted: { nodeId: string; x: number; width: number }[] = [];
    fixture.componentRef.instance.nodeUpdated.subscribe((e) => emitted.push(e));
    fixture.componentRef.setInput('baseNodes', [makeBaseNode({ id: 'b1' })]);
    fixture.detectChanges();
    const node = makeNode({ id: 'n1', x: 0, width: 0.5 });
    component.onStepWidth(node, -0.5);
    expect(emitted[0].width).toBe(0.5);
  });

  it('onStepWidth clamps at max baseCount - x', () => {
    const emitted: { nodeId: string; x: number; width: number }[] = [];
    fixture.componentRef.instance.nodeUpdated.subscribe((e) => emitted.push(e));
    fixture.componentRef.setInput('baseNodes', [
      makeBaseNode({ id: 'b1', sortOrder: 0 }),
      makeBaseNode({ id: 'b2', sortOrder: 1 }),
      makeBaseNode({ id: 'b3', sortOrder: 2 }),
    ]);
    fixture.detectChanges();
    const node = makeNode({ id: 'n1', x: 1, width: 2 });
    component.onStepWidth(node, 0.5);
    expect(emitted[0].width).toBe(2);
  });

  it('xAtMin returns true when x is 0', () => {
    const node = makeNode({ x: 0, width: 1 });
    expect(component.xAtMin(node)).toBe(true);
  });

  it('xAtMax returns true when x = baseCount - width', () => {
    fixture.componentRef.setInput('baseNodes', [
      makeBaseNode({ id: 'b1', sortOrder: 0 }),
      makeBaseNode({ id: 'b2', sortOrder: 1 }),
    ]);
    fixture.detectChanges();
    const node = makeNode({ x: 1, width: 1 });
    expect(component.xAtMax(node)).toBe(true);
  });

  it('widthAtMin returns true when width is 0.5', () => {
    const node = makeNode({ width: 0.5 });
    expect(component.widthAtMin(node)).toBe(true);
  });

  it('widthAtMax returns true when width = baseCount - x', () => {
    fixture.componentRef.setInput('baseNodes', [
      makeBaseNode({ id: 'b1', sortOrder: 0 }),
      makeBaseNode({ id: 'b2', sortOrder: 1 }),
      makeBaseNode({ id: 'b3', sortOrder: 2 }),
    ]);
    fixture.detectChanges();
    const node = makeNode({ x: 1, width: 2 });
    expect(component.widthAtMax(node)).toBe(true);
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

  // ── Sequential floor management (canAddFloor / canRemoveFloor) ──────────

  it('canAddFloor returns false when no bases exist', () => {
    expect(component.canAddFloor()).toBe(false);
  });

  it('canAddFloor returns true when bases exist and maxZ < MAX_TRONC_Z', () => {
    fixture.componentRef.setInput('baseNodes', [makeBaseNode()]);
    fixture.detectChanges();
    expect(component.canAddFloor()).toBe(true);
  });

  it('canAddFloor returns false when all 5 z levels have nodes', () => {
    const allFloors = [];
    for (let z = 1; z <= 5; z++) {
      allFloors.push(makeNode({ id: `n${z}`, z }));
    }
    fixture.componentRef.setInput('troncNodes', allFloors);
    fixture.componentRef.setInput('baseNodes', [makeBaseNode()]);
    fixture.detectChanges();
    expect(component.canAddFloor()).toBe(false);
  });

  it('canRemoveFloor returns true for topmost z', () => {
    fixture.componentRef.setInput('troncNodes', [
      makeNode({ id: 'n1', z: 1 }),
      makeNode({ id: 'n2', z: 2 }),
    ]);
    fixture.detectChanges();
    expect(component.canRemoveFloor(2)).toBe(true);
  });

  it('canRemoveFloor returns false for non-topmost z', () => {
    fixture.componentRef.setInput('troncNodes', [
      makeNode({ id: 'n1', z: 1 }),
      makeNode({ id: 'n2', z: 2 }),
    ]);
    fixture.detectChanges();
    expect(component.canRemoveFloor(1)).toBe(false);
  });

  it('onAddFloor creates floor at maxExistingZ + 1', () => {
    const emitted: { z: number; positionType: string; label: string; sortOrder: number }[] = [];
    fixture.componentRef.instance.nodeAdded.subscribe((e) => emitted.push(e));
    fixture.componentRef.setInput('baseNodes', [makeBaseNode()]);
    fixture.componentRef.setInput('troncNodes', [makeNode({ z: 1 })]);
    fixture.detectChanges();
    component.onAddFloor();
    expect(emitted[0].z).toBe(2);
    expect(emitted[0].sortOrder).toBe(0);
  });

  it('onAddFloor uses first troncPosition when available', () => {
    const positions: PositionOption[] = [
      { slug: 'alcadora', name: 'Alçadora', color: null },
      { slug: 'segon', name: 'Segon/Segona', color: null },
    ];
    const emitted: { z: number; positionType: string; label: string }[] = [];
    fixture.componentRef.instance.nodeAdded.subscribe((e) => emitted.push(e));
    fixture.componentRef.setInput('baseNodes', [makeBaseNode()]);
    fixture.componentRef.setInput('troncPositions', positions);
    fixture.detectChanges();
    component.onAddFloor();
    expect(emitted[0].positionType).toBe('alcadora');
    expect(emitted[0].label).toBe('Alçadora');
  });

  it('onAddFloor uses fallback when no troncPositions configured', () => {
    const emitted: { z: number; positionType: string; label: string }[] = [];
    fixture.componentRef.instance.nodeAdded.subscribe((e) => emitted.push(e));
    fixture.componentRef.setInput('baseNodes', [makeBaseNode()]);
    fixture.detectChanges();
    component.onAddFloor();
    expect(emitted[0].positionType).toBe('tronc');
    expect(emitted[0].label).toBe('Tronc');
  });

  it('onRemoveFloor emits floorRemoved for topmost z', () => {
    const emitted: number[] = [];
    fixture.componentRef.instance.floorRemoved.subscribe((z: number) => emitted.push(z));
    fixture.componentRef.setInput('troncNodes', [
      makeNode({ id: 'n1', z: 1 }),
      makeNode({ id: 'n2', z: 2 }),
    ]);
    fixture.detectChanges();
    component.onRemoveFloor(2);
    expect(emitted).toEqual([2]);
  });

  it('onRemoveFloor does not emit for non-topmost z', () => {
    const emitted: number[] = [];
    fixture.componentRef.instance.floorRemoved.subscribe((z: number) => emitted.push(z));
    fixture.componentRef.setInput('troncNodes', [
      makeNode({ id: 'n1', z: 1 }),
      makeNode({ id: 'n2', z: 2 }),
    ]);
    fixture.detectChanges();
    component.onRemoveFloor(1);
    expect(emitted.length).toBe(0);
  });

  // ── Position catalog ────────────────────────────────────────────────────

  it('troncPositions defaults to empty array', () => {
    expect(component.troncPositions()).toEqual([]);
  });

  it('onPositionTypeChange emits correct positionType and label', () => {
    const positions: PositionOption[] = [
      { slug: 'segon', name: 'Segon/Segona', color: '#ff0000' },
      { slug: 'alcadora', name: 'Alçadora', color: '#00ff00' },
    ];
    fixture.componentRef.setInput('troncPositions', positions);
    fixture.detectChanges();

    const emitted: { nodeId: string; positionType?: string; label?: string }[] = [];
    fixture.componentRef.instance.nodeUpdated.subscribe((e) => emitted.push(e));
    const node = makeNode({ id: 'n1', positionType: 'segon' });
    component.onPositionTypeChange(node, 'alcadora');
    expect(emitted[0].positionType).toBe('alcadora');
    expect(emitted[0].label).toBe('Alçadora');
  });

  // ── Position color coding (SP3) ──────────────────────────────────────────

  describe('getPositionColor', () => {
    it('returns null when troncPositions is empty', () => {
      const node = makeNode({ positionType: 'segon' });
      expect(component.getPositionColor(node)).toBeNull();
    });

    it('returns null when node has no matching positionType', () => {
      fixture.componentRef.setInput('troncPositions', [
        { slug: 'alcadora', name: 'Alçadora', color: '#0000ff' },
      ]);
      fixture.detectChanges();
      const node = makeNode({ positionType: 'segon' });
      expect(component.getPositionColor(node)).toBeNull();
    });

    it('returns null when node positionType is null', () => {
      fixture.componentRef.setInput('troncPositions', [
        { slug: 'segon', name: 'Segon', color: '#ff0000' },
      ]);
      fixture.detectChanges();
      const node = makeNode({ positionType: null });
      expect(component.getPositionColor(node)).toBeNull();
    });

    it('returns color string when slug matches', () => {
      fixture.componentRef.setInput('troncPositions', [
        { slug: 'segon', name: 'Segon', color: '#ff0000' },
        { slug: 'alcadora', name: 'Alçadora', color: '#0000ff' },
      ]);
      fixture.detectChanges();
      const node = makeNode({ positionType: 'segon' });
      expect(component.getPositionColor(node)).toBe('#ff0000');
    });

    it('returns null when matching position has null color', () => {
      fixture.componentRef.setInput('troncPositions', [
        { slug: 'segon', name: 'Segon', color: null },
      ]);
      fixture.detectChanges();
      const node = makeNode({ positionType: 'segon' });
      expect(component.getPositionColor(node)).toBeNull();
    });
  });

  describe('position color border rendering', () => {
    const positions: PositionOption[] = [
      { slug: 'segon', name: 'Segon', color: '#ff0000' },
    ];

    it('renders position-colored class in assignment mode', () => {
      fixture.componentRef.setInput('troncNodes', [makeNode({ positionType: 'segon' })]);
      fixture.componentRef.setInput('baseNodes', [makeBaseNode()]);
      fixture.componentRef.setInput('troncPositions', positions);
      fixture.componentRef.setInput('mode', 'assignment');
      fixture.detectChanges();

      const colored = fixture.nativeElement.querySelectorAll('.tronc-node.position-colored');
      expect(colored.length).toBeGreaterThan(0);
    });

    it('does not render position-colored class in editor mode', () => {
      fixture.componentRef.setInput('troncNodes', [makeNode({ positionType: 'segon' })]);
      fixture.componentRef.setInput('baseNodes', [makeBaseNode()]);
      fixture.componentRef.setInput('troncPositions', positions);
      fixture.componentRef.setInput('mode', 'editor');
      fixture.detectChanges();

      const colored = fixture.nativeElement.querySelectorAll('.tronc-node.position-colored');
      expect(colored.length).toBe(0);
    });

    it('does not render position-colored class in projection mode', () => {
      fixture.componentRef.setInput('troncNodes', [makeNode({ positionType: 'segon' })]);
      fixture.componentRef.setInput('baseNodes', [makeBaseNode()]);
      fixture.componentRef.setInput('troncPositions', positions);
      fixture.componentRef.setInput('mode', 'projection');
      fixture.detectChanges();

      const colored = fixture.nativeElement.querySelectorAll('.tronc-node.position-colored');
      expect(colored.length).toBe(0);
    });
  });

  // ── Floor label resolution (SP3) ───────────────────────────────────────

  describe('floor positionTypeLabel resolution', () => {
    it('resolves slug to Position.name when positions are loaded', () => {
      fixture.componentRef.setInput('troncPositions', [
        { slug: 'segon', name: 'Segon/Segona', color: null },
      ]);
      fixture.componentRef.setInput('troncNodes', [
        makeNode({ id: 'n1', z: 1, positionType: 'segon' }),
      ]);
      fixture.detectChanges();

      const floor = component.floors().find((f) => f.z === 1);
      expect(floor?.positionTypeLabel).toBe('Segon/Segona');
    });

    it('falls back to raw slug when positions are empty', () => {
      fixture.componentRef.setInput('troncNodes', [
        makeNode({ id: 'n1', z: 1, positionType: 'segon' }),
      ]);
      fixture.detectChanges();

      const floor = component.floors().find((f) => f.z === 1);
      expect(floor?.positionTypeLabel).toBe('segon');
    });

    it('falls back to raw slug when no matching position found', () => {
      fixture.componentRef.setInput('troncPositions', [
        { slug: 'alcadora', name: 'Alçadora', color: null },
      ]);
      fixture.componentRef.setInput('troncNodes', [
        makeNode({ id: 'n1', z: 1, positionType: 'segon' }),
      ]);
      fixture.detectChanges();

      const floor = component.floors().find((f) => f.z === 1);
      expect(floor?.positionTypeLabel).toBe('segon');
    });

    it('shows position-type-label in DOM in assignment mode', () => {
      fixture.componentRef.setInput('troncPositions', [
        { slug: 'segon', name: 'Segon/Segona', color: null },
      ]);
      fixture.componentRef.setInput('troncNodes', [
        makeNode({ id: 'n1', z: 1, positionType: 'segon' }),
      ]);
      fixture.componentRef.setInput('baseNodes', [makeBaseNode()]);
      fixture.componentRef.setInput('mode', 'assignment');
      fixture.detectChanges();

      const labels = fixture.nativeElement.querySelectorAll('.position-type-label');
      expect(labels.length).toBeGreaterThan(0);
      const texts = Array.from(labels as NodeListOf<HTMLElement>).map((el) => el.textContent?.trim());
      expect(texts).toContain('Segon/Segona');
    });

    it('does not show position-type-label in editor mode', () => {
      fixture.componentRef.setInput('troncNodes', [makeNode()]);
      fixture.componentRef.setInput('baseNodes', [makeBaseNode()]);
      fixture.componentRef.setInput('mode', 'editor');
      fixture.detectChanges();

      const labels = fixture.nativeElement.querySelectorAll('.position-type-label');
      expect(labels.length).toBe(0);
    });

    it('does not show position-type-label in projection mode', () => {
      fixture.componentRef.setInput('troncNodes', [makeNode()]);
      fixture.componentRef.setInput('baseNodes', [makeBaseNode()]);
      fixture.componentRef.setInput('mode', 'projection');
      fixture.detectChanges();

      const labels = fixture.nativeElement.querySelectorAll('.position-type-label');
      expect(labels.length).toBe(0);
    });
  });

  // ── Projection mode ───────────────────────────────────────────────────────

  describe('projection mode', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('troncNodes', [makeNode()]);
      fixture.componentRef.setInput('baseNodes', [makeBaseNode()]);
      fixture.componentRef.setInput('assignments', [makeAssignment('node-1', 'Lluna', 155)]);
      fixture.componentRef.setInput('mode', 'projection');
      fixture.detectChanges();
    });

    it('does not render height badges', () => {
      const badges = fixture.nativeElement.querySelectorAll('.height-badge');
      expect(badges.length).toBe(0);
    });

    it('does not render attendance dots', () => {
      const dots = fixture.nativeElement.querySelectorAll('.attendance-dot');
      expect(dots.length).toBe(0);
    });

    it('renders person alias with text-base class for larger font', () => {
      const aliases = fixture.nativeElement.querySelectorAll('.person-alias.text-base');
      expect(aliases.length).toBeGreaterThan(0);
    });

    it('does not render editor controls (+ button, floor dropdown)', () => {
      const editorControls = fixture.nativeElement.querySelector('.editor-controls');
      expect(editorControls).toBeNull();
    });

    it('does not render variance indicators', () => {
      const variances = fixture.nativeElement.querySelectorAll('.floor-variance');
      expect(variances.length).toBe(0);
    });

    it('does not render progress badges', () => {
      const progressBadges = fixture.nativeElement.querySelectorAll('.progress-badge');
      expect(progressBadges.length).toBe(0);
    });
  });
});
