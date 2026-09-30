import { AssignmentDetail, ConflictPlacement, PendingOp, SegmentNodeRef, TroncChangeImpact } from '@muixer/pinyes-render';
import { Injectable, computed, inject, signal } from '@angular/core';
import { ToastService } from '@muixer/ui';
import { FigureZone, areaForZone, conflictRelevantPlacements } from '@muixer/shared';
import { forkJoin, map, Observable, switchMap } from 'rxjs';
import { generateUUID } from '../../../shared/utils/uuid.util';
import { AssignmentStateService } from './assignment-state.service';
import { NodeAssignmentService } from './node-assignment.service';
import { SegmentWorkspaceStateService, WorkspaceInstance } from './segment-workspace-state.service';
import { UndoRedoService, UndoableAction } from './undo-redo.service';

/**
 * What the owning tab (Pinyes / Troncs) still decides for itself: how a node is
 * selected, and where the selection goes after an assignment. Selection state
 * is per-tab (`selectedRef`), so the service reaches it through this host.
 */
export interface AssignmentActionsHost {
  select(ref: SegmentNodeRef): void;
  clearSelection(): void;
  advanceToNextEmptyNode(instanceId: string, justAssignedNodeId: string): void;
}

/** Length of the haptic bump when a move starts, in ms (a brief tick, like a native long press). */
const MOVE_START_HAPTIC_MS = 15;

/** A placement to free before reassigning its person elsewhere. */
export interface PlacementToRemove {
  assignmentId: string;
  instanceId: string;
}

/**
 * Assign / unassign / move / swap of persons on nodes, with optimistic updates,
 * rollback and undo/redo. Shared by the Pinyes and Troncs tabs of the segment
 * workspace. Provide at tab level and call `attach()` from the tab constructor.
 */
@Injectable()
export class SegmentAssignmentActionsService {
  private readonly ws = inject(SegmentWorkspaceStateService);
  private readonly state = inject(AssignmentStateService);
  private readonly assignmentService = inject(NodeAssignmentService);
  private readonly toast = inject(ToastService);
  private readonly undoRedo = inject(UndoRedoService);

  private host: AssignmentActionsHost | null = null;

  attach(host: AssignmentActionsHost): void {
    this.host = host;
  }

  // ── Move mode ────────────────────────────────────────────────────────────
  // Right-click / long-press a placed person, then press the destination node: an empty one moves
  // them there, an occupied one swaps the two. Same outcomes (and undo steps) as a drag-and-drop.

  // Tracked by assignment id (not node) so it can't resume on whoever later lands on that node.
  private readonly movingAssignmentId = signal<string | null>(null);

  /** The assignment being moved, or null. Goes back to null by itself if it disappears (e.g. undone). */
  readonly movingAssignment = computed(() => {
    const id = this.movingAssignmentId();
    return id ? (this.state.assignments().find((a) => a.id === id) ?? null) : null;
  });

  /** Name shown in the "S'està movent …" banner. */
  readonly movingAlias = computed(() => {
    const a = this.movingAssignment();
    return a ? a.person.alias || `${a.person.name} ${a.person.firstSurname}`.trim() : null;
  });

  /** Starts moving the person placed on `ref`. Ignored for an empty node, a locked workspace, or an unsaved assignment. */
  startMove(ref: SegmentNodeRef): void {
    if (this.ws.isLocked()) return;
    const assignment = this.assignmentFor(ref);
    if (!assignment || assignment.id.startsWith('temp-')) return;
    this.host?.clearSelection();
    this.movingAssignmentId.set(assignment.id);
    this.hapticBump();
  }

  /** Brief vibration where the browser supports it (Android Chrome/Edge); silently nothing elsewhere. */
  private hapticBump(): void {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(MOVE_START_HAPTIC_MS);
    }
  }

  cancelMove(): void {
    this.movingAssignmentId.set(null);
  }

  /** Puts the person being moved on `target`: moves them to an empty node, swaps with an occupied one. */
  completeMove(target: SegmentNodeRef): void {
    const source = this.movingAssignment();
    if (!source || this.ws.isLocked()) {
      this.cancelMove();
      return;
    }
    const sourceRef: SegmentNodeRef = { slotId: source.figureInstanceId, nodeId: source.node.id };
    if (sourceRef.slotId === target.slotId && sourceRef.nodeId === target.nodeId) {
      this.cancelMove();
      return;
    }
    if (this.nodeFor(target)?.zone === FigureZone.DECORATION) {
      this.toast.error('Els nodes decoratius no es poden assignar.');
      return;
    }
    this.cancelMove();
    this.drop(sourceRef, target);
  }

  // ── Lookups ──────────────────────────────────────────────────────────────

  instanceFor(instanceId: string): WorkspaceInstance | null {
    return this.ws.instances().find((i) => i.instanceId === instanceId) ?? null;
  }

  nodeFor(ref: SegmentNodeRef) {
    const instance = this.instanceFor(ref.slotId);
    return instance?.nodes.find((n) => n.id === ref.nodeId) ?? null;
  }

  assignmentFor(ref: SegmentNodeRef): AssignmentDetail | null {
    return (
      this.state
        .assignments()
        .find((a) => a.figureInstanceId === ref.slotId && a.node.id === ref.nodeId) ?? null
    );
  }

  /** All of a person's placements in the segment, from the API-provided `assignedPlacements` (Phase 3). */
  placementsForPerson(personId: string): ConflictPlacement[] {
    return this.state.confirmedPersons().find((p) => p.id === personId)?.assignedPlacements ?? [];
  }

  /**
   * Whether adding `target` to `personId`'s existing placements in the segment would actually
   * count as a conflict, per the same domain rule the segment-conflict engine uses
   * (`conflictRelevantPlacements`, D-«direcció pinya»): a direcció-pinya placement is excused
   * when the person also holds a pinya placement of the *same* figure instance. Built from the
   * live `state.assignments()` (not `placementsForPerson`, which mirrors a separately-fetched
   * person list that can lag behind an assignment just made in this same session).
   */
  wouldConflict(personId: string, target: SegmentNodeRef): boolean {
    const targetNode = this.nodeFor(target);
    const targetArea = targetNode ? areaForZone(targetNode.zone as FigureZone) : null;
    const existing = this.state
      .assignments()
      .filter((a) => a.person.id === personId)
      .map((a) => ({
        positionType: a.node.positionType,
        area: (areaForZone(a.node.zone as FigureZone) ?? '') as string,
        instanceId: a.figureInstanceId,
      }));
    const hypothetical = [
      ...existing,
      { positionType: targetNode?.positionType ?? null, area: (targetArea ?? '') as string, instanceId: target.slotId },
    ];
    return conflictRelevantPlacements(hypothetical, (p) => p).length >= 2;
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  /**
   * Assigns `personId` to `ref`. When `moveFrom` is given (drag-drop move / cross-figure
   * reassign), the pushed undo action is a single composite MOVE — undo restores the person to
   * `moveFrom` instead of just unassigning them (FE-BUG-7).
   */
  assign(ref: SegmentNodeRef, personId: string, moveFrom?: { instanceId: string; nodeId: string }): void {
    const instanceId = ref.slotId;
    const instance = this.instanceFor(instanceId);
    if (!instance) return;

    const snapshot = [...this.state.assignments()];
    const matchedNode = this.nodeFor(ref);
    const tempAssignment: AssignmentDetail = {
      id: `temp-${generateUUID()}`,
      figureInstanceId: instanceId,
      node: {
        id: ref.nodeId,
        label: matchedNode?.label ?? '',
        zone: matchedNode?.zone ?? '',
        z: matchedNode?.z ?? 0,
        positionType: matchedNode?.positionType ?? null,
        sortOrder: matchedNode?.sortOrder ?? 0,
        climbIndicator: matchedNode?.climbIndicator ?? null,
        ringLevel: matchedNode?.ringLevel ?? null,
        originNodeId: matchedNode?.originNodeId ?? null,
        sourceNodeId: matchedNode?.sourceNodeId ?? null,
      },
      person: { id: personId, alias: '...', name: '', firstSurname: '', shoulderHeight: null, notes: null, notesEmoji: null },
    };
    this.state.assignments.update((list) => [...list, tempAssignment]);
    this.host?.clearSelection();

    const op: PendingOp = {
      id: `op-${generateUUID()}`,
      type: 'assign',
      instanceId,
      nodeId: ref.nodeId,
      personId,
      previousAssignments: snapshot,
    };
    this.state.pendingOperations.update((ops) => [...ops, op]);

    this.assignmentService.assign(instanceId, { nodeId: ref.nodeId, personId }).subscribe({
      next: (created) => {
        this.state.assignments.update((list) =>
          list.map((a) => (a.id === tempAssignment.id ? created : a)),
        );
        this.state.pendingOperations.update((ops) => ops.filter((o) => o.id !== op.id));

        if (!instance.snapshotted) {
          this.ws.refreshInstance(instanceId);
        } else {
          // Fase 5: a duplicate assign is legal and needs the conflict banner to reflect
          // it immediately. refreshInstance() (above) already reloads conflicts on its own.
          this.ws.reloadConflicts();
        }

        this.state.refreshPersonList();
        this.host?.advanceToNextEmptyNode(instanceId, created.node.id);

        this.undoRedo.push(
          moveFrom
            ? this.buildMoveAction(instanceId, ref.nodeId, personId, created, moveFrom)
            : this.buildAssignAction(instanceId, ref.nodeId, personId, created),
        );
      },
      error: (err) => {
        this.state.assignments.set(op.previousAssignments);
        this.state.pendingOperations.update((ops) => ops.filter((o) => o.id !== op.id));
        this.state.refreshPersonList();
        this.host?.select(ref);
        // Fase 5: the only 409 assign() can still throw is NODE_OCCUPIED (someone else
        // took this node first) — the old PERSON_IN_INSTANCE/PERSON_IN_SEGMENT message no
        // longer applies, since duplicates are legal now.
        const msg = err?.status === 409 ? 'Este lloc ja està ocupat.' : 'Error en assignar la persona.';
        this.toast.error(msg);
      },
    });
  }

  unassign(assignment: AssignmentDetail): void {
    if (this.ws.isLocked()) return;
    const instanceId = assignment.figureInstanceId;
    const nodeId = assignment.node.id;
    const personId = assignment.person.id;

    const snapshot = [...this.state.assignments()];
    this.state.assignments.update((list) => list.filter((a) => a.id !== assignment.id));
    this.host?.clearSelection();

    this.assignmentService.unassign(instanceId, assignment.id).subscribe({
      next: () => {
        this.state.refreshPersonList();
        // Fase 5: removing one of several duplicate placements can resolve a conflict —
        // keep the banner live.
        this.ws.reloadConflicts();
        this.undoRedo.push(this.buildUnassignAction(instanceId, nodeId, personId, assignment.id));
      },
      error: () => {
        this.state.assignments.set(snapshot);
        this.state.refreshPersonList();
        this.toast.error('Error en desassignar la persona.');
      },
    });
  }

  /** Frees `existing`, then assigns `personId` to `targetRef` as a single undoable MOVE. */
  unassignThenAssign(existing: AssignmentDetail, targetRef: SegmentNodeRef, personId: string): void {
    const snapshot = [...this.state.assignments()];
    const moveFrom = { instanceId: existing.figureInstanceId, nodeId: existing.node.id };
    this.state.assignments.update((list) => list.filter((a) => a.id !== existing.id));
    this.host?.clearSelection();

    this.assignmentService.unassign(existing.figureInstanceId, existing.id).subscribe({
      next: () => {
        this.assign(targetRef, personId, moveFrom);
      },
      error: () => {
        this.state.assignments.set(snapshot);
        this.toast.error('Error en desassignar la persona.');
      },
    });
  }

  /** Drag-and-drop: a person was dragged from `source` and dropped on `target`. */
  drop(source: SegmentNodeRef, target: SegmentNodeRef): void {
    if (this.ws.isLocked()) return;
    if (source.slotId === target.slotId && source.nodeId === target.nodeId) return;

    const sourceAssignment = this.assignmentFor(source);
    if (!sourceAssignment) return;

    const targetAssignment = this.assignmentFor(target);
    if (targetAssignment) {
      // Both assigned → swap persons (cross-figure swaps go through unassign + reassign)
      if (source.slotId === target.slotId) {
        this.swap(sourceAssignment, targetAssignment);
      } else {
        this.crossSwap(sourceAssignment, targetAssignment);
      }
    } else {
      // Dropped on an empty node → move person (cross-figure allowed)
      this.unassignThenAssign(sourceAssignment, target, sourceAssignment.person.id);
    }
    this.host?.clearSelection();
  }

  /**
   * "Moure ací" from the already-assigned dialog: frees every one of the person's existing
   * placements in the segment (not just the one under the selected node — § Fase 7 finding),
   * then assigns them to `target` as a MOVE from `moveFrom`.
   */
  reassignAll(
    placements: PlacementToRemove[],
    target: SegmentNodeRef,
    personId: string,
    moveFrom: { instanceId: string; nodeId: string },
  ): void {
    const toRemove = new Map(placements.map((p) => [p.assignmentId, p.instanceId]));
    const snapshot = [...this.state.assignments()];
    const removeIds = new Set(toRemove.keys());
    this.state.assignments.update((list) => list.filter((a) => !removeIds.has(a.id)));

    forkJoin(
      Array.from(toRemove, ([assignmentId, instanceId]) => this.assignmentService.unassign(instanceId, assignmentId)),
    ).subscribe({
      next: () => {
        this.assign(target, personId, moveFrom);
      },
      error: () => {
        this.state.assignments.set(snapshot);
        this.toast.error('Error en reassignar la persona.');
      },
    });
  }

  /** Ctrl+Z / undo button: reverses the most recent assign/unassign/move/swap. */
  undo(): void {
    if (this.ws.isLocked() || !this.undoRedo.canUndo() || this.undoRedo.isBusy()) return;
    this.undoRedo.undo().subscribe({
      next: () => this.ws.reloadConflicts(),
      error: () => this.toast.error("Error en desfer l'acció."),
    });
  }

  /** Ctrl+Shift+Z / redo button: re-applies the most recently undone action. */
  redo(): void {
    if (this.ws.isLocked() || !this.undoRedo.canRedo() || this.undoRedo.isBusy()) return;
    this.undoRedo.redo().subscribe({
      next: () => this.ws.reloadConflicts(),
      error: () => this.toast.error("Error en refer l'acció."),
    });
  }

  // ── Swap ─────────────────────────────────────────────────────────────────

  private swap(assignment1: AssignmentDetail, assignment2: AssignmentDetail): void {
    const instanceId = assignment1.figureInstanceId;
    const snapshot = [...this.state.assignments()];

    this.state.assignments.update((list) =>
      list.map((a) => {
        if (a.id === assignment1.id) return { ...a, person: assignment2.person };
        if (a.id === assignment2.id) return { ...a, person: assignment1.person };
        return a;
      }),
    );

    this.performSwap(instanceId, assignment1.id, assignment2.id).subscribe({
      next: () => {
        this.toast.success("S'han intercanviat les persones.");
        // Fase 5: a swap can create/resolve a duplicate — keep the banner live.
        this.ws.reloadConflicts();
        // Swap preserves both assignment ids server-side, so it's its own inverse:
        // running it again — whether via undo or redo — reverses/re-applies it identically.
        this.undoRedo.push({
          type: 'SWAP',
          description: 'Intercanviar persones',
          execute: () => this.performSwap(instanceId, assignment1.id, assignment2.id),
          undo: () => this.performSwap(instanceId, assignment1.id, assignment2.id),
        });
      },
      error: () => {
        this.state.assignments.set(snapshot);
        this.toast.error("Error en l'intercanvi de persones.");
      },
    });
  }

  private performSwap(
    instanceId: string,
    assignmentIdA: string,
    assignmentIdB: string,
  ): Observable<TroncChangeImpact | undefined> {
    return this.assignmentService.swap(instanceId, { assignmentIdA, assignmentIdB }).pipe(
      map((result) => {
        this.state.assignments.update((list) =>
          list.map((a) => {
            if (a.id === result.a.id) return result.a;
            if (a.id === result.b.id) return result.b;
            return a;
          }),
        );
        return result.impact;
      }),
    );
  }

  /** Swap between figures: the swap endpoint is per-instance, so unassign both and reassign crossed. */
  private crossSwap(assignment1: AssignmentDetail, assignment2: AssignmentDetail): void {
    const snapshot = [...this.state.assignments()];
    const instance1 = assignment1.figureInstanceId;
    const node1 = assignment1.node.id;
    const person1Id = assignment1.person.id;
    const instance2 = assignment2.figureInstanceId;
    const node2 = assignment2.node.id;
    const person2Id = assignment2.person.id;

    this.state.assignments.update((list) =>
      list.map((a) => {
        if (a.id === assignment1.id) return { ...a, person: assignment2.person };
        if (a.id === assignment2.id) return { ...a, person: assignment1.person };
        return a;
      }),
    );

    // Ids returned by unassign+assign change every time this runs, so the current
    // occupant of each node is tracked in closures shared by execute/undo (FE-BUG-7).
    let currentId1 = assignment1.id;
    let currentId2 = assignment2.id;

    const applyCrossSwap = (personFor1: string, personFor2: string) =>
      this.performCrossSwap(instance1, node1, currentId1, personFor1, instance2, node2, currentId2, personFor2).pipe(
        map((result) => {
          currentId1 = result.a.id;
          currentId2 = result.b.id;
          this.state.assignments.update((list) =>
            list.map((a) => {
              if (a.figureInstanceId === instance1 && a.node.id === node1) return result.a;
              if (a.figureInstanceId === instance2 && a.node.id === node2) return result.b;
              return a;
            }),
          );
          return result;
        }),
      );

    applyCrossSwap(person2Id, person1Id).subscribe({
      next: () => {
        this.toast.success("S'han intercanviat les persones.");
        // Fase 5: a cross-figure swap can create/resolve a duplicate — keep the banner live.
        this.ws.reloadConflicts();
        this.undoRedo.push({
          type: 'SWAP',
          description: 'Intercanviar persones (figures diferents)',
          execute: () => applyCrossSwap(person2Id, person1Id),
          undo: () => applyCrossSwap(person1Id, person2Id),
        });
      },
      error: () => {
        this.state.assignments.set(snapshot);
        this.ws.refreshInstance(instance1);
        this.ws.refreshInstance(instance2);
        this.toast.error("Error en l'intercanvi de persones.");
      },
    });
  }

  private performCrossSwap(
    instance1: string,
    node1: string,
    currentId1: string,
    personFor1: string,
    instance2: string,
    node2: string,
    currentId2: string,
    personFor2: string,
  ): Observable<{ a: AssignmentDetail & { impact?: TroncChangeImpact }; b: AssignmentDetail & { impact?: TroncChangeImpact } }> {
    return forkJoin([
      this.assignmentService.unassign(instance1, currentId1),
      this.assignmentService.unassign(instance2, currentId2),
    ]).pipe(
      switchMap(() =>
        forkJoin([
          this.assignmentService.assign(instance1, { nodeId: node1, personId: personFor1 }),
          this.assignmentService.assign(instance2, { nodeId: node2, personId: personFor2 }),
        ]),
      ),
      map(([a, b]) => ({ a, b })),
    );
  }

  // ── Undo actions ─────────────────────────────────────────────────────────

  /** Plain assign undo: undo unassigns; redo re-assigns to the same node/person. */
  private buildAssignAction(
    instanceId: string,
    nodeId: string,
    personId: string,
    created: AssignmentDetail,
  ): UndoableAction {
    let lastAssignId = created.id;
    return {
      type: 'ASSIGN',
      description: 'Assignar persona',
      execute: () =>
        new Observable<void>((sub) => {
          this.assignmentService.assign(instanceId, { nodeId, personId }).subscribe({
            next: (re) => {
              lastAssignId = re.id;
              this.state.assignments.update((list) => [...list, re]);
              this.state.refreshPersonList();
              sub.next();
              sub.complete();
            },
            error: (err) => sub.error(err),
          });
        }),
      undo: () =>
        new Observable<void>((sub) => {
          const removeId = lastAssignId;
          this.assignmentService.unassign(instanceId, removeId).subscribe({
            next: () => {
              this.state.assignments.update((list) => list.filter((a) => a.id !== removeId));
              this.state.refreshPersonList();
              sub.next();
              sub.complete();
            },
            error: (err) => sub.error(err),
          });
        }),
    };
  }

  /** Plain unassign undo: undo re-assigns; redo unassigns again. */
  private buildUnassignAction(
    instanceId: string,
    nodeId: string,
    personId: string,
    initialAssignmentId: string,
  ): UndoableAction {
    let lastAssignmentId = initialAssignmentId;
    return {
      type: 'UNASSIGN',
      description: 'Desassignar persona',
      execute: () =>
        new Observable<void>((sub) => {
          const removeId = lastAssignmentId;
          this.assignmentService.unassign(instanceId, removeId).subscribe({
            next: () => {
              this.state.assignments.update((list) => list.filter((a) => a.id !== removeId));
              this.state.refreshPersonList();
              sub.next();
              sub.complete();
            },
            error: (err) => sub.error(err),
          });
        }),
      undo: () =>
        new Observable<void>((sub) => {
          this.assignmentService.assign(instanceId, { nodeId, personId }).subscribe({
            next: (created) => {
              lastAssignmentId = created.id;
              this.state.assignments.update((list) => [...list, created]);
              this.state.refreshPersonList();
              sub.next();
              sub.complete();
            },
            error: (err) => sub.error(err),
          });
        }),
    };
  }

  /** Composite move undo: undo unassigns from the target and re-assigns to `moveFrom`; redo reverses that. */
  private buildMoveAction(
    targetInstanceId: string,
    targetNodeId: string,
    personId: string,
    created: AssignmentDetail,
    moveFrom: { instanceId: string; nodeId: string },
  ): UndoableAction {
    let targetAssignmentId = created.id;
    // Re-populated by undo() once the person is reassigned back to moveFrom.
    let sourceAssignmentId: string | null = null;

    const assignTo = (instanceId: string, nodeId: string) =>
      this.assignmentService.assign(instanceId, { nodeId, personId });

    return {
      type: 'MOVE',
      description: 'Moure persona',
      execute: () =>
        new Observable<void>((sub) => {
          const reassignToTarget = () => {
            assignTo(targetInstanceId, targetNodeId).subscribe({
              next: (re) => {
                targetAssignmentId = re.id;
                this.state.assignments.update((list) => [...list, re]);
                this.state.refreshPersonList();
                sub.next();
                sub.complete();
              },
              error: (err) => sub.error(err),
            });
          };
          if (sourceAssignmentId) {
            const removeId = sourceAssignmentId;
            this.assignmentService.unassign(moveFrom.instanceId, removeId).subscribe({
              next: () => {
                sourceAssignmentId = null;
                this.state.assignments.update((list) => list.filter((a) => a.id !== removeId));
                reassignToTarget();
              },
              error: (err) => sub.error(err),
            });
          } else {
            reassignToTarget();
          }
        }),
      undo: () =>
        new Observable<void>((sub) => {
          const removeId = targetAssignmentId;
          this.assignmentService.unassign(targetInstanceId, removeId).subscribe({
            next: () => {
              this.state.assignments.update((list) => list.filter((a) => a.id !== removeId));
              assignTo(moveFrom.instanceId, moveFrom.nodeId).subscribe({
                next: (re) => {
                  sourceAssignmentId = re.id;
                  this.state.assignments.update((list) => [...list, re]);
                  this.state.refreshPersonList();
                  sub.next();
                  sub.complete();
                },
                error: (err) => sub.error(err),
              });
            },
            error: (err) => sub.error(err),
          });
        }),
    };
  }
}
