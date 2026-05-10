import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  LUCIDE_ICONS,
  LucideIconProvider,
  AlignJustify,
  ArrowDown,
  ArrowUp,
  Building2,
  ChevronDown,
  List,
  Minus,
  Plus,
  Trash2,
  X,
} from 'lucide-angular';
import { TroncWidgetComponent } from './tronc-widget.component';
import { FigureNodeItem } from '../../models/figure-template.model';
import { FigureZone, NodeShape } from '@muixer/shared';

// ── Helpers ───────────────────────────────────────────────────────────────────

let nodeCounter = 0;

const makeNode = (overrides: Partial<FigureNodeItem> = {}): FigureNodeItem => ({
  id: `node-${++nodeCounter}`,
  label: 'Segon',
  zone: FigureZone.TRONC,
  positionType: 'segon',
  x: 0,
  y: 0,
  z: 1,
  width: 80,
  height: 40,
  rotation: 0,
  color: null,
  shape: NodeShape.RECTANGLE,
  sortOrder: 0,
  climbPath: null,
  metadata: {},
  ...overrides,
});

const makeBaseNode = (overrides: Partial<FigureNodeItem> = {}): FigureNodeItem => ({
  id: `node-${++nodeCounter}`,
  label: 'Base',
  zone: FigureZone.BASE,
  positionType: 'base',
  x: 500,
  y: 500,
  z: 0,
  width: 80,
  height: 40,
  rotation: 0,
  color: '#EEEEEE',
  shape: NodeShape.RECTANGLE,
  sortOrder: 0,
  climbPath: null,
  metadata: {},
  ...overrides,
});

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('TroncWidgetComponent', () => {
  let fixture: ComponentFixture<TroncWidgetComponent>;
  let component: TroncWidgetComponent;

  beforeEach(async () => {
    nodeCounter = 0;

    await TestBed.configureTestingModule({
      imports: [TroncWidgetComponent],
      providers: [
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useFactory: () =>
            new LucideIconProvider({
              AlignJustify, ArrowDown, ArrowUp, Building2,
              ChevronDown, List, Minus, Plus, Trash2, X,
            }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TroncWidgetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates correctly', () => {
    expect(component).toBeTruthy();
  });

  // ── Computed: floors() ─────────────────────────────────────────────────────

  describe('floors()', () => {
    it('returns empty array when no nodes', () => {
      expect(component.floors()).toHaveLength(0);
    });

    it('groups nodes by z level', () => {
      fixture.componentRef.setInput('troncNodes', [
        makeNode({ id: 'a', z: 1 }),
        makeNode({ id: 'b', z: 2 }),
        makeNode({ id: 'c', z: 1 }),
      ]);
      const floors = component.floors();
      expect(floors).toHaveLength(2);
      const p2 = floors.find((f) => f.z === 1)!;
      expect(p2.nodes).toHaveLength(2);
    });

    it('assigns pisLabel as P(z+1)', () => {
      fixture.componentRef.setInput('troncNodes', [makeNode({ z: 2 })]);
      expect(component.floors()[0].pisLabel).toBe('P3');
    });

    it('sorts nodes within a floor by sortOrder', () => {
      fixture.componentRef.setInput('troncNodes', [
        makeNode({ id: 'a', z: 1, sortOrder: 2 }),
        makeNode({ id: 'b', z: 1, sortOrder: 0 }),
        makeNode({ id: 'c', z: 1, sortOrder: 1 }),
      ]);
      const floor = component.floors()[0];
      expect(floor.nodes.map((n) => n.id)).toEqual(['b', 'c', 'a']);
    });

    it('sorts floors descending by default (top floor first)', () => {
      fixture.componentRef.setInput('troncNodes', [
        makeNode({ z: 1 }),
        makeNode({ z: 3 }),
        makeNode({ z: 2 }),
      ]);
      const zOrder = component.floors().map((f) => f.z);
      expect(zOrder).toEqual([3, 2, 1]);
    });

    it('sorts floors ascending when sortAscending is true', () => {
      fixture.componentRef.setInput('troncNodes', [
        makeNode({ z: 3 }),
        makeNode({ z: 1 }),
        makeNode({ z: 2 }),
      ]);
      component.sortAscending.set(true);
      const zOrder = component.floors().map((f) => f.z);
      expect(zOrder).toEqual([1, 2, 3]);
    });
  });

  // ── Computed: maxZ() ───────────────────────────────────────────────────────

  describe('maxZ()', () => {
    it('returns 0 when no tronc nodes (z=0 is reserved for BASE)', () => {
      expect(component.maxZ()).toBe(0);
    });

    it('returns the highest z among tronc nodes', () => {
      fixture.componentRef.setInput('troncNodes', [
        makeNode({ z: 1 }),
        makeNode({ z: 3 }),
        makeNode({ z: 2 }),
      ]);
      expect(component.maxZ()).toBe(3);
    });
  });

  // ── Computed: pillLabel() ──────────────────────────────────────────────────

  describe('pillLabel()', () => {
    it('returns "sense pisos" when no floors and no bases', () => {
      expect(component.pillLabel()).toBe('sense pisos');
    });

    it('counts bases as an extra floor in the pill label', () => {
      fixture.componentRef.setInput('baseNodes', [makeBaseNode()]);
      expect(component.pillLabel()).toBe('1 pis');
    });

    it('returns singular "1 pis" for one tronc floor and no bases', () => {
      fixture.componentRef.setInput('troncNodes', [makeNode({ z: 1 })]);
      expect(component.pillLabel()).toBe('1 pis');
    });

    it('returns plural "X pisos" for tronc floors and one base', () => {
      fixture.componentRef.setInput('baseNodes', [makeBaseNode()]);
      fixture.componentRef.setInput('troncNodes', [
        makeNode({ z: 1 }),
        makeNode({ z: 2 }),
      ]);
      expect(component.pillLabel()).toBe('3 pisos');
    });
  });

  // ── Computed: nextZ(), canAddFloor(), nextFloorOptions() ──────────────────

  describe('nextZ()', () => {
    it('returns 1 when no tronc nodes (z=0 is reserved for BASE)', () => {
      expect(component.nextZ()).toBe(1);
    });

    it('returns maxZ + 1', () => {
      fixture.componentRef.setInput('troncNodes', [makeNode({ z: 2 })]);
      expect(component.nextZ()).toBe(3);
    });
  });

  describe('canAddFloor()', () => {
    it('returns true when fewer than 5 tronc floors (total < 6 with base)', () => {
      fixture.componentRef.setInput('troncNodes', [
        makeNode({ z: 1 }),
        makeNode({ z: 2 }),
      ]);
      expect(component.canAddFloor()).toBe(true);
    });

    it('returns false when tronc floors fill up to z=5 (nextZ=6)', () => {
      fixture.componentRef.setInput('troncNodes', [
        makeNode({ z: 1 }), makeNode({ z: 2 }), makeNode({ z: 3 }),
        makeNode({ z: 4 }), makeNode({ z: 5 }),
      ]);
      expect(component.canAddFloor()).toBe(false);
    });
  });

  describe('nextFloorOptions()', () => {
    it('P2 (z=1): Segon, Alçadora, Xiqueta when no tronc floors', () => {
      const opts = component.nextFloorOptions();
      expect(opts.map((o) => o.positionType)).toEqual(['segon', 'alcadora', 'xiqueta']);
    });

    it('P3 (z=2): Terç, Alçadora, Xiqueta after one tronc floor', () => {
      fixture.componentRef.setInput('troncNodes', [makeNode({ z: 1 })]);
      const opts = component.nextFloorOptions();
      expect(opts[0].positionType).toBe('terç');
    });

    it('P4 (z=3): Quart, Alçadora, Xiqueta', () => {
      fixture.componentRef.setInput('troncNodes', [makeNode({ z: 1 }), makeNode({ z: 2 })]);
      const opts = component.nextFloorOptions();
      expect(opts[0].positionType).toBe('quart');
    });

    it('P6 (z=5): only Alçadora, Xiqueta', () => {
      fixture.componentRef.setInput('troncNodes', [
        makeNode({ z: 1 }), makeNode({ z: 2 }), makeNode({ z: 3 }),
        makeNode({ z: 4 }),
      ]);
      const opts = component.nextFloorOptions();
      expect(opts.map((o) => o.positionType)).toEqual(['alcadora', 'xiqueta']);
    });

    it('returns empty array when all tronc floors filled (z=5 is max)', () => {
      fixture.componentRef.setInput('troncNodes', [
        makeNode({ z: 1 }), makeNode({ z: 2 }), makeNode({ z: 3 }),
        makeNode({ z: 4 }), makeNode({ z: 5 }),
      ]);
      expect(component.nextFloorOptions()).toHaveLength(0);
    });
  });

  // ── basesCount() and base outputs ────────────────────────────────────────

  describe('basesCount()', () => {
    it('returns 0 when no base nodes', () => {
      expect(component.basesCount()).toBe(0);
    });

    it('returns the number of base nodes', () => {
      fixture.componentRef.setInput('baseNodes', [makeBaseNode(), makeBaseNode()]);
      expect(component.basesCount()).toBe(2);
    });
  });

  describe('addBase()', () => {
    it('emits baseAdded with sortOrder equal to current base count', () => {
      fixture.componentRef.setInput('baseNodes', [makeBaseNode()]);
      const emitted: { sortOrder: number }[] = [];
      component.baseAdded.subscribe((v) => emitted.push(v));

      component.addBase();

      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toEqual({ sortOrder: 1 });
    });

    it('emits sortOrder 0 when no bases yet', () => {
      const emitted: { sortOrder: number }[] = [];
      component.baseAdded.subscribe((v) => emitted.push(v));

      component.addBase();

      expect(emitted[0]).toEqual({ sortOrder: 0 });
    });
  });

  describe('removeBase()', () => {
    it('emits baseRemoved with the given id', () => {
      const emitted: string[] = [];
      component.baseRemoved.subscribe((v) => emitted.push(v));

      component.removeBase('base-1');

      expect(emitted).toEqual(['base-1']);
    });
  });

  describe('removeLastBase()', () => {
    it('emits baseRemoved with the last base node id', () => {
      fixture.componentRef.setInput('baseNodes', [
        makeBaseNode({ id: 'b1', sortOrder: 0 }),
        makeBaseNode({ id: 'b2', sortOrder: 1 }),
      ]);
      const emitted: string[] = [];
      component.baseRemoved.subscribe((v) => emitted.push(v));

      component.removeLastBase();

      expect(emitted).toEqual(['b2']);
    });

    it('does not emit when no bases', () => {
      const emitted: string[] = [];
      component.baseRemoved.subscribe((v) => emitted.push(v));

      component.removeLastBase();

      expect(emitted).toHaveLength(0);
    });
  });

  // ── UI state methods ───────────────────────────────────────────────────────

  describe('toggle()', () => {
    it('expands the widget when collapsed', () => {
      expect(component.expanded()).toBe(false);
      component.toggle();
      expect(component.expanded()).toBe(true);
    });

    it('collapses the widget when expanded', () => {
      component.toggle();
      component.toggle();
      expect(component.expanded()).toBe(false);
    });

    it('closes addMenu when expanding', () => {
      component.addMenuOpen.set(true);
      component.toggle();
      expect(component.addMenuOpen()).toBe(false);
    });
  });

  describe('close()', () => {
    it('sets expanded to false', () => {
      component.toggle();
      component.close();
      expect(component.expanded()).toBe(false);
    });

    it('closes the add menu', () => {
      component.addMenuOpen.set(true);
      component.close();
      expect(component.addMenuOpen()).toBe(false);
    });
  });

  describe('setViewMode()', () => {
    it('switches to list view', () => {
      component.setViewMode('list');
      expect(component.viewMode()).toBe('list');
    });

    it('switches back to tower view', () => {
      component.setViewMode('list');
      component.setViewMode('tower');
      expect(component.viewMode()).toBe('tower');
    });
  });

  describe('toggleSortDirection()', () => {
    it('changes from descending to ascending', () => {
      expect(component.sortAscending()).toBe(false);
      component.toggleSortDirection();
      expect(component.sortAscending()).toBe(true);
    });

    it('toggles back to descending', () => {
      component.toggleSortDirection();
      component.toggleSortDirection();
      expect(component.sortAscending()).toBe(false);
    });
  });

  describe('toggleAddMenu()', () => {
    it('opens the add menu', () => {
      component.toggleAddMenu();
      expect(component.addMenuOpen()).toBe(true);
    });

    it('closes when called again', () => {
      component.toggleAddMenu();
      component.toggleAddMenu();
      expect(component.addMenuOpen()).toBe(false);
    });
  });

  describe('isSelected()', () => {
    it('returns true when id matches selectedNodeId', () => {
      fixture.componentRef.setInput('selectedNodeId', 'abc');
      expect(component.isSelected('abc')).toBe(true);
    });

    it('returns false when id does not match', () => {
      fixture.componentRef.setInput('selectedNodeId', 'abc');
      expect(component.isSelected('xyz')).toBe(false);
    });

    it('returns false when selectedNodeId is null', () => {
      fixture.componentRef.setInput('selectedNodeId', null);
      expect(component.isSelected('abc')).toBe(false);
    });
  });

  // ── Outputs ────────────────────────────────────────────────────────────────

  describe('selectNode()', () => {
    it('emits nodeSelected with the given id', () => {
      const emitted: (string | null)[] = [];
      component.nodeSelected.subscribe((v) => emitted.push(v));
      component.selectNode('node-abc');
      expect(emitted).toEqual(['node-abc']);
    });
  });

  describe('removeNode()', () => {
    it('emits nodeRemoved with the given id', () => {
      const emitted: string[] = [];
      component.nodeRemoved.subscribe((v) => emitted.push(v));
      component.removeNode('n1');
      expect(emitted).toEqual(['n1']);
    });
  });

  describe('removeFloor()', () => {
    it('emits floorRemoved with the z level', () => {
      const emitted: number[] = [];
      component.floorRemoved.subscribe((v) => emitted.push(v));
      component.removeFloor(2);
      expect(emitted).toEqual([2]);
    });
  });

  describe('addFloorNode()', () => {
    it('emits nodeAdded at z=1 (nextZ when no tronc floors) with sortOrder 0', () => {
      const emitted: { z: number; positionType: string; label: string; sortOrder: number }[] = [];
      component.nodeAdded.subscribe((v) => emitted.push(v));

      component.addFloorNode({ label: 'Segon', positionType: 'segon' });

      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toEqual({ z: 1, positionType: 'segon', label: 'Segon', sortOrder: 0 });
    });

    it('emits at nextZ = maxZ + 1', () => {
      fixture.componentRef.setInput('troncNodes', [makeNode({ z: 1 })]);
      const emitted: { z: number }[] = [];
      component.nodeAdded.subscribe((v) => emitted.push(v));

      component.addFloorNode({ label: 'Terç', positionType: 'terç' });

      expect(emitted[0].z).toBe(2);
    });

    it('closes the add menu after emitting', () => {
      component.addMenuOpen.set(true);
      component.addFloorNode({ label: 'Segon', positionType: 'segon' });
      expect(component.addMenuOpen()).toBe(false);
    });
  });

  describe('addNodeToFloor()', () => {
    it('emits nodeAdded with same positionType/label as the floor and sortOrder = node count', () => {
      fixture.componentRef.setInput('troncNodes', [
        makeNode({ id: 'a', z: 1, positionType: 'segon', label: 'Segon', sortOrder: 0 }),
        makeNode({ id: 'b', z: 1, positionType: 'segon', label: 'Segon', sortOrder: 1 }),
      ]);

      const emitted: { z: number; positionType: string; label: string; sortOrder: number }[] = [];
      component.nodeAdded.subscribe((v) => emitted.push(v));

      const floor = component.floors().find((f) => f.z === 1)!;
      component.addNodeToFloor(floor);

      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toEqual({
        z: 1,
        positionType: 'segon',
        label: 'Segon',
        sortOrder: 2,
      });
    });
  });

  describe('removeLastNodeFromFloor()', () => {
    it('emits nodeRemoved with the id of the last node (highest sortOrder)', () => {
      fixture.componentRef.setInput('troncNodes', [
        makeNode({ id: 'first', z: 1, sortOrder: 0 }),
        makeNode({ id: 'last',  z: 1, sortOrder: 1 }),
      ]);

      const emitted: string[] = [];
      component.nodeRemoved.subscribe((v) => emitted.push(v));

      const floor = component.floors().find((f) => f.z === 1)!;
      component.removeLastNodeFromFloor(floor);

      expect(emitted).toEqual(['last']);
    });

    it('does not emit when floor has no nodes', () => {
      const emitted: string[] = [];
      component.nodeRemoved.subscribe((v) => emitted.push(v));

      component.removeLastNodeFromFloor({ z: 1, pisLabel: 'P2', nodes: [] });

      expect(emitted).toHaveLength(0);
    });
  });
});
