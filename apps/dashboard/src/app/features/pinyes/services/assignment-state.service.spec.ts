import { TestBed } from '@angular/core/testing';
import { AssignmentStateService } from './assignment-state.service';
import { AssignmentDetail, AvailablePerson, InstanceNodeItem } from '../models/assignment.model';
import { AD_HOC_PINYA_PRESETS } from '@muixer/shared';

const makeAssignment = (nodeId = 'node-1', personId = 'person-1'): AssignmentDetail => ({
  id: 'assignment-1',
  figureInstanceId: 'instance-1',
  compositionSlotId: null,
  node: { id: nodeId, label: 'pd4-1', zone: 'TRONC', z: 1, positionType: 'pd4', sortOrder: 0, ringLevel: null, originNodeId: null, sourceNodeId: null },
  person: { id: personId, alias: 'Pepet', name: 'Pere', firstSurname: 'Garcia', shoulderHeight: 140 },
});

const makeAvailablePerson = (id = 'person-1', status: AvailablePerson['attendanceStatus'] = 'ANIRE'): AvailablePerson => ({
  id,
  alias: 'Pepet',
  name: 'Pere',
  firstSurname: 'Garcia',
  shoulderHeight: 140,
  isXicalla: false,
  attendanceStatus: status,
  nextPerformanceStatus: null,
  assignedInSegment: false,
  positions: [],
});

describe('AssignmentStateService', () => {
  let service: AssignmentStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AssignmentStateService],
    });
    service = TestBed.inject(AssignmentStateService);
  });

  // ── selection state ────────────────────────────────────────────────────────

  describe('selection state', () => {
    it('selectedNodeId defaults to null', () => {
      expect(service.selectedNodeId()).toBeNull();
    });

    it('selectedPersonId defaults to null', () => {
      expect(service.selectedPersonId()).toBeNull();
    });

    it('setting selectedNodeId clears selectedPersonId', () => {
      service.setSelectedPersonId('person-1');
      expect(service.selectedPersonId()).toBe('person-1');

      service.setSelectedNodeId('node-1');
      expect(service.selectedNodeId()).toBe('node-1');
      expect(service.selectedPersonId()).toBeNull();
    });

    it('setting selectedPersonId clears selectedNodeId', () => {
      service.setSelectedNodeId('node-1');
      expect(service.selectedNodeId()).toBe('node-1');

      service.setSelectedPersonId('person-1');
      expect(service.selectedPersonId()).toBe('person-1');
      expect(service.selectedNodeId()).toBeNull();
    });
  });

  // ── assignments ────────────────────────────────────────────────────────────

  describe('assignments', () => {
    it('assignments defaults to empty array', () => {
      expect(service.assignments()).toEqual([]);
    });

    it('setting assignments updates the signal', () => {
      const assignments = [makeAssignment()];
      service.assignments.set(assignments);
      expect(service.assignments()).toEqual(assignments);
    });
  });

  // ── heightMode ─────────────────────────────────────────────────────────────

  describe('heightMode', () => {
    it('defaults to relative', () => {
      expect(service.heightMode()).toBe('relative');
    });

    it('toggles to absolute when called once', () => {
      service.toggleHeightMode();
      expect(service.heightMode()).toBe('absolute');
    });

    it('toggles back to relative when called twice', () => {
      service.toggleHeightMode();
      service.toggleHeightMode();
      expect(service.heightMode()).toBe('relative');
    });
  });

  // ── freePersonsCount ───────────────────────────────────────────────────────

  describe('freePersonsCount (computed)', () => {
    it('returns 0 when no confirmed persons data', () => {
      service.confirmedPersons.set([]);
      service.assignments.set([]);
      expect(service.freePersonsCount()).toBe(0);
    });

    it('returns correct count (total ANIRE minus assigned in segment)', () => {
      service.confirmedPersons.set([
        makeAvailablePerson('person-1', 'ANIRE'),
        makeAvailablePerson('person-2', 'ANIRE'),
        makeAvailablePerson('person-3', 'PENDENT'),
      ]);
      service.assignments.set([makeAssignment('node-1', 'person-1')]);
      // 2 ANIRE total, 1 assigned → 1 free
      expect(service.freePersonsCount()).toBe(1);
    });

    it('updates reactively when assignments change', () => {
      service.confirmedPersons.set([
        makeAvailablePerson('person-1', 'ANIRE'),
        makeAvailablePerson('person-2', 'ANIRE'),
      ]);
      service.assignments.set([]);
      expect(service.freePersonsCount()).toBe(2);

      service.assignments.set([makeAssignment('node-1', 'person-1')]);
      expect(service.freePersonsCount()).toBe(1);

      service.assignments.set([
        makeAssignment('node-1', 'person-1'),
        makeAssignment('node-2', 'person-2'),
      ]);
      expect(service.freePersonsCount()).toBe(0);
    });
  });

  // ── reset ──────────────────────────────────────────────────────────────────

  describe('reset', () => {
    it('resets all signals to defaults', () => {
      service.setSelectedNodeId('node-1');
      service.activeInstanceId.set('instance-1');
      service.assignments.set([makeAssignment()]);
      service.toggleHeightMode();
      service.panelCollapsed.set(true);

      service.reset();

      expect(service.selectedNodeId()).toBeNull();
      expect(service.selectedPersonId()).toBeNull();
      expect(service.activeInstanceId()).toBeNull();
      expect(service.assignments()).toEqual([]);
      expect(service.heightMode()).toBe('relative');
      expect(service.panelCollapsed()).toBe(false);
      expect(service.isPlacementMode()).toBe(false);
      expect(service.placementPreset()).toBeNull();
      expect(service.activeTabNodes()).toEqual([]);
    });
  });

  // ── ad-hoc placement mode ─────────────────────────────────────────────────

  describe('placement mode', () => {
    const mansPreset = AD_HOC_PINYA_PRESETS.find((p) => p.positionType === 'mans')!;

    it('isPlacementMode defaults to false', () => {
      expect(service.isPlacementMode()).toBe(false);
    });

    it('enterPlacementMode activates placement and clears selection', () => {
      service.setSelectedNodeId('node-1');
      service.setSelectedPersonId('person-1');

      service.enterPlacementMode(mansPreset);

      expect(service.isPlacementMode()).toBe(true);
      expect(service.placementPreset()).toBe(mansPreset);
      expect(service.selectedNodeId()).toBeNull();
      expect(service.selectedPersonId()).toBeNull();
    });

    it('enterPlacementMode stores custom label for comodin', () => {
      const comodinPreset = AD_HOC_PINYA_PRESETS.find((p) => p.requiresCustomLabel)!;
      service.enterPlacementMode(comodinPreset, 'Extra mans');

      expect(service.placementCustomLabel()).toBe('Extra mans');
    });

    it('exitPlacementMode deactivates placement', () => {
      service.enterPlacementMode(mansPreset);
      service.exitPlacementMode();

      expect(service.isPlacementMode()).toBe(false);
      expect(service.placementPreset()).toBeNull();
      expect(service.placementCustomLabel()).toBeNull();
    });
  });

  // ── ad-hoc node computed ─────────────────────────────────────────────────

  describe('adHocNodes computed', () => {
    const makeNode = (id: string, isAdHoc: boolean): InstanceNodeItem => ({
      id,
      label: 'Node',
      zone: 'PINYA',
      positionType: 'mans',
      x: 0, y: 0, z: 0,
      width: 80, height: 40, rotation: 0,
      color: null, shape: 'RECTANGLE',
      sortOrder: 0, ringLevel: null,
      originNodeId: null, renglaId: null,
      renglaPosition: null, sourceNodeId: null,
      isSnapshotted: true,
      isAdHoc,
      createdById: isAdHoc ? 'user-1' : null,
    });

    it('returns empty when no nodes', () => {
      service.activeTabNodes.set([]);
      expect(service.adHocNodes()).toEqual([]);
      expect(service.hasAdHocNodes()).toBe(false);
    });

    it('filters only ad-hoc nodes', () => {
      service.activeTabNodes.set([
        makeNode('n1', false),
        makeNode('n2', true),
        makeNode('n3', false),
        makeNode('n4', true),
      ]);

      expect(service.adHocNodes()).toHaveLength(2);
      expect(service.adHocNodes().map((n) => n.id)).toEqual(['n2', 'n4']);
      expect(service.hasAdHocNodes()).toBe(true);
    });
  });
});
