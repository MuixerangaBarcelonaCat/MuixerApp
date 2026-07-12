import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { LucideAngularModule, Map as MapIcon } from 'lucide-angular';
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
import { forkJoin, Observable, switchMap } from 'rxjs';

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
    const prevRef = this.selectedRef();
    const prevAssignment = prevRef ? this.assignmentFor(prevRef) : null;
    const isSameNode = !!prevRef && prevRef.slotId === ref.slotId && prevRef.nodeId === ref.nodeId;

    if (clickedAssignment && prevAssignment && !isSameNode) {
      if (prevRef?.slotId === ref.slotId) {
        this.triggerSwap(prevAssignment, clickedAssignment);
      } else {
        this.triggerCrossSwap(prevAssignment, clickedAssignment);
      }
      this.clearSelection();
      return;
    }

    if (!clickedAssignment && prevAssignment && !isSameNode) {
      this.triggerUnassignThenAssign(prevAssignment, ref, prevAssignment.person.id);
      return;
    }

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
    this.clearSelection();

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
