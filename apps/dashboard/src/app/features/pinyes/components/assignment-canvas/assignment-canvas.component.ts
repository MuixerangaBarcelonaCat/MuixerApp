import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Location } from '@angular/common';
import { LucideAngularModule, ArrowLeft, Users, Edit, RefreshCw, Plus, Trash2, X } from 'lucide-angular';
import { LayoutService } from '../../../../core/services/layout.service';
import { NodeAssignmentService } from '../../services/node-assignment.service';
import { AssignmentStateService } from '../../services/assignment-state.service';
import { EventSegmentService } from '../../services/event-segment.service';
import { FigureFamilyService } from '../../services/figure-family.service';
import { FigureInstanceService } from '../../services/figure-instance.service';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';
import { FigureCanvasComponent } from '../figure-canvas/figure-canvas.component';
import { PersonPanelComponent } from '../person-panel/person-panel.component';
import { NodePopoverComponent } from '../node-popover/node-popover.component';
import { ImportPinyaModalComponent } from '../import-pinya-modal/import-pinya-modal.component';
import {
  AssignmentDetail,
  AvailablePerson,
  BulkImportResult,
  InstanceNodeItem,
  PendingOp,
} from '../../models/assignment.model';
import { SegmentDetail } from '../../models/segment.model';
import { FigureFamilyDetail, FigureFamilyVariant } from '../../models/figure-family.model';
import { FigureTemplateService } from '../../services/figure-template.service';

interface InstanceTab {
  instanceId: string;
  label: string;
  figureTemplateId: string | null;
  familyId: string | null;
  snapshotted: boolean;
  sourceVariantOrder: number | null;
  nodes: InstanceNodeItem[];
  assignedCount: number;
  totalCount: number;
}

@Component({
  selector: 'app-assignment-canvas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    LucideAngularModule,
    FigureCanvasComponent,
    PersonPanelComponent,
    NodePopoverComponent,
    ImportPinyaModalComponent,
  ],
  templateUrl: './assignment-canvas.component.html',
})
export class AssignmentCanvasComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly layout = inject(LayoutService);
  private readonly assignmentService = inject(NodeAssignmentService);
  private readonly segmentService = inject(EventSegmentService);
  private readonly familyService = inject(FigureFamilyService);
  private readonly figureTemplateService = inject(FigureTemplateService);
  private readonly instanceService = inject(FigureInstanceService);
  private readonly toast = inject(ToastService);
  readonly state = inject(AssignmentStateService);

  readonly ArrowLeft = ArrowLeft;
  readonly Users = Users;
  readonly Edit = Edit;
  readonly RefreshCw = RefreshCw;
  readonly Plus = Plus;
  readonly Trash2 = Trash2;
  readonly X = X;

  readonly eventId = signal('');
  readonly segmentId = signal('');
  readonly loading = signal(false);
  readonly segment = signal<SegmentDetail | null>(null);
  readonly tabs = signal<InstanceTab[]>([]);
  readonly popoverAssignment = signal<AssignmentDetail | null>(null);
  readonly popoverPosition = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  readonly importModalOpen = signal(false);
  readonly highlightedNodeIds = signal<Set<string>>(new Set());
  readonly upgradeModalOpen = signal(false);
  readonly upgrading = signal(false);
  readonly familyDetail = signal<FigureFamilyDetail | null>(null);
  readonly resetModalOpen = signal(false);
  readonly resetting = signal(false);
  readonly deleteInstanceModalOpen = signal(false);
  readonly deletingInstance = signal(false);
  readonly pendingDeleteTab = signal<InstanceTab | null>(null);

  readonly activeTab = computed(() =>
    this.tabs().find((t) => t.instanceId === this.state.activeInstanceId()) ?? null,
  );

  readonly activeNodes = computed(() => this.activeTab()?.nodes ?? []);

  readonly assignmentProgress = computed(() => {
    const tab = this.activeTab();
    if (!tab) return '';
    return `${tab.assignedCount}/${tab.totalCount}`;
  });

  readonly attendanceMap = computed(() => this.state.attendanceRegistry());
  readonly nextPerformanceMap = computed(() => this.state.nextPerformanceRegistry());

  readonly nextVariant = computed<FigureFamilyVariant | null>(() => {
    const tab = this.activeTab();
    const family = this.familyDetail();
    if (!tab || !family || !tab.figureTemplateId) return null;
    const currentOrder = tab.sourceVariantOrder ?? family.variants.find(
      (v) => v.id === tab.figureTemplateId,
    )?.variantOrder ?? 0;
    return family.variants
      .filter((v) => v.variantOrder > currentOrder)
      .sort((a, b) => a.variantOrder - b.variantOrder)[0] ?? null;
  });

  readonly canUpgrade = computed(() => !!this.nextVariant());

  ngOnInit(): void {
    this.layout.requestFullscreen();
    const params = this.route.snapshot.params;
    this.eventId.set(params['eventId']);
    this.segmentId.set(params['segmentId']);
    this.state.reset();
    this.loadSegment();
  }

  ngOnDestroy(): void {
    this.layout.exitFullscreen();
  }

  private loadSegment(): void {
    this.loading.set(true);
    this.segmentService.getByEvent(this.eventId()).subscribe({
      next: (resp) => {
        const seg = resp.data.find((s) => s.id === this.segmentId());
        if (!seg) {
          this.toast.error('Segment no trobat.');
          this.goBack();
          return;
        }
        this.segment.set(seg);
        this.loading.set(false);
        this.buildTabs(seg);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Error en carregar el segment.');
      },
    });
  }

  private buildTabs(seg: SegmentDetail): void {
    const tabBuilders = seg.instances
      .filter((i) => !!i.figureTemplate)
      .map((instance): InstanceTab => ({
        instanceId: instance.id,
        label: instance.label ?? instance.figureTemplate?.name ?? '?',
        figureTemplateId: instance.figureTemplate?.id ?? null,
        familyId: null,
        snapshotted: instance.snapshotted,
        sourceVariantOrder: instance.sourceVariantOrder,
        nodes: [],
        assignedCount: 0,
        totalCount: 0,
      }));

    this.tabs.set(tabBuilders);

    if (tabBuilders.length > 0) {
      this.selectTab(tabBuilders[0].instanceId);
    }
  }

  selectTab(instanceId: string): void {
    this.state.activeInstanceId.set(instanceId);
    this.state.selectedNodeId.set(null);
    this.popoverAssignment.set(null);
    this.highlightedNodeIds.set(new Set());
    this.familyDetail.set(null);
    this.loadTabData(instanceId);
    this.loadFamilyForTab(instanceId);
  }

  private loadTabData(instanceId: string): void {
    const tab = this.tabs().find((t) => t.instanceId === instanceId);
    if (!tab) return;

    this.assignmentService.getInstanceNodes(instanceId).subscribe({
      next: (resp) => {
        this.tabs.update((list) =>
          list.map((t) =>
            t.instanceId === instanceId
              ? { ...t, nodes: resp.data, totalCount: resp.data.length }
              : t,
          ),
        );
      },
    });

    this.assignmentService.getByInstance(instanceId).subscribe({
      next: (resp) => {
        this.state.assignments.set(resp.data);
        this.tabs.update((list) =>
          list.map((t) =>
            t.instanceId === instanceId
              ? { ...t, assignedCount: resp.data.length }
              : t,
          ),
        );
      },
    });
  }

  private loadFamilyForTab(instanceId: string): void {
    const tab = this.tabs().find((t) => t.instanceId === instanceId);
    if (!tab?.figureTemplateId) return;

    if (tab.familyId) {
      this.familyService.getOne(tab.familyId).subscribe({
        next: (family) => this.familyDetail.set(family),
      });
      return;
    }

    this.figureTemplateService.getOne(tab.figureTemplateId).subscribe({
      next: (template) => {
        const familyId = template.familyId ?? null;
        this.tabs.update((list) =>
          list.map((t) =>
            t.instanceId === instanceId ? { ...t, familyId } : t,
          ),
        );
        if (familyId) {
          this.familyService.getOne(familyId).subscribe({
            next: (family) => this.familyDetail.set(family),
          });
        }
      },
    });
  }

  onAssignedPersonSelected(event: { personId: string; instanceId: string }): void {
    const targetTab = this.tabs().find((t) => t.instanceId === event.instanceId);
    if (!targetTab) return;

    this.selectTab(event.instanceId);

    this.assignmentService.getByInstance(event.instanceId).subscribe({
      next: (resp) => {
        const assignment = resp.data.find((a) => a.person.id === event.personId);
        if (assignment) {
          this.state.setSelectedNodeId(assignment.node.id);
        }
      },
    });
  }

  onNodeSelected(nodeId: string | null): void {
    if (!nodeId) {
      this.state.setSelectedNodeId(null);
      this.popoverAssignment.set(null);
      return;
    }

    const clickedNodeAssignment = this.state
      .assignments()
      .find((a) => a.node.id === nodeId);

    const previouslySelectedNodeId = this.state.selectedNodeId();
    const previousNodeAssignment = previouslySelectedNodeId
      ? this.state.assignments().find((a) => a.node.id === previouslySelectedNodeId)
      : null;

    if (clickedNodeAssignment && previousNodeAssignment && previouslySelectedNodeId !== nodeId) {
      this.triggerSwap(previousNodeAssignment, clickedNodeAssignment);
      this.state.setSelectedNodeId(null);
      this.popoverAssignment.set(null);
    } else if (clickedNodeAssignment) {
      this.popoverAssignment.set(clickedNodeAssignment);
      this.state.setSelectedNodeId(nodeId);
    } else {
      const pendingPersonId = this.state.selectedPersonId();
      this.state.setSelectedNodeId(nodeId);
      this.popoverAssignment.set(null);

      if (pendingPersonId) {
        this.triggerAssign(nodeId, pendingPersonId);
      }
    }
  }

  onNodeClicked(event: { nodeId: string; x: number; y: number }): void {
    this.popoverPosition.set({ x: event.x, y: event.y });
  }

  onPersonSelected(person: AvailablePerson): void {
    const selectedNodeId = this.state.selectedNodeId();

    if (!selectedNodeId) {
      this.state.setSelectedPersonId(person.id);
      return;
    }

    const existingAssignment = this.state
      .assignments()
      .find((a) => a.node.id === selectedNodeId);

    if (existingAssignment) {
      this.triggerUnassignThenAssign(existingAssignment, selectedNodeId, person.id);
    } else {
      this.triggerAssign(selectedNodeId, person.id);
    }
  }

  private triggerAssign(nodeId: string, personId: string): void {
    const instanceId = this.state.activeInstanceId();
    if (!instanceId) return;
    const tab = this.activeTab();

    const snapshot = [...this.state.assignments()];
    const matchedNode = this.activeNodes().find((n) => n.id === nodeId);
    const tempAssignment: AssignmentDetail = {
      id: `temp-${Date.now()}`,
      figureInstanceId: instanceId,
      compositionSlotId: null,
      node: {
        id: nodeId,
        label: matchedNode?.label ?? '',
        zone: matchedNode?.zone ?? '',
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

    this.assignmentService.assign(instanceId, { nodeId, personId }).subscribe({
      next: (created) => {
        this.state.assignments.update((list) =>
          list.map((a) => (a.id === tempAssignment.id ? created : a)),
        );
        this.state.pendingOperations.update((ops) => ops.filter((o) => o.id !== op.id));

        // After first assignment the instance becomes snapshotted — refresh nodes to get InstanceNode IDs
        if (tab && !tab.snapshotted) {
          this.refreshInstanceNodes(instanceId);
        }

        this.updateTabCount(instanceId);
        this.state.refreshPersonList();
        this.advanceToNextEmptyNode(created.node.id);
      },
      error: (err) => {
        this.state.assignments.set(op.previousAssignments);
        this.state.pendingOperations.update((ops) => ops.filter((o) => o.id !== op.id));
        this.updateTabCount(instanceId);
        this.state.refreshPersonList();
        this.state.setSelectedNodeId(nodeId);
        const msg = err?.status === 409
          ? 'Conflicte en assignar la persona. Ja pot estar assignada.'
          : 'Error en assignar la persona.';
        this.toast.error(msg);
      },
    });
  }

  private refreshInstanceNodes(instanceId: string): void {
    this.assignmentService.getInstanceNodes(instanceId).subscribe({
      next: (resp) => {
        this.tabs.update((list) =>
          list.map((t) =>
            t.instanceId === instanceId
              ? { ...t, nodes: resp.data, totalCount: resp.data.length, snapshotted: true }
              : t,
          ),
        );
        // Re-fetch assignments so node IDs align
        this.assignmentService.getByInstance(instanceId).subscribe({
          next: (assignResp) => {
            if (this.state.activeInstanceId() === instanceId) {
              this.state.assignments.set(assignResp.data);
            }
          },
        });
      },
    });
  }

  private triggerUnassignThenAssign(
    existing: AssignmentDetail,
    nodeId: string,
    newPersonId: string,
  ): void {
    const instanceId = this.state.activeInstanceId();
    if (!instanceId) return;

    const snapshot = [...this.state.assignments()];
    this.state.assignments.update((list) => list.filter((a) => a.id !== existing.id));
    this.state.setSelectedNodeId(null);

    this.assignmentService.unassign(instanceId, existing.id).subscribe({
      next: () => {
        this.triggerAssign(nodeId, newPersonId);
      },
      error: () => {
        this.state.assignments.set(snapshot);
        this.toast.error('Error en desassignar la persona.');
      },
    });
  }

  private triggerSwap(assignment1: AssignmentDetail, assignment2: AssignmentDetail): void {
    const instanceId = this.state.activeInstanceId();
    if (!instanceId) return;

    const snapshot = [...this.state.assignments()];

    // Optimistic update
    this.state.assignments.update((list) =>
      list.map((a) => {
        if (a.id === assignment1.id) return { ...a, person: assignment2.person };
        if (a.id === assignment2.id) return { ...a, person: assignment1.person };
        return a;
      }),
    );

    this.assignmentService
      .swap(instanceId, {
        assignmentIdA: assignment1.id,
        assignmentIdB: assignment2.id,
      })
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

  onUnassign(assignment: AssignmentDetail): void {
    const instanceId = this.state.activeInstanceId();
    if (!instanceId) return;

    const snapshot = [...this.state.assignments()];
    this.state.assignments.update((list) => list.filter((a) => a.id !== assignment.id));
    this.popoverAssignment.set(null);
    this.state.setSelectedNodeId(null);

    this.assignmentService.unassign(instanceId, assignment.id).subscribe({
      next: () => {
        this.updateTabCount(instanceId);
        this.state.refreshPersonList();
      },
      error: () => {
        this.state.assignments.set(snapshot);
        this.updateTabCount(instanceId);
        this.state.refreshPersonList();
        this.toast.error('Error en desassignar la persona.');
      },
    });
  }

  // ─── Upgrade ────────────────────────────────────────────────────────────

  openUpgradeModal(): void {
    this.upgradeModalOpen.set(true);
  }

  confirmUpgrade(): void {
    const instanceId = this.state.activeInstanceId();
    if (!instanceId) return;

    this.upgrading.set(true);
    const previousNodeIds = new Set(this.activeNodes().map((n) => n.id));

    this.assignmentService.upgradeInstance(instanceId).subscribe({
      next: (result) => {
        this.upgrading.set(false);
        this.upgradeModalOpen.set(false);
        this.toast.success(`S'han afegit ${result.addedNodes} posicions noves.`);

        // Reload nodes and highlight the new ones
        this.assignmentService.getInstanceNodes(instanceId).subscribe({
          next: (resp) => {
            const newIds = new Set(
              resp.data.filter((n) => !previousNodeIds.has(n.id)).map((n) => n.id),
            );
            this.tabs.update((list) =>
              list.map((t) =>
                t.instanceId === instanceId
                  ? {
                      ...t,
                      nodes: resp.data,
                      totalCount: resp.data.length,
                      snapshotted: true,
                      label: result.newTemplateName,
                      figureTemplateId: result.newTemplateId,
                      sourceVariantOrder: result.newVariantOrder,
                    }
                  : t,
              ),
            );
            this.highlightedNodeIds.set(newIds);
            setTimeout(() => this.highlightedNodeIds.set(new Set()), 5000);

            // Reload family to update nextVariant computed
            this.loadFamilyForTab(instanceId);
          },
        });

        this.assignmentService.getByInstance(instanceId).subscribe({
          next: (resp) => {
            this.state.assignments.set(resp.data);
            this.updateTabCount(instanceId);
          },
        });
      },
      error: (err) => {
        this.upgrading.set(false);
        this.upgradeModalOpen.set(false);
        const msg = err?.error?.message ?? "Error en afegir el cordó.";
        this.toast.error(msg);
      },
    });
  }

  cancelUpgrade(): void {
    this.upgradeModalOpen.set(false);
  }

  // ─── Reset snapshot ────────────────────────────────────────────────────

  openResetModal(): void {
    this.resetModalOpen.set(true);
  }

  confirmReset(): void {
    const instanceId = this.state.activeInstanceId();
    if (!instanceId) return;

    this.resetting.set(true);
    this.assignmentService.resetSnapshot(instanceId).subscribe({
      next: (result) => {
        this.resetting.set(false);
        this.resetModalOpen.set(false);
        this.toast.success(`S'han eliminat ${result.removedAssignments} assignacions. La figura torna al template original.`);

        this.tabs.update((list) =>
          list.map((t) =>
            t.instanceId === instanceId
              ? { ...t, snapshotted: false, sourceVariantOrder: null, assignedCount: 0 }
              : t,
          ),
        );
        this.state.assignments.set([]);
        this.loadTabData(instanceId);
        this.loadFamilyForTab(instanceId);
        this.state.refreshPersonList();
      },
      error: (err) => {
        this.resetting.set(false);
        this.resetModalOpen.set(false);
        const msg = err?.error?.message ?? 'Error en reinicialitzar la figura.';
        this.toast.error(msg);
      },
    });
  }

  cancelReset(): void {
    this.resetModalOpen.set(false);
  }

  // ─── Delete instance ────────────────────────────────────────────────────

  openDeleteInstanceModal(tab: InstanceTab): void {
    this.pendingDeleteTab.set(tab);
    this.deleteInstanceModalOpen.set(true);
  }

  cancelDeleteInstance(): void {
    this.deleteInstanceModalOpen.set(false);
    this.pendingDeleteTab.set(null);
  }

  confirmDeleteInstance(): void {
    const tab = this.pendingDeleteTab();
    if (!tab) return;

    this.deletingInstance.set(true);
    this.instanceService.remove(this.eventId(), this.segmentId(), tab.instanceId).subscribe({
      next: () => {
        this.deletingInstance.set(false);
        this.deleteInstanceModalOpen.set(false);
        this.pendingDeleteTab.set(null);

        const remaining = this.tabs().filter((t) => t.instanceId !== tab.instanceId);
        this.tabs.set(remaining);

        if (remaining.length > 0) {
          this.selectTab(remaining[0].instanceId);
        } else {
          this.state.reset();
          this.goBack();
        }

        this.state.refreshPersonList();
        this.toast.success(`Figura "${tab.label}" eliminada del segment.`);
      },
      error: () => {
        this.deletingInstance.set(false);
        this.toast.error("Error en eliminar la figura del segment.");
      },
    });
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  private advanceToNextEmptyNode(justAssignedNodeId: string): void {
    const nodes = this.activeNodes();
    const assignments = this.state.assignments();
    const assignedNodeIds = new Set(assignments.map((a) => a.node.id));
    const currentIndex = nodes.findIndex((n) => n.id === justAssignedNodeId);
    if (currentIndex === -1) return;

    for (let i = currentIndex + 1; i < nodes.length; i++) {
      if (!assignedNodeIds.has(nodes[i].id)) {
        this.state.setSelectedNodeId(nodes[i].id);
        return;
      }
    }
    this.state.setSelectedNodeId(null);
  }

  private updateTabCount(instanceId: string): void {
    const count = this.state.assignments().length;
    this.tabs.update((list) =>
      list.map((t) => (t.instanceId === instanceId ? { ...t, assignedCount: count } : t)),
    );
  }

  onImportCompleted(result: BulkImportResult): void {
    const msg = result.conflicts.length > 0
      ? `Importades ${result.created.length} assignacions (${result.conflicts.length} conflictes omesos).`
      : `Importades ${result.created.length} assignacions correctament.`;
    this.toast.success(msg);
    this.importModalOpen.set(false);
    const instanceId = this.state.activeInstanceId();
    if (instanceId) {
      // Import may trigger snapshot — refresh nodes
      this.refreshInstanceNodes(instanceId);
    }
  }

  getAttendanceStatus(assignment: AssignmentDetail): string | null {
    return this.attendanceMap().get(assignment.person.id) ?? null;
  }

  goBack(): void {
    this.location.back();
  }
}
