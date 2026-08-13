import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
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
    color: null,
    climbIndicator: null,
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
    color: null,
    climbIndicator: null,
    ...overrides,
  };
}

function makeAssignment(nodeId: string, alias: string, shoulderHeight: number | null = 165): AssignmentDetail {
  return {
    id: `assign-${nodeId}`,
    figureInstanceId: 'instance-1',
    node: {
      id: nodeId,
      label: 'Node',
      zone: 'TRONC',
      z: 1,
      positionType: 'segon',
      sortOrder: 0,
      climbIndicator: null,
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
      notes: null,
      notesEmoji: null,
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
        allLucideIconsProvider,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TroncViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ── Floor grouping ────────────────────────────────────────────────────────

  it('shows no floors when no nodes are provided', () => {
    expect(component.floors().length).toBe(0);
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

  // ── Conflict style (Phase 3) ──────────────────────────────────────────────

  it('isConflict is false when the node has no assignment', () => {
    fixture.componentRef.setInput('conflictPersonIds', new Set(['person-node-1']));
    fixture.detectChanges();
    expect(component.isConflict('node-1')).toBe(false);
  });

  it('isConflict is false when the assigned person is not in conflict (production default)', () => {
    fixture.componentRef.setInput('assignments', [makeAssignment('node-1', 'Pepet')]);
    fixture.componentRef.setInput('conflictPersonIds', new Set<string>());
    fixture.detectChanges();
    expect(component.isConflict('node-1')).toBe(false);
  });

  it('isConflict is true when the assigned person is in conflict', () => {
    fixture.componentRef.setInput('assignments', [makeAssignment('node-1', 'Pepet')]);
    fixture.componentRef.setInput('conflictPersonIds', new Set(['person-node-1']));
    fixture.detectChanges();
    expect(component.isConflict('node-1')).toBe(true);
  });

  it('renders no .tronc-node.conflict in the DOM with zero conflicts (production default)', () => {
    fixture.componentRef.setInput('troncNodes', [makeNode({ id: 'node-1' })]);
    fixture.componentRef.setInput('assignments', [makeAssignment('node-1', 'Pepet')]);
    fixture.componentRef.setInput('conflictPersonIds', new Set<string>());
    fixture.componentRef.setInput('mode', 'assignment');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.tronc-node.conflict').length).toBe(0);
  });

  it('renders the .conflict class on the DOM node whose assigned person is in conflict', () => {
    fixture.componentRef.setInput('troncNodes', [makeNode({ id: 'node-1' })]);
    fixture.componentRef.setInput('assignments', [makeAssignment('node-1', 'Pepet')]);
    fixture.componentRef.setInput('conflictPersonIds', new Set(['person-node-1']));
    fixture.componentRef.setInput('mode', 'assignment');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.tronc-node.conflict').length).toBe(1);
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

  it('selectedFloorNode returns the matching TRONC node when selected', () => {
    const node = makeNode({ id: 'tronc-1' });
    fixture.componentRef.setInput('troncNodes', [node]);
    fixture.componentRef.setInput('selectedNodeId', 'tronc-1');
    fixture.detectChanges();
    expect(component.selectedFloorNode()?.id).toBe('tronc-1');
  });

  it('selectedFloorNode returns the matching BASE node when selected', () => {
    fixture.componentRef.setInput('baseNodes', [makeBaseNode({ id: 'base-1' })]);
    fixture.componentRef.setInput('selectedNodeId', 'base-1');
    fixture.detectChanges();
    expect(component.selectedFloorNode()?.id).toBe('base-1');
  });

  it('selectedFloorNode returns null when nothing is selected', () => {
    expect(component.selectedFloorNode()).toBeNull();
  });

  // ── Editor outputs ────────────────────────────────────────────────────────

  it('nodeUpdated emits climbIndicator when onIndicatorChange is called', () => {
    const emitted: { nodeId: string; climbIndicator?: string | null }[] = [];
    fixture.componentRef.instance.nodeUpdated.subscribe((e: (typeof emitted)[number]) => emitted.push(e));
    const node = makeBaseNode({ id: 'base-1', x: 0, width: 1 });
    component.onIndicatorChange(node, 'X');
    expect(emitted).toEqual([{ nodeId: 'base-1', x: 0, width: 1, climbIndicator: 'X' }]);
  });

  it('onIndicatorChange emits null when cleared', () => {
    const emitted: { nodeId: string; climbIndicator?: string | null }[] = [];
    fixture.componentRef.instance.nodeUpdated.subscribe((e: (typeof emitted)[number]) => emitted.push(e));
    const node = makeNode({ id: 'tronc-1', x: 0, width: 1 });
    component.onIndicatorChange(node, '');
    expect(emitted).toEqual([{ nodeId: 'tronc-1', x: 0, width: 1, climbIndicator: null }]);
  });

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

  // ── getAttendanceColor ────────────────────────────────────────────────────

  describe('getAttendanceColor', () => {
    it('ASSISTIT → green regardless of isPast', () => {
      const a = makeAssignment('node-1', 'Pepet');
      fixture.componentRef.setInput('assignments', [a]);
      fixture.componentRef.setInput('attendanceMap', new Map([['person-node-1', 'ASSISTIT']]));
      fixture.detectChanges();
      expect(component.getAttendanceColor(a)).toBe('oklch(var(--su))');
    });

    it('ANIRE → green for future event (isPast=false)', () => {
      const a = makeAssignment('node-1', 'Pepet');
      fixture.componentRef.setInput('assignments', [a]);
      fixture.componentRef.setInput('attendanceMap', new Map([['person-node-1', 'ANIRE']]));
      fixture.componentRef.setInput('isPast', false);
      fixture.detectChanges();
      expect(component.getAttendanceColor(a)).toBe('oklch(var(--su))');
    });

    it('ANIRE → amber for past event (isPast=true)', () => {
      const a = makeAssignment('node-1', 'Pepet');
      fixture.componentRef.setInput('assignments', [a]);
      fixture.componentRef.setInput('attendanceMap', new Map([['person-node-1', 'ANIRE']]));
      fixture.componentRef.setInput('isPast', true);
      fixture.detectChanges();
      expect(component.getAttendanceColor(a)).toBe('oklch(var(--wa))');
    });

    it('NO_VAIG → red regardless of isPast', () => {
      const a = makeAssignment('node-1', 'Pepet');
      fixture.componentRef.setInput('assignments', [a]);
      fixture.componentRef.setInput('attendanceMap', new Map([['person-node-1', 'NO_VAIG']]));
      fixture.detectChanges();
      expect(component.getAttendanceColor(a)).toBe('oklch(var(--er))');
    });

    it('PENDENT → muted for future event (isPast=false)', () => {
      const a = makeAssignment('node-1', 'Pepet');
      fixture.componentRef.setInput('assignments', [a]);
      fixture.componentRef.setInput('attendanceMap', new Map([['person-node-1', 'PENDENT']]));
      fixture.componentRef.setInput('isPast', false);
      fixture.detectChanges();
      expect(component.getAttendanceColor(a)).toBe('oklch(var(--bc) / 0.2)');
    });

    it('PENDENT → red for past event (isPast=true)', () => {
      const a = makeAssignment('node-1', 'Pepet');
      fixture.componentRef.setInput('assignments', [a]);
      fixture.componentRef.setInput('attendanceMap', new Map([['person-node-1', 'PENDENT']]));
      fixture.componentRef.setInput('isPast', true);
      fixture.detectChanges();
      expect(component.getAttendanceColor(a)).toBe('oklch(var(--er))');
    });

    it('no status → muted fallback', () => {
      const a = makeAssignment('node-1', 'Pepet');
      fixture.componentRef.setInput('assignments', [a]);
      fixture.componentRef.setInput('attendanceMap', new Map());
      fixture.detectChanges();
      expect(component.getAttendanceColor(a)).toBe('oklch(var(--bc) / 0.2)');
    });
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

  it('onAddFloor uses z-level defaults for new floors', () => {
    const emitted: { z: number; positionType: string; label: string }[] = [];
    fixture.componentRef.instance.nodeAdded.subscribe((e) => emitted.push(e));
    fixture.componentRef.setInput('baseNodes', [makeBaseNode()]);
    fixture.detectChanges();
    component.onAddFloor();
    expect(emitted[0].z).toBe(1);
    expect(emitted[0].positionType).toBe('segona');
    expect(emitted[0].label).toBe('Segona');
  });

  it('onAddFloor uses correct z-level default for z=2', () => {
    const emitted: { z: number; positionType: string; label: string }[] = [];
    fixture.componentRef.instance.nodeAdded.subscribe((e) => emitted.push(e));
    fixture.componentRef.setInput('baseNodes', [makeBaseNode()]);
    fixture.componentRef.setInput('troncNodes', [makeNode({ z: 1 })]);
    fixture.detectChanges();
    component.onAddFloor();
    expect(emitted[0].z).toBe(2);
    expect(emitted[0].positionType).toBe('terça');
    expect(emitted[0].label).toBe('Terça');
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

  // ── Label editing ───────────────────────────────────────────────────────

  it('onLabelChange emits updated label', () => {
    const emitted: { nodeId: string; label?: string }[] = [];
    fixture.componentRef.instance.nodeUpdated.subscribe((e) => emitted.push(e));
    const node = makeNode({ id: 'n1', label: 'Segon' });
    component.onLabelChange(node, 'Terç');
    expect(emitted[0].label).toBe('Terç');
  });

  it('onLabelChange ignores empty string', () => {
    const emitted: { nodeId: string; label?: string }[] = [];
    fixture.componentRef.instance.nodeUpdated.subscribe((e) => emitted.push(e));
    const node = makeNode({ id: 'n1' });
    component.onLabelChange(node, '  ');
    expect(emitted.length).toBe(0);
  });

  // ── Z-level color coding ──────────────────────────────────────────────

  describe('getZLevelColor', () => {
    it('returns blue for z=1', () => {
      expect(component.getZLevelColor(1)).toBe('#1E88E5');
    });

    it('returns green for z=2', () => {
      expect(component.getZLevelColor(2)).toBe('#43A047');
    });

    it('returns fallback for unknown z', () => {
      expect(component.getZLevelColor(99)).toBe('#78909C');
    });
  });

  describe('z-colored border rendering', () => {
    it('renders z-colored class in assignment mode', () => {
      fixture.componentRef.setInput('troncNodes', [makeNode({ positionType: 'segon' })]);
      fixture.componentRef.setInput('baseNodes', [makeBaseNode()]);
      fixture.componentRef.setInput('mode', 'assignment');
      fixture.detectChanges();

      const colored = fixture.nativeElement.querySelectorAll('.tronc-node.z-colored');
      expect(colored.length).toBeGreaterThan(0);
    });

    it('does not render z-colored class in editor mode', () => {
      fixture.componentRef.setInput('troncNodes', [makeNode({ positionType: 'segon' })]);
      fixture.componentRef.setInput('baseNodes', [makeBaseNode()]);
      fixture.componentRef.setInput('mode', 'editor');
      fixture.detectChanges();

      const colored = fixture.nativeElement.querySelectorAll('.tronc-node.z-colored');
      expect(colored.length).toBe(0);
    });

    it('renders z-colored class in projection mode', () => {
      fixture.componentRef.setInput('troncNodes', [makeNode({ positionType: 'segon' })]);
      fixture.componentRef.setInput('baseNodes', [makeBaseNode()]);
      fixture.componentRef.setInput('mode', 'projection');
      fixture.detectChanges();

      const colored = fixture.nativeElement.querySelectorAll('.tronc-node.z-colored');
      expect(colored.length).toBe(2);
    });
  });

  // ── Floor label resolution ──────────────────────────────────────────────

  describe('floor positionTypeLabel resolution', () => {
    it('resolves using dominant node label', () => {
      fixture.componentRef.setInput('troncNodes', [
        makeNode({ id: 'n1', z: 1, label: 'Segon', positionType: 'segon' }),
      ]);
      fixture.detectChanges();

      const floor = component.floors().find((f) => f.z === 1);
      expect(floor?.positionTypeLabel).toBe('Segon');
    });

    it('uses most common label when multiple nodes on same floor', () => {
      fixture.componentRef.setInput('troncNodes', [
        makeNode({ id: 'n1', z: 1, label: 'Segon', positionType: 'segones' }),
        makeNode({ id: 'n2', z: 1, label: 'Segon', positionType: 'segones' }),
        makeNode({ id: 'n3', z: 1, label: 'Alt', positionType: 'segones' }),
      ]);
      fixture.detectChanges();

      const floor = component.floors().find((f) => f.z === 1);
      expect(floor?.positionTypeLabel).toBe('Segon');
    });

    it('shows position-type-label in DOM in assignment mode', () => {
      fixture.componentRef.setInput('troncNodes', [
        makeNode({ id: 'n1', z: 1, label: 'Segon', positionType: 'segon' }),
      ]);
      fixture.componentRef.setInput('baseNodes', [makeBaseNode()]);
      fixture.componentRef.setInput('mode', 'assignment');
      fixture.detectChanges();

      const labels = fixture.nativeElement.querySelectorAll('.position-type-label');
      expect(labels.length).toBeGreaterThan(0);
      const texts = Array.from(labels as NodeListOf<HTMLElement>).map((el) => el.textContent?.trim());
      expect(texts).toContain('Segon');
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

  // ── Unassign ──────────────────────────────────────────────────────────

  it('nodeUnassigned emits node id', () => {
    const emitted: string[] = [];
    fixture.componentRef.instance.nodeUnassigned.subscribe((id: string) => emitted.push(id));
    component.onUnassignNode('node-42');
    expect(emitted).toEqual(['node-42']);
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

  // ── climbIndicator display ────────────────────────────────────────────────

  describe('climbIndicator display', () => {
    it('appends the indicator to the alias for an assigned TRONC node', () => {
      fixture.componentRef.setInput('troncNodes', [makeNode({ id: 'n1', z: 1, climbIndicator: 'X' })]);
      fixture.componentRef.setInput('assignments', [makeAssignment('n1', 'Marta')]);
      fixture.componentRef.setInput('mode', 'assignment');
      fixture.detectChanges();

      const alias = fixture.nativeElement.querySelector('.person-alias');
      expect(alias.textContent.trim()).toBe('Marta (X)');
    });

    it('appends the indicator to the alias for an assigned BASE node', () => {
      fixture.componentRef.setInput('baseNodes', [makeBaseNode({ id: 'b1', climbIndicator: 'A' })]);
      fixture.componentRef.setInput('assignments', [makeAssignment('b1', 'Joan')]);
      fixture.componentRef.setInput('mode', 'assignment');
      fixture.detectChanges();

      const alias = fixture.nativeElement.querySelector('.person-alias');
      expect(alias.textContent.trim()).toBe('Joan (A)');
    });

    it('shows the alias alone when there is no indicator', () => {
      fixture.componentRef.setInput('troncNodes', [makeNode({ id: 'n1', z: 1 })]);
      fixture.componentRef.setInput('assignments', [makeAssignment('n1', 'Marta')]);
      fixture.componentRef.setInput('mode', 'assignment');
      fixture.detectChanges();

      const alias = fixture.nativeElement.querySelector('.person-alias');
      expect(alias.textContent.trim()).toBe('Marta');
    });

    it('appends the indicator to the label of an unassigned TRONC node', () => {
      fixture.componentRef.setInput('troncNodes', [makeNode({ id: 'n1', z: 1, label: 'Segona', climbIndicator: 'X' })]);
      fixture.componentRef.setInput('mode', 'assignment');
      fixture.detectChanges();

      const label = fixture.nativeElement.querySelector('.node-label');
      expect(label.textContent.trim()).toBe('Segona (X)');
    });

    it('appends the indicator to the label of an unassigned BASE node', () => {
      fixture.componentRef.setInput('baseNodes', [makeBaseNode({ id: 'b1', label: 'Base 1', climbIndicator: 'A' })]);
      fixture.componentRef.setInput('mode', 'assignment');
      fixture.detectChanges();

      const label = fixture.nativeElement.querySelector('.node-label');
      expect(label.textContent.trim()).toBe('Base 1 (A)');
    });

    it('appends the indicator to the aria-label', () => {
      fixture.componentRef.setInput('troncNodes', [makeNode({ id: 'n1', z: 1, climbIndicator: 'X' })]);
      fixture.componentRef.setInput('assignments', [makeAssignment('n1', 'Marta', 170)]);
      fixture.detectChanges();

      expect(component.getNodeAriaLabel(component.troncNodes()[0])).toContain('Marta (X)');
    });

    it('appends the indicator to the aria-label when unassigned', () => {
      fixture.componentRef.setInput('troncNodes', [makeNode({ id: 'n1', z: 1, label: 'Segona', climbIndicator: 'X' })]);
      fixture.detectChanges();

      expect(component.getNodeAriaLabel(component.troncNodes()[0])).toBe('Node Segona (X), sense assignar');
    });
  });

  // ── positionType tags (F1) ───────────────────────────────────────────────

  describe('positionType preset tags', () => {
    it('renders preset tags when a TRONC node is selected in editor mode', () => {
      fixture.componentRef.setInput('troncNodes', [makeNode({ id: 'n1', z: 1 })]);
      fixture.componentRef.setInput('baseNodes', [makeBaseNode()]);
      fixture.componentRef.setInput('mode', 'editor');
      fixture.componentRef.setInput('selectedNodeId', 'n1');
      fixture.detectChanges();

      const tags = fixture.nativeElement.querySelectorAll('.preset-tag');
      expect(tags.length).toBe(8);
    });

    it('does not render preset tags when no node is selected', () => {
      fixture.componentRef.setInput('troncNodes', [makeNode({ id: 'n1', z: 1 })]);
      fixture.componentRef.setInput('baseNodes', [makeBaseNode()]);
      fixture.componentRef.setInput('mode', 'editor');
      fixture.componentRef.setInput('selectedNodeId', null);
      fixture.detectChanges();

      const tags = fixture.nativeElement.querySelectorAll('.preset-tag');
      expect(tags.length).toBe(0);
    });

    it('marks the active tag with .active class', () => {
      fixture.componentRef.setInput('troncNodes', [
        makeNode({ id: 'n1', z: 1, positionType: 'terça' }),
      ]);
      fixture.componentRef.setInput('baseNodes', [makeBaseNode()]);
      fixture.componentRef.setInput('mode', 'editor');
      fixture.componentRef.setInput('selectedNodeId', 'n1');
      fixture.detectChanges();

      const activeTags = fixture.nativeElement.querySelectorAll('.preset-tag.active');
      expect(activeTags.length).toBe(1);
      expect(activeTags[0].textContent.trim()).toContain('Terça');
    });

    it('onPositionTypeChange emits nodeUpdated with positionType and color', () => {
      const emitted: { nodeId: string; positionType?: string; color?: string | null }[] = [];
      fixture.componentRef.instance.nodeUpdated.subscribe((e) => emitted.push(e));

      const node = makeNode({ id: 'n1', label: 'Segona', positionType: 'segona', color: '#1E88E5' });
      const preset = { positionType: 'puntal', label: 'Puntal', color: '#795548', abbrev: 'Pun' };
      component.onPositionTypeChange(node, preset);

      expect(emitted.length).toBe(1);
      expect(emitted[0].positionType).toBe('puntal');
      expect(emitted[0].color).toBe('#795548');
    });

    it('onPositionTypeChange updates label when it is a default preset label', () => {
      const emitted: { nodeId: string; label?: string }[] = [];
      fixture.componentRef.instance.nodeUpdated.subscribe((e) => emitted.push(e));

      const node = makeNode({ id: 'n1', label: 'Segona', positionType: 'segona', color: '#1E88E5' });
      const preset = { positionType: 'puntal', label: 'Puntal', color: '#795548', abbrev: 'Pun' };
      component.onPositionTypeChange(node, preset);

      expect(emitted[0].label).toBe('Puntal');
    });

    it('onPositionTypeChange does not change label when it is custom', () => {
      const emitted: { nodeId: string; label?: string }[] = [];
      fixture.componentRef.instance.nodeUpdated.subscribe((e) => emitted.push(e));

      const node = makeNode({ id: 'n1', label: 'Mon node custom', positionType: 'segones', color: '#1E88E5' });
      const preset = { positionType: 'puntal', label: 'Puntal', color: '#795548', abbrev: 'Pun' };
      component.onPositionTypeChange(node, preset);

      expect(emitted[0].label).toBeUndefined();
    });
  });

  // ── Type-colored visual feedback (F1) ──────────────────────────────────

  describe('type-colored node rendering', () => {
    it('renders type-colored class on TRONC nodes in editor mode when color is set', () => {
      fixture.componentRef.setInput('troncNodes', [
        makeNode({ id: 'n1', z: 1, color: '#1E88E5' }),
      ]);
      fixture.componentRef.setInput('baseNodes', [makeBaseNode()]);
      fixture.componentRef.setInput('mode', 'editor');
      fixture.detectChanges();

      const colored = fixture.nativeElement.querySelectorAll('.tronc-node.type-colored');
      expect(colored.length).toBe(1);
    });

    it('does not render type-colored class when color is null', () => {
      fixture.componentRef.setInput('troncNodes', [
        makeNode({ id: 'n1', z: 1, color: null }),
      ]);
      fixture.componentRef.setInput('baseNodes', [makeBaseNode()]);
      fixture.componentRef.setInput('mode', 'editor');
      fixture.detectChanges();

      const colored = fixture.nativeElement.querySelectorAll('.tronc-node.type-colored');
      expect(colored.length).toBe(0);
    });

    it('renders type-badge inside TRONC node in editor mode', () => {
      fixture.componentRef.setInput('troncNodes', [
        makeNode({ id: 'n1', z: 1, positionType: 'segona', color: '#1E88E5' }),
      ]);
      fixture.componentRef.setInput('baseNodes', [makeBaseNode()]);
      fixture.componentRef.setInput('mode', 'editor');
      fixture.detectChanges();

      const badges = fixture.nativeElement.querySelectorAll('.type-badge');
      expect(badges.length).toBe(1);
      expect(badges[0].textContent.trim()).toContain('Seg');
    });

    it('does not render type-badge in assignment mode', () => {
      fixture.componentRef.setInput('troncNodes', [
        makeNode({ id: 'n1', z: 1, positionType: 'segones', color: '#1E88E5' }),
      ]);
      fixture.componentRef.setInput('baseNodes', [makeBaseNode()]);
      fixture.componentRef.setInput('mode', 'assignment');
      fixture.detectChanges();

      const badges = fixture.nativeElement.querySelectorAll('.type-badge');
      expect(badges.length).toBe(0);
    });
  });

  // ── getPositionTypeBadge ───────────────────────────────────────────────

  describe('getPositionTypeBadge', () => {
    it('returns "Seg" for segona', () => {
      expect(component.getPositionTypeBadge(makeNode({ positionType: 'segona' }))).toBe('Seg');
    });

    it('returns "Ter" for terça', () => {
      expect(component.getPositionTypeBadge(makeNode({ positionType: 'terça' }))).toBe('Ter');
    });

    it('returns "Xiq" for xiqueta', () => {
      expect(component.getPositionTypeBadge(makeNode({ positionType: 'xiqueta' }))).toBe('Xiq');
    });

    it('returns first 3 chars for unknown positionType', () => {
      expect(component.getPositionTypeBadge(makeNode({ positionType: 'custom-type' }))).toBe('cus');
    });

    it('returns empty string when positionType is null', () => {
      expect(component.getPositionTypeBadge(makeNode({ positionType: null }))).toBe('');
    });
  });

  // ── Directions section (F4) ──────────────────────────────────────────

  describe('directions section (figures netes)', () => {
    const figDirNode = makeNode({
      id: 'dir-fig-1',
      zone: 'FIGURE_DIRECTION',
      label: 'Dir. Figura',
      z: 0,
      x: 0,
      width: 1,
    });

    const xicDirNode = makeNode({
      id: 'dir-xic-1',
      zone: 'XICALLA_DIRECTION',
      label: 'Dir. Xicalla',
      z: 0,
      x: 0,
      width: 1,
    });

    it('does not render directions section in editor mode', () => {
      fixture.componentRef.setInput('mode', 'editor');
      fixture.componentRef.setInput('directionNodes', [figDirNode]);
      fixture.detectChanges();

      const section = fixture.nativeElement.querySelector('.directions-section');
      expect(section).toBeNull();
    });

    it('renders directions section in assignment mode', () => {
      fixture.componentRef.setInput('mode', 'assignment');
      fixture.detectChanges();

      const section = fixture.nativeElement.querySelector('.directions-section');
      expect(section).not.toBeNull();
    });

    it('starts expanded by default', () => {
      fixture.componentRef.setInput('mode', 'assignment');
      fixture.detectChanges();

      expect(component.directionsExpanded()).toBe(true);
      const content = fixture.nativeElement.querySelector('.directions-content');
      expect(content).not.toBeNull();
    });

    it('collapses on toggle click', () => {
      fixture.componentRef.setInput('mode', 'assignment');
      fixture.detectChanges();

      const toggle = fixture.nativeElement.querySelector('.directions-toggle') as HTMLButtonElement;
      toggle.click();
      fixture.detectChanges();

      expect(component.directionsExpanded()).toBe(false);
      const content = fixture.nativeElement.querySelector('.directions-content');
      expect(content).toBeNull();
    });

    it('shows "Afegir" buttons when no direction nodes exist', () => {
      fixture.componentRef.setInput('mode', 'assignment');
      fixture.componentRef.setInput('directionNodes', []);
      component.directionsExpanded.set(true);
      fixture.detectChanges();

      const addButtons = fixture.nativeElement.querySelectorAll('.directions-content .btn-ghost');
      expect(addButtons.length).toBe(2);
    });

    it('shows direction node button when a direction node exists', () => {
      fixture.componentRef.setInput('mode', 'assignment');
      fixture.componentRef.setInput('directionNodes', [figDirNode]);
      component.directionsExpanded.set(true);
      fixture.detectChanges();

      const dirNodes = fixture.nativeElement.querySelectorAll('.direction-node');
      expect(dirNodes.length).toBe(1);
    });

    it('figureDirectionNodes computed returns FIGURE_DIRECTION nodes', () => {
      fixture.componentRef.setInput('directionNodes', [figDirNode, xicDirNode]);
      fixture.detectChanges();

      expect(component.figureDirectionNodes().map((n) => n.id)).toEqual(['dir-fig-1']);
    });

    it('xicallaDirectionNodes computed returns XICALLA_DIRECTION nodes', () => {
      fixture.componentRef.setInput('directionNodes', [figDirNode, xicDirNode]);
      fixture.detectChanges();

      expect(component.xicallaDirectionNodes().map((n) => n.id)).toEqual(['dir-xic-1']);
    });

    it('hasAssignedDirections returns false when no assignments', () => {
      fixture.componentRef.setInput('directionNodes', [figDirNode]);
      fixture.componentRef.setInput('assignments', []);
      fixture.detectChanges();

      expect(component.hasAssignedDirections()).toBe(false);
    });

    it('hasAssignedDirections returns true when a direction has assignment', () => {
      fixture.componentRef.setInput('directionNodes', [figDirNode]);
      fixture.componentRef.setInput('assignments', [
        makeAssignment('dir-fig-1', 'Pepet'),
      ]);
      fixture.detectChanges();

      expect(component.hasAssignedDirections()).toBe(true);
    });

    it('auto-expands when hasAssignedDirections becomes true', () => {
      fixture.componentRef.setInput('mode', 'assignment');
      fixture.componentRef.setInput('directionNodes', [figDirNode]);
      fixture.componentRef.setInput('assignments', []);
      fixture.detectChanges();

      component.directionsExpanded.set(false);
      expect(component.directionsExpanded()).toBe(false);

      fixture.componentRef.setInput('assignments', [
        makeAssignment('dir-fig-1', 'Pepet'),
      ]);
      fixture.detectChanges();

      expect(component.directionsExpanded()).toBe(true);
    });

    it('directionAdded emits zone when "Afegir" is clicked', () => {
      const emitted: { zone: string }[] = [];
      component.directionAdded.subscribe((e) => emitted.push(e));

      fixture.componentRef.setInput('mode', 'assignment');
      fixture.componentRef.setInput('directionNodes', []);
      component.directionsExpanded.set(true);
      fixture.detectChanges();

      const addButtons = fixture.nativeElement.querySelectorAll('.directions-content .btn-ghost') as NodeListOf<HTMLButtonElement>;
      addButtons[0].click();
      fixture.detectChanges();

      expect(emitted.length).toBe(1);
      expect(emitted[0].zone).toBe('FIGURE_DIRECTION');
    });

    it('directionRemoved emits nodeId when trash is clicked on unassigned direction', () => {
      const emitted: string[] = [];
      component.directionRemoved.subscribe((id) => emitted.push(id));

      fixture.componentRef.setInput('mode', 'assignment');
      fixture.componentRef.setInput('directionNodes', [figDirNode]);
      fixture.componentRef.setInput('assignments', []);
      component.directionsExpanded.set(true);
      fixture.detectChanges();

      const trashBtn = fixture.nativeElement.querySelector('.directions-content .text-error') as HTMLButtonElement;
      expect(trashBtn).not.toBeNull();
      trashBtn.click();
      fixture.detectChanges();

      expect(emitted).toEqual(['dir-fig-1']);
    });

    it('renders direction assignments in projection mode', () => {
      fixture.componentRef.setInput('mode', 'projection');
      fixture.componentRef.setInput('directionNodes', [figDirNode]);
      fixture.componentRef.setInput('assignments', [
        makeAssignment('dir-fig-1', 'Pepet'),
      ]);
      fixture.detectChanges();

      const projRow = fixture.nativeElement.querySelector('.direction-projection-row');
      expect(projRow).not.toBeNull();
      expect(projRow.textContent).toContain('Pepet');
    });

    it('does not render projection directions when no assignments', () => {
      fixture.componentRef.setInput('mode', 'projection');
      fixture.componentRef.setInput('directionNodes', [figDirNode]);
      fixture.componentRef.setInput('assignments', []);
      fixture.detectChanges();

      const projRow = fixture.nativeElement.querySelector('.direction-projection-row');
      expect(projRow).toBeNull();
    });
  });

  // ── Pointer-based drag-and-drop (replaces HTML5 DnD, which never fires on touch) ──

  describe('pointer drag-and-drop', () => {
    function makePointerEvent(overrides: Partial<PointerEvent> = {}): PointerEvent {
      return {
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        button: 0,
        pointerType: 'touch',
        preventDefault: () => { /* no-op */ },
        currentTarget: { setPointerCapture: () => { /* no-op */ } } as unknown as EventTarget,
        ...overrides,
      } as unknown as PointerEvent;
    }

    /** A real detached DOM node so Element.closest()/dataset work like in the browser. */
    function makeDropTargetElement(nodeId: string, instanceId: string): HTMLElement {
      const el = document.createElement('button');
      el.dataset['troncNodeId'] = nodeId;
      el.dataset['instanceId'] = instanceId;
      return el;
    }

    beforeEach(() => {
      // jsdom doesn't implement elementFromPoint at all (not even as a no-op) —
      // define it once so vi.spyOn has an existing property to replace per test.
      if (!('elementFromPoint' in document)) {
        Object.defineProperty(document, 'elementFromPoint', { value: () => null, writable: true, configurable: true });
      }
      fixture.componentRef.setInput('instanceId', 'instance-a');
      fixture.componentRef.setInput('mode', 'assignment');
      fixture.componentRef.setInput('troncNodes', [makeNode({ id: 'node-1' })]);
      fixture.componentRef.setInput('assignments', [makeAssignment('node-1', 'Pepet')]);
      fixture.detectChanges();
    });

    it('isDraggableNode is false for an unassigned node', () => {
      fixture.componentRef.setInput('assignments', []);
      fixture.detectChanges();
      expect(component.isDraggableNode('node-1')).toBe(false);
    });

    it('does not start dragging on pointerdown alone (movement threshold not yet reached)', () => {
      component.onNodePointerDown(component.troncNodes()[0], makePointerEvent({ clientX: 0, clientY: 0 }));
      expect(component.isDragging('node-1')).toBe(false);
    });

    it('pointerdown on a non-draggable node does not capture the pointer', () => {
      fixture.componentRef.setInput('assignments', []);
      fixture.detectChanges();
      let captured = false;
      const event = makePointerEvent({
        currentTarget: { setPointerCapture: () => { captured = true; } } as unknown as EventTarget,
      });
      component.onNodePointerDown(component.troncNodes()[0], event);
      expect(captured).toBe(false);
    });

    it('starts dragging once pointermove exceeds the movement threshold', () => {
      vi.spyOn(document, 'elementFromPoint').mockReturnValue(null);
      component.onNodePointerDown(component.troncNodes()[0], makePointerEvent({ clientX: 0, clientY: 0 }));
      component.onNodePointerMove(makePointerEvent({ clientX: 20, clientY: 0 }));
      expect(component.isDragging('node-1')).toBe(true);
    });

    it('does not start dragging when movement stays under the threshold', () => {
      vi.spyOn(document, 'elementFromPoint').mockReturnValue(null);
      component.onNodePointerDown(component.troncNodes()[0], makePointerEvent({ clientX: 0, clientY: 0 }));
      component.onNodePointerMove(makePointerEvent({ clientX: 2, clientY: 0 }));
      expect(component.isDragging('node-1')).toBe(false);
    });

    it('sets dragOverNodeId to the node resolved under the pointer while dragging', () => {
      const target = makeDropTargetElement('node-2', 'instance-a');
      vi.spyOn(document, 'elementFromPoint').mockReturnValue(target);
      component.onNodePointerDown(component.troncNodes()[0], makePointerEvent({ clientX: 0, clientY: 0 }));
      component.onNodePointerMove(makePointerEvent({ clientX: 50, clientY: 0 }));
      expect(component.dragOverNodeId()).toBe('node-2');
    });

    it('does not set dragOverNodeId when hovering back over the origin node', () => {
      const target = makeDropTargetElement('node-1', 'instance-a');
      vi.spyOn(document, 'elementFromPoint').mockReturnValue(target);
      component.onNodePointerDown(component.troncNodes()[0], makePointerEvent({ clientX: 0, clientY: 0 }));
      component.onNodePointerMove(makePointerEvent({ clientX: 50, clientY: 0 }));
      expect(component.dragOverNodeId()).toBeNull();
    });

    it('ignores move events from an unrelated pointerId', () => {
      vi.spyOn(document, 'elementFromPoint').mockReturnValue(makeDropTargetElement('node-2', 'instance-a'));
      component.onNodePointerDown(component.troncNodes()[0], makePointerEvent({ pointerId: 1, clientX: 0, clientY: 0 }));
      component.onNodePointerMove(makePointerEvent({ pointerId: 2, clientX: 50, clientY: 0 }));
      expect(component.isDragging('node-1')).toBe(false);
      expect(component.dragOverNodeId()).toBeNull();
    });

    it('emits nodeDropped when released over a different node in the same instance', () => {
      let emitted: unknown = null;
      component.nodeDropped.subscribe((e) => (emitted = e));
      const target = makeDropTargetElement('node-2', 'instance-a');
      vi.spyOn(document, 'elementFromPoint').mockReturnValue(target);

      component.onNodePointerDown(component.troncNodes()[0], makePointerEvent({ clientX: 0, clientY: 0 }));
      component.onNodePointerMove(makePointerEvent({ clientX: 50, clientY: 0 }));
      component.onNodePointerUp(makePointerEvent({ clientX: 50, clientY: 0 }));

      expect(emitted).toEqual({
        sourceInstanceId: 'instance-a',
        sourceNodeId: 'node-1',
        targetInstanceId: 'instance-a',
        targetNodeId: 'node-2',
      });
    });

    it('emits nodeDropped with the target instance id when dropped on a sibling tronc-view', () => {
      let emitted: unknown = null;
      component.nodeDropped.subscribe((e) => (emitted = e));
      const target = makeDropTargetElement('node-9', 'instance-b');
      vi.spyOn(document, 'elementFromPoint').mockReturnValue(target);

      component.onNodePointerDown(component.troncNodes()[0], makePointerEvent({ clientX: 0, clientY: 0 }));
      component.onNodePointerMove(makePointerEvent({ clientX: 50, clientY: 0 }));
      component.onNodePointerUp(makePointerEvent({ clientX: 50, clientY: 0 }));

      expect(emitted).toEqual({
        sourceInstanceId: 'instance-a',
        sourceNodeId: 'node-1',
        targetInstanceId: 'instance-b',
        targetNodeId: 'node-9',
      });
    });

    it('does not emit nodeDropped for a plain tap that never exceeds the movement threshold', () => {
      let emitted: unknown = null;
      component.nodeDropped.subscribe((e) => (emitted = e));
      vi.spyOn(document, 'elementFromPoint').mockReturnValue(makeDropTargetElement('node-1', 'instance-a'));

      component.onNodePointerDown(component.troncNodes()[0], makePointerEvent({ clientX: 0, clientY: 0 }));
      component.onNodePointerUp(makePointerEvent({ clientX: 0, clientY: 0 }));

      expect(emitted).toBeNull();
    });

    it('does not emit nodeDropped when released with no resolvable target', () => {
      let emitted: unknown = null;
      component.nodeDropped.subscribe((e) => (emitted = e));
      vi.spyOn(document, 'elementFromPoint').mockReturnValue(null);

      component.onNodePointerDown(component.troncNodes()[0], makePointerEvent({ clientX: 0, clientY: 0 }));
      component.onNodePointerMove(makePointerEvent({ clientX: 50, clientY: 0 }));
      component.onNodePointerUp(makePointerEvent({ clientX: 50, clientY: 0 }));

      expect(emitted).toBeNull();
    });

    it('resets dragging and dragOver state after pointerup', () => {
      vi.spyOn(document, 'elementFromPoint').mockReturnValue(makeDropTargetElement('node-2', 'instance-a'));
      component.onNodePointerDown(component.troncNodes()[0], makePointerEvent({ clientX: 0, clientY: 0 }));
      component.onNodePointerMove(makePointerEvent({ clientX: 50, clientY: 0 }));
      component.onNodePointerUp(makePointerEvent({ clientX: 50, clientY: 0 }));

      expect(component.isDragging('node-1')).toBe(false);
      expect(component.dragOverNodeId()).toBeNull();
    });

    it('resets dragging state on pointercancel without emitting a drop', () => {
      let emitted: unknown = null;
      component.nodeDropped.subscribe((e) => (emitted = e));
      vi.spyOn(document, 'elementFromPoint').mockReturnValue(makeDropTargetElement('node-2', 'instance-a'));

      component.onNodePointerDown(component.troncNodes()[0], makePointerEvent({ clientX: 0, clientY: 0 }));
      component.onNodePointerMove(makePointerEvent({ clientX: 50, clientY: 0 }));
      component.onNodePointerCancel(makePointerEvent({ clientX: 50, clientY: 0 }));

      expect(component.isDragging('node-1')).toBe(false);
      expect(emitted).toBeNull();
    });
  });

  // ── Tap fallback for the person hover card (touch has no mouseenter/mouseleave) ──

  describe('tap fallback for the person hover card', () => {
    function makeClickEvent(currentTarget: EventTarget): MouseEvent {
      return {
        currentTarget,
        target: currentTarget,
      } as unknown as MouseEvent;
    }

    function makeButtonTarget(): HTMLElement {
      const el = document.createElement('button');
      el.getBoundingClientRect = () => ({ top: 10, right: 20, bottom: 0, left: 0, width: 20, height: 10, x: 0, y: 10, toJSON: () => '' });
      return el;
    }

    it('onNodeClick reveals the hover card for an assigned node (tap has no hover)', () => {
      fixture.componentRef.setInput('troncNodes', [makeNode({ id: 'node-1' })]);
      fixture.componentRef.setInput('assignments', [makeAssignment('node-1', 'Pepet')]);
      fixture.detectChanges();

      component.onNodeClick(component.troncNodes()[0], makeClickEvent(makeButtonTarget()));

      expect(component.hoveredPerson()?.info.alias).toBe('Pepet');
    });

    it('onNodeClick does not reveal a card for an unassigned node', () => {
      fixture.componentRef.setInput('troncNodes', [makeNode({ id: 'node-1' })]);
      fixture.componentRef.setInput('assignments', []);
      fixture.detectChanges();

      component.onNodeClick(component.troncNodes()[0], makeClickEvent(makeButtonTarget()));

      expect(component.hoveredPerson()).toBeNull();
    });

    it('onDirectionNodeClick reveals the hover card for an assigned direction node', () => {
      const dirNode = makeNode({ id: 'dir-1', zone: 'FIGURE_DIRECTION' });
      fixture.componentRef.setInput('directionNodes', [dirNode]);
      fixture.componentRef.setInput('assignments', [makeAssignment('dir-1', 'Marta')]);
      fixture.detectChanges();

      component.onDirectionNodeClick(dirNode, makeClickEvent(makeButtonTarget()));

      expect(component.hoveredPerson()?.info.alias).toBe('Marta');
    });

    it('onBackgroundClick dismisses the hover card when tapping the section itself', () => {
      const section = document.createElement('section');
      component.hoveredPerson.set({
        info: { alias: 'Pepet', attendanceStatus: null, isXicalla: false, shoulderHeight: null, notes: null, notesEmoji: null, positions: [] },
        top: 0,
        left: 0,
        positionType: null,
      });

      component.onBackgroundClick(makeClickEvent(section));

      expect(component.hoveredPerson()).toBeNull();
    });

    it('onBackgroundClick does not dismiss the hover card when the click bubbled from a child node', () => {
      const section = document.createElement('section');
      const child = document.createElement('button');
      section.appendChild(child);
      component.hoveredPerson.set({
        info: { alias: 'Pepet', attendanceStatus: null, isXicalla: false, shoulderHeight: null, notes: null, notesEmoji: null, positions: [] },
        top: 0,
        left: 0,
        positionType: null,
      });

      component.onBackgroundClick({ currentTarget: section, target: child } as unknown as MouseEvent);

      expect(component.hoveredPerson()).not.toBeNull();
    });
  });
});
