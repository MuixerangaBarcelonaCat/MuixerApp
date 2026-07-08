import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, it, expect, vi } from 'vitest';
import { SegmentWorkspaceStateService } from './segment-workspace-state.service';
import { AssignmentStateService } from './assignment-state.service';
import { EventSegmentService } from './event-segment.service';
import { SegmentDistributionService } from './segment-distribution.service';
import { NodeAssignmentService } from './node-assignment.service';
import { ToastService } from '../../../shared/components/feedback/toast/toast.service';
import { SegmentDetail, InstanceDetail } from '../models/segment.model';
import { SegmentDistributionData } from '../models/distribution.model';
import { AssignmentDetail, AvailablePerson, InstanceNodeItem } from '../models/assignment.model';

const EVENT_ID = 'event-1';
const SEGMENT_ID = 'seg-1';

const makeNode = (id: string, zone: string, overrides: Partial<InstanceNodeItem> = {}): InstanceNodeItem => ({
  id,
  label: id,
  zone,
  positionType: null,
  x: 0,
  y: 0,
  z: 0,
  width: 30,
  height: 30,
  rotation: 0,
  color: null,
  shape: 'RECTANGLE',
  sortOrder: 0,
  ringLevel: null,
  originNodeId: null,
  renglaId: null,
  renglaPosition: null,
  sourceNodeId: null,
  isSnapshotted: false,
  isAdHoc: false,
  createdById: null,
  ...overrides,
});

const makeInstance = (id: string, overrides: Partial<InstanceDetail> = {}): InstanceDetail => ({
  id,
  label: null,
  sortOrder: 0,
  snapshotted: false,
  assignedCount: 0,
  pinyaAssignedCount: 0,
  pinyaCapacity: null,
  totalCordons: null,
  numberOfCordons: null,
  projectionX: null,
  projectionY: null,
  projectionScale: 1,
  figureMode: 'COMPLETA',
  figureTemplate: { id: `tpl-${id}`, name: `Figura ${id}`, hasPinya: true },
  ...overrides,
});

const makeSegment = (instances: InstanceDetail[]): SegmentDetail => ({
  id: SEGMENT_ID,
  name: 'Bloc 1',
  sortOrder: 0,
  startTime: null,
  endTime: null,
  notes: null,
  isVisible: true,
  instances,
});

const makeDistributionItem = (
  instanceId: string,
  overrides: Partial<SegmentDistributionData['items'][number]> = {},
): SegmentDistributionData['items'][number] => ({
  instanceId,
  label: null,
  figureMode: 'COMPLETA',
  numberOfCordons: null,
  assignments: [],
  figureTemplate: { id: `tpl-${instanceId}`, name: `Figura ${instanceId}`, nodes: [] },
  troncGridCols: 2,
  troncGridRows: 3,
  projectionX: null,
  projectionY: null,
  projectionAngle: null,
  troncPanelX: null,
  troncPanelY: null,
  troncPanelWidth: null,
  troncPanelHeight: null,
  ...overrides,
});

const makeAssignment = (id: string, instanceId: string, nodeId: string, personId = `p-${id}`): AssignmentDetail => ({
  id,
  figureInstanceId: instanceId,
  node: {
    id: nodeId,
    label: nodeId,
    zone: 'PINYA',
    z: 0,
    positionType: null,
    sortOrder: 0,
    ringLevel: null,
    originNodeId: null,
    sourceNodeId: null,
  },
  person: {
    id: personId,
    alias: `Alias ${personId}`,
    name: 'Nom',
    firstSurname: 'Cognom',
    shoulderHeight: null,
    notes: null,
    notesEmoji: null,
  },
});

const makePerson = (id: string, overrides: Partial<AvailablePerson> = {}): AvailablePerson => ({
  id,
  alias: `Alias ${id}`,
  name: 'Nom',
  firstSurname: 'Cognom',
  shoulderHeight: null,
  isXicalla: false,
  notes: null,
  notesEmoji: null,
  attendanceStatus: 'ANIRE',
  nextPerformanceStatus: null,
  assignedInSegment: false,
  positions: [],
  ...overrides,
});

describe('SegmentWorkspaceStateService', () => {
  let service: SegmentWorkspaceStateService;
  let state: AssignmentStateService;
  let segmentService: { getByEvent: ReturnType<typeof vi.fn> };
  let distributionService: { getDistribution: ReturnType<typeof vi.fn> };
  let assignmentService: {
    getInstanceNodes: ReturnType<typeof vi.fn>;
    getByInstance: ReturnType<typeof vi.fn>;
    getAvailablePersons: ReturnType<typeof vi.fn>;
    getLockStatus: ReturnType<typeof vi.fn>;
  };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };

  const configure = (opts: {
    segment?: SegmentDetail;
    distribution?: SegmentDistributionData;
    nodesByInstance?: Record<string, InstanceNodeItem[]>;
    assignmentsByInstance?: Record<string, AssignmentDetail[]>;
    persons?: AvailablePerson[];
  } = {}) => {
    const segment = opts.segment ?? makeSegment([makeInstance('inst-a')]);
    const distribution = opts.distribution ?? {
      segment: { id: SEGMENT_ID, name: 'Bloc 1' },
      items: segment.instances.map((i) => makeDistributionItem(i.id)),
    };

    segmentService = { getByEvent: vi.fn().mockReturnValue(of({ data: [segment] })) };
    distributionService = { getDistribution: vi.fn().mockReturnValue(of(distribution)) };
    assignmentService = {
      getInstanceNodes: vi.fn((instanceId: string) =>
        of({ data: opts.nodesByInstance?.[instanceId] ?? [] }),
      ),
      getByInstance: vi.fn((instanceId: string) =>
        of({ data: opts.assignmentsByInstance?.[instanceId] ?? [] }),
      ),
      getAvailablePersons: vi.fn().mockReturnValue(of({ data: opts.persons ?? [] })),
      getLockStatus: vi.fn().mockReturnValue(of({ locked: false, lockDate: null, lockDays: 3 })),
    };
    toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        SegmentWorkspaceStateService,
        AssignmentStateService,
        { provide: EventSegmentService, useValue: segmentService },
        { provide: SegmentDistributionService, useValue: distributionService },
        { provide: NodeAssignmentService, useValue: assignmentService },
        { provide: ToastService, useValue: toast },
      ],
    });
    service = TestBed.inject(SegmentWorkspaceStateService);
    state = TestBed.inject(AssignmentStateService);
  };

  describe('load', () => {
    it('sets the segment name and builds one instance per segment instance with a template', () => {
      configure({
        segment: makeSegment([
          makeInstance('inst-a'),
          makeInstance('inst-b', { figureTemplate: null }),
        ]),
      });

      service.load(EVENT_ID, SEGMENT_ID);

      expect(service.segmentName()).toBe('Bloc 1');
      expect(service.instances().map((i) => i.instanceId)).toEqual(['inst-a']);
      expect(service.loading()).toBe(false);
    });

    it('flags notFound when the segment does not exist', () => {
      configure();
      segmentService.getByEvent.mockReturnValue(of({ data: [] }));

      service.load(EVENT_ID, SEGMENT_ID);

      expect(service.notFound()).toBe(true);
    });

    it('computes display labels from figureMode', () => {
      configure({
        segment: makeSegment([
          makeInstance('inst-a', { figureMode: 'PEU' }),
          makeInstance('inst-b', { figureMode: 'REMAT' }),
          makeInstance('inst-c', { figureMode: 'NETA', figureTemplate: { id: 't', name: 'Torreta', hasPinya: true } }),
        ]),
      });

      service.load(EVENT_ID, SEGMENT_ID);

      const labels = service.instances().map((i) => i.label);
      expect(labels[0]).toBe('Peu de Figura inst-a');
      expect(labels[1]).toBe('Remat de Figura inst-b');
      expect(labels[2]).toBe('Torreta neta');
    });

    it('loads nodes for every instance and computes totalCount excluding decorations and cordons-hidden nodes', () => {
      configure({
        segment: makeSegment([makeInstance('inst-a', { numberOfCordons: 1 })]),
        nodesByInstance: {
          'inst-a': [
            makeNode('n1', 'PINYA', { renglaId: 'r1', renglaPosition: 1 }),
            makeNode('n2', 'PINYA', { renglaId: 'r1', renglaPosition: 2 }),
            makeNode('d1', 'DECORATION'),
            makeNode('b1', 'BASE'),
          ],
        },
      });

      service.load(EVENT_ID, SEGMENT_ID);

      const inst = service.instances()[0];
      expect(inst.nodes).toHaveLength(4);
      expect(inst.totalCount).toBe(2); // n1 + b1 (n2 hidden by cordons, d1 decoration)
    });

    it('flattens assignments of all instances into the shared assignment state', () => {
      configure({
        segment: makeSegment([makeInstance('inst-a'), makeInstance('inst-b')]),
        assignmentsByInstance: {
          'inst-a': [makeAssignment('as-1', 'inst-a', 'n1')],
          'inst-b': [makeAssignment('as-2', 'inst-b', 'n2')],
        },
      });

      service.load(EVENT_ID, SEGMENT_ID);

      expect(state.assignments().map((a) => a.id).sort()).toEqual(['as-1', 'as-2']);
      expect(service.instances().find((i) => i.instanceId === 'inst-a')?.assignedCount).toBe(1);
    });

    it('loads confirmed persons into the shared state and marks personsLoaded', () => {
      configure({ persons: [makePerson('p1'), makePerson('p2', { attendanceStatus: 'PENDENT' })] });

      service.load(EVENT_ID, SEGMENT_ID);

      expect(service.personsLoaded()).toBe(true);
      expect(state.confirmedPersons()).toHaveLength(2);
      expect(state.attendanceRegistry().get('p1')).toBe('ANIRE');
    });

    it('loads the lock status', () => {
      configure();
      assignmentService.getLockStatus.mockReturnValue(of({ locked: true, lockDate: '2026-07-01', lockDays: 3 }));

      service.load(EVENT_ID, SEGMENT_ID);

      expect(service.isLocked()).toBe(true);
    });

    it('resets shared assignment state on load', () => {
      configure();
      state.assignments.set([makeAssignment('stale', 'old-inst', 'n-old')]);
      state.selectedNodeId.set('n-old');

      service.load(EVENT_ID, SEGMENT_ID);

      expect(state.assignments().every((a) => a.id !== 'stale')).toBe(true);
      expect(state.selectedNodeId()).toBeNull();
    });
  });

  describe('pinyaSlots', () => {
    it('uses stored distribution positions when present', () => {
      const seg = makeSegment([makeInstance('inst-a')]);
      configure({
        segment: seg,
        distribution: {
          segment: { id: SEGMENT_ID, name: 'Bloc 1' },
          items: [makeDistributionItem('inst-a', { projectionX: 150, projectionY: 250, projectionAngle: 30 })],
        },
        nodesByInstance: { 'inst-a': [makeNode('n1', 'PINYA')] },
      });

      service.load(EVENT_ID, SEGMENT_ID);

      const slot = service.pinyaSlots()[0];
      expect(slot.offsetX).toBe(150);
      expect(slot.offsetY).toBe(250);
      expect(slot.angle).toBe(30);
    });

    it('auto-places all figures in a horizontal line when no positions are stored', () => {
      configure({
        segment: makeSegment([makeInstance('inst-a'), makeInstance('inst-b')]),
        nodesByInstance: {
          'inst-a': [makeNode('n1', 'PINYA', { width: 100, height: 40 })],
          'inst-b': [makeNode('n2', 'PINYA', { width: 100, height: 40 })],
        },
      });

      service.load(EVENT_ID, SEGMENT_ID);

      const [a, b] = service.pinyaSlots();
      expect(a.offsetY).toBe(0);
      expect(b.offsetY).toBe(0);
      expect(b.offsetX).toBeGreaterThan(a.offsetX);
      expect(a.angle).toBe(0);
    });

    it('auto-places unpositioned figures to the right of positioned ones', () => {
      configure({
        segment: makeSegment([makeInstance('inst-a'), makeInstance('inst-b')]),
        distribution: {
          segment: { id: SEGMENT_ID, name: 'Bloc 1' },
          items: [
            makeDistributionItem('inst-a', { projectionX: 400, projectionY: 100, projectionAngle: 0 }),
            makeDistributionItem('inst-b'),
          ],
        },
        nodesByInstance: {
          'inst-a': [makeNode('n1', 'PINYA', { width: 100, height: 40 })],
          'inst-b': [makeNode('n2', 'PINYA', { width: 100, height: 40 })],
        },
      });

      service.load(EVENT_ID, SEGMENT_ID);

      const slotB = service.pinyaSlots().find((s) => s.slotId === 'inst-b');
      expect(slotB?.offsetX).toBeGreaterThan(400 + 50);
    });

    it('includes PINYA, BASE and DECORATION nodes but never TRONC nodes', () => {
      configure({
        nodesByInstance: {
          'inst-a': [
            makeNode('p1', 'PINYA'),
            makeNode('b1', 'BASE'),
            makeNode('d1', 'DECORATION'),
            makeNode('t1', 'TRONC'),
          ],
        },
      });

      service.load(EVENT_ID, SEGMENT_ID);

      const ids = service.pinyaSlots()[0].figureTemplate.nodes.map((n) => n.id).sort();
      expect(ids).toEqual(['b1', 'd1', 'p1']);
    });

    it('hides BASE nodes for REMAT instances', () => {
      configure({
        segment: makeSegment([makeInstance('inst-a', { figureMode: 'REMAT' })]),
        nodesByInstance: {
          'inst-a': [makeNode('p1', 'PINYA'), makeNode('b1', 'BASE')],
        },
      });

      service.load(EVENT_ID, SEGMENT_ID);

      const ids = service.pinyaSlots()[0].figureTemplate.nodes.map((n) => n.id);
      expect(ids).toEqual(['p1']);
    });

    it('hides PINYA nodes beyond the instance numberOfCordons and repositions cordo-obert nodes', () => {
      configure({
        segment: makeSegment([makeInstance('inst-a', { numberOfCordons: 1 })]),
        nodesByInstance: {
          'inst-a': [
            makeNode('n1', 'PINYA', { renglaId: 'r1', renglaPosition: 1, x: 10, y: 10 }),
            makeNode('n2', 'PINYA', { renglaId: 'r1', renglaPosition: 2, x: 20, y: 20 }),
            makeNode('co', 'PINYA', { renglaId: 'r1', renglaPosition: 3, positionType: 'cordo-obert', x: 30, y: 30 }),
          ],
        },
      });

      service.load(EVENT_ID, SEGMENT_ID);

      const nodes = service.pinyaSlots()[0].figureTemplate.nodes;
      expect(nodes.map((n) => n.id).sort()).toEqual(['co', 'n1']);
      const cordoObert = nodes.find((n) => n.id === 'co');
      expect(cordoObert?.x).toBe(20);
      expect(cordoObert?.y).toBe(20);
    });

    it('keeps an auto-placed figure position stable when its nodes change later (e.g. adding an ad-hoc node)', () => {
      configure({
        segment: makeSegment([makeInstance('inst-a'), makeInstance('inst-b')]),
        nodesByInstance: {
          'inst-a': [makeNode('n1', 'PINYA', { width: 100, height: 40 })],
          'inst-b': [makeNode('n2', 'PINYA', { width: 100, height: 40 })],
        },
      });
      service.load(EVENT_ID, SEGMENT_ID);
      const initialOffsetX = service.pinyaSlots().find((s) => s.slotId === 'inst-b')?.offsetX;

      assignmentService.getInstanceNodes.mockImplementation((instanceId: string) =>
        of({
          data:
            instanceId === 'inst-a'
              ? [
                  makeNode('n1', 'PINYA', { width: 100, height: 40 }),
                  makeNode('adhoc-1', 'PINYA', { x: 600, width: 40, height: 40, isAdHoc: true }),
                ]
              : [makeNode('n2', 'PINYA', { width: 100, height: 40 })],
        }),
      );
      service.refreshInstance('inst-a');

      const offsetXAfter = service.pinyaSlots().find((s) => s.slotId === 'inst-b')?.offsetX;
      expect(offsetXAfter).toBe(initialOffsetX);
    });

    it('skips instances with no pinya-canvas nodes', () => {
      configure({
        segment: makeSegment([makeInstance('inst-a'), makeInstance('inst-b')]),
        nodesByInstance: {
          'inst-a': [makeNode('t1', 'TRONC')],
          'inst-b': [makeNode('p1', 'PINYA')],
        },
      });

      service.load(EVENT_ID, SEGMENT_ID);

      expect(service.pinyaSlots().map((s) => s.slotId)).toEqual(['inst-b']);
    });
  });

  describe('refreshInstance', () => {
    it('marks the instance snapshotted when the refreshed nodes are snapshotted', () => {
      configure({ nodesByInstance: { 'inst-a': [makeNode('n1', 'PINYA')] } });
      service.load(EVENT_ID, SEGMENT_ID);
      expect(service.instances()[0].snapshotted).toBe(false);

      assignmentService.getInstanceNodes.mockReturnValue(
        of({ data: [makeNode('n1', 'PINYA', { isSnapshotted: true })] }),
      );
      service.refreshInstance('inst-a');

      expect(service.instances()[0].snapshotted).toBe(true);
    });
  });

  describe('selection', () => {
    it('selectInstance sets selectedInstanceId and clears the node selection', () => {
      configure();
      service.load(EVENT_ID, SEGMENT_ID);
      state.selectedNodeId.set('n1');

      service.selectInstance('inst-a');

      expect(service.selectedInstanceId()).toBe('inst-a');
      expect(state.selectedNodeId()).toBeNull();
    });
  });

  describe('refresh', () => {
    it('re-fetches numberOfCordons, figureMode and label for existing instances, keeping their loaded nodes', () => {
      configure({
        segment: makeSegment([makeInstance('inst-a', { numberOfCordons: 1, figureMode: 'COMPLETA' })]),
        nodesByInstance: { 'inst-a': [makeNode('n1', 'PINYA')] },
      });
      service.load(EVENT_ID, SEGMENT_ID);
      expect(service.instances()[0].nodes).toHaveLength(1);

      segmentService.getByEvent.mockReturnValue(
        of({
          data: [makeSegment([makeInstance('inst-a', { numberOfCordons: 3, figureMode: 'PEU' })])],
        }),
      );
      service.refresh();

      const inst = service.instances()[0];
      expect(inst.numberOfCordons).toBe(3);
      expect(inst.figureMode).toBe('PEU');
      expect(inst.nodes).toHaveLength(1);
    });

    it('re-fetches distribution positions', () => {
      configure();
      service.load(EVENT_ID, SEGMENT_ID);

      distributionService.getDistribution.mockReturnValue(
        of({
          segment: { id: SEGMENT_ID, name: 'Bloc 1' },
          items: [makeDistributionItem('inst-a', { projectionX: 999, projectionY: 111, projectionAngle: 0 })],
        }),
      );
      service.refresh();

      expect(service.distributionByInstance().get('inst-a')?.projectionX).toBe(999);
    });

    it('does nothing when called before load (no event/segment id yet)', () => {
      configure();

      expect(() => service.refresh()).not.toThrow();
      expect(segmentService.getByEvent).not.toHaveBeenCalled();
    });
  });
});
