import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Location } from '@angular/common';
import {
  LucideAngularModule,
  ArrowLeft, Users, Edit, RefreshCw, Trash2, X, PanelLeft, PanelLeftClose, Monitor, Lock, SlidersHorizontal,
} from 'lucide-angular';
import { LayoutService } from '../../../../core/services/layout.service';
import { NodeAssignmentService, LockStatus } from '../../services/node-assignment.service';
import { AssignmentStateService } from '../../services/assignment-state.service';
import { FigureCanvasComponent } from '../figure-canvas/figure-canvas.component';
import { PersonPanelComponent } from '../person-panel/person-panel.component';
import { NodePopoverComponent } from '../node-popover/node-popover.component';
import { ImportPinyaModalComponent } from '../import-pinya-modal/import-pinya-modal.component';
import { TroncViewComponent } from '../tronc-view/tronc-view.component';
import { CordonsDialogComponent, CordonsDialogSaveEvent } from '../cordons-dialog/cordons-dialog.component';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { FloatingPanelDragDirective } from '../../../../shared/directives/floating-panel-drag.directive';
import {
  AssignmentDetail,
  AttendanceStatus,
  AvailablePerson,
  BulkImportResult,
} from '../../models/assignment.model';
import { FigureZone } from '@muixer/shared';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';
import { AssignmentTabService, InstanceTab } from './services/assignment-tab.service';
import { AssignmentOperationsService } from './services/assignment-operations.service';

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
    FloatingPanelDragDirective,
    CdkTrapFocus,
  ],
  providers: [AssignmentTabService, AssignmentOperationsService],
  templateUrl: './assignment-canvas.component.html',
  styleUrl: './assignment-canvas.component.scss',
})
export class AssignmentCanvasComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly layout = inject(LayoutService);
  private readonly assignmentService = inject(NodeAssignmentService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly state = inject(AssignmentStateService);
  readonly tab = inject(AssignmentTabService);
  readonly ops = inject(AssignmentOperationsService);

  // ── Icons ────────────────────────────────────────────────────────────────
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

  // ── Route params ─────────────────────────────────────────────────────────
  readonly eventId = signal('');
  readonly segmentId = signal('');

  // ── UI-only state ────────────────────────────────────────────────────────
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
  readonly troncPanelOpen = signal(false);
  readonly cordonsDialogOpen = signal(false);

  // ── Computed ─────────────────────────────────────────────────────────────
  readonly isLocked = computed(() => this.lockStatus()?.locked ?? false);

  // ── Tab aliases (for backward-compatible template bindings) ──────────────
  readonly tabs = this.tab.tabs;
  readonly segment = this.tab.segment;
  readonly loading = this.tab.loading;
  readonly templateRengles = this.tab.templateRengles;
  readonly maxCordons = this.tab.maxCordons;
  readonly activeTab = this.tab.activeTab;
  readonly activeNodes = this.tab.activeNodes;
  readonly activePinyaNodes = this.tab.activePinyaNodes;
  readonly activeTroncNodes = this.tab.activeTroncNodes;
  readonly activeBaseNodes = this.tab.activeBaseNodes;
  readonly renglesWithCordoObert = this.tab.renglesWithCordoObert;
  readonly hasCordonsConfig = this.tab.hasCordonsConfig;

  readonly selectedNode = computed(() => {
    const id = this.state.selectedNodeId();
    return id ? (this.activeNodes().find((n) => n.id === id) ?? null) : null;
  });

  readonly assignmentProgress = computed(() => {
    const t = this.activeTab();
    return t ? `${t.assignedCount}/${t.totalCount}` : '';
  });

  readonly troncAttendanceMap = computed(
    () => this.state.attendanceRegistry() as Map<string, AttendanceStatus>,
  );

  readonly attendanceMap = computed(() => this.state.attendanceRegistry());
  readonly nextPerformanceMap = computed(() => this.state.nextPerformanceRegistry());

  ngOnInit(): void {
    this.layout.requestFullscreen();
    const params = this.route.snapshot.params;
    this.eventId.set(params['eventId']);
    this.segmentId.set(params['segmentId']);
    this.state.reset();
    this.tab.init(this.eventId(), this.segmentId());

    this.assignmentService.getLockStatus(this.eventId()).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (status) => this.lockStatus.set(status),
    });
  }

  ngOnDestroy(): void {
    this.layout.exitFullscreen();
  }

  // ── Keyboard handler ─────────────────────────────────────────────────────

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
      this.ops.advanceToNextEmptyNodeFromCurrent();
    }
  }

  // ── Tab management ───────────────────────────────────────────────────────

  selectTab(instanceId: string): void {
    this.popoverAssignment.set(null);
    this.highlightedNodeIds.set(new Set());
    this.tab.selectTab(instanceId);
  }

  // ── Canvas events ─────────────────────────────────────────────────────────

  onNodeSelected(nodeId: string | null): void {
    if (this.isLocked()) return;
    if (!nodeId) {
      this.state.setSelectedNodeId(null);
      this.popoverAssignment.set(null);
      return;
    }

    const clickedAssignment = this.state.assignments().find((a) => a.node.id === nodeId);
    const prevNodeId = this.state.selectedNodeId();
    const prevAssignment = prevNodeId
      ? this.state.assignments().find((a) => a.node.id === prevNodeId)
      : null;

    if (clickedAssignment && prevAssignment && prevNodeId !== nodeId) {
      this.ops.triggerSwap(prevAssignment, clickedAssignment);
      this.state.setSelectedNodeId(null);
      this.popoverAssignment.set(null);
    } else if (clickedAssignment) {
      this.popoverAssignment.set(clickedAssignment);
      this.state.setSelectedNodeId(nodeId);
    } else {
      const pendingPersonId = this.state.selectedPersonId();
      this.state.setSelectedNodeId(nodeId);
      this.popoverAssignment.set(null);
      if (pendingPersonId) {
        this.ops.triggerAssign(nodeId, pendingPersonId);
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

  // ── Person panel events ───────────────────────────────────────────────────

  onPersonSelected(person: AvailablePerson): void {
    if (this.isLocked()) return;
    const selectedNodeId = this.state.selectedNodeId();

    if (!selectedNodeId) {
      this.state.setSelectedPersonId(person.id);
      return;
    }

    const existingAssignment = this.state.assignments().find((a) => a.node.id === selectedNodeId);
    if (existingAssignment) {
      this.ops.triggerUnassignThenAssign(existingAssignment, selectedNodeId, person.id);
    } else {
      this.ops.triggerAssign(selectedNodeId, person.id);
    }
  }

  onAssignedPersonSelected(event: { personId: string; instanceId: string }): void {
    const targetTab = this.tabs().find((t) => t.instanceId === event.instanceId);
    if (!targetTab) return;

    this.selectTab(event.instanceId);

    this.assignmentService.getByInstance(event.instanceId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (resp) => {
        const assignment = resp.data.find((a) => a.person.id === event.personId);
        if (assignment) this.state.setSelectedNodeId(assignment.node.id);
      },
    });
  }

  onUnassign(assignment: AssignmentDetail): void {
    if (this.isLocked()) return;
    this.popoverAssignment.set(null);
    this.ops.unassign(assignment);
  }

  // ── Cordons ───────────────────────────────────────────────────────────────

  openCordonsDialog(): void {
    this.cordonsDialogOpen.set(true);
  }

  onCordonsSaved(event: CordonsDialogSaveEvent): void {
    this.ops.saveCordons(event, () => this.cordonsDialogOpen.set(false));
  }

  onCordonsDialogClosed(): void {
    this.cordonsDialogOpen.set(false);
  }

  // ── Reset snapshot ────────────────────────────────────────────────────────

  openResetModal(): void {
    this.resetModalOpen.set(true);
  }

  confirmReset(): void {
    this.resetting.set(true);
    this.ops.resetSnapshot(
      (removed) => {
        this.resetting.set(false);
        this.resetModalOpen.set(false);
        this.toastService.success(`S'han eliminat ${removed} assignacions. La figura torna al template original.`);
      },
      () => {
        this.resetting.set(false);
        this.resetModalOpen.set(false);
      },
    );
  }

  cancelReset(): void {
    this.resetModalOpen.set(false);
  }

  // ── Delete instance ───────────────────────────────────────────────────────

  openDeleteInstanceModal(t: InstanceTab): void {
    this.pendingDeleteTab.set(t);
    this.deleteInstanceModalOpen.set(true);
  }

  cancelDeleteInstance(): void {
    this.deleteInstanceModalOpen.set(false);
    this.pendingDeleteTab.set(null);
  }

  confirmDeleteInstance(): void {
    const t = this.pendingDeleteTab();
    if (!t) return;
    this.deletingInstance.set(true);
    this.ops.deleteInstance(
      t.instanceId,
      t.label,
      () => this.goBack(),
      () => {
        this.deletingInstance.set(false);
        this.deleteInstanceModalOpen.set(false);
        this.pendingDeleteTab.set(null);
      },
      () => {
        this.deletingInstance.set(false);
      },
    );
  }

  // ── Import ────────────────────────────────────────────────────────────────

  onImportCompleted(result: BulkImportResult): void {
    this.importModalOpen.set(false);
    this.ops.handleImportCompleted(result);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  getAttendanceStatus(assignment: AssignmentDetail): string | null {
    return this.attendanceMap().get(assignment.person.id) ?? null;
  }

  goBack(): void {
    this.location.back();
  }
}
