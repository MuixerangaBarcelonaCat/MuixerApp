import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { LucideAngularModule, Trash2, Undo2, Redo2 } from 'lucide-angular';
import { FigureCanvasComponent } from '../../../figure-canvas/figure-canvas.component';
import { PersonPanelComponent } from '../../../person-panel/person-panel.component';
import { AlreadyAssignedDialogComponent } from '../../../already-assigned-dialog/already-assigned-dialog.component';
import { SegmentWorkspaceStateService, WorkspaceInstance } from '../../../../services/segment-workspace-state.service';
import { AssignmentStateService } from '../../../../services/assignment-state.service';
import { NodeAssignmentService } from '../../../../services/node-assignment.service';
import { ToastService } from '../../../../../../shared/components/feedback/toast/toast.service';
import { UndoRedoService, UndoableAction } from '../../../../services/undo-redo.service';
import { SegmentNodeRef, targetTabForZone } from '../../../../utils/segment-assignment-render.util';
import {
  AssignmentDetail,
  AttendanceStatus,
  AvailablePerson,
  AvailablePersonPosition,
  BulkImportResult,
  PendingOp,
} from '../../../../models/assignment.model';
import { ImportPinyaModalComponent } from '../../../import-pinya-modal/import-pinya-modal.component';
import { FigureZone } from '@muixer/shared';
import { forkJoin, map, Observable, switchMap } from 'rxjs';
import { buildPinyaBuckets, pickNextAssignableNode } from '../../../../utils/assignment-order.util';

/**
 * Pinyes tab of the segment workspace: every figure of the segment on one
 * canvas at its distributed position, with person assignment. Ad-hoc node
 * creation/editing lives in the "Nodes extra" tab.
 */
@Component({
  selector: 'app-pinyes-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucideAngularModule,
    FigureCanvasComponent,
    PersonPanelComponent,
    AlreadyAssignedDialogComponent,
    ImportPinyaModalComponent,
  ],
  templateUrl: './pinyes-tab.component.html',
})
export class PinyesTabComponent implements OnInit {
  readonly ws = inject(SegmentWorkspaceStateService);
  readonly state = inject(AssignmentStateService);
  private readonly assignmentService = inject(NodeAssignmentService);
  private readonly toast = inject(ToastService);
  private readonly undoRedo = inject(UndoRedoService);

  readonly isPast = input(false);

  /** Emitted when "Anar-hi" targets a node that only exists in the Troncs tab. */
  readonly crossTabSelect = output<{ tab: 'pinyes' | 'troncs'; ref: SegmentNodeRef }>();

  readonly Trash2 = Trash2;
  readonly Undo2 = Undo2;
  readonly Redo2 = Redo2;

  readonly canUndo = this.undoRedo.canUndo;
  readonly canRedo = this.undoRedo.canRedo;
  readonly undoDescription = this.undoRedo.undoDescription;
  readonly redoDescription = this.undoRedo.redoDescription;

  // Queried by template ref (not by type) so tests can substitute a stub component.
  @ViewChild('canvas') private canvasRef?: FigureCanvasComponent;
  private initialCenterDone = false;

  /**
   * Below `sm`, the fixed-width person panel (w-80) leaves the canvas at
   * ~73px — unusable for drag assignment (P-M2, GE-H3). Shows a guard
   * message instead until the mobile layout is designed (WI-14/15 gestures
   * land first). Driven by `matchMedia`; falls back to `false` where
   * `matchMedia` is unavailable.
   */
  readonly mobileUnsupported = signal(false);

  constructor() {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const mql = window.matchMedia('(max-width: 639.98px)');
      this.mobileUnsupported.set(mql.matches);
      const listener = (e: MediaQueryListEvent) => this.mobileUnsupported.set(e.matches);
      mql.addEventListener('change', listener);
      inject(DestroyRef).onDestroy(() => mql.removeEventListener('change', listener));
    }

    effect(() => {
      // Wait for every figure's nodes to have loaded — fitting on an early,
      // partial pinyaSlots() emission freezes the viewport on an incomplete
      // layout, since nothing re-fits once the rest of the figures arrive.
      if (this.ws.instancesHydrated() && this.ws.pinyaSlots().length > 0 && !this.initialCenterDone) {
        this.initialCenterDone = true;
        setTimeout(() => this.canvasRef?.centerOnContent());
      }
    });
  }

  ngOnInit(): void {
    // Positions/cordons/mode may have changed in another tab (e.g. Distribució)
    // since the workspace's one-time load(); pull the latest on activation.
    this.ws.refresh();

    const pending = this.ws.pendingSelection();
    if (pending) {
      this.ws.pendingSelection.set(null);
      this.select(pending);
    }
  }

  readonly selectedRef = signal<SegmentNodeRef | null>(null);
  readonly highlightedNodeIds = signal<Set<string>>(new Set());

  readonly reassignDialog = signal<{
    personId: string;
    personAlias: string;
    oldInstanceId: string;
    oldAssignmentId: string;
    oldNodeId: string;
    oldNodeLabel: string;
    figureName: string;
    targetInstanceId: string;
    targetNodeId: string;
  } | null>(null);

  // ── Import pinya / reset snapshot ────────────────────────────────────────

  readonly importMenuOpen = signal(false);
  readonly importTarget = signal<{ instanceId: string; figureTemplateId: string } | null>(null);
  readonly resetMenuOpen = signal(false);
  readonly resetTarget = signal<string | null>(null);
  readonly resetting = signal(false);

  readonly importCandidates = computed(() =>
    this.ws.instances().filter((i) => i.figureTemplateId !== null),
  );
  readonly resetCandidates = computed(() => this.ws.instances().filter((i) => i.snapshotted));

  readonly resetTargetInstance = computed(() => {
    const id = this.resetTarget();
    return id ? this.instanceFor(id) : null;
  });

  readonly resetTargetAssignedCount = computed(() => {
    const id = this.resetTarget();
    if (!id) return 0;
    return this.state.assignments().filter((a) => a.figureInstanceId === id).length;
  });

  openImport(): void {
    this.resetMenuOpen.set(false);
    const candidates = this.importCandidates();
    if (candidates.length === 1) {
      this.chooseImportFigure(candidates[0].instanceId);
    } else if (candidates.length > 1) {
      this.importMenuOpen.set(true);
    }
  }

  chooseImportFigure(instanceId: string): void {
    this.importMenuOpen.set(false);
    const instance = this.instanceFor(instanceId);
    if (!instance?.figureTemplateId) return;
    this.importTarget.set({ instanceId, figureTemplateId: instance.figureTemplateId });
  }

  onImportCompleted(result: BulkImportResult): void {
    let msg =
      result.conflicts.length > 0
        ? `S'han importat ${result.created.length} assignacions (${result.conflicts.length} conflictes omesos).`
        : `S'han importat ${result.created.length} assignacions.`;
    if (result.clonedAdHocNodes > 0) {
      msg += ` S'han clonat ${result.clonedAdHocNodes} nodes manuals.`;
    }
    this.toast.success(msg);
    const target = this.importTarget();
    this.importTarget.set(null);
    if (target) {
      this.ws.refreshInstance(target.instanceId);
    }
  }

  onImportClosed(): void {
    this.importTarget.set(null);
  }

  openReset(): void {
    this.importMenuOpen.set(false);
    const candidates = this.resetCandidates();
    if (candidates.length === 1) {
      this.chooseResetFigure(candidates[0].instanceId);
    } else if (candidates.length > 1) {
      this.resetMenuOpen.set(true);
    }
  }

  chooseResetFigure(instanceId: string): void {
    this.resetMenuOpen.set(false);
    this.resetTarget.set(instanceId);
  }

  cancelReset(): void {
    this.resetTarget.set(null);
  }

  confirmReset(): void {
    const instanceId = this.resetTarget();
    if (!instanceId) return;

    this.undoRedo.clear();
    this.resetting.set(true);
    this.assignmentService.resetSnapshot(instanceId).subscribe({
      next: (result) => {
        this.resetting.set(false);
        this.resetTarget.set(null);
        let msg = `S'han eliminat ${result.removedAssignments} assignacions. La figura torna a la plantilla original.`;
        if (result.deletedAdHocCount > 0) {
          msg += ` S'han eliminat ${result.deletedAdHocCount} nodes manuals.`;
        }
        this.toast.success(msg);

        this.clearSelection();
        this.state.assignments.update((list) =>
          list.filter((a) => a.figureInstanceId !== instanceId),
        );
        this.ws.instances.update((list) =>
          list.map((i) =>
            i.instanceId === instanceId ? { ...i, snapshotted: false, assignedCount: 0 } : i,
          ),
        );
        this.ws.refreshInstance(instanceId);
        this.state.refreshPersonList();
      },
      error: (err) => {
        this.resetting.set(false);
        this.resetTarget.set(null);
        const msg = err?.error?.message ?? 'No s\'ha pogut reinicialitzar la figura.';
        this.toast.error(msg);
      },
    });
  }

  readonly attendanceMap = computed(
    () => this.state.attendanceRegistry() as Map<string, AttendanceStatus>,
  );
  readonly nextPerformanceMap = computed(() => this.state.nextPerformanceRegistry());

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

    if (event.key === 'Escape') {
      event.preventDefault();
      this.clearSelection();
      this.state.setSelectedPersonId(null);
      return;
    }

    if ((event.key === 'Delete' || event.key === 'Backspace') && !this.ws.isLocked()) {
      const ref = this.selectedRef();
      if (!ref) return;
      const assignment = this.assignmentFor(ref);
      if (!assignment) return;
      event.preventDefault();
      this.onUnassign(assignment);
      return;
    }

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

    if (event.key === 'Tab') {
      event.preventDefault();
      this.advanceFromCurrent();
    }
  }

  onSegmentNodeSelected(ref: SegmentNodeRef | null): void {
    if (this.ws.isLocked()) return;

    if (!ref) {
      this.clearSelection();
      return;
    }

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
      // Both assigned → swap persons (cross-figure swaps go through unassign + reassign)
      if (source.slotId === target.slotId) {
        this.triggerSwap(sourceAssignment, targetAssignment);
      } else {
        this.triggerCrossSwap(sourceAssignment, targetAssignment);
      }
    } else {
      // Dropped on an empty node → move person (cross-figure allowed)
      this.triggerUnassignThenAssign(sourceAssignment, target, sourceAssignment.person.id);
    }
    this.clearSelection();
  }

  onPersonSelected(person: AvailablePerson): void {
    if (this.ws.isLocked()) return;
    const ref = this.selectedRef();

    if (!ref) {
      this.state.setSelectedPersonId(person.id);
      return;
    }

    const node = this.nodeFor(ref);
    if (node?.zone === FigureZone.DECORATION) {
      this.toast.error('Els nodes decoratius no es poden assignar.');
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

    const targetRef = this.selectedRef();
    if (targetRef) {
      // figureName is shown as "X ja és <node> a <figureName>" — the figure the
      // person is CURRENTLY in, not the one they'd move to (that's targetInstanceId).
      const currentInstance = this.instanceFor(event.instanceId);
      this.reassignDialog.set({
        personId: event.personId,
        personAlias:
          assignment.person.alias || `${assignment.person.name} ${assignment.person.firstSurname}`,
        oldInstanceId: event.instanceId,
        oldAssignmentId: assignment.id,
        oldNodeId: assignment.node.id,
        oldNodeLabel: assignment.node.label,
        figureName: currentInstance?.label ?? '',
        targetInstanceId: targetRef.slotId,
        targetNodeId: targetRef.nodeId,
      });
      return;
    }

    this.navigateToAssignment(assignment);
  }

  onReassignDialogClosed(): void {
    this.reassignDialog.set(null);
  }

  onReassignDialogView(): void {
    const dialog = this.reassignDialog();
    if (!dialog) return;
    this.reassignDialog.set(null);
    const assignment = this.state.assignments().find((a) => a.id === dialog.oldAssignmentId);
    if (assignment) this.navigateToAssignment(assignment);
  }

  onReassignDialogConfirm(): void {
    const dialog = this.reassignDialog();
    if (!dialog) return;
    this.reassignDialog.set(null);

    const snapshot = [...this.state.assignments()];
    this.state.assignments.update((list) => list.filter((a) => a.id !== dialog.oldAssignmentId));

    this.assignmentService.unassign(dialog.oldInstanceId, dialog.oldAssignmentId).subscribe({
      next: () => {
        this.triggerAssign(
          { slotId: dialog.targetInstanceId, nodeId: dialog.targetNodeId },
          dialog.personId,
          { instanceId: dialog.oldInstanceId, nodeId: dialog.oldNodeId },
        );
      },
      error: () => {
        this.state.assignments.set(snapshot);
        this.toast.error('Error en reassignar la persona.');
      },
    });
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
   * Assigns `personId` to `ref`. When `moveFrom` is given (drag-drop move / cross-figure
   * reassign), the pushed undo action is a single composite MOVE — undo restores the person to
   * `moveFrom` instead of just unassigning them (FE-BUG-7).
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
    this.selectedRef.set(null);
    this.state.setSelectedNodeId(null);

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
    this.selectedRef.set(null);
    this.state.setSelectedNodeId(null);

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

  /** Swap between figures: the swap endpoint is per-instance, so unassign both and reassign crossed. */
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

  private navigateToAssignment(assignment: AssignmentDetail): void {
    const ref: SegmentNodeRef = { slotId: assignment.figureInstanceId, nodeId: assignment.node.id };
    const targetTab = targetTabForZone(assignment.node.zone);
    if (targetTab === 'troncs') {
      this.crossTabSelect.emit({ tab: 'troncs', ref });
      return;
    }
    this.select(ref);
  }

  private advanceToNextEmptyNode(instanceId: string, justAssignedNodeId: string): void {
    const instance = this.instanceFor(instanceId);
    if (!instance) return;

    const visibleIds = new Set(this.ws.visibleNodesFor(instance).map((n) => n.id));
    const assignedIds = new Set(
      this.state
        .assignments()
        .filter((a) => a.figureInstanceId === instanceId)
        .map((a) => a.node.id),
    );

    const buckets = buildPinyaBuckets(instance.nodes);
    const next = pickNextAssignableNode(buckets, justAssignedNodeId, assignedIds, visibleIds);
    if (next) {
      this.select({ slotId: instanceId, nodeId: next.id });
    } else {
      this.selectedRef.set(null);
      this.state.setSelectedNodeId(null);
    }
  }

  private advanceFromCurrent(): void {
    const ref = this.selectedRef();
    const instanceId = ref?.slotId ?? this.ws.selectedInstanceId() ?? this.ws.instances()[0]?.instanceId;
    if (!instanceId) return;
    const instance = this.instanceFor(instanceId);
    if (!instance) return;

    const nodes = this.ws
      .visibleNodesFor(instance)
      .filter((n) => n.zone !== FigureZone.DECORATION && n.zone !== FigureZone.TRONC);
    if (nodes.length === 0) return;

    const assignedIds = new Set(
      this.state
        .assignments()
        .filter((a) => a.figureInstanceId === instanceId)
        .map((a) => a.node.id),
    );

    const startIndex = ref ? nodes.findIndex((n) => n.id === ref.nodeId) : -1;
    for (let i = 1; i <= nodes.length; i++) {
      const idx = (startIndex + i) % nodes.length;
      if (!assignedIds.has(nodes[idx].id)) {
        this.select({ slotId: instanceId, nodeId: nodes[idx].id });
        return;
      }
    }
  }
}
