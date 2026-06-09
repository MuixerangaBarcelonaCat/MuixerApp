import { Injectable, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NodeAssignmentService } from '../../../services/node-assignment.service';
import { AssignmentStateService } from '../../../services/assignment-state.service';
import { ToastService } from '../../../../../shared/components/feedback/toast/toast.service';
import { AssignmentTabService } from './assignment-tab.service';
import {
  AssignmentDetail,
  BulkImportResult,
  PendingOp,
} from '../../../models/assignment.model';
import { FigureZone } from '@muixer/shared';
import { CordonsDialogSaveEvent } from '../../cordons-dialog/cordons-dialog.component';

/**
 * Component-scoped service owning all assignment mutation operations:
 * assign, unassign, swap, cordons, reset, delete instance.
 */
@Injectable()
export class AssignmentOperationsService {
  private readonly assignmentService = inject(NodeAssignmentService);
  private readonly state = inject(AssignmentStateService);
  private readonly tab = inject(AssignmentTabService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  triggerAssign(nodeId: string, personId: string): void {
    const instanceId = this.state.activeInstanceId();
    if (!instanceId) return;

    const activeTab = this.tab.activeTab();
    const snapshot = [...this.state.assignments()];
    const matchedNode = this.tab.activeNodes().find((n) => n.id === nodeId);

    const tempAssignment: AssignmentDetail = {
      id: `temp-${Date.now()}`,
      figureInstanceId: instanceId,
      compositionSlotId: null,
      node: {
        id: nodeId,
        label: matchedNode?.label ?? '',
        zone: matchedNode?.zone ?? FigureZone.PINYA,
        z: matchedNode?.z ?? 0,
        positionType: matchedNode?.positionType ?? null,
        sortOrder: matchedNode?.sortOrder ?? 0,
        ringLevel: matchedNode?.ringLevel ?? null,
        originNodeId: matchedNode?.originNodeId ?? null,
        sourceNodeId: matchedNode?.sourceNodeId ?? null,
      },
      person: { id: personId, alias: '...', name: '', firstSurname: '', shoulderHeight: null },
    };

    this.state.assignments.update((list) => [...list, tempAssignment]);
    this.state.setSelectedNodeId(null);

    const op: PendingOp = {
      id: `op-${Date.now()}`,
      type: 'assign',
      instanceId,
      nodeId,
      personId,
      previousAssignments: snapshot,
    };
    this.state.pendingOperations.update((ops) => [...ops, op]);

    this.assignmentService.assign(instanceId, { nodeId, personId }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (created) => {
        this.state.assignments.update((list) =>
          list.map((a) => (a.id === tempAssignment.id ? created : a)),
        );
        this.state.pendingOperations.update((ops) => ops.filter((o) => o.id !== op.id));

        if (activeTab && !activeTab.snapshotted) {
          this.tab.refreshInstanceNodes(instanceId);
        }

        this.tab.updateTabCount(instanceId);
        this.state.refreshPersonList();
        this.advanceToNextEmptyNode(created.node.id);
      },
      error: (err) => {
        this.state.assignments.set(op.previousAssignments);
        this.state.pendingOperations.update((ops) => ops.filter((o) => o.id !== op.id));
        this.tab.updateTabCount(instanceId);
        this.state.refreshPersonList();
        this.state.setSelectedNodeId(nodeId);
        const msg =
          err?.status === 409
            ? 'Conflicte en assignar la persona. Ja pot estar assignada.'
            : 'Error en assignar la persona.';
        this.toast.error(msg);
      },
    });
  }

  triggerUnassignThenAssign(
    existing: AssignmentDetail,
    nodeId: string,
    newPersonId: string,
  ): void {
    const instanceId = this.state.activeInstanceId();
    if (!instanceId) return;

    const snapshot = [...this.state.assignments()];
    this.state.assignments.update((list) => list.filter((a) => a.id !== existing.id));
    this.state.setSelectedNodeId(null);

    this.assignmentService.unassign(instanceId, existing.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.triggerAssign(nodeId, newPersonId),
      error: () => {
        this.state.assignments.set(snapshot);
        this.toast.error('Error en desassignar la persona.');
      },
    });
  }

  triggerSwap(assignment1: AssignmentDetail, assignment2: AssignmentDetail): void {
    const instanceId = this.state.activeInstanceId();
    if (!instanceId) return;

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
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.state.assignments.update((list) =>
            list.map((a) => {
              if (a.id === result.a.id) return result.a;
              if (a.id === result.b.id) return result.b;
              return a;
            }),
          );
          this.toast.success('Persones intercanviades correctament.');
        },
        error: () => {
          this.state.assignments.set(snapshot);
          this.toast.error("Error en l'intercanvi de persones.");
        },
      });
  }

  unassign(assignment: AssignmentDetail): void {
    const instanceId = this.state.activeInstanceId();
    if (!instanceId) return;

    const snapshot = [...this.state.assignments()];
    this.state.assignments.update((list) => list.filter((a) => a.id !== assignment.id));
    this.state.setSelectedNodeId(null);

    this.assignmentService.unassign(instanceId, assignment.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.tab.updateTabCount(instanceId);
        this.state.refreshPersonList();
      },
      error: () => {
        this.state.assignments.set(snapshot);
        this.tab.updateTabCount(instanceId);
        this.state.refreshPersonList();
        this.toast.error('Error en desassignar la persona.');
      },
    });
  }

  saveCordons(event: CordonsDialogSaveEvent, onSuccess: () => void): void {
    const instanceId = this.state.activeInstanceId();
    if (!instanceId) return;

    this.assignmentService
      .updateCordons(instanceId, {
        numberOfCordons: event.numberOfCordons,
        openCordons: event.openCordons.length > 0 ? event.openCordons : null,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resp) => {
          this.tab.updateTabCordons(instanceId, resp.numberOfCordons, resp.openCordons);
          this.tab.refreshInstanceNodes(instanceId);
          this.toast.success('Configuració de cordons actualitzada.');
          onSuccess();
        },
        error: () => this.toast.error('Error en actualitzar els cordons.'),
      });
  }

  resetSnapshot(onSuccess: (removed: number) => void, onError: () => void): void {
    const instanceId = this.state.activeInstanceId();
    if (!instanceId) return;

    this.assignmentService.resetSnapshot(instanceId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.tab.markTabReset(instanceId);
        this.state.assignments.set([]);
        this.tab.loadTabData(instanceId);
        this.state.refreshPersonList();
        onSuccess(result.removedAssignments);
      },
      error: (err) => {
        const msg = err?.error?.message ?? 'Error en reinicialitzar la figura.';
        this.toast.error(msg);
        onError();
      },
    });
  }

  deleteInstance(
    instanceId: string,
    label: string,
    goBack: () => void,
    onSuccess: () => void,
    onError: () => void,
  ): void {
    const eventId = this.tab.getEventId();
    const segmentId = this.tab.getSegmentId();

    this.tab.instanceService
      .remove(eventId, segmentId, instanceId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const remaining = this.tab.removeTabs(instanceId);
          if (remaining.length > 0) {
            this.tab.selectTab(remaining[0].instanceId);
          } else {
            this.state.reset();
            goBack();
          }
          this.state.refreshPersonList();
          this.toast.success(`Figura "${label}" eliminada del segment.`);
          onSuccess();
        },
        error: () => {
          this.toast.error('Error en eliminar la figura del segment.');
          onError();
        },
      });
  }

  handleImportCompleted(result: BulkImportResult): void {
    const msg =
      result.conflicts.length > 0
        ? `Importades ${result.created.length} assignacions (${result.conflicts.length} conflictes omesos).`
        : `Importades ${result.created.length} assignacions correctament.`;
    this.toast.success(msg);
    const instanceId = this.state.activeInstanceId();
    if (instanceId) this.tab.refreshInstanceNodes(instanceId);
  }

  advanceToNextEmptyNode(justAssignedNodeId: string): void {
    const nodes = this.tab.activeNodes();
    const assignments = this.state.assignments();
    const assignedIds = new Set(assignments.map((a) => a.node.id));
    const idx = nodes.findIndex((n) => n.id === justAssignedNodeId);
    if (idx === -1) return;

    for (let i = idx + 1; i < nodes.length; i++) {
      if (!assignedIds.has(nodes[i].id)) {
        this.state.setSelectedNodeId(nodes[i].id);
        return;
      }
    }
    this.state.setSelectedNodeId(null);
  }

  advanceToNextEmptyNodeFromCurrent(): void {
    const nodes = this.tab.activeNodes();
    if (nodes.length === 0) return;
    const assignments = this.state.assignments();
    const assignedIds = new Set(assignments.map((a) => a.node.id));
    const currentId = this.state.selectedNodeId();
    const startIndex = currentId ? nodes.findIndex((n) => n.id === currentId) : -1;

    for (let i = 1; i <= nodes.length; i++) {
      const idx = (startIndex + i) % nodes.length;
      if (!assignedIds.has(nodes[idx].id)) {
        this.state.setSelectedNodeId(nodes[idx].id);
        return;
      }
    }
  }
}
