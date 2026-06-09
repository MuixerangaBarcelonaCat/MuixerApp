import {
  ChangeDetectionStrategy,
  Component,
  computed,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Location } from '@angular/common';
import { LucideAngularModule, ArrowLeft, Users, Edit, RefreshCw, Trash2, X, PanelLeft, PanelLeftClose, Monitor, Lock, SlidersHorizontal } from 'lucide-angular';
import { LayoutService } from '../../../../core/services/layout.service';
import { NodeAssignmentService, LockStatus } from '../../services/node-assignment.service';
import { AssignmentStateService } from '../../services/assignment-state.service';
import { EventSegmentService } from '../../services/event-segment.service';
import { FigureInstanceService } from '../../services/figure-instance.service';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';
import { FigureCanvasComponent } from '../figure-canvas/figure-canvas.component';
import { PersonPanelComponent } from '../person-panel/person-panel.component';
import { NodePopoverComponent } from '../node-popover/node-popover.component';
import { ImportPinyaModalComponent } from '../import-pinya-modal/import-pinya-modal.component';
import { TroncViewComponent } from '../tronc-view/tronc-view.component';
import { CordonsDialogComponent, CordonsDialogSaveEvent } from '../cordons-dialog/cordons-dialog.component';
import {
  AssignmentDetail,
  AttendanceStatus,
  AvailablePerson,
  BulkImportResult,
  InstanceNodeItem,
  PendingOp,
} from '../../models/assignment.model';
import { SegmentDetail } from '../../models/segment.model';
import { FigureTemplateService } from '../../services/figure-template.service';
import { RenglaModel } from '../../models/figure-template.model';
import { FigureZone } from '@muixer/shared';
import { repositionCordoObertNodes } from '../../utils/cordo-obert-reposition.util';

interface InstanceTab {
  instanceId: string;
  label: string;
  figureTemplateId: string | null;
  snapshotted: boolean;
  numberOfCordons: number | null;
  openCordons: string[] | null;
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
    TroncViewComponent,
    CordonsDialogComponent,
  ],
  templateUrl: './assignment-canvas.component.html',
  styleUrl: './assignment-canvas.component.scss',
})
export class AssignmentCanvasComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly layout = inject(LayoutService);
  private readonly assignmentService = inject(NodeAssignmentService);
  private readonly segmentService = inject(EventSegmentService);
  private readonly figureTemplateService = inject(FigureTemplateService);
  private readonly instanceService = inject(FigureInstanceService);
  private readonly toast = inject(ToastService);
  readonly state = inject(AssignmentStateService);

  readonly ArrowLeft = ArrowLeft;
  readonly Users = Users;
  readonly Edit = Edit;
  readonly RefreshCw = RefreshCw;
  readonly Trash2 = Trash2;
  readonly X = X;
  readonly PanelLeft = PanelLeft;
  readonly PanelLeftClose = PanelLeftClose;
  readonly Monitor = Monitor;
  readonly Lock = Lock;
  readonly SlidersHorizontal = SlidersHorizontal;

  readonly eventId = signal('');
  readonly segmentId = signal('');
  readonly loading = signal(false);
  readonly segment = signal<SegmentDetail | null>(null);
  readonly tabs = signal<InstanceTab[]>([]);
  readonly popoverAssignment = signal<AssignmentDetail | null>(null);
  readonly popoverPosition = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  readonly importModalOpen = signal(false);
  readonly highlightedNodeIds = signal<Set<string>>(new Set());
  readonly resetModalOpen = signal(false);
  readonly resetting = signal(false);
  readonly deleteInstanceModalOpen = signal(false);
  readonly deletingInstance = signal(false);
  readonly pendingDeleteTab = signal<InstanceTab | null>(null);

  readonly lockStatus = signal<LockStatus | null>(null);
  readonly isLocked = computed(() => this.lockStatus()?.locked ?? false);

  readonly troncPanelOpen = signal(false);

  readonly templateRengles = signal<RenglaModel[]>([]);
  readonly maxCordons = signal(0);
  readonly renglesWithCordoObert = computed(() =>
    this.templateRengles().filter((r) => r.allowsCordoObert),
  );
  readonly hasCordonsConfig = computed(() => this.templateRengles().length > 0);
  readonly cordonsDialogOpen = signal(false);

  // Floating tronc panel drag state
  readonly troncPanelPos = signal({ x: 16, y: 60 });
  private troncDragging = false;
  private troncDragOffset = { x: 0, y: 0 };

  readonly activeTab = computed(() =>
    this.tabs().find((t) => t.instanceId === this.state.activeInstanceId()) ?? null,
  );

  readonly activeNodes = computed(() => this.activeTab()?.nodes ?? []);

  /** Full node object for the currently selected node (null if no selection). */
  readonly selectedNode = computed(() => {
    const id = this.state.selectedNodeId();
    return id ? (this.activeNodes().find((n) => n.id === id) ?? null) : null;
  });

  /** Nodes rendered on the pinya Konva canvas (PINYA + BASE + direction zones, no TRONC). */
  readonly activePinyaNodes = computed(() => {
    const nodes = this.activeNodes().filter((n) => n.zone !== FigureZone.TRONC);
    const tab = this.activeTab();
    return repositionCordoObertNodes(nodes, tab?.numberOfCordons ?? null);
  });

  /** TRONC-zone nodes passed to the tronc panel. */
  readonly activeTroncNodes = computed(() =>
    this.activeNodes().filter((n) => n.zone === FigureZone.TRONC),
  );

  /** BASE-zone nodes passed to the tronc panel (P1 row). */
  readonly activeBaseNodes = computed(() =>
    this.activeNodes().filter((n) => n.zone === FigureZone.BASE),
  );

  /** Cast attendanceRegistry to AttendanceStatus map for TroncViewComponent. */
  readonly troncAttendanceMap = computed(
    () => this.state.attendanceRegistry() as Map<string, AttendanceStatus>,
  );

  readonly assignmentProgress = computed(() => {
    const tab = this.activeTab();
    if (!tab) return '';
    return `${tab.assignedCount}/${tab.totalCount}`;
  });

  readonly attendanceMap = computed(() => this.state.attendanceRegistry());
  readonly nextPerformanceMap = computed(() => this.state.nextPerformanceRegistry());

  ngOnInit(): void {
    this.layout.requestFullscreen();
    const params = this.route.snapshot.params;
    this.eventId.set(params['eventId']);
    this.segmentId.set(params['segmentId']);
    this.state.reset();
    this.loadSegment();

    this.assignmentService.getLockStatus(this.eventId()).subscribe({
      next: (status) => this.lockStatus.set(status),
    });
  }

  ngOnDestroy(): void {
    this.layout.exitFullscreen();
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    const isEditing =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable;
    if (isEditing) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      this.state.setSelectedNodeId(null);
      this.state.setSelectedPersonId(null);
      this.popoverAssignment.set(null);
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      this.advanceToNextEmptyNodeFromCurrent();
      return;
    }
  }

  private advanceToNextEmptyNodeFromCurrent(): void {
    const nodes = this.activeNodes();
    if (nodes.length === 0) return;
    const assignments = this.state.assignments();
    const assignedNodeIds = new Set(assignments.map((a) => a.node.id));

    const currentId = this.state.selectedNodeId();
    const startIndex = currentId
      ? nodes.findIndex((n) => n.id === currentId)
      : -1;

    for (let i = 1; i <= nodes.length; i++) {
      const idx = (startIndex + i) % nodes.length;
      if (!assignedNodeIds.has(nodes[idx].id)) {
        this.state.setSelectedNodeId(nodes[idx].id);
        return;
      }
    }
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
        snapshotted: instance.snapshotted,
        numberOfCordons: instance.numberOfCordons ?? null,
        openCordons: instance.openCordons ?? null,
        nodes: [],
        assignedCount: 0,
        totalCount: 0,
      }));

    this.tabs.set(tabBuilders);

    if (tabBuilders.length > 0) {
      this.selectTab(tabBuilders[0].instanceId);
    }
  }

  // ── Tronc panel drag ─────────────────────────────────────────────────────

  onTroncDragStart(event: MouseEvent): void {
    if ((event.target as HTMLElement).closest('button')) return;
    this.troncDragging = true;
    const pos = this.troncPanelPos();
    this.troncDragOffset = { x: event.clientX - pos.x, y: event.clientY - pos.y };
    event.preventDefault();
  }

  @HostListener('document:mousemove', ['$event'])
  onTroncDragMove(event: MouseEvent): void {
    if (!this.troncDragging) return;
    this.troncPanelPos.set({
      x: event.clientX - this.troncDragOffset.x,
      y: event.clientY - this.troncDragOffset.y,
    });
  }

  @HostListener('document:mouseup')
  onTroncDragEnd(): void {
    this.troncDragging = false;
  }

  selectTab(instanceId: string): void {
    this.state.activeInstanceId.set(instanceId);
    this.state.selectedNodeId.set(null);
    this.popoverAssignment.set(null);
    this.highlightedNodeIds.set(new Set());
    this.loadTabData(instanceId);
    this.loadTemplateRenglesForTab(instanceId);
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

  private loadTemplateRenglesForTab(instanceId: string): void {
    const tab = this.tabs().find((t) => t.instanceId === instanceId);
    if (!tab?.figureTemplateId) return;
    this.loadTemplateRengles(tab.figureTemplateId);
  }

  private loadTemplateRengles(templateId: string): void {
    this.figureTemplateService.getOne(templateId).subscribe({
      next: (template) => {
        this.templateRengles.set(template.rengles ?? []);
        const maxPos = (template.nodes ?? []).reduce(
          (max, n) => (n.renglaPosition != null && n.renglaPosition > max ? n.renglaPosition : max),
          0,
        );
        this.maxCordons.set(maxPos);
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
    if (this.isLocked()) return;
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

  onTroncNodeClicked(event: { nodeId: string; event: MouseEvent }): void {
    const target = event.event.currentTarget as HTMLElement | null;
    if (target) {
      const rect = target.getBoundingClientRect();
      this.popoverPosition.set({ x: rect.right, y: rect.top + rect.height / 2 });
    }
  }

  onPersonSelected(person: AvailablePerson): void {
    if (this.isLocked()) return;
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
    if (this.isLocked()) return;
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

  // ─── Cordons dialog ─────────────────────────────────────────────────────

  openCordonsDialog(): void {
    this.cordonsDialogOpen.set(true);
  }

  onCordonsSaved(event: CordonsDialogSaveEvent): void {
    const instanceId = this.state.activeInstanceId();
    if (!instanceId) return;

    this.cordonsDialogOpen.set(false);
    this.assignmentService.updateCordons(instanceId, {
      numberOfCordons: event.numberOfCordons,
      openCordons: event.openCordons.length > 0 ? event.openCordons : null,
    }).subscribe({
      next: (resp) => {
        this.tabs.update((list) =>
          list.map((t) =>
            t.instanceId === instanceId
              ? { ...t, numberOfCordons: resp.numberOfCordons, openCordons: resp.openCordons }
              : t,
          ),
        );
        this.refreshInstanceNodes(instanceId);
        this.toast.success('Configuració de cordons actualitzada.');
      },
      error: () => {
        this.toast.error('Error en actualitzar els cordons.');
      },
    });
  }

  onCordonsDialogClosed(): void {
    this.cordonsDialogOpen.set(false);
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
              ? { ...t, snapshotted: false, assignedCount: 0 }
              : t,
          ),
        );
        this.state.assignments.set([]);
        this.loadTabData(instanceId);
        this.loadTemplateRenglesForTab(instanceId);
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
