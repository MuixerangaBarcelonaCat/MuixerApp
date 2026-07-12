import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { LucideAngularModule, Trash2 } from 'lucide-angular';
import { FigureCanvasComponent } from '../../../figure-canvas/figure-canvas.component';
import { PersonPanelComponent } from '../../../person-panel/person-panel.component';
import { NodePopoverComponent } from '../../../node-popover/node-popover.component';
import { AlreadyAssignedDialogComponent } from '../../../already-assigned-dialog/already-assigned-dialog.component';
import { SegmentWorkspaceStateService, WorkspaceInstance } from '../../../../services/segment-workspace-state.service';
import { AssignmentStateService } from '../../../../services/assignment-state.service';
import { NodeAssignmentService } from '../../../../services/node-assignment.service';
import { ToastService } from '../../../../../../shared/components/feedback/toast/toast.service';
import { UndoRedoService, UndoableAction } from '../../../../services/undo-redo.service';
import { SegmentNodeRef } from '../../../../utils/segment-assignment-render.util';
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
import { forkJoin, Observable, switchMap } from 'rxjs';
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
    NodePopoverComponent,
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

  readonly Trash2 = Trash2;

  // Queried by template ref (not by type) so tests can substitute a stub component.
  @ViewChild('canvas') private canvasRef?: FigureCanvasComponent;
  private initialCenterDone = false;

  constructor() {
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
  }

  readonly selectedRef = signal<SegmentNodeRef | null>(null);
  readonly popoverAssignment = signal<AssignmentDetail | null>(null);
  readonly popoverPosition = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  readonly highlightedNodeIds = signal<Set<string>>(new Set());

  readonly reassignDialog = signal<{
    personId: string;
    personAlias: string;
    oldInstanceId: string;
    oldAssignmentId: string;
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
    const prevRef = this.selectedRef();
    const prevAssignment = prevRef ? this.assignmentFor(prevRef) : null;
    const isSameNode = !!prevRef && prevRef.slotId === ref.slotId && prevRef.nodeId === ref.nodeId;

    if (clickedAssignment && prevAssignment && !isSameNode) {
      // Both assigned → swap persons (cross-figure swaps go through unassign + reassign)
      if (prevRef?.slotId === ref.slotId) {
        this.triggerSwap(prevAssignment, clickedAssignment);
      } else {
        this.triggerCrossSwap(prevAssignment, clickedAssignment);
      }
      this.clearSelection();
      return;
    }

    if (!clickedAssignment && prevAssignment && !isSameNode) {
      // Assigned node selected, empty node clicked → move person (cross-figure allowed)
      this.triggerUnassignThenAssign(prevAssignment, ref, prevAssignment.person.id);
      return;
    }

    if (clickedAssignment) {
      this.popoverAssignment.set(clickedAssignment);
      this.select(ref);
      return;
    }

    const pendingPersonId = this.state.selectedPersonId();
    this.popoverAssignment.set(null);
    this.select(ref);
    if (pendingPersonId) {
      this.triggerAssign(ref, pendingPersonId);
    }
  }

  onSegmentNodeClicked(event: SegmentNodeRef & { x: number; y: number }): void {
    this.popoverPosition.set({ x: event.x, y: event.y });
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
      const targetInstance = this.instanceFor(targetRef.slotId);
      this.reassignDialog.set({
        personId: event.personId,
        personAlias:
          assignment.person.alias || `${assignment.person.name} ${assignment.person.firstSurname}`,
        oldInstanceId: event.instanceId,
        oldAssignmentId: assignment.id,
        oldNodeLabel: assignment.node.label,
        figureName: targetInstance?.label ?? '',
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
    this.popoverAssignment.set(null);
    this.clearSelection();

    this.assignmentService.unassign(instanceId, assignment.id).subscribe({
      next: () => {
        this.state.refreshPersonList();

        let lastAssignmentId = assignment.id;
        const action: UndoableAction = {
          type: 'UNASSIGN',
          description: 'Desassignar persona',
          execute: () => this.assignmentService.unassign(instanceId, lastAssignmentId),
          undo: () => {
            const obs = this.assignmentService.assign(instanceId, { nodeId, personId });
            return new Observable<void>((sub) => {
              obs.subscribe({
                next: (created) => {
                  lastAssignmentId = created.id;
                  sub.next();
                  sub.complete();
                },
                error: (err) => sub.error(err),
              });
            });
          },
        };
        this.undoRedo.push(action);
      },
      error: () => {
        this.state.assignments.set(snapshot);
        this.state.refreshPersonList();
        this.toast.error('Error en desassignar la persona.');
      },
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
    this.popoverAssignment.set(null);
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

  private triggerAssign(ref: SegmentNodeRef, personId: string): void {
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

        let lastAssignId = created.id;
        const action: UndoableAction = {
          type: 'ASSIGN',
          description: 'Assignar persona',
          execute: () => {
            const obs = this.assignmentService.assign(instanceId, { nodeId: ref.nodeId, personId });
            return new Observable<void>((sub) => {
              obs.subscribe({
                next: (re) => {
                  lastAssignId = re.id;
                  sub.next();
                  sub.complete();
                },
                error: (err) => sub.error(err),
              });
            });
          },
          undo: () => this.assignmentService.unassign(instanceId, lastAssignId),
        };
        this.undoRedo.push(action);
      },
      error: (err) => {
        this.state.assignments.set(op.previousAssignments);
        this.state.pendingOperations.update((ops) => ops.filter((o) => o.id !== op.id));
        this.state.refreshPersonList();
        this.select(ref);
        const msg =
          err?.status === 409
            ? 'Conflicte en assignar la persona. Ja pot estar assignada.'
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
    this.state.assignments.update((list) => list.filter((a) => a.id !== existing.id));
    this.selectedRef.set(null);
    this.state.setSelectedNodeId(null);

    this.assignmentService.unassign(existing.figureInstanceId, existing.id).subscribe({
      next: () => {
        this.triggerAssign(targetRef, personId);
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

    this.assignmentService
      .swap(instanceId, { assignmentIdA: assignment1.id, assignmentIdB: assignment2.id })
      .subscribe({
        next: (result) => {
          this.state.assignments.update((list) =>
            list.map((a) => {
              if (a.id === result.a.id) return result.a;
              if (a.id === result.b.id) return result.b;
              return a;
            }),
          );
          this.toast.success("S'han intercanviat les persones.");
        },
        error: () => {
          this.state.assignments.set(snapshot);
          this.toast.error("Error en l'intercanvi de persones.");
        },
      });
  }

  /** Swap between figures: the swap endpoint is per-instance, so unassign both and reassign crossed. */
  private triggerCrossSwap(assignment1: AssignmentDetail, assignment2: AssignmentDetail): void {
    const snapshot = [...this.state.assignments()];

    this.state.assignments.update((list) =>
      list.map((a) => {
        if (a.id === assignment1.id) return { ...a, person: assignment2.person };
        if (a.id === assignment2.id) return { ...a, person: assignment1.person };
        return a;
      }),
    );

    forkJoin([
      this.assignmentService.unassign(assignment1.figureInstanceId, assignment1.id),
      this.assignmentService.unassign(assignment2.figureInstanceId, assignment2.id),
    ])
      .pipe(
        switchMap(() =>
          forkJoin([
            this.assignmentService.assign(assignment1.figureInstanceId, {
              nodeId: assignment1.node.id,
              personId: assignment2.person.id,
            }),
            this.assignmentService.assign(assignment2.figureInstanceId, {
              nodeId: assignment2.node.id,
              personId: assignment1.person.id,
            }),
          ]),
        ),
      )
      .subscribe({
        next: ([created1, created2]) => {
          this.state.assignments.update((list) =>
            list.map((a) => {
              if (a.id === assignment1.id) return created1;
              if (a.id === assignment2.id) return created2;
              return a;
            }),
          );
          this.toast.success("S'han intercanviat les persones.");
        },
        error: () => {
          this.state.assignments.set(snapshot);
          this.ws.refreshInstance(assignment1.figureInstanceId);
          this.ws.refreshInstance(assignment2.figureInstanceId);
          this.toast.error("Error en l'intercanvi de persones.");
        },
      });
  }

  private navigateToAssignment(assignment: AssignmentDetail): void {
    const ref: SegmentNodeRef = { slotId: assignment.figureInstanceId, nodeId: assignment.node.id };
    this.select(ref);
    this.popoverAssignment.set(assignment);
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
