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

  it('nodeUpdated emits with clamped width (max 8) on onNodeWidthChange', () => {
    const emitted: { nodeId: string; x: number; width: number }[] = [];
    fixture.componentRef.instance.nodeUpdated.subscribe((e) => emitted.push(e));
    const node = makeNode({ id: 'n1', x: 0, width: 1 });
    component.onNodeWidthChange(node, 10);
    expect(emitted[0]).toEqual({ nodeId: 'n1', x: 0, width: 8 });
  });

  it('nodeUpdated supports 0.5 step for width', () => {
    const emitted: { nodeId: string; x: number; width: number }[] = [];
    fixture.componentRef.instance.nodeUpdated.subscribe((e) => emitted.push(e));
    const node = makeNode({ id: 'n1', x: 0, width: 1 });
    component.onNodeWidthChange(node, 1.5);
    expect(emitted[0]).toEqual({ nodeId: 'n1', x: 0, width: 1.5 });
  });

  it('nodeUpdated rounds x to nearest 0.5 on onNodeXChange', () => {
    const emitted: { nodeId: string; x: number; width: number }[] = [];
    fixture.componentRef.instance.nodeUpdated.subscribe((e) => emitted.push(e));
    const node = makeNode({ id: 'n1', x: 0, width: 2 });
    component.onNodeXChange(node, 1.7);
    expect(emitted[0]).toEqual({ nodeId: 'n1', x: 1.5, width: 2 });
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

  // ── availableFloorOptions ────────────────────────────────────────────────

  it('shows all floor options when no tronc floors exist', () => {
    const opts = component.availableFloorOptions();
    expect(opts.length).toBeGreaterThan(0);
    expect(opts[0].z).toBe(1);
  });

  it('excludes z levels that already have nodes', () => {
    fixture.componentRef.setInput('troncNodes', [makeNode({ z: 1}), makeNode({ z: 2 })]);
    fixture.detectChanges();
    const opts = component.availableFloorOptions();
    expect(opts.some((o) => o.z === 2)).toBe(false);
    expect(opts.some((o) => o.z === 1)).toBe(false);
    expect(opts.some((o) => o.z === 3)).toBe(true);
  });

  it('is empty when all z levels have nodes', () => {
    const allFloors = [];
    for (let z = 1; z <= 5; z++) {
      allFloors.push(makeNode({ id: `n${z}`, z }));
    }
    fixture.componentRef.setInput('troncNodes', allFloors);
    fixture.detectChanges();
    expect(component.availableFloorOptions().length).toBe(0);
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
