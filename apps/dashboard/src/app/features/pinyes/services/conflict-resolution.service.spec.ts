import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, it, expect, vi } from 'vitest';
import { ConflictResolutionService } from './conflict-resolution.service';
import { SegmentWorkspaceStateService } from './segment-workspace-state.service';
import { AssignmentStateService } from './assignment-state.service';
import { UndoRedoService } from './undo-redo.service';
import { NodeAssignmentService } from './node-assignment.service';
import { ToastService } from '../../../shared/components/feedback/toast/toast.service';
import { AssignmentDetail, ConflictPlacement, SegmentConflict } from '../models/assignment.model';

const makePlacement = (overrides: Partial<ConflictPlacement> = {}): ConflictPlacement => ({
  assignmentId: 'as-1',
  figureInstanceId: 'inst-1',
  figureName: 'Figura 1',
  nodeId: 'node-1',
  nodeLabel: 'Mans',
  zone: 'PINYA',
  area: 'PINYA',
  z: 0,
  renglaPosition: null,
  cordon: null,
  ...overrides,
});

const makeAssignment = (placement: ConflictPlacement, personId: string): AssignmentDetail => ({
  id: placement.assignmentId,
  figureInstanceId: placement.figureInstanceId,
  node: {
    id: placement.nodeId,
    label: placement.nodeLabel ?? '',
    zone: placement.zone,
    z: placement.z ?? 0,
    positionType: null,
    sortOrder: 0,
    climbIndicator: null,
    ringLevel: null,
    originNodeId: null,
    sourceNodeId: null,
  },
  person: {
    id: personId,
    alias: 'Alias',
    name: 'Nom',
    firstSurname: 'Cognom',
    shoulderHeight: null,
    notes: null,
    notesEmoji: null,
  },
});

type MockFn = ReturnType<typeof vi.fn>;

describe('ConflictResolutionService', () => {
  let service: ConflictResolutionService;
  let ws: SegmentWorkspaceStateService;
  let state: AssignmentStateService;
  let undoRedo: UndoRedoService;
  let assignmentService: { unassign: MockFn; assign: MockFn; getSegmentConflicts: MockFn };

  const setup = () => {
    assignmentService = {
      unassign: vi.fn().mockReturnValue(of(undefined)),
      assign: vi.fn(),
      getSegmentConflicts: vi.fn().mockReturnValue(of({ data: [], meta: null })),
    };

    TestBed.configureTestingModule({
      providers: [
        ConflictResolutionService,
        SegmentWorkspaceStateService,
        AssignmentStateService,
        UndoRedoService,
        { provide: NodeAssignmentService, useValue: assignmentService },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn(), info: vi.fn() } },
      ],
    });

    service = TestBed.inject(ConflictResolutionService);
    ws = TestBed.inject(SegmentWorkspaceStateService);
    state = TestBed.inject(AssignmentStateService);
    undoRedo = TestBed.inject(UndoRedoService);
    ws.eventId.set('event-1');
    ws.segmentId.set('segment-1');
  };

  describe('removePlacement', () => {
    it('unassigns the single placement and removes it from local state', () => {
      setup();
      const placement = makePlacement();
      state.assignments.set([makeAssignment(placement, 'person-1')]);

      service.removePlacement('person-1', placement);

      expect(assignmentService.unassign).toHaveBeenCalledWith('inst-1', 'as-1');
      expect(state.assignments()).toEqual([]);
    });

    it('pushes a single undo entry that re-assigns the same person to the same node', () => {
      setup();
      const placement = makePlacement();
      state.assignments.set([makeAssignment(placement, 'person-1')]);
      assignmentService.assign.mockReturnValue(of(makeAssignment(placement, 'person-1')));

      service.removePlacement('person-1', placement);

      expect(undoRedo.canUndo()).toBe(true);
      undoRedo.undo().subscribe();
      expect(assignmentService.assign).toHaveBeenCalledWith('inst-1', { nodeId: 'node-1', personId: 'person-1' });
      expect(state.assignments().map((a) => a.id)).toEqual(['as-1']);
    });
  });

  describe('releaseSuggested ("Allibera la pinya")', () => {
    it('removes 2 pinya placements as ONE undo entry; undo recovers both', () => {
      setup();
      const p1 = makePlacement({ assignmentId: 'as-p1', nodeId: 'n-p1', area: 'PINYA', figureInstanceId: 'inst-a' });
      const p2 = makePlacement({ assignmentId: 'as-p2', nodeId: 'n-p2', area: 'PINYA', figureInstanceId: 'inst-b' });
      const troncPlacement = makePlacement({ assignmentId: 'as-t', nodeId: 'n-t', area: 'TRONC', figureInstanceId: 'inst-c' });
      const conflict: SegmentConflict = {
        personId: 'person-1',
        personAlias: 'Pepet',
        placements: [troncPlacement, p1, p2],
        kind: 'TRONC_PINYA',
        suggestedRemovalAssignmentIds: ['as-p1', 'as-p2'],
      };
      state.assignments.set([
        makeAssignment(troncPlacement, 'person-1'),
        makeAssignment(p1, 'person-1'),
        makeAssignment(p2, 'person-1'),
      ]);

      service.releaseSuggested(conflict);

      // Live removal touches only the suggested (pinya) placements.
      expect(assignmentService.unassign).toHaveBeenCalledWith('inst-a', 'as-p1');
      expect(assignmentService.unassign).toHaveBeenCalledWith('inst-b', 'as-p2');
      expect(assignmentService.unassign).not.toHaveBeenCalledWith('inst-c', 'as-t');
      expect(state.assignments().map((a) => a.id).sort()).toEqual(['as-t']);

      // Exactly one entry on the undo stack for both removals.
      expect(undoRedo.canUndo()).toBe(true);

      assignmentService.assign.mockImplementation((instanceId: string, payload: { nodeId: string; personId: string }) =>
        of(makeAssignment(payload.nodeId === 'n-p1' ? p1 : p2, payload.personId)),
      );

      undoRedo.undo().subscribe();

      expect(assignmentService.assign).toHaveBeenCalledWith('inst-a', { nodeId: 'n-p1', personId: 'person-1' });
      expect(assignmentService.assign).toHaveBeenCalledWith('inst-b', { nodeId: 'n-p2', personId: 'person-1' });
      expect(state.assignments()).toHaveLength(3);
      expect(undoRedo.canUndo()).toBe(false);
      expect(undoRedo.canRedo()).toBe(true);
    });
  });

  describe('removeTroncSide ("Treu la del tronc")', () => {
    it('removes only the TRONC-area placements', () => {
      setup();
      const troncPlacement = makePlacement({ assignmentId: 'as-t', nodeId: 'n-t', area: 'TRONC', figureInstanceId: 'inst-c' });
      const pinyaPlacement = makePlacement({ assignmentId: 'as-p', nodeId: 'n-p', area: 'PINYA', figureInstanceId: 'inst-a' });
      const conflict: SegmentConflict = {
        personId: 'person-1',
        personAlias: 'Pepet',
        placements: [troncPlacement, pinyaPlacement],
        kind: 'TRONC_PINYA',
        suggestedRemovalAssignmentIds: ['as-p'],
      };
      state.assignments.set([
        makeAssignment(troncPlacement, 'person-1'),
        makeAssignment(pinyaPlacement, 'person-1'),
      ]);

      service.removeTroncSide(conflict);

      expect(assignmentService.unassign).toHaveBeenCalledWith('inst-c', 'as-t');
      expect(assignmentService.unassign).not.toHaveBeenCalledWith('inst-a', 'as-p');
      expect(state.assignments().map((a) => a.id)).toEqual(['as-p']);
    });

    it('no-ops when the conflict has no TRONC placement (PINYA_PINYA)', () => {
      setup();
      const p1 = makePlacement({ assignmentId: 'as-p1', area: 'PINYA' });
      const p2 = makePlacement({ assignmentId: 'as-p2', area: 'PINYA', nodeId: 'n-p2' });
      const conflict: SegmentConflict = {
        personId: 'person-1',
        personAlias: 'Pepet',
        placements: [p1, p2],
        kind: 'PINYA_PINYA',
        suggestedRemovalAssignmentIds: ['as-p2'],
      };
      state.assignments.set([makeAssignment(p1, 'person-1'), makeAssignment(p2, 'person-1')]);

      service.removeTroncSide(conflict);

      expect(assignmentService.unassign).not.toHaveBeenCalled();
    });
  });

  describe('after a successful resolution', () => {
    it('refreshes the person list and reloads segment conflicts', () => {
      setup();
      const placement = makePlacement();
      state.assignments.set([makeAssignment(placement, 'person-1')]);
      const reloadSpy = vi.spyOn(ws, 'reloadConflicts');
      const refreshSpy = vi.spyOn(state, 'refreshPersonList');

      service.removePlacement('person-1', placement);

      expect(reloadSpy).toHaveBeenCalled();
      expect(refreshSpy).toHaveBeenCalled();
    });
  });
});
