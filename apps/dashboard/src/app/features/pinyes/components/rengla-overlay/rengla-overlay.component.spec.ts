import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import {
  LUCIDE_ICONS, LucideIconProvider,
  Plus, Pencil, Trash2, X, GitBranchPlus,
} from 'lucide-angular';
import { RenglaOverlayComponent, RenglaCreatedEvent, RenglaUpdatedEvent, RenglaDeletedEvent } from './rengla-overlay.component';
import { FigureNodeItem, RenglaModel } from '../../models/figure-template.model';
import { FigureZone, NodeShape } from '@muixer/shared';

const makeNode = (overrides: Partial<FigureNodeItem> = {}): FigureNodeItem => ({
  id: crypto.randomUUID(),
  label: 'MANS',
  zone: FigureZone.PINYA,
  positionType: 'mans',
  x: 200,
  y: 200,
  z: 0,
  width: 80,
  height: 40,
  rotation: 0,
  color: '#FFE082',
  shape: NodeShape.RECTANGLE,
  sortOrder: 0,
  climbPath: null,
  ringLevel: 1,
  originNodeId: null,
  renglaId: null,
  renglaPosition: null,
  metadata: {},
  ...overrides,
});

const makeRengla = (overrides: Partial<RenglaModel> = {}): RenglaModel => ({
  id: crypto.randomUUID(),
  name: 'MANS',
  sortOrder: 0,
  startPosition: 1,
  allowsCordoObert: false,
  ...overrides,
});

describe('RenglaOverlayComponent', () => {
  let fixture: ComponentFixture<RenglaOverlayComponent>;
  let component: RenglaOverlayComponent;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let createdSpy: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let updatedSpy: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let deletedSpy: any;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RenglaOverlayComponent],
      providers: [
        {
          provide: LUCIDE_ICONS, multi: true,
          useFactory: () => new LucideIconProvider({ Plus, Pencil, Trash2, X, GitBranchPlus }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RenglaOverlayComponent);
    component = fixture.componentInstance;

    createdSpy = vi.fn();
    updatedSpy = vi.fn();
    deletedSpy = vi.fn();
    component.renglaCreated.subscribe((e: RenglaCreatedEvent) => createdSpy(e));
    component.renglaUpdated.subscribe((e: RenglaUpdatedEvent) => updatedSpy(e));
    component.renglaDeleted.subscribe((e: RenglaDeletedEvent) => deletedSpy(e));
  });

  function setInputs(nodes: FigureNodeItem[], rengles: RenglaModel[] = []) {
    fixture.componentRef.setInput('nodes', nodes);
    fixture.componentRef.setInput('rengles', rengles);
    fixture.componentRef.setInput('stageTransform', { x: 0, y: 0, scaleX: 1, scaleY: 1 });
    fixture.detectChanges();
  }

  it('creates successfully', () => {
    setInputs([]);
    expect(component).toBeTruthy();
  });

  it('filters out central nodes from eligible nodes', () => {
    const nodes = [
      makeNode({ id: 'n1', positionType: 'mans' }),
      makeNode({ id: 'n2', positionType: 'agulla' }),
      makeNode({ id: 'n3', positionType: 'crossa' }),
      makeNode({ id: 'n4', positionType: 'contrafort' }),
      makeNode({ id: 'n5', positionType: 'tap' }),
      makeNode({ id: 'n6', positionType: 'vents' }),
    ];
    setInputs(nodes);
    const eligible = component.eligibleNodes();
    expect(eligible.map((n) => n.id)).toEqual(['n1', 'n5', 'n6']);
  });

  it('excludes non-PINYA zone nodes from eligible', () => {
    const nodes = [
      makeNode({ id: 'n1', zone: FigureZone.PINYA, positionType: 'mans' }),
      makeNode({ id: 'n2', zone: FigureZone.BASE, positionType: 'base' }),
      makeNode({ id: 'n3', zone: FigureZone.TRONC, positionType: 'segon' }),
    ];
    setInputs(nodes);
    expect(component.eligibleNodes()).toHaveLength(1);
    expect(component.eligibleNodes()[0].id).toBe('n1');
  });

  it('computes screen positions using stage transform', () => {
    const nodes = [makeNode({ id: 'n1', x: 100, y: 50 })];
    fixture.componentRef.setInput('nodes', nodes);
    fixture.componentRef.setInput('rengles', []);
    fixture.componentRef.setInput('stageTransform', { x: 10, y: 20, scaleX: 2, scaleY: 2 });
    fixture.detectChanges();

    const sn = component.screenNodes();
    expect(sn).toHaveLength(1);
    expect(sn[0].cx).toBe(210); // 100 * 2 + 10
    expect(sn[0].cy).toBe(120); // 50 * 2 + 20
  });

  it('computes rengla lines for existing rengles', () => {
    const renglaId = 'rengla-1';
    const nodes = [
      makeNode({ id: 'n1', renglaId, renglaPosition: 1 }),
      makeNode({ id: 'n2', renglaId, renglaPosition: 2 }),
      makeNode({ id: 'n3' }),
    ];
    const rengles = [makeRengla({ id: renglaId, name: 'MANS' })];
    setInputs(nodes, rengles);

    const lines = component.renglaLines();
    expect(lines).toHaveLength(1);
    expect(lines[0].points).toHaveLength(2);
    expect(lines[0].points[0].id).toBe('n1');
    expect(lines[0].points[1].id).toBe('n2');
  });

  describe('creation flow', () => {
    it('starts creation mode', () => {
      setInputs([makeNode()]);
      component.startCreating();
      expect(component.creatingRengla()).toBe(true);
      expect(component.pendingNodeIds()).toEqual([]);
    });

    it('adds nodes to pending on click during creation', () => {
      const nodes = [makeNode({ id: 'n1' }), makeNode({ id: 'n2' })];
      setInputs(nodes);
      component.startCreating();

      component.onNodeClick('n1');
      expect(component.pendingNodeIds()).toEqual(['n1']);

      component.onNodeClick('n2');
      expect(component.pendingNodeIds()).toEqual(['n1', 'n2']);
    });

    it('toggles off node if clicked twice during creation', () => {
      setInputs([makeNode({ id: 'n1' }), makeNode({ id: 'n2' })]);
      component.startCreating();
      component.onNodeClick('n1');
      component.onNodeClick('n2');
      component.onNodeClick('n1');
      expect(component.pendingNodeIds()).toEqual(['n2']);
    });

    it('does not allow finishing with less than 1 nodes', () => {
      setInputs([makeNode({ id: 'n1' })]);
      component.startCreating();
      component.finishCreating();
      expect(component.showMiniDialog()).toBe(false);
    });

    it('opens mini-dialog when finishing with 1+ nodes', () => {
      const nodes = [
        makeNode({ id: 'n1', positionType: 'mans' }),
      ];
      setInputs(nodes);
      component.startCreating();
      component.onNodeClick('n1');
      component.finishCreating();
      expect(component.showMiniDialog()).toBe(true);
      expect(component.dialogName()).toBe('MANS');
    });

    it('emits renglaCreated on confirm', () => {
      const nodes = [
        makeNode({ id: 'n1', positionType: 'mans' }),
        makeNode({ id: 'n2', positionType: 'mans' }),
        makeNode({ id: 'n3', positionType: 'mans' }),
      ];
      setInputs(nodes);
      component.startCreating();
      component.onNodeClick('n1');
      component.onNodeClick('n2');
      component.onNodeClick('n3');
      component.finishCreating();
      component.dialogName.set('MANS Nord');
      component.dialogStartPosition.set(1);
      component.dialogAllowsCordoObert.set(true);
      component.confirmCreate();

      expect(createdSpy).toHaveBeenCalledTimes(1);
      const event = createdSpy.mock.calls[0][0] as RenglaCreatedEvent;
      expect(event.rengla.name).toBe('MANS Nord');
      expect(event.rengla.startPosition).toBe(1);
      expect(event.rengla.allowsCordoObert).toBe(true);
      expect(event.nodeAssignments).toEqual([
        { nodeId: 'n1', renglaPosition: 1 },
        { nodeId: 'n2', renglaPosition: 2 },
        { nodeId: 'n3', renglaPosition: 3 },
      ]);
    });

    it('clears state after confirm', () => {
      const nodes = [makeNode({ id: 'n1' }), makeNode({ id: 'n2' })];
      setInputs(nodes);
      component.startCreating();
      component.onNodeClick('n1');
      component.onNodeClick('n2');
      component.finishCreating();
      component.confirmCreate();

      expect(component.creatingRengla()).toBe(false);
      expect(component.pendingNodeIds()).toEqual([]);
      expect(component.showMiniDialog()).toBe(false);
    });

    it('cancelCreate resets all creation state', () => {
      setInputs([makeNode({ id: 'n1' }), makeNode({ id: 'n2' })]);
      component.startCreating();
      component.onNodeClick('n1');
      component.cancelCreate();

      expect(component.creatingRengla()).toBe(false);
      expect(component.pendingNodeIds()).toEqual([]);
    });
  });

  describe('rengla selection and editing', () => {
    it('selects a rengla by clicking an assigned node', () => {
      const renglaId = 'r-1';
      const nodes = [makeNode({ id: 'n1', renglaId, renglaPosition: 1 })];
      setInputs(nodes, [makeRengla({ id: renglaId })]);

      component.onNodeClick('n1');
      expect(component.selectedRenglaId()).toBe(renglaId);
    });

    it('selects a rengla by clicking its line', () => {
      const renglaId = 'r-1';
      setInputs([], [makeRengla({ id: renglaId })]);

      component.onRenglaLineClick(renglaId);
      expect(component.selectedRenglaId()).toBe(renglaId);
    });

    it('emits renglaUpdated on edit confirm', () => {
      const renglaId = 'r-1';
      const rengla = makeRengla({ id: renglaId, name: 'MANS', startPosition: 1 });
      setInputs([], [rengla]);

      component.selectedRenglaId.set(renglaId);
      component.editSelectedRengla();
      expect(component.showMiniDialog()).toBe(true);
      expect(component.dialogName()).toBe('MANS');

      component.dialogName.set('MANS Nord');
      component.dialogStartPosition.set(2);
      component.confirmEdit();

      expect(updatedSpy).toHaveBeenCalledTimes(1);
      const event = updatedSpy.mock.calls[0][0] as RenglaUpdatedEvent;
      expect(event.rengla.name).toBe('MANS Nord');
      expect(event.rengla.startPosition).toBe(2);
    });

    it('emits renglaDeleted on delete', () => {
      const renglaId = 'r-1';
      setInputs([], [makeRengla({ id: renglaId })]);

      component.selectedRenglaId.set(renglaId);
      component.deleteSelectedRengla();

      expect(deletedSpy).toHaveBeenCalledTimes(1);
      expect(deletedSpy).toHaveBeenCalledWith({ renglaId });
      expect(component.selectedRenglaId()).toBeNull();
    });
  });

  describe('keyboard handling', () => {
    it('Escape cancels creation mode', () => {
      setInputs([makeNode({ id: 'n1' })]);
      component.startCreating();
      component.onNodeClick('n1');

      component.onKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(component.creatingRengla()).toBe(false);
    });

    it('Escape clears selection when not creating', () => {
      const renglaId = 'r-1';
      setInputs([], [makeRengla({ id: renglaId })]);
      component.selectedRenglaId.set(renglaId);

      component.onKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(component.selectedRenglaId()).toBeNull();
    });

    it('Enter opens finish dialog when creating with 2+ nodes', () => {
      const nodes = [makeNode({ id: 'n1' }), makeNode({ id: 'n2' })];
      setInputs(nodes);
      component.startCreating();
      component.onNodeClick('n1');
      component.onNodeClick('n2');

      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      vi.spyOn(event, 'preventDefault');
      component.onKeyDown(event);

      expect(component.showMiniDialog()).toBe(true);
    });
  });

  describe('color assignment', () => {
    it('assigns different colors to different rengles', () => {
      const r1 = makeRengla({ id: 'r1', sortOrder: 0 });
      const r2 = makeRengla({ id: 'r2', sortOrder: 1 });
      const nodes = [
        makeNode({ id: 'n1', renglaId: 'r1', renglaPosition: 1 }),
        makeNode({ id: 'n2', renglaId: 'r1', renglaPosition: 2 }),
        makeNode({ id: 'n3', renglaId: 'r2', renglaPosition: 1 }),
        makeNode({ id: 'n4', renglaId: 'r2', renglaPosition: 2 }),
      ];
      setInputs(nodes, [r1, r2]);

      const lines = component.renglaLines();
      expect(lines[0].color).not.toBe(lines[1].color);
    });
  });

  describe('helper methods', () => {
    it('toPolylinePoints formats correctly', () => {
      const result = component.toPolylinePoints([
        { id: '1', label: 'A', positionType: null, cx: 10, cy: 20, width: 80, height: 40, rotation: 0, renglaId: null, renglaPosition: null },
        { id: '2', label: 'B', positionType: null, cx: 30, cy: 40, width: 80, height: 40, rotation: 0, renglaId: null, renglaPosition: null },
      ]);
      expect(result).toBe('10,20 30,40');
    });

    it('isNodePending checks pending set', () => {
      setInputs([makeNode({ id: 'n1' }), makeNode({ id: 'n2' })]);
      component.startCreating();
      component.onNodeClick('n1');
      expect(component.isNodePending('n1')).toBe(true);
      expect(component.isNodePending('n2')).toBe(false);
    });
  });
});
