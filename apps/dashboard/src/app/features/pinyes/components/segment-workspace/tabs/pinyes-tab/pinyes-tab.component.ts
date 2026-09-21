import { FigureCanvasComponent, SegmentNodeRef, targetTabForZone, AssignmentDetail, AttendanceStatus, AvailablePerson, AvailablePersonPosition, ConflictPlacement } from '@muixer/pinyes-render';
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
import { LucideAngularModule, Undo2, Redo2 } from 'lucide-angular';
import { PersonPanelComponent } from '../../../person-panel/person-panel.component';
import { AlreadyAssignedDialogComponent } from '../../../already-assigned-dialog/already-assigned-dialog.component';
import { SegmentWorkspaceStateService, WorkspaceInstance } from '../../../../services/segment-workspace-state.service';
import { AssignmentStateService } from '../../../../services/assignment-state.service';
import { SegmentAssignmentActionsService } from '../../../../services/segment-assignment-actions.service';
import { ToastService, ButtonComponent } from '@muixer/ui';
import { UndoRedoService } from '../../../../services/undo-redo.service';
import { FigureZone } from '@muixer/shared';
import {
  buildPinyaBuckets,
  pickAdjacentNode,
  pickNextAssignableNode,
} from '../../../../utils/assignment-order.util';

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
    ButtonComponent,
    FigureCanvasComponent,
    PersonPanelComponent,
    AlreadyAssignedDialogComponent,
  ],
  templateUrl: './pinyes-tab.component.html',
  providers: [SegmentAssignmentActionsService],
})
export class PinyesTabComponent implements OnInit {
  readonly ws = inject(SegmentWorkspaceStateService);
  readonly state = inject(AssignmentStateService);
  private readonly actions = inject(SegmentAssignmentActionsService);
  private readonly toast = inject(ToastService);
  private readonly undoRedo = inject(UndoRedoService);

  readonly isPast = input(false);

  /** Emitted when "Anar-hi" targets a node that only exists in the Troncs tab. */
  readonly crossTabSelect = output<{ tab: 'pinyes' | 'troncs'; ref: SegmentNodeRef }>();

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
    this.actions.attach({
      select: (ref) => this.select(ref),
      clearSelection: () => this.clearSelection(),
      advanceToNextEmptyNode: (instanceId, nodeId) => this.advanceToNextEmptyNode(instanceId, nodeId),
    });

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
    /** All of this person's placements in the segment, for the multi-placement dialog (Phase 3). */
    placements: ConflictPlacement[];
  } | null>(null);

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

    if (isMod && (event.key === '+' || event.key === '=')) {
      event.preventDefault();
      this.canvasRef?.zoomIn();
      return;
    }

    if (isMod && event.key === '-') {
      event.preventDefault();
      this.canvasRef?.zoomOut();
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      this.navigateAdjacent(event.shiftKey ? -1 : 1);
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
      this.actions.assign(ref, pendingPersonId);
    }
  }

  /** Drag-and-drop: a person was dragged from `source` and dropped on `target`. */
  onNodeDropped(source: SegmentNodeRef, target: SegmentNodeRef): void {
    this.actions.drop(source, target);
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
      this.actions.unassignThenAssign(existing, ref, person.id);
    } else {
      this.actions.assign(ref, person.id);
    }
  }

  onAssignedPersonSelected(event: { personId: string; instanceId: string }): void {
    // Collect every placement of this person in this instance instead of a single
    // arbitrary `.find()` (§2). Today the per-instance unique constraint means at most
    // one, so `[0]` matches the old behaviour; from Fase 4 on the full list is consumed.
    const matches = this.state
      .assignments()
      .filter((a) => a.figureInstanceId === event.instanceId && a.person.id === event.personId);
    const assignment = matches[0];
    if (!assignment) return;

    const targetRef = this.selectedRef();
    if (targetRef) {
      if (!this.actions.wouldConflict(event.personId, targetRef)) {
        // Domain rule (D-«direcció pinya»): a direcció-pinya placement never conflicts with a
        // pinya placement of the same figure instance — assign directly, no dialog.
        this.actions.assign(targetRef, event.personId);
        return;
      }

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
        placements: this.actions.placementsForPerson(event.personId),
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

    this.actions.reassignAll(
      [
        { assignmentId: dialog.oldAssignmentId, instanceId: dialog.oldInstanceId },
        ...dialog.placements.map((p) => ({ assignmentId: p.assignmentId, instanceId: p.figureInstanceId })),
      ],
      { slotId: dialog.targetInstanceId, nodeId: dialog.targetNodeId },
      dialog.personId,
      { instanceId: dialog.oldInstanceId, nodeId: dialog.oldNodeId },
    );
  }

  /** D8 (Fase 5): keep both placements — the deliberate-friction path out of the dialog. */
  onReassignDialogAssignAnyway(): void {
    const dialog = this.reassignDialog();
    if (!dialog) return;
    this.reassignDialog.set(null);
    this.actions.assign({ slotId: dialog.targetInstanceId, nodeId: dialog.targetNodeId }, dialog.personId);
  }

  onUnassign(assignment: AssignmentDetail): void {
    this.actions.unassign(assignment);
  }

  /** Ctrl+Z / undo button: reverses the most recent assign/unassign/move/swap. */
  performUndo(): void {
    this.actions.undo();
  }

  /** Ctrl+Shift+Z / redo button: re-applies the most recently undone action. */
  performRedo(): void {
    this.actions.redo();
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
    return this.actions.instanceFor(instanceId);
  }

  private nodeFor(ref: SegmentNodeRef) {
    return this.actions.nodeFor(ref);
  }

  private assignmentFor(ref: SegmentNodeRef): AssignmentDetail | null {
    return this.actions.assignmentFor(ref);
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

  /**
   * Steps the selection to the node immediately before (`-1`) or after (`1`)
   * the current one, following the established pinya order and stopping on
   * every visible node (assigned nodes included). Wraps around at both ends.
   */
  navigateAdjacent(direction: 1 | -1): void {
    const ref = this.selectedRef();
    const instanceId = ref?.slotId ?? this.ws.selectedInstanceId() ?? this.ws.instances()[0]?.instanceId;
    if (!instanceId) return;
    const instance = this.instanceFor(instanceId);
    if (!instance) return;

    const visibleIds = new Set(
      this.ws
        .visibleNodesFor(instance)
        .filter((n) => n.zone !== FigureZone.DECORATION && n.zone !== FigureZone.TRONC)
        .map((n) => n.id),
    );
    const buckets = buildPinyaBuckets(instance.nodes);
    const currentId = ref?.slotId === instanceId ? ref.nodeId : null;
    const next = pickAdjacentNode(buckets, currentId, direction, visibleIds);
    if (next) {
      this.select({ slotId: instanceId, nodeId: next.id });
    }
  }
}
