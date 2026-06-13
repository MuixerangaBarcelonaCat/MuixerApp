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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Location } from '@angular/common';
import { LucideAngularModule, ArrowLeft, Users, Edit, RefreshCw, Trash2, X, PanelLeft, PanelLeftClose, Monitor, Lock, SlidersHorizontal, Plus, HelpCircle, Undo2, Redo2, Save } from 'lucide-angular';
import { LayoutService } from '../../../../core/services/layout.service';
import { NodeAssignmentService, LockStatus } from '../../services/node-assignment.service';
import { AssignmentStateService } from '../../services/assignment-state.service';
import { EventSegmentService } from '../../services/event-segment.service';
import { FigureInstanceService } from '../../services/figure-instance.service';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';
import { FigureCanvasComponent } from '../figure-canvas/figure-canvas.component';
import { PersonPanelComponent } from '../person-panel/person-panel.component';
import { ImportPinyaModalComponent } from '../import-pinya-modal/import-pinya-modal.component';
import { TroncViewComponent } from '../tronc-view/tronc-view.component';
import { CordonsDialogComponent, CordonsDialogSaveEvent } from '../cordons-dialog/cordons-dialog.component';
import { AdHocNodesHelpModalComponent } from '../ad-hoc-nodes-help-modal/ad-hoc-nodes-help-modal.component';
import { AdHocNodePropertiesComponent } from '../ad-hoc-node-properties/ad-hoc-node-properties.component';
import { SaveAsTemplateDialogComponent, SaveAsTemplateResult } from '../save-as-template-dialog/save-as-template-dialog.component';
import {
  AssignmentDetail,
  AttendanceStatus,
  AvailablePerson,
  BulkImportResult,
  InstanceNodeItem,
  PendingOp,
  UpdateAdHocNodePayload,
} from '../../models/assignment.model';
import { SegmentDetail } from '../../models/segment.model';
import { FigureTemplateService } from '../../services/figure-template.service';
import { RenglaModel } from '../../models/figure-template.model';
import { FigureZone, AD_HOC_PINYA_PRESETS, AD_HOC_DECORATION_PRESETS, AD_HOC_DIRECTION_PRESETS, AdHocNodePreset } from '@muixer/shared';
import { repositionCordoObertNodes } from '../../utils/cordo-obert-reposition.util';
import { Observable } from 'rxjs';
import { UndoRedoService, UndoableAction } from '../../services/undo-redo.service';

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
    ImportPinyaModalComponent,
    TroncViewComponent,
    CordonsDialogComponent,
    AdHocNodesHelpModalComponent,
    AdHocNodePropertiesComponent,
    SaveAsTemplateDialogComponent,
  ],
  templateUrl: './assignment-canvas.component.html',
  styleUrl: './assignment-canvas.component.scss',
  providers: [UndoRedoService],
})
export class AssignmentCanvasComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly layout = inject(LayoutService);
  private readonly assignmentService = inject(NodeAssignmentService);
  private readonly segmentService = inject(EventSegmentService);
  private readonly figureTemplateService = inject(FigureTemplateService);
  private readonly instanceService = inject(FigureInstanceService);
  private readonly toast = inject(ToastService);
  readonly state = inject(AssignmentStateService);
  readonly undoRedo = inject(UndoRedoService);

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
  readonly Plus = Plus;
  readonly HelpCircle = HelpCircle;
  readonly Undo2 = Undo2;
  readonly Redo2 = Redo2;
  readonly SaveIcon = Save;

  readonly saveAsTemplateOpen = signal(false);

  readonly adHocPresets = AD_HOC_PINYA_PRESETS;
  readonly decorationPresets = AD_HOC_DECORATION_PRESETS;
  readonly directionPresets = AD_HOC_DIRECTION_PRESETS;

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
  readonly adHocPropertiesOpen = signal(false);

  readonly deleteAdHocModalOpen = signal(false);
  readonly pendingDeleteNodeId = signal<string | null>(null);
  readonly pendingDeleteNodeLabel = computed(() => {
    const nodeId = this.pendingDeleteNodeId();
    if (!nodeId) return '';
    return this.activeNodes().find((n) => n.id === nodeId)?.label ?? '';
  });
  readonly pendingDeletePersonName = computed(() => {
    const nodeId = this.pendingDeleteNodeId();
    if (!nodeId) return '';
    const assignment = this.state.assignments().find((a) => a.node.id === nodeId);
    if (!assignment) return '';
    return assignment.person.alias || `${assignment.person.name} ${assignment.person.firstSurname}`;
  });
  readonly helpModalOpen = signal(false);
  readonly comodinInputOpen = signal(false);
  readonly comodinLabel = signal('');
  readonly clipboardAdHocNode = signal<{ zone: string; positionType: string | null; label: string; width: number; height: number; shape: string; color: string | null; rotation: number } | null>(null);
  readonly fabDropdownOpen = signal(false);
  readonly fabDecorationOpen = signal(false);
  readonly fabDirectionOpen = signal(false);

  private lastMoveUndoTime = 0;
  private lastMoveNodeId: string | null = null;
  private moveOrigin: { x: number; y: number } | null = null;
  private static readonly MOVE_COALESCE_MS = 500;

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

  /** Selected ad-hoc node (null if selection is a template node or nothing). */
  readonly selectedAdHocNode = computed(() => {
    const node = this.selectedNode();
    return node?.isAdHoc ? node : null;
  });

  /** Ad-hoc node to show in the properties panel (only when panel explicitly opened via double-click). */
  readonly adHocNodeForPanel = computed(() => {
    if (!this.adHocPropertiesOpen()) return null;
    return this.selectedAdHocNode();
  });

  /** Assignment for the selected ad-hoc node (if any). */
  readonly selectedAdHocAssignment = computed(() => {
    const node = this.selectedAdHocNode();
    if (!node) return null;
    return this.state.assignments().find((a) => a.node.id === node.id) ?? null;
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
    this.undoRedo.clear();
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
      if (this.fabDropdownOpen()) {
        this.fabDropdownOpen.set(false);
        return;
      }
      if (this.fabDecorationOpen()) {
        this.fabDecorationOpen.set(false);
        return;
      }
      if (this.fabDirectionOpen()) {
        this.fabDirectionOpen.set(false);
        return;
      }
      if (this.state.isPlacementMode()) {
        this.state.exitPlacementMode();
        return;
      }
      if (this.deleteAdHocModalOpen()) {
        this.cancelDeleteAdHocNode();
        return;
      }
      if (this.adHocPropertiesOpen()) {
        this.adHocPropertiesOpen.set(false);
        return;
      }
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

    if ((event.key === 'Delete' || event.key === 'Backspace') && !this.isLocked()) {
      const selectedId = this.state.selectedNodeId();
      if (!selectedId) return;
      const node = this.activeNodes().find((n) => n.id === selectedId);
      if (!node?.isAdHoc) return;
      event.preventDefault();

      const isAssigned = this.state.assignments().some((a) => a.node.id === selectedId);
      if (isAssigned) {
        this.pendingDeleteNodeId.set(selectedId);
        this.deleteAdHocModalOpen.set(true);
      } else {
        this.deleteAdHocNode(selectedId);
      }
      return;
    }

    const ARROW_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    if (ARROW_KEYS.includes(event.key) && !this.isLocked()) {
      const selectedId = this.state.selectedNodeId();
      if (!selectedId) return;
      const node = this.activeNodes().find((n) => n.id === selectedId);
      if (!node?.isAdHoc) return;
      event.preventDefault();
      this.moveAdHocNodeByKey(selectedId, node, event.key, event.shiftKey);
      return;
    }

    if (event.key === 'z' && (event.ctrlKey || event.metaKey) && !event.shiftKey && !this.isLocked()) {
      event.preventDefault();
      this.performUndo();
      return;
    }

    if (event.key === 'z' && (event.ctrlKey || event.metaKey) && event.shiftKey && !this.isLocked()) {
      event.preventDefault();
      this.performRedo();
      return;
    }

    if (event.key === 'c' && (event.ctrlKey || event.metaKey) && !this.isLocked()) {
      event.preventDefault();
      this.copySelectedAdHocNode();
      return;
    }

    if (event.key === 'v' && (event.ctrlKey || event.metaKey) && !this.isLocked()) {
      event.preventDefault();
      this.pasteAdHocNode();
      return;
    }

    if (event.key === 'd' && (event.ctrlKey || event.metaKey) && !this.isLocked()) {
      event.preventDefault();
      const node = this.selectedAdHocNode();
      if (!node) return;
      this.duplicateAdHocNode(node);
      return;
    }

    // Keyboard shortcuts
    if (event.ctrlKey || event.metaKey) {
      const digit = parseInt(event.key, 10);
      if (
        digit >= 1 && digit <= 9
        && !this.isLocked()
        && this.activeTab()
        && !this.state.isPlacementMode()
        && !this.helpModalOpen()
        && !this.comodinInputOpen()
        && !this.deleteAdHocModalOpen()
      ) {
        event.preventDefault();
        const preset = this.adHocPresets[digit - 1];
        if (preset) this.onPresetSelected(preset);
        return;
      }
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

    const instanceId = this.route.snapshot.params['instanceId'] ?? null;
    const targetId = instanceId ?? tabBuilders[0]?.instanceId;
    if (targetId) {
      this.selectTab(targetId);
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
    this.adHocPropertiesOpen.set(false);
    this.highlightedNodeIds.set(new Set());
    this.undoRedo.clear();
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
        if (this.state.activeInstanceId() === instanceId) {
          this.state.activeTabNodes.set(resp.data);
        }
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

  onCanvasClicked(event: { x: number; y: number }): void {
    this.fabDropdownOpen.set(false);
    if (!this.state.isPlacementMode()) return;
    const preset = this.state.placementPreset();
    if (!preset) return;

    const instanceId = this.state.activeInstanceId();
    if (!instanceId) return;

    const label = preset.requiresCustomLabel
      ? (this.state.placementCustomLabel() || 'Comodí')
      : preset.label;

    const createPayload = {
      zone: preset.zone,
      positionType: preset.positionType ?? undefined,
      label,
      x: event.x,
      y: event.y,
      width: preset.width,
      height: preset.height,
      shape: preset.shape,
      color: preset.color ?? undefined,
    };

    this.assignmentService.createAdHocNode(instanceId, createPayload).subscribe({
      next: (created) => {
        this.state.exitPlacementMode();
        this.refreshInstanceNodes(instanceId);
        this.toast.success(`Node "${label}" creat.`);

        let lastCreatedId = created.id;
        const action: UndoableAction = {
          type: 'CREATE',
          description: `Crear ${label}`,
          execute: () => {
            const obs = this.assignmentService.createAdHocNode(instanceId, createPayload);
            return new Observable<void>((sub) => {
              obs.subscribe({
                next: (re) => { lastCreatedId = re.id; sub.next(); sub.complete(); },
                error: (err) => sub.error(err),
              });
            });
          },
          undo: () => this.assignmentService.deleteAdHocNode(instanceId, lastCreatedId),
        };
        this.undoRedo.push(action);
      },
      error: (err) => {
        this.state.exitPlacementMode();
        const msg = err?.error?.message ?? 'Error en crear el node.';
        this.toast.error(msg);
      },
    });
  }

  onNodeSelected(nodeId: string | null): void {
    this.fabDropdownOpen.set(false);
    this.fabDecorationOpen.set(false);
    this.fabDirectionOpen.set(false);
    if (this.isLocked()) return;

    const previousNodeId = this.state.selectedNodeId();
    if (nodeId !== previousNodeId) {
      this.adHocPropertiesOpen.set(false);
    }

    if (!nodeId) {
      this.state.setSelectedNodeId(null);
      this.popoverAssignment.set(null);
      return;
    }

    const activeNodes = this.activePinyaNodes();
    const clickedNode = activeNodes.find((n) => n.id === nodeId);
    const isDecorationNode = clickedNode?.zone === FigureZone.DECORATION;

    if (isDecorationNode) {
      this.state.setSelectedNodeId(nodeId);
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

  onNodeDoubleClicked(nodeId: string): void {
    const node = this.activeNodes().find((n) => n.id === nodeId);
    if (node?.isAdHoc) {
      this.adHocPropertiesOpen.set(true);
    }
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

    const selectedNodeData = this.activeNodes().find((n) => n.id === selectedNodeId);
    if (selectedNodeData?.zone === FigureZone.DECORATION) {
      this.toast.error('Els nodes decoratius no es poden assignar.');
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

        if (tab && !tab.snapshotted) {
          this.refreshInstanceNodes(instanceId);
        }

        this.updateTabCount(instanceId);
        this.state.refreshPersonList();
        this.advanceToNextEmptyNode(created.node.id);

        let lastAssignId = created.id;
        const action: UndoableAction = {
          type: 'ASSIGN',
          description: `Assignar persona`,
          execute: () => {
            const obs = this.assignmentService.assign(instanceId, { nodeId, personId });
            return new Observable<void>((sub) => {
              obs.subscribe({
                next: (re) => { lastAssignId = re.id; sub.next(); sub.complete(); },
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
        if (this.state.activeInstanceId() === instanceId) {
          this.state.activeTabNodes.set(resp.data);
        }
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

    const nodeId = assignment.node.id;
    const personId = assignment.person.id;
    const snapshot = [...this.state.assignments()];
    this.state.assignments.update((list) => list.filter((a) => a.id !== assignment.id));
    this.popoverAssignment.set(null);
    this.state.setSelectedNodeId(null);

    this.assignmentService.unassign(instanceId, assignment.id).subscribe({
      next: () => {
        this.updateTabCount(instanceId);
        this.state.refreshPersonList();

        let lastAssignmentId = assignment.id;
        const action: UndoableAction = {
          type: 'UNASSIGN',
          description: `Desassignar persona`,
          execute: () => this.assignmentService.unassign(instanceId, lastAssignmentId),
          undo: () => {
            const obs = this.assignmentService.assign(instanceId, { nodeId, personId });
            return new Observable<void>((sub) => {
              obs.subscribe({
                next: (created) => { lastAssignmentId = created.id; sub.next(); sub.complete(); },
                error: (err) => sub.error(err),
              });
            });
          },
        };
        this.undoRedo.push(action);
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
        if (resp.removedAssignments > 0) {
          this.toast.warning(
            `S'han desassignat ${resp.removedAssignments} persones dels cordons eliminats.`,
          );
        } else {
          this.toast.success('Configuració de cordons actualitzada.');
        }
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

    this.undoRedo.clear();
    this.resetting.set(true);
    this.assignmentService.resetSnapshot(instanceId).subscribe({
      next: (result) => {
        this.resetting.set(false);
        this.resetModalOpen.set(false);
        let resetMsg = `S'han eliminat ${result.removedAssignments} assignacions. La figura torna al template original.`;
        if (result.deletedAdHocCount > 0) {
          resetMsg += ` S'han eliminat ${result.deletedAdHocCount} nodes ad-hoc.`;
        }
        this.toast.success(resetMsg);

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
    let msg = result.conflicts.length > 0
      ? `Importades ${result.created.length} assignacions (${result.conflicts.length} conflictes omesos).`
      : `Importades ${result.created.length} assignacions correctament.`;
    if (result.clonedAdHocNodes > 0) {
      msg += ` S'han clonat ${result.clonedAdHocNodes} nodes ad-hoc.`;
    }
    this.toast.success(msg);
    this.importModalOpen.set(false);
    const instanceId = this.state.activeInstanceId();
    if (instanceId) {
      this.refreshInstanceNodes(instanceId);
    }
  }

  // ── Ad-hoc node operations ──────────────────────────────────────────────

  readonly pendingLabelPreset = signal<AdHocNodePreset | null>(null);

  onPresetSelected(preset: AdHocNodePreset): void {
    this.fabDropdownOpen.set(false);
    this.fabDecorationOpen.set(false);
    this.fabDirectionOpen.set(false);
    if (preset.requiresCustomLabel) {
      this.pendingLabelPreset.set(preset);
      this.comodinInputOpen.set(true);
      this.comodinLabel.set('');
      return;
    }
    this.state.enterPlacementMode(preset);
  }

  confirmComodinLabel(): void {
    const label = this.comodinLabel().trim();
    if (!label) return;
    const preset = this.pendingLabelPreset();
    if (!preset) return;
    this.comodinInputOpen.set(false);
    this.pendingLabelPreset.set(null);
    this.state.enterPlacementMode(preset, label);
  }

  cancelComodinInput(): void {
    this.comodinInputOpen.set(false);
    this.comodinLabel.set('');
    this.pendingLabelPreset.set(null);
  }

  readonly labelDialogTitle = computed(() => {
    const preset = this.pendingLabelPreset();
    return preset?.zone === FigureZone.DECORATION
      ? 'Etiqueta del node decoratiu'
      : 'Etiqueta del comodí';
  });

  readonly labelDialogPlaceholder = computed(() => {
    const preset = this.pendingLabelPreset();
    return preset?.zone === FigureZone.DECORATION
      ? 'Ex: Església, Nord, Escenari...'
      : 'Ex: Extra mans, Reforç...';
  });

  getDecorationLabel(preset: AdHocNodePreset): string {
    const labels: Record<string, string> = {
      rectangle: 'Rectangle',
      arrow: 'Fletxa',
      circle: 'Cercle',
    };
    return labels[preset.positionType ?? ''] ?? preset.positionType ?? '';
  }

  onAdHocNodeMoved(event: { nodeId: string; x: number; y: number }): void {
    const instanceId = this.state.activeInstanceId();
    if (!instanceId) return;

    const now = Date.now();
    const node = this.activeNodes().find((n) => n.id === event.nodeId);
    const isCoalescing =
      event.nodeId === this.lastMoveNodeId &&
      now - this.lastMoveUndoTime < AssignmentCanvasComponent.MOVE_COALESCE_MS;

    if (!isCoalescing) {
      this.moveOrigin = { x: node?.x ?? event.x, y: node?.y ?? event.y };
      this.lastMoveNodeId = event.nodeId;
    }
    this.lastMoveUndoTime = now;
    const origin = this.moveOrigin!;

    this.tabs.update((list) =>
      list.map((t) =>
        t.instanceId === instanceId
          ? {
              ...t,
              nodes: t.nodes.map((n) =>
                n.id === event.nodeId ? { ...n, x: event.x, y: event.y } : n,
              ),
            }
          : t,
      ),
    );

    this.assignmentService
      .updateAdHocNode(instanceId, event.nodeId, { x: event.x, y: event.y })
      .subscribe({
        next: () => {
          const finalX = event.x;
          const finalY = event.y;
          const action: UndoableAction = {
            type: 'MOVE',
            description: `Moure ${node?.label ?? 'node'}`,
            execute: () => this.assignmentService.updateAdHocNode(instanceId, event.nodeId, { x: finalX, y: finalY }),
            undo: () => this.assignmentService.updateAdHocNode(instanceId, event.nodeId, { x: origin.x, y: origin.y }),
          };
          if (isCoalescing) {
            this.undoRedo.replaceLast(action);
          } else {
            this.undoRedo.push(action);
          }
        },
        error: () => {
          this.toast.error('Error en moure el node.');
          this.refreshInstanceNodes(instanceId);
        },
      });
  }

  onAdHocNodeTransformed(event: {
    nodeId: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
  }): void {
    const instanceId = this.state.activeInstanceId();
    if (!instanceId) return;

    const node = this.activeNodes().find((n) => n.id === event.nodeId);
    const prevGeometry = node
      ? { x: node.x, y: node.y, width: node.width, height: node.height, rotation: node.rotation }
      : null;
    const newGeometry = { x: event.x, y: event.y, width: event.width, height: event.height, rotation: event.rotation };

    this.assignmentService
      .updateAdHocNode(instanceId, event.nodeId, newGeometry)
      .subscribe({
        next: () => {
          this.refreshInstanceNodes(instanceId);
          if (prevGeometry) {
            const action: UndoableAction = {
              type: 'RESIZE',
              description: `Redimensionar ${node?.label ?? 'node'}`,
              execute: () => this.assignmentService.updateAdHocNode(instanceId, event.nodeId, newGeometry),
              undo: () => this.assignmentService.updateAdHocNode(instanceId, event.nodeId, prevGeometry),
            };
            this.undoRedo.push(action);
          }
        },
        error: () => {
          this.toast.error('Error en redimensionar el node.');
          this.refreshInstanceNodes(instanceId);
        },
      });
  }

  deleteAdHocNode(nodeId: string): void {
    const instanceId = this.state.activeInstanceId();
    if (!instanceId) return;

    const node = this.activeNodes().find((n) => n.id === nodeId);
    const assignment = this.state.assignments().find((a) => a.node.id === nodeId);
    const snapshotData = node ? {
      zone: node.zone,
      positionType: node.positionType ?? undefined,
      label: node.label,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      shape: node.shape,
      color: node.color ?? undefined,
      rotation: node.rotation,
    } : null;

    this.state.setSelectedNodeId(null);
    this.assignmentService.deleteAdHocNode(instanceId, nodeId).subscribe({
      next: () => {
        this.refreshInstanceNodes(instanceId);
        this.state.refreshPersonList();
        this.toast.success('Node eliminat.');

        if (snapshotData) {
          let lastKnownNodeId = nodeId;
          const action: UndoableAction = {
            type: 'DELETE',
            description: `Eliminar ${snapshotData.label}`,
            execute: () => this.assignmentService.deleteAdHocNode(instanceId, lastKnownNodeId),
            undo: () => {
              const obs = this.assignmentService.createAdHocNode(instanceId, snapshotData);
              return new Observable<void>((sub) => {
                obs.subscribe({
                  next: (recreated) => {
                    lastKnownNodeId = recreated.id;
                    sub.next();
                    sub.complete();
                  },
                  error: (err) => sub.error(err),
                });
              });
            },
          };
          this.undoRedo.push(action);
        }
      },
      error: () => this.toast.error('Error en eliminar el node.'),
    });
  }

  private copySelectedAdHocNode(): void {
    const node = this.selectedAdHocNode();
    if (!node) return;
    this.clipboardAdHocNode.set({
      zone: node.zone,
      positionType: node.positionType,
      label: node.label,
      width: node.width,
      height: node.height,
      shape: node.shape,
      color: node.color,
      rotation: node.rotation,
    });
    this.toast.success('Node copiat.');
  }

  private pasteAdHocNode(): void {
    const clipboard = this.clipboardAdHocNode();
    if (!clipboard) return;
    const instanceId = this.state.activeInstanceId();
    if (!instanceId) return;

    const selectedNode = this.selectedAdHocNode();
    const baseX = selectedNode?.x ?? 100;
    const baseY = selectedNode?.y ?? 100;

    const pastePayload = {
      zone: clipboard.zone,
      positionType: clipboard.positionType ?? undefined,
      label: clipboard.label,
      x: baseX + 20,
      y: baseY + 20,
      width: clipboard.width,
      height: clipboard.height,
      shape: clipboard.shape,
      color: clipboard.color ?? undefined,
      rotation: clipboard.rotation,
    };

    this.assignmentService.createAdHocNode(instanceId, pastePayload).subscribe({
      next: (created) => {
        this.refreshInstanceNodes(instanceId);
        this.toast.success(`Node "${clipboard.label}" enganxat.`);

        let lastPastedId = created.id;
        const action: UndoableAction = {
          type: 'CREATE',
          description: `Enganxar ${clipboard.label}`,
          execute: () => {
            const obs = this.assignmentService.createAdHocNode(instanceId, pastePayload);
            return new Observable<void>((sub) => {
              obs.subscribe({
                next: (re) => { lastPastedId = re.id; sub.next(); sub.complete(); },
                error: (err) => sub.error(err),
              });
            });
          },
          undo: () => this.assignmentService.deleteAdHocNode(instanceId, lastPastedId),
        };
        this.undoRedo.push(action);
      },
      error: () => this.toast.error('Error en enganxar el node.'),
    });
  }

  duplicateSelectedAdHocNode(): void {
    const node = this.selectedAdHocNode();
    if (!node) return;
    this.duplicateAdHocNode(node);
  }

  private duplicateAdHocNode(node: { id: string; zone: string; positionType: string | null; label: string; x: number; y: number; width: number; height: number; shape: string; color: string | null; rotation: number }): void {
    const instanceId = this.state.activeInstanceId();
    if (!instanceId) return;

    const dupPayload = {
      zone: node.zone,
      positionType: node.positionType ?? undefined,
      label: node.label,
      x: node.x + 20,
      y: node.y + 20,
      width: node.width,
      height: node.height,
      shape: node.shape,
      color: node.color ?? undefined,
      rotation: node.rotation,
    };

    this.assignmentService.createAdHocNode(instanceId, dupPayload).subscribe({
      next: (created) => {
        this.refreshInstanceNodes(instanceId);
        this.toast.success(`Node "${node.label}" duplicat.`);

        let lastDupId = created.id;
        const action: UndoableAction = {
          type: 'CREATE',
          description: `Duplicar ${node.label}`,
          execute: () => {
            const obs = this.assignmentService.createAdHocNode(instanceId, dupPayload);
            return new Observable<void>((sub) => {
              obs.subscribe({
                next: (re) => { lastDupId = re.id; sub.next(); sub.complete(); },
                error: (err) => sub.error(err),
              });
            });
          },
          undo: () => this.assignmentService.deleteAdHocNode(instanceId, lastDupId),
        };
        this.undoRedo.push(action);
      },
      error: () => this.toast.error('Error en duplicar el node.'),
    });
  }

  confirmDeleteAdHocNode(): void {
    const nodeId = this.pendingDeleteNodeId();
    if (!nodeId) return;
    this.deleteAdHocModalOpen.set(false);
    this.pendingDeleteNodeId.set(null);
    this.deleteAdHocNode(nodeId);
  }

  cancelDeleteAdHocNode(): void {
    this.deleteAdHocModalOpen.set(false);
    this.pendingDeleteNodeId.set(null);
  }

  openHelpModal(): void {
    this.helpModalOpen.set(true);
  }

  closeHelpModal(): void {
    this.helpModalOpen.set(false);
  }

  private moveAdHocNodeByKey(nodeId: string, node: InstanceNodeItem, key: string, large: boolean): void {
    const step = large ? 10 : 1;
    const delta: Record<string, { x: number; y: number }> = {
      ArrowUp:    { x: 0,     y: -step },
      ArrowDown:  { x: 0,     y:  step },
      ArrowLeft:  { x: -step, y: 0     },
      ArrowRight: { x:  step, y: 0     },
    };
    const d = delta[key];
    if (!d) return;

    const newX = node.x + d.x;
    const newY = node.y + d.y;
    this.onAdHocNodeMoved({ nodeId, x: newX, y: newY });
  }

  onAdHocPropertyChanged(event: { nodeId: string; patch: Partial<UpdateAdHocNodePayload> }): void {
    const instanceId = this.state.activeInstanceId();
    if (!instanceId) return;

    const node = this.activeNodes().find((n) => n.id === event.nodeId);
    const reversePatch: Partial<UpdateAdHocNodePayload> = {};
    if (node) {
      for (const key of Object.keys(event.patch) as (keyof UpdateAdHocNodePayload)[]) {
        if (key in node) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (reversePatch as any)[key] = (node as any)[key];
        }
      }
    }

    this.tabs.update((list) =>
      list.map((t) =>
        t.instanceId === instanceId
          ? { ...t, nodes: t.nodes.map((n) => n.id === event.nodeId ? { ...n, ...event.patch } : n) }
          : t,
      ),
    );

    this.assignmentService.updateAdHocNode(instanceId, event.nodeId, event.patch).subscribe({
      next: () => {
        const action: UndoableAction = {
          type: 'PROPERTY_CHANGE',
          description: `Canviar propietat`,
          execute: () => this.assignmentService.updateAdHocNode(instanceId, event.nodeId, event.patch),
          undo: () => this.assignmentService.updateAdHocNode(instanceId, event.nodeId, reversePatch),
        };
        this.undoRedo.push(action);
      },
      error: () => {
        this.toast.error('Error en actualitzar el node.');
        this.refreshInstanceNodes(instanceId);
      },
    });
  }

  onAdHocNodeUpdated(): void {
    const instanceId = this.state.activeInstanceId();
    if (instanceId) {
      this.refreshInstanceNodes(instanceId);
    }
  }

  onAdHocDeleteFromPanel(nodeId: string): void {
    const isAssigned = this.state.assignments().some((a) => a.node.id === nodeId);
    if (isAssigned) {
      this.pendingDeleteNodeId.set(nodeId);
      this.deleteAdHocModalOpen.set(true);
    } else {
      this.deleteAdHocNode(nodeId);
    }
  }

  // ── Undo / Redo ─────────────────────────────────────────────────────────

  performUndo(): void {
    this.undoRedo.undo().subscribe({
      next: () => {
        const instanceId = this.state.activeInstanceId();
        if (instanceId) this.refreshInstanceNodes(instanceId);
      },
      error: () => this.toast.error("Error en desfer l'acció."),
    });
  }

  performRedo(): void {
    this.undoRedo.redo().subscribe({
      next: () => {
        const instanceId = this.state.activeInstanceId();
        if (instanceId) this.refreshInstanceNodes(instanceId);
      },
      error: () => this.toast.error("Error en refer l'acció."),
    });
  }

  openSaveAsTemplate(): void {
    this.saveAsTemplateOpen.set(true);
  }

  onSaveAsTemplateClosed(): void {
    this.saveAsTemplateOpen.set(false);
  }

  onSaveAsTemplateResult(_result: SaveAsTemplateResult): void {
    this.saveAsTemplateOpen.set(false);
  }

  onEditTemplate(): void {
    const templateId = this.activeTab()?.figureTemplateId;
    if (!templateId) return;
    this.toast.info('Els canvis al template no afecten instàncies ja creades.');
    this.router.navigate(['/pinyes', 'templates', templateId, 'edit']);
  }

  getAttendanceStatus(assignment: AssignmentDetail): string | null {
    return this.attendanceMap().get(assignment.person.id) ?? null;
  }

  goBack(): void {
    this.location.back();
  }
}
