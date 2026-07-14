import { ChangeDetectionStrategy, Component, HostListener, OnInit, computed, inject, input, signal } from '@angular/core';
import { LucideAngularModule, Map as MapIcon, Undo2, Redo2 } from 'lucide-angular';
import { TroncViewComponent, TroncNodeItem } from '../../../tronc-view/tronc-view.component';
import { PersonPanelComponent } from '../../../person-panel/person-panel.component';
import { SegmentWorkspaceStateService, WorkspaceInstance } from '../../../../services/segment-workspace-state.service';
import { AssignmentStateService } from '../../../../services/assignment-state.service';
import { NodeAssignmentService } from '../../../../services/node-assignment.service';
import { ToastService } from '../../../../../../shared/components/feedback/toast/toast.service';
import { UndoRedoService, UndoableAction } from '../../../../services/undo-redo.service';
import { SegmentNodeRef } from '../../../../utils/segment-assignment-render.util';
import { buildTroncBuckets, pickNextAssignableNode } from '../../../../utils/assignment-order.util';
import { computeFigureBoundingBoxes, FigureBoundingBox } from '../../../../utils/figure-placement.util';
import { getFigureColor } from '../../../../utils/figure-palette.util';
import {
  AssignmentDetail,
  AttendanceStatus,
  AvailablePerson,
  AvailablePersonPosition,
  PendingOp,
} from '../../../../models/assignment.model';
import { DIRECTION_NODE_PRESETS, FigureZone } from '@muixer/shared';
import { forkJoin, map, Observable, switchMap } from 'rxjs';

interface TroncFigure {
  instance: WorkspaceInstance;
  troncNodes: TroncNodeItem[];
  baseNodes: TroncNodeItem[];
  directionNodes: TroncNodeItem[];
  color: string;
}

/**
 * Troncs tab of the segment workspace: one tronc-view per figure that has a
 * tronc, side by side, with a single shared person panel.
 */
@Component({
  selector: 'app-troncs-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, TroncViewComponent, PersonPanelComponent],
  templateUrl: './troncs-tab.component.html',
})
export class TroncsTabComponent implements OnInit {
  readonly ws = inject(SegmentWorkspaceStateService);
  readonly state = inject(AssignmentStateService);
  private readonly assignmentService = inject(NodeAssignmentService);
  private readonly toast = inject(ToastService);
  private readonly undoRedo = inject(UndoRedoService);

  readonly isPast = input(false);

  ngOnInit(): void {
    // Positions/cordons/mode may have changed in another tab (e.g. Distribució)
    // since the workspace's one-time load(); pull the latest on activation.
    this.ws.refresh();
  }

  readonly MapIcon = MapIcon;
  readonly Undo2 = Undo2;
  readonly Redo2 = Redo2;

  readonly canUndo = this.undoRedo.canUndo;
  readonly canRedo = this.undoRedo.canRedo;
  readonly undoDescription = this.undoRedo.undoDescription;
  readonly redoDescription = this.undoRedo.redoDescription;

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const isEditing =
      !!target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable);
    if (isEditing) return;

    const isMod = event.ctrlKey || event.metaKey;
    if (isMod && event.key.toLowerCase() === 'z' && !event.shiftKey) {
      event.preventDefault();
      this.performUndo();
      return;
    }

    if (isMod && event.key.toLowerCase() === 'z' && event.shiftKey) {
      event.preventDefault();
      this.performRedo();
      return;
    }
  }

  /** Ctrl+Z / undo button: reverses the most recent assign/unassign/move/swap. */
  performUndo(): void {
    if (this.ws.isLocked() || !this.undoRedo.canUndo() || this.undoRedo.isBusy()) return;
    this.undoRedo.undo().subscribe({
      error: () => this.toast.error("Error en desfer l'acció."),
    });
  }

  /** Ctrl+Shift+Z / redo button: re-applies the most recently undone action. */
  performRedo(): void {
    if (this.ws.isLocked() || !this.undoRedo.canRedo() || this.undoRedo.isBusy()) return;
    this.undoRedo.redo().subscribe({
      error: () => this.toast.error("Error en refer l'acció."),
    });
  }

  readonly selectedRef = signal<SegmentNodeRef | null>(null);
  readonly highlightedNodeIds = signal<Set<string>>(new Set());

  readonly attendanceMap = computed(
    () => this.state.attendanceRegistry() as Map<string, AttendanceStatus>,
  );

  readonly personDetailsMap = computed(() => {
    const map = new Map<string, { positions: AvailablePersonPosition[]; isXicalla: boolean; notes: string | null; notesEmoji: string | null }>();
    for (const p of this.state.confirmedPersons()) {
      map.set(p.id, { positions: p.positions, isXicalla: p.isXicalla, notes: p.notes, notesEmoji: p.notesEmoji });
    }
    return map;
  });

  readonly selectedNode = computed(() => {
    const ref = this.selectedRef();
    if (!ref) return null;
    return this.nodeFor(ref);
  });

  readonly selectedNodePositionType = computed(() => this.selectedNode()?.positionType ?? null);
  readonly selectedNodeZone = computed(() => this.selectedNode()?.zone ?? null);

  readonly figures = computed<TroncFigure[]>(() =>
    this.ws
      .instances()
      .map((instance, index) => {
        const visible = this.ws.visibleNodesFor(instance);
        return {
          instance,
          troncNodes: visible.filter((n) => n.zone === FigureZone.TRONC) as unknown as TroncNodeItem[],
          baseNodes: visible.filter((n) => n.zone === FigureZone.BASE) as unknown as TroncNodeItem[],
          directionNodes: visible.filter(
            (n) => n.zone === FigureZone.FIGURE_DIRECTION || n.zone === FigureZone.XICALLA_DIRECTION,
          ) as unknown as TroncNodeItem[],
          color: getFigureColor(index),
        };
      })
      .filter((f) => f.troncNodes.length > 0 || f.baseNodes.length > 0 || f.directionNodes.length > 0),
  );

  // ── Minimap ──────────────────────────────────────────────────────────────

  readonly minimapOpen = signal(true);

  readonly minimapBoxes = computed<(FigureBoundingBox & { color: string })[]>(() => {
    const colorBySlot = new Map(this.figures().map((f) => [f.instance.instanceId, f.color]));
    return computeFigureBoundingBoxes(this.ws.pinyaSlots()).map((box) => ({
      ...box,
      color: colorBySlot.get(box.slotId) ?? getFigureColor(0),
    }));
  });

  readonly minimapViewBox = computed(() => {
    const boxes = this.minimapBoxes();
    if (boxes.length === 0) return '0 0 100 100';

    const padding = 20;
    const minX = Math.min(...boxes.map((b) => b.x)) - padding;
    const minY = Math.min(...boxes.map((b) => b.y)) - padding;
    const maxX = Math.max(...boxes.map((b) => b.x + b.width)) + padding;
    const maxY = Math.max(...boxes.map((b) => b.y + b.height)) + padding;
    return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
  });

  toggleMinimap(): void {
    this.minimapOpen.update((v) => !v);
  }

  onTroncNodeSelected(instanceId: string, nodeId: string | null): void {
    if (this.ws.isLocked()) return;

    if (!nodeId) {
      this.clearSelection();
      return;
    }
    const ref: SegmentNodeRef = { slotId: instanceId, nodeId };

    const clickedAssignment = this.assignmentFor(ref);

    if (clickedAssignment) {
      this.select(ref);
      return;
    }

    const pendingPersonId = this.state.selectedPersonId();
    this.select(ref);
    if (pendingPersonId) {
      this.triggerAssign(ref, pendingPersonId);
    }
  }

  /** Drag-and-drop: a person was dragged from `source` and dropped on `target`. */
  onNodeDropped(source: SegmentNodeRef, target: SegmentNodeRef): void {
    if (this.ws.isLocked()) return;
    if (source.slotId === target.slotId && source.nodeId === target.nodeId) return;

    const sourceAssignment = this.assignmentFor(source);
    if (!sourceAssignment) return;

    const targetAssignment = this.assignmentFor(target);
    if (targetAssignment) {
      if (source.slotId === target.slotId) {
        this.triggerSwap(sourceAssignment, targetAssignment);
      } else {
        this.triggerCrossSwap(sourceAssignment, targetAssignment);
      }
    } else {
      this.triggerUnassignThenAssign(sourceAssignment, target, sourceAssignment.person.id);
    }
    this.clearSelection();
  }

  onTroncNodeClicked(_event: { nodeId: string; event: MouseEvent }): void {
    // Popover positioning is handled elsewhere; the tronc panel shows unassign inline.
  }

  onTroncNodeUnassigned(instanceId: string, nodeId: string): void {
    const assignment = this.assignmentFor({ slotId: instanceId, nodeId });
    if (assignment) this.onUnassign(assignment);
  }

  onPersonSelected(person: AvailablePerson): void {
    if (this.ws.isLocked()) return;
    const ref = this.selectedRef();

    if (!ref) {
      this.state.setSelectedPersonId(person.id);
      return;
    }

    const existing = this.assignmentFor(ref);
    if (existing) {
      this.triggerUnassignThenAssign(existing, ref, person.id);
    } else {
      this.triggerAssign(ref, person.id);
    }
  }

  onAssignedPersonSelected(event: { personId: string; instanceId: string }): void {
    const assignment = this.state
      .assignments()
      .find((a) => a.figureInstanceId === event.instanceId && a.person.id === event.personId);
    if (!assignment) return;
    this.select({ slotId: assignment.figureInstanceId, nodeId: assignment.node.id });
  }

  onUnassign(assignment: AssignmentDetail): void {
    if (this.ws.isLocked()) return;
    const instanceId = assignment.figureInstanceId;
    const nodeId = assignment.node.id;
    const personId = assignment.person.id;

    const snapshot = [...this.state.assignments()];
    this.state.assignments.update((list) => list.filter((a) => a.id !== assignment.id));
    this.clearSelection();

    this.assignmentService.unassign(instanceId, assignment.id).subscribe({
      next: () => {
        this.state.refreshPersonList();
        this.undoRedo.push(this.buildUnassignAction(instanceId, nodeId, personId, assignment.id));
      },
      error: () => {
        this.state.assignments.set(snapshot);
        this.state.refreshPersonList();
        this.toast.error('Error en desassignar la persona.');
      },
    });
  }

  onDirectionAdded(instanceId: string, event: { zone: string }): void {
    if (this.ws.isLocked()) return;
    const preset = DIRECTION_NODE_PRESETS.find((p) => p.zone === event.zone);
    if (!preset) return;

    this.assignmentService
      .createAdHocNode(instanceId, {
        zone: preset.zone,
        positionType: preset.positionType ?? undefined,
        label: preset.label,
        x: 0,
        y: 0,
        width: preset.width,
        height: preset.height,
        shape: preset.shape,
        color: preset.color ?? undefined,
      })
      .subscribe({
        next: () => this.ws.refreshInstance(instanceId),
        error: () => this.toast.error("No s'ha pogut crear la direcció."),
      });
  }

  onDirectionRemoved(instanceId: string, nodeId: string): void {
    if (this.ws.isLocked()) return;
    const hasAssignment = this.state
      .assignments()
      .some((a) => a.figureInstanceId === instanceId && a.node.id === nodeId);
    if (hasAssignment) {
      this.toast.error("Traieu l'assignació abans d'eliminar la direcció.");
      return;
    }

    this.assignmentService.deleteAdHocNode(instanceId, nodeId).subscribe({
      next: () => this.ws.refreshInstance(instanceId),
      error: () => this.toast.error("No s'ha pogut eliminar la direcció."),
    });
  }

  getAttendanceStatus(assignment: AssignmentDetail): string | null {
    return this.attendanceMap().get(assignment.person.id) ?? null;
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private select(ref: SegmentNodeRef): void {
    this.selectedRef.set(ref);
    this.ws.selectedInstanceId.set(ref.slotId);
    this.state.setSelectedNodeId(ref.nodeId);
  }

  private clearSelection(): void {
    this.selectedRef.set(null);
    this.state.setSelectedNodeId(null);
  }

  private instanceFor(instanceId: string): WorkspaceInstance | null {
    return this.ws.instances().find((i) => i.instanceId === instanceId) ?? null;
  }

  private nodeFor(ref: SegmentNodeRef) {
    const instance = this.instanceFor(ref.slotId);
    return instance?.nodes.find((n) => n.id === ref.nodeId) ?? null;
  }

  private assignmentFor(ref: SegmentNodeRef): AssignmentDetail | null {
    return (
      this.state
        .assignments()
        .find((a) => a.figureInstanceId === ref.slotId && a.node.id === ref.nodeId) ?? null
    );
  }

  /**
   * Assigns `personId` to `ref`. When `moveFrom` is given (drag-drop move), the pushed undo
   * action is a single composite MOVE — undo restores the person to `moveFrom` instead of just
   * unassigning them (FE-BUG-7).
   */
  private triggerAssign(
    ref: SegmentNodeRef,
    personId: string,
    moveFrom?: { instanceId: string; nodeId: string },
  ): void {
    const instanceId = ref.slotId;
    const instance = this.instanceFor(instanceId);
    if (!instance) return;

    const snapshot = [...this.state.assignments()];
    const matchedNode = this.nodeFor(ref);
    const tempAssignment: AssignmentDetail = {
      id: `temp-${Date.now()}`,
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
    this.clearSelection();

    const op: PendingOp = {
      id: `op-${Date.now()}`,
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
        }

        this.state.refreshPersonList();
        this.advanceToNextEmptyNode(instanceId, created.node.id);

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
        this.select(ref);
        const msg =
          err?.status === 409
            ? 'La persona ja està assignada.'
            : 'Error en assignar la persona.';
        this.toast.error(msg);
      },
    });
  }

  private triggerUnassignThenAssign(
    existing: AssignmentDetail,
    targetRef: SegmentNodeRef,
    personId: string,
  ): void {
    const snapshot = [...this.state.assignments()];
    const moveFrom = { instanceId: existing.figureInstanceId, nodeId: existing.node.id };
    this.state.assignments.update((list) => list.filter((a) => a.id !== existing.id));
    this.clearSelection();

    this.assignmentService.unassign(existing.figureInstanceId, existing.id).subscribe({
      next: () => {
        this.triggerAssign(targetRef, personId, moveFrom);
      },
      error: () => {
        this.state.assignments.set(snapshot);
        this.toast.error('Error en desassignar la persona.');
      },
    });
  }

  private triggerSwap(assignment1: AssignmentDetail, assignment2: AssignmentDetail): void {
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

  private performSwap(instanceId: string, assignmentIdA: string, assignmentIdB: string): Observable<void> {
    return this.assignmentService.swap(instanceId, { assignmentIdA, assignmentIdB }).pipe(
      map((result) => {
        this.state.assignments.update((list) =>
          list.map((a) => {
            if (a.id === result.a.id) return result.a;
            if (a.id === result.b.id) return result.b;
            return a;
          }),
        );
      }),
    );
  }

  private triggerCrossSwap(assignment1: AssignmentDetail, assignment2: AssignmentDetail): void {
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
        }),
      );

    applyCrossSwap(person2Id, person1Id).subscribe({
      next: () => {
        this.toast.success("S'han intercanviat les persones.");
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
  ): Observable<{ a: AssignmentDetail; b: AssignmentDetail }> {
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

  private advanceToNextEmptyNode(instanceId: string, justAssignedNodeId: string): void {
    const instance = this.instanceFor(instanceId);
    if (!instance) return;

    const visibleIds = new Set(
      this.ws
        .visibleNodesFor(instance)
        .filter((n) => n.zone !== FigureZone.PINYA && n.zone !== FigureZone.DECORATION)
        .map((n) => n.id),
    );
    const assignedIds = new Set(
      this.state
        .assignments()
        .filter((a) => a.figureInstanceId === instanceId)
        .map((a) => a.node.id),
    );

    const buckets = buildTroncBuckets(instance.nodes);
    const next = pickNextAssignableNode(buckets, justAssignedNodeId, assignedIds, visibleIds);
    if (next) {
      this.select({ slotId: instanceId, nodeId: next.id });
    } else {
      this.clearSelection();
    }
  }
}
