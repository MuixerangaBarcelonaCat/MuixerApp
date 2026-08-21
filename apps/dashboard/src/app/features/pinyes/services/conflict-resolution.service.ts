import { AssignmentDetail, ConflictPlacement, SegmentConflict } from '@muixer/pinyes-render';
import { Injectable, inject } from '@angular/core';
import { forkJoin, map, Observable } from 'rxjs';
import { NodeAssignmentService } from './node-assignment.service';
import { SegmentWorkspaceStateService } from './segment-workspace-state.service';
import { AssignmentStateService } from './assignment-state.service';
import { UndoRedoService } from './undo-redo.service';
import { ToastService } from '@muixer/ui';

interface TrackedPlacement {
  instanceId: string;
  nodeId: string;
  assignmentId: string;
}

/**
 * Interactive resolution of segment conflicts (Fase 4, D9): removes one or more of a
 * person's placements as a single undoable action. Scoped to the workspace (not
 * `providedIn: 'root'`) so its undo entries share the workspace's `UndoRedoService`
 * stack alongside ordinary assign/unassign/move/swap actions.
 */
@Injectable()
export class ConflictResolutionService {
  private readonly assignmentService = inject(NodeAssignmentService);
  private readonly ws = inject(SegmentWorkspaceStateService);
  private readonly state = inject(AssignmentStateService);
  private readonly undoRedo = inject(UndoRedoService);
  private readonly toast = inject(ToastService);

  /** Removes a single placement — one unassign, undoable (re-assigns the same person to the same node). */
  removePlacement(personId: string, placement: ConflictPlacement): void {
    this.removeBatch(personId, [placement], 'Treure col·locació');
  }

  /**
   * "Allibera la pinya" (D9): applies the server-computed `suggestedRemovalAssignmentIds`
   * (never a tronc placement) as a single undo entry, same click count as `removeTroncSide`.
   */
  releaseSuggested(conflict: SegmentConflict): void {
    const placements = conflict.placements.filter((p) =>
      conflict.suggestedRemovalAssignmentIds.includes(p.assignmentId),
    );
    if (placements.length === 0) return;
    this.removeBatch(conflict.personId, placements, 'Allibera la pinya');
  }

  /** "Treu la del tronc" (D9 alternative): removes every TRONC-area placement as one undo entry. */
  removeTroncSide(conflict: SegmentConflict): void {
    const placements = conflict.placements.filter((p) => p.area === 'TRONC');
    if (placements.length === 0) return;
    this.removeBatch(conflict.personId, placements, 'Treu la del tronc');
  }

  /**
   * N unassigns applied live, then pushed as a single undo entry (pattern of
   * `performCrossSwap` in the tabs): undo re-assigns everyone in one `forkJoin`. Ids
   * change on every replay, so they're re-captured in a closure shared by execute/undo.
   */
  private removeBatch(personId: string, placements: ConflictPlacement[], description: string): void {
    let current: TrackedPlacement[] = placements.map((p) => ({
      instanceId: p.figureInstanceId,
      nodeId: p.nodeId,
      assignmentId: p.assignmentId,
    }));

    const snapshot = [...this.state.assignments()];
    const removeIds = new Set(current.map((c) => c.assignmentId));
    this.state.assignments.update((list) => list.filter((a) => !removeIds.has(a.id)));

    const unassignAll = (): Observable<void> =>
      forkJoin(current.map((c) => this.assignmentService.unassign(c.instanceId, c.assignmentId))).pipe(
        map(() => {
          const ids = new Set(current.map((c) => c.assignmentId));
          this.state.assignments.update((list) => list.filter((a) => !ids.has(a.id)));
        }),
      );

    const assignAll = (): Observable<void> =>
      forkJoin(
        current.map((c) => this.assignmentService.assign(c.instanceId, { nodeId: c.nodeId, personId })),
      ).pipe(
        map((created: AssignmentDetail[]) => {
          current = created.map((a, i) => ({
            instanceId: current[i].instanceId,
            nodeId: current[i].nodeId,
            assignmentId: a.id,
          }));
          this.state.assignments.update((list) => [...list, ...created]);
          this.state.refreshPersonList();
          this.ws.reloadConflicts();
        }),
      );

    unassignAll().subscribe({
      next: () => {
        this.state.refreshPersonList();
        this.ws.reloadConflicts();
        this.undoRedo.push({
          type: 'CONFLICT_RESOLUTION',
          description,
          execute: unassignAll,
          undo: assignAll,
        });
      },
      error: () => {
        this.state.assignments.set(snapshot);
        this.toast.error('Error en resoldre el conflicte.');
      },
    });
  }
}
