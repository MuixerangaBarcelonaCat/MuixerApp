import { TroncViewComponent, TroncNodeItem, SegmentNodeRef, targetTabForZone, computeFigureBoundingBoxes, FigureBoundingBox, getFigureColor, AssignmentDetail, AttendanceStatus, AvailablePerson, AvailablePersonPosition, ConflictPlacement } from '@muixer/pinyes-render';
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, OnInit, ViewChild, computed, inject, input, output, signal } from '@angular/core';
import { LucideAngularModule, Map as MapIcon, Undo2, Redo2 } from 'lucide-angular';
import { PersonPanelComponent } from '../../../person-panel/person-panel.component';
import { AlreadyAssignedDialogComponent } from '../../../already-assigned-dialog/already-assigned-dialog.component';
import { SegmentWorkspaceStateService, WorkspaceInstance } from '../../../../services/segment-workspace-state.service';
import { AssignmentStateService } from '../../../../services/assignment-state.service';
import { NodeAssignmentService } from '../../../../services/node-assignment.service';
import { SegmentAssignmentActionsService } from '../../../../services/segment-assignment-actions.service';
import { ButtonComponent, ModalComponent, ToastService } from '@muixer/ui';
import { LayoutService } from '../../../../../../core/services/layout.service';
import { UndoRedoService } from '../../../../services/undo-redo.service';
import {
  buildTroncBuckets,
  pickAdjacentNode,
  pickNextAssignableNode,
} from '../../../../utils/assignment-order.util';
import { DIRECTION_NODE_PRESETS, FigureZone, isNodeVisibleByModeAndCordons } from '@muixer/shared';

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
  imports: [LucideAngularModule, TroncViewComponent, PersonPanelComponent, AlreadyAssignedDialogComponent, ButtonComponent, ModalComponent, NgTemplateOutlet],
  templateUrl: './troncs-tab.component.html',
  providers: [SegmentAssignmentActionsService],
})
export class TroncsTabComponent implements OnInit {
  readonly ws = inject(SegmentWorkspaceStateService);
  readonly state = inject(AssignmentStateService);
  private readonly assignmentService = inject(NodeAssignmentService);
  private readonly actions = inject(SegmentAssignmentActionsService);
  private readonly toast = inject(ToastService);
  private readonly undoRedo = inject(UndoRedoService);

  /** Touch devices get no side panel: tapping a node opens the person list in a modal instead. */
  readonly isTouch = inject(LayoutService).isTouch;

  readonly isPast = input(false);

  /** Emitted when "Anar-hi" targets a node that only exists in the Pinyes tab. */
  readonly crossTabSelect = output<{ tab: 'pinyes' | 'troncs'; ref: SegmentNodeRef }>();

  constructor() {
    this.actions.attach({
      select: (ref) => this.select(ref),
      clearSelection: () => this.clearSelection(),
      advanceToNextEmptyNode: (instanceId, nodeId) => this.advanceToNextEmptyNode(instanceId, nodeId),
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

  @ViewChild('personPanel') private personPanel?: PersonPanelComponent;

  /**
   * The tronc view has no full-bleed canvas that swallows background clicks, so
   * clicks on the empty area around the figures fall through to the tab host.
   * Mirror the Pinyes canvas: deselect the current node and pull focus back to
   * the person search box, so the box is never left "orphaned" after an outside
   * click. Clicks on a tronc view, the person panel, or a control are ignored.
   */
  @HostListener('click', ['$event'])
  onBackgroundClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('app-tronc-view, app-person-panel, button, a, [role="button"], input')) {
      return;
    }
    this.clearSelection();
    this.personPanel?.focusSearch();
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

    if (event.key === 'Tab') {
      event.preventDefault();
      this.navigateAdjacent(event.shiftKey ? -1 : 1);
    }
  }

  /**
   * Steps the selection to the node immediately before (`-1`) or after (`1`)
   * the current one, following the established tronc order and stopping on
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
        .filter((n) => n.zone !== FigureZone.PINYA && n.zone !== FigureZone.DECORATION)
        .map((n) => n.id),
    );
    const buckets = buildTroncBuckets(instance.nodes);
    const currentId = ref?.slotId === instanceId ? ref.nodeId : null;
    const next = pickAdjacentNode(buckets, currentId, direction, visibleIds);
    if (next) {
      this.select({ slotId: instanceId, nodeId: next.id });
    }
  }

  /** Ctrl+Z / undo button: reverses the most recent assign/unassign/move/swap. */
  performUndo(): void {
    this.actions.undo();
  }

  /** Ctrl+Shift+Z / redo button: re-applies the most recently undone action. */
  performRedo(): void {
    this.actions.redo();
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

  /** Touch: the person list modal, opened by tapping a node. */
  readonly personPickerOpen = signal(false);

  readonly personPickerTitle = computed(() => {
    const ref = this.selectedRef();
    return ref && this.actions.assignmentFor(ref) ? 'Canvia la persona' : 'Assigna una persona';
  });

  readonly figures = computed<TroncFigure[]>(() =>
    this.ws
      .instances()
      .map((instance, index) => {
        const visible = this.ws.visibleNodesFor(instance);
        return {
          instance,
          troncNodes: visible.filter((n) => n.zone === FigureZone.TRONC) as unknown as TroncNodeItem[],
          baseNodes: visible.filter(
            (n) => n.zone === FigureZone.BASE && isNodeVisibleByModeAndCordons(n, instance),
          ) as unknown as TroncNodeItem[],
          directionNodes: visible.filter(
            (n) => n.zone === FigureZone.DIRECTION,
          ) as unknown as TroncNodeItem[],
          color: getFigureColor(index),
        };
      })
      .filter((f) => f.troncNodes.length > 0 || f.baseNodes.length > 0 || f.directionNodes.length > 0),
  );

  // ── Minimap ──────────────────────────────────────────────────────────────

  /** Hidden by default on touch: the map would cover a big part of a small screen. */
  readonly minimapOpen = signal(!this.isTouch());

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
      this.personPickerOpen.set(false);
      this.clearSelection();
      return;
    }
    const ref: SegmentNodeRef = { slotId: instanceId, nodeId };

    const clickedAssignment = this.assignmentFor(ref);

    if (clickedAssignment) {
      this.select(ref);
      this.openPersonPickerIfTouch();
      return;
    }

    const pendingPersonId = this.state.selectedPersonId();
    this.select(ref);
    if (pendingPersonId) {
      this.actions.assign(ref, pendingPersonId);
      return;
    }
    this.openPersonPickerIfTouch();
  }

  /** Touch: the person list modal opens on the tapped node. */
  private openPersonPickerIfTouch(): void {
    if (this.isTouch() && this.selectedRef()) this.personPickerOpen.set(true);
  }

  /** The modal was dismissed (close button, backdrop, Escape) or closed after a choice. */
  onPersonPickerClosed(): void {
    this.personPickerOpen.set(false);
    this.clearSelection();
  }

  /** Drag-and-drop: a person was dragged from `source` and dropped on `target`. */
  onNodeDropped(source: SegmentNodeRef, target: SegmentNodeRef): void {
    this.actions.drop(source, target);
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
    this.personPickerOpen.set(false);
    const ref = this.selectedRef();

    if (!ref) {
      this.state.setSelectedPersonId(person.id);
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
    this.personPickerOpen.set(false);
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

  /** D8 (Fase 5): keep both placements — the deliberate-friction path out of the dialog. */
  onReassignDialogAssignAnyway(): void {
    const dialog = this.reassignDialog();
    if (!dialog) return;
    this.reassignDialog.set(null);
    this.actions.assign({ slotId: dialog.targetInstanceId, nodeId: dialog.targetNodeId }, dialog.personId);
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

  private navigateToAssignment(assignment: AssignmentDetail): void {
    const ref: SegmentNodeRef = { slotId: assignment.figureInstanceId, nodeId: assignment.node.id };
    const targetTab = targetTabForZone(assignment.node.zone);
    if (targetTab === 'pinyes') {
      this.crossTabSelect.emit({ tab: 'pinyes', ref });
      return;
    }
    this.select(ref);
  }

  onUnassign(assignment: AssignmentDetail): void {
    this.personPickerOpen.set(false);
    this.actions.unassign(assignment);
  }

  onDirectionAdded(instanceId: string, event: { positionType: string }): void {
    if (this.ws.isLocked()) return;
    const preset = DIRECTION_NODE_PRESETS.find((p) => p.positionType === event.positionType);
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
        next: (created) => {
          this.ws.refreshInstance(instanceId);
          // Select the fresh node so it's highlighted and the person panel auto-focuses
          // its "Cerca per nom o àlies" input, ready to assign someone straight away.
          this.select({ slotId: instanceId, nodeId: created.id });
          this.openPersonPickerIfTouch();
        },
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
    return this.actions.instanceFor(instanceId);
  }

  private nodeFor(ref: SegmentNodeRef) {
    return this.actions.nodeFor(ref);
  }

  private assignmentFor(ref: SegmentNodeRef): AssignmentDetail | null {
    return this.actions.assignmentFor(ref);
  }

  private advanceToNextEmptyNode(instanceId: string, justAssignedNodeId: string): void {
    // Touch has no list to keep filling from: each assignment is its own tap → modal → pick.
    if (this.isTouch()) {
      this.clearSelection();
      return;
    }
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
