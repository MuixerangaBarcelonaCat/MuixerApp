import { AssignmentDetail, SegmentNodeRef } from '@muixer/pinyes-render';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NEVER, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastService } from '@muixer/ui';
import { DIRECCIO_PINYA_POSITION_TYPE } from '@muixer/shared';
import { SegmentAssignmentActionsService, AssignmentActionsHost } from './segment-assignment-actions.service';
import { SegmentWorkspaceStateService, WorkspaceInstance } from './segment-workspace-state.service';
import { AssignmentStateService } from './assignment-state.service';
import { NodeAssignmentService } from './node-assignment.service';
import { UndoRedoService } from './undo-redo.service';

const INST_A = 'inst-a';
const INST_B = 'inst-b';

type MockFn = ReturnType<typeof vi.fn>;

const makeNodeItem = (id: string, zone = 'PINYA', positionType: string | null = null) => ({
  id,
  label: id,
  zone,
  positionType,
  z: 0,
  sortOrder: 0,
  climbIndicator: null,
  ringLevel: null,
  originNodeId: null,
  sourceNodeId: null,
});

const makeInstance = (
  instanceId: string,
  nodes: ReturnType<typeof makeNodeItem>[],
  snapshotted = false,
): WorkspaceInstance =>
  ({
    instanceId,
    label: `Figura ${instanceId}`,
    snapshotted,
    nodes,
  }) as unknown as WorkspaceInstance;

let seq = 0;
const makeAssignment = (
  instanceId: string,
  nodeId: string,
  personId: string,
  zone = 'PINYA',
  positionType: string | null = null,
): AssignmentDetail => ({
  id: `as-${++seq}`,
  figureInstanceId: instanceId,
  node: {
    id: nodeId,
    label: nodeId,
    zone,
    z: 0,
    positionType,
    sortOrder: 0,
    climbIndicator: null,
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

const ref = (slotId: string, nodeId: string): SegmentNodeRef => ({ slotId, nodeId });

describe('SegmentAssignmentActionsService', () => {
  let service: SegmentAssignmentActionsService;
  let state: AssignmentStateService;
  let undoRedo: UndoRedoService;
  let host: { select: MockFn; clearSelection: MockFn; advanceToNextEmptyNode: MockFn };
  let ws: {
    isLocked: ReturnType<typeof signal<boolean>>;
    instances: ReturnType<typeof signal<WorkspaceInstance[]>>;
    refreshInstance: MockFn;
    reloadConflicts: MockFn;
  };
  let api: { assign: MockFn; unassign: MockFn; swap: MockFn };
  let toast: { success: MockFn; error: MockFn };

  const dynamicAssign = () =>
    api.assign.mockImplementation((instanceId: string, payload: { nodeId: string; personId: string }) =>
      of(makeAssignment(instanceId, payload.nodeId, payload.personId)),
    );

  beforeEach(() => {
    ws = {
      isLocked: signal(false),
      instances: signal([
        makeInstance(INST_A, [makeNodeItem('n1'), makeNodeItem('n2')]),
        makeInstance(INST_B, [makeNodeItem('m1')]),
      ]),
      refreshInstance: vi.fn(),
      reloadConflicts: vi.fn(),
    };
    api = {
      assign: vi.fn(),
      unassign: vi.fn().mockReturnValue(of({})),
      swap: vi.fn(),
    };
    toast = { success: vi.fn(), error: vi.fn() };
    host = { select: vi.fn(), clearSelection: vi.fn(), advanceToNextEmptyNode: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        SegmentAssignmentActionsService,
        AssignmentStateService,
        UndoRedoService,
        { provide: SegmentWorkspaceStateService, useValue: ws },
        { provide: NodeAssignmentService, useValue: api },
        { provide: ToastService, useValue: toast },
      ],
    });
    service = TestBed.inject(SegmentAssignmentActionsService);
    state = TestBed.inject(AssignmentStateService);
    undoRedo = TestBed.inject(UndoRedoService);
    service.attach(host as AssignmentActionsHost);
  });

  describe('lookups', () => {
    it('assignmentFor finds the assignment placed on a node', () => {
      const a = makeAssignment(INST_A, 'n1', 'p-1');
      state.assignments.set([a]);

      expect(service.assignmentFor(ref(INST_A, 'n1'))).toBe(a);
      expect(service.assignmentFor(ref(INST_A, 'n2'))).toBeNull();
    });

    it('nodeFor and instanceFor resolve from the workspace instances', () => {
      expect(service.instanceFor(INST_A)?.instanceId).toBe(INST_A);
      expect(service.instanceFor('nope')).toBeNull();
      expect(service.nodeFor(ref(INST_A, 'n2'))?.id).toBe('n2');
      expect(service.nodeFor(ref(INST_A, 'zzz'))).toBeNull();
    });
  });

  describe('assign', () => {
    it('adds an optimistic temp assignment and clears the selection', () => {
      api.assign.mockReturnValue(NEVER);

      service.assign(ref(INST_A, 'n1'), 'p-1');

      const optimistic = state.assignments().find((a) => a.node.id === 'n1');
      expect(optimistic?.id.startsWith('temp-')).toBe(true);
      expect(optimistic?.person.id).toBe('p-1');
      expect(host.clearSelection).toHaveBeenCalled();
      expect(state.pendingOperations()).toHaveLength(1);
    });

    it('replaces the temp assignment with the created one and clears the pending op', () => {
      const created = makeAssignment(INST_A, 'n1', 'p-1');
      api.assign.mockReturnValue(of(created));

      service.assign(ref(INST_A, 'n1'), 'p-1');

      expect(api.assign).toHaveBeenCalledWith(INST_A, { nodeId: 'n1', personId: 'p-1' });
      expect(state.assignments()).toEqual([created]);
      expect(state.pendingOperations()).toHaveLength(0);
    });

    it('refreshes the instance when it is not snapshotted', () => {
      api.assign.mockReturnValue(of(makeAssignment(INST_A, 'n1', 'p-1')));

      service.assign(ref(INST_A, 'n1'), 'p-1');

      expect(ws.refreshInstance).toHaveBeenCalledWith(INST_A);
    });

    it('only reloads conflicts when the instance is already snapshotted', () => {
      ws.instances.set([makeInstance(INST_A, [makeNodeItem('n1')], true)]);
      api.assign.mockReturnValue(of(makeAssignment(INST_A, 'n1', 'p-1')));

      service.assign(ref(INST_A, 'n1'), 'p-1');

      expect(ws.refreshInstance).not.toHaveBeenCalled();
      expect(ws.reloadConflicts).toHaveBeenCalled();
    });

    it('asks the host to advance to the next empty node after a successful assign', () => {
      api.assign.mockReturnValue(of(makeAssignment(INST_A, 'n1', 'p-1')));

      service.assign(ref(INST_A, 'n1'), 'p-1');

      expect(host.advanceToNextEmptyNode).toHaveBeenCalledWith(INST_A, 'n1');
    });

    it('pushes a plain ASSIGN undo action', () => {
      api.assign.mockReturnValue(of(makeAssignment(INST_A, 'n1', 'p-1')));

      service.assign(ref(INST_A, 'n1'), 'p-1');

      expect(undoRedo.undoDescription()).toBe('Assignar persona');
    });

    it('pushes a MOVE undo action when moveFrom is given', () => {
      api.assign.mockReturnValue(of(makeAssignment(INST_A, 'n2', 'p-1')));

      service.assign(ref(INST_A, 'n2'), 'p-1', { instanceId: INST_A, nodeId: 'n1' });

      expect(undoRedo.undoDescription()).toBe('Moure persona');
    });

    it('rolls back, reselects the node and toasts "ocupat" on a 409', () => {
      const before = [makeAssignment(INST_B, 'm1', 'p-9')];
      state.assignments.set(before);
      api.assign.mockReturnValue(throwError(() => ({ status: 409 })));

      service.assign(ref(INST_A, 'n1'), 'p-1');

      expect(state.assignments()).toEqual(before);
      expect(state.pendingOperations()).toHaveLength(0);
      expect(host.select).toHaveBeenCalledWith(ref(INST_A, 'n1'));
      expect(toast.error).toHaveBeenCalledWith('Este lloc ja està ocupat.');
    });

    it('toasts a generic error on any other failure', () => {
      api.assign.mockReturnValue(throwError(() => ({ status: 500 })));

      service.assign(ref(INST_A, 'n1'), 'p-1');

      expect(toast.error).toHaveBeenCalledWith('Error en assignar la persona.');
    });

    it('does nothing when the instance is unknown', () => {
      service.assign(ref('ghost', 'n1'), 'p-1');

      expect(api.assign).not.toHaveBeenCalled();
      expect(state.assignments()).toHaveLength(0);
    });
  });

  describe('unassign', () => {
    it('removes the assignment optimistically, clears selection and calls the API', () => {
      const a = makeAssignment(INST_A, 'n1', 'p-1');
      state.assignments.set([a]);

      service.unassign(a);

      expect(state.assignments()).toHaveLength(0);
      expect(host.clearSelection).toHaveBeenCalled();
      expect(api.unassign).toHaveBeenCalledWith(INST_A, a.id);
      expect(ws.reloadConflicts).toHaveBeenCalled();
      expect(undoRedo.undoDescription()).toBe('Desassignar persona');
    });

    it('does nothing when the workspace is locked', () => {
      const a = makeAssignment(INST_A, 'n1', 'p-1');
      state.assignments.set([a]);
      ws.isLocked.set(true);

      service.unassign(a);

      expect(api.unassign).not.toHaveBeenCalled();
      expect(state.assignments()).toEqual([a]);
    });

    it('restores the assignment and toasts when the API fails', () => {
      const a = makeAssignment(INST_A, 'n1', 'p-1');
      state.assignments.set([a]);
      api.unassign.mockReturnValue(throwError(() => ({ status: 500 })));

      service.unassign(a);

      expect(state.assignments()).toEqual([a]);
      expect(toast.error).toHaveBeenCalledWith('Error en desassignar la persona.');
    });
  });

  describe('unassignThenAssign', () => {
    it('unassigns the existing person then assigns the new one as a MOVE', () => {
      const existing = makeAssignment(INST_A, 'n1', 'p-1');
      state.assignments.set([existing]);
      dynamicAssign();

      service.unassignThenAssign(existing, ref(INST_A, 'n2'), 'p-1');

      expect(api.unassign).toHaveBeenCalledWith(INST_A, existing.id);
      expect(api.assign).toHaveBeenCalledWith(INST_A, { nodeId: 'n2', personId: 'p-1' });
      expect(state.assignments().map((a) => a.node.id)).toEqual(['n2']);
      expect(undoRedo.undoDescription()).toBe('Moure persona');
    });

    it('restores the existing assignment and toasts when the unassign fails', () => {
      const existing = makeAssignment(INST_A, 'n1', 'p-1');
      state.assignments.set([existing]);
      api.unassign.mockReturnValue(throwError(() => ({ status: 500 })));

      service.unassignThenAssign(existing, ref(INST_A, 'n2'), 'p-2');

      expect(state.assignments()).toEqual([existing]);
      expect(api.assign).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith('Error en desassignar la persona.');
    });
  });

  describe('drop', () => {
    it('ignores drops when locked', () => {
      const a = makeAssignment(INST_A, 'n1', 'p-1');
      state.assignments.set([a]);
      ws.isLocked.set(true);

      service.drop(ref(INST_A, 'n1'), ref(INST_A, 'n2'));

      expect(api.unassign).not.toHaveBeenCalled();
    });

    it('does nothing when dropped on itself', () => {
      state.assignments.set([makeAssignment(INST_A, 'n1', 'p-1')]);

      service.drop(ref(INST_A, 'n1'), ref(INST_A, 'n1'));

      expect(api.unassign).not.toHaveBeenCalled();
      expect(api.swap).not.toHaveBeenCalled();
    });

    it('does nothing when the source node has no assignment', () => {
      service.drop(ref(INST_A, 'n1'), ref(INST_A, 'n2'));

      expect(api.unassign).not.toHaveBeenCalled();
      expect(api.assign).not.toHaveBeenCalled();
    });

    it('moves the person when the target is empty', () => {
      const a = makeAssignment(INST_A, 'n1', 'p-1');
      state.assignments.set([a]);
      dynamicAssign();

      service.drop(ref(INST_A, 'n1'), ref(INST_A, 'n2'));

      expect(api.unassign).toHaveBeenCalledWith(INST_A, a.id);
      expect(api.assign).toHaveBeenCalledWith(INST_A, { nodeId: 'n2', personId: 'p-1' });
    });

    it('swaps through the swap endpoint when both nodes are in the same figure', () => {
      const a1 = makeAssignment(INST_A, 'n1', 'p-1');
      const a2 = makeAssignment(INST_A, 'n2', 'p-2');
      state.assignments.set([a1, a2]);
      api.swap.mockReturnValue(of({ a: a1, b: a2 }));

      service.drop(ref(INST_A, 'n1'), ref(INST_A, 'n2'));

      expect(api.swap).toHaveBeenCalledWith(INST_A, { assignmentIdA: a1.id, assignmentIdB: a2.id });
      expect(toast.success).toHaveBeenCalledWith("S'han intercanviat les persones.");
      expect(undoRedo.undoDescription()).toBe('Intercanviar persones');
    });

    it('cross-swaps by unassigning both and reassigning crossed when figures differ', () => {
      const a1 = makeAssignment(INST_A, 'n1', 'p-1');
      const a2 = makeAssignment(INST_B, 'm1', 'p-2');
      state.assignments.set([a1, a2]);
      dynamicAssign();

      service.drop(ref(INST_A, 'n1'), ref(INST_B, 'm1'));

      expect(api.unassign).toHaveBeenCalledWith(INST_A, a1.id);
      expect(api.unassign).toHaveBeenCalledWith(INST_B, a2.id);
      expect(api.assign).toHaveBeenCalledWith(INST_A, { nodeId: 'n1', personId: 'p-2' });
      expect(api.assign).toHaveBeenCalledWith(INST_B, { nodeId: 'm1', personId: 'p-1' });
      expect(undoRedo.undoDescription()).toBe('Intercanviar persones (figures diferents)');
    });

    it('reverts the optimistic cross swap and refreshes both figures when it fails', () => {
      const a1 = makeAssignment(INST_A, 'n1', 'p-1');
      const a2 = makeAssignment(INST_B, 'm1', 'p-2');
      state.assignments.set([a1, a2]);
      api.unassign.mockReturnValue(throwError(() => ({ status: 500 })));

      service.drop(ref(INST_A, 'n1'), ref(INST_B, 'm1'));

      expect(state.assignments()).toEqual([a1, a2]);
      expect(ws.refreshInstance).toHaveBeenCalledWith(INST_A);
      expect(ws.refreshInstance).toHaveBeenCalledWith(INST_B);
      expect(toast.error).toHaveBeenCalledWith("Error en l'intercanvi de persones.");
    });

    it('reverts the optimistic same-figure swap when it fails', () => {
      const a1 = makeAssignment(INST_A, 'n1', 'p-1');
      const a2 = makeAssignment(INST_A, 'n2', 'p-2');
      state.assignments.set([a1, a2]);
      api.swap.mockReturnValue(throwError(() => ({ status: 500 })));

      service.drop(ref(INST_A, 'n1'), ref(INST_A, 'n2'));

      expect(state.assignments()).toEqual([a1, a2]);
      expect(toast.error).toHaveBeenCalledWith("Error en l'intercanvi de persones.");
    });

    it('clears the selection after a successful drop', () => {
      state.assignments.set([makeAssignment(INST_A, 'n1', 'p-1')]);
      dynamicAssign();

      service.drop(ref(INST_A, 'n1'), ref(INST_A, 'n2'));

      expect(host.clearSelection).toHaveBeenCalled();
    });
  });

  describe('reassignAll', () => {
    it('unassigns every listed placement then assigns to the target as a MOVE', () => {
      const a = makeAssignment(INST_A, 'n1', 'p-1');
      state.assignments.set([a]);
      dynamicAssign();

      service.reassignAll(
        [{ assignmentId: a.id, instanceId: INST_A }],
        ref(INST_B, 'm1'),
        'p-1',
        { instanceId: INST_A, nodeId: 'n1' },
      );

      expect(api.unassign).toHaveBeenCalledWith(INST_A, a.id);
      expect(api.assign).toHaveBeenCalledWith(INST_B, { nodeId: 'm1', personId: 'p-1' });
      expect(undoRedo.undoDescription()).toBe('Moure persona');
    });

    it('restores the assignments and toasts when an unassign fails', () => {
      const a = makeAssignment(INST_A, 'n1', 'p-1');
      state.assignments.set([a]);
      api.unassign.mockReturnValue(throwError(() => ({ status: 500 })));

      service.reassignAll(
        [{ assignmentId: a.id, instanceId: INST_A }],
        ref(INST_B, 'm1'),
        'p-1',
        { instanceId: INST_A, nodeId: 'n1' },
      );

      expect(state.assignments()).toEqual([a]);
      expect(api.assign).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith('Error en reassignar la persona.');
    });
  });

  describe('undo / redo', () => {
    it('undo does nothing when there is no history', () => {
      service.undo();

      expect(ws.reloadConflicts).not.toHaveBeenCalled();
    });

    it('undo reverses the last action and reloads conflicts', () => {
      const created = makeAssignment(INST_A, 'n1', 'p-1');
      api.assign.mockReturnValue(of(created));
      service.assign(ref(INST_A, 'n1'), 'p-1');
      ws.reloadConflicts.mockClear();

      service.undo();

      expect(state.assignments()).toHaveLength(0);
      expect(ws.reloadConflicts).toHaveBeenCalled();
    });

    it('redo re-applies the undone action', () => {
      api.assign.mockReturnValue(of(makeAssignment(INST_A, 'n1', 'p-1')));
      service.assign(ref(INST_A, 'n1'), 'p-1');
      service.undo();

      service.redo();

      expect(state.assignments().some((a) => a.node.id === 'n1')).toBe(true);
    });

    it('undo and redo do nothing when the workspace is locked', () => {
      api.assign.mockReturnValue(of(makeAssignment(INST_A, 'n1', 'p-1')));
      service.assign(ref(INST_A, 'n1'), 'p-1');
      ws.isLocked.set(true);

      service.undo();

      expect(state.assignments()).toHaveLength(1);
    });

    it('toasts when undo fails', () => {
      api.assign.mockReturnValue(of(makeAssignment(INST_A, 'n1', 'p-1')));
      service.assign(ref(INST_A, 'n1'), 'p-1');
      api.unassign.mockReturnValue(throwError(() => ({ status: 500 })));

      service.undo();

      expect(toast.error).toHaveBeenCalledWith("Error en desfer l'acció.");
    });

    it('toasts when redo fails', () => {
      api.assign.mockReturnValue(of(makeAssignment(INST_A, 'n1', 'p-1')));
      service.assign(ref(INST_A, 'n1'), 'p-1');
      service.undo();
      api.assign.mockReturnValue(throwError(() => ({ status: 500 })));

      service.redo();

      expect(toast.error).toHaveBeenCalledWith("Error en refer l'acció.");
    });
  });

  describe('wouldConflict', () => {
    it('is true when the person already holds a pinya placement in another figure', () => {
      state.assignments.set([makeAssignment(INST_A, 'n1', 'p-1')]);

      expect(service.wouldConflict('p-1', ref(INST_B, 'm1'))).toBe(true);
    });

    it('is false when the person holds no placement yet', () => {
      expect(service.wouldConflict('p-1', ref(INST_B, 'm1'))).toBe(false);
    });

    it('is false for a direcció-pinya node of a figure whose pinya the person already holds', () => {
      ws.instances.set([
        makeInstance(INST_A, [makeNodeItem('n1'), makeNodeItem('d1', 'DIRECTION', DIRECCIO_PINYA_POSITION_TYPE)]),
      ]);
      state.assignments.set([makeAssignment(INST_A, 'n1', 'p-1')]);

      expect(service.wouldConflict('p-1', ref(INST_A, 'd1'))).toBe(false);
    });
  });

  describe('placementsForPerson', () => {
    it('returns the API-provided placements of a confirmed person, or [] when unknown', () => {
      state.confirmedPersons.set([
        { id: 'p-1', assignedPlacements: [{ assignmentId: 'x' }] },
      ] as never);

      expect(service.placementsForPerson('p-1')).toEqual([{ assignmentId: 'x' }]);
      expect(service.placementsForPerson('nobody')).toEqual([]);
    });
  });

  // ── Move mode: right-click / long-press a person, then press the destination ─────────────

  describe('move mode', () => {
    it('startMove marks the person on that node as being moved', () => {
      const a = makeAssignment(INST_A, 'n1', 'p-1');
      state.assignments.set([a]);

      service.startMove(ref(INST_A, 'n1'));

      expect(service.movingAssignment()).toBe(a);
      expect(service.movingAlias()).toBe('Alias p-1');
    });

    it('uses the full name when the person has no alias', () => {
      const a = makeAssignment(INST_A, 'n1', 'p-1');
      state.assignments.set([{ ...a, person: { ...a.person, alias: '' } }]);

      service.startMove(ref(INST_A, 'n1'));

      expect(service.movingAlias()).toBe('Nom Cognom');
    });

    it('is not moving by default', () => {
      expect(service.movingAssignment()).toBeNull();
      expect(service.movingAlias()).toBeNull();
    });

    it('ignores an empty node (nobody to move)', () => {
      service.startMove(ref(INST_A, 'n1'));

      expect(service.movingAssignment()).toBeNull();
    });

    it('ignores the request when the workspace is locked', () => {
      state.assignments.set([makeAssignment(INST_A, 'n1', 'p-1')]);
      ws.isLocked.set(true);

      service.startMove(ref(INST_A, 'n1'));

      expect(service.movingAssignment()).toBeNull();
    });

    it('ignores an assignment that is still being saved (optimistic temp id)', () => {
      const a = makeAssignment(INST_A, 'n1', 'p-1');
      state.assignments.set([{ ...a, id: 'temp-123' }]);

      service.startMove(ref(INST_A, 'n1'));

      expect(service.movingAssignment()).toBeNull();
    });

    it('clears the current node selection when a move starts', () => {
      state.assignments.set([makeAssignment(INST_A, 'n1', 'p-1')]);

      service.startMove(ref(INST_A, 'n1'));

      expect(host.clearSelection).toHaveBeenCalled();
    });

    it('cancelMove ends the move without touching anything', () => {
      state.assignments.set([makeAssignment(INST_A, 'n1', 'p-1')]);
      service.startMove(ref(INST_A, 'n1'));

      service.cancelMove();

      expect(service.movingAssignment()).toBeNull();
      expect(api.unassign).not.toHaveBeenCalled();
      expect(api.assign).not.toHaveBeenCalled();
      expect(api.swap).not.toHaveBeenCalled();
    });

    it('ends by itself when that assignment disappears (e.g. undone)', () => {
      state.assignments.set([makeAssignment(INST_A, 'n1', 'p-1')]);
      service.startMove(ref(INST_A, 'n1'));

      state.assignments.set([]);

      expect(service.movingAssignment()).toBeNull();
    });

    it('does not resume when somebody else later lands on the same node', () => {
      state.assignments.set([makeAssignment(INST_A, 'n1', 'p-1')]);
      service.startMove(ref(INST_A, 'n1'));
      state.assignments.set([]);

      state.assignments.set([makeAssignment(INST_A, 'n1', 'p-2')]);

      expect(service.movingAssignment()).toBeNull();
    });

    describe('completeMove', () => {
      it('moves the person to an empty node', () => {
        const a = makeAssignment(INST_A, 'n1', 'p-1');
        state.assignments.set([a]);
        dynamicAssign();
        service.startMove(ref(INST_A, 'n1'));

        service.completeMove(ref(INST_A, 'n2'));

        expect(api.unassign).toHaveBeenCalledWith(INST_A, a.id);
        expect(api.assign).toHaveBeenCalledWith(INST_A, { nodeId: 'n2', personId: 'p-1' });
        expect(undoRedo.undoDescription()).toBe('Moure persona');
        expect(service.movingAssignment()).toBeNull();
      });

      it('swaps with the person of an assigned node in the same figure', () => {
        const a1 = makeAssignment(INST_A, 'n1', 'p-1');
        const a2 = makeAssignment(INST_A, 'n2', 'p-2');
        state.assignments.set([a1, a2]);
        api.swap.mockReturnValue(of({ a: a1, b: a2 }));
        service.startMove(ref(INST_A, 'n1'));

        service.completeMove(ref(INST_A, 'n2'));

        expect(api.swap).toHaveBeenCalledWith(INST_A, { assignmentIdA: a1.id, assignmentIdB: a2.id });
        expect(service.movingAssignment()).toBeNull();
      });

      it('swaps across figures by unassigning both and reassigning crossed', () => {
        const a1 = makeAssignment(INST_A, 'n1', 'p-1');
        const a2 = makeAssignment(INST_B, 'm1', 'p-2');
        state.assignments.set([a1, a2]);
        dynamicAssign();
        service.startMove(ref(INST_A, 'n1'));

        service.completeMove(ref(INST_B, 'm1'));

        expect(api.assign).toHaveBeenCalledWith(INST_A, { nodeId: 'n1', personId: 'p-2' });
        expect(api.assign).toHaveBeenCalledWith(INST_B, { nodeId: 'm1', personId: 'p-1' });
      });

      it('pressing the same node again just cancels the move', () => {
        state.assignments.set([makeAssignment(INST_A, 'n1', 'p-1')]);
        service.startMove(ref(INST_A, 'n1'));

        service.completeMove(ref(INST_A, 'n1'));

        expect(service.movingAssignment()).toBeNull();
        expect(api.unassign).not.toHaveBeenCalled();
        expect(api.swap).not.toHaveBeenCalled();
      });

      it('refuses a decoration node, explains why, and keeps the move going', () => {
        ws.instances.set([makeInstance(INST_A, [makeNodeItem('n1'), makeNodeItem('d1', 'DECORATION')])]);
        state.assignments.set([makeAssignment(INST_A, 'n1', 'p-1')]);
        service.startMove(ref(INST_A, 'n1'));

        service.completeMove(ref(INST_A, 'd1'));

        expect(toast.error).toHaveBeenCalledWith('Els nodes decoratius no es poden assignar.');
        expect(api.assign).not.toHaveBeenCalled();
        expect(service.movingAssignment()).not.toBeNull();
      });

      it('does nothing when no move is in progress', () => {
        state.assignments.set([makeAssignment(INST_A, 'n1', 'p-1')]);

        service.completeMove(ref(INST_A, 'n2'));

        expect(api.unassign).not.toHaveBeenCalled();
        expect(api.assign).not.toHaveBeenCalled();
      });

      it('ends the move without changing anything when the workspace got locked meanwhile', () => {
        state.assignments.set([makeAssignment(INST_A, 'n1', 'p-1')]);
        service.startMove(ref(INST_A, 'n1'));
        ws.isLocked.set(true);

        service.completeMove(ref(INST_A, 'n2'));

        expect(api.unassign).not.toHaveBeenCalled();
        expect(service.movingAssignment()).toBeNull();
      });

      it('a move can be undone as one step', () => {
        state.assignments.set([makeAssignment(INST_A, 'n1', 'p-1')]);
        ws.instances.set([makeInstance(INST_A, [makeNodeItem('n1'), makeNodeItem('n2')], true)]);
        dynamicAssign();
        service.startMove(ref(INST_A, 'n1'));
        service.completeMove(ref(INST_A, 'n2'));

        service.undo();

        expect(state.assignments().map((a) => a.node.id)).toEqual(['n1']);
      });
    });
  });
});
