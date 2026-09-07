import { BulkImportResult, SegmentNodeRef } from '@muixer/pinyes-render';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideAngularModule, ArrowLeft, ChevronLeft, ChevronRight, Shapes, Monitor, Lock, CircleQuestionMark, Trash2 } from 'lucide-angular';
import { DOMAIN_ICONS } from '../../../../shared/constants/domain-icons';
import { LayoutService } from '../../../../core/services/layout.service';
import { FiguresViewModeService, FiguresViewMode } from '../../services/figures-view-mode.service';
import { ToastService, TabsComponent, TabDef, ButtonComponent, BadgeComponent, ModalComponent } from '@muixer/ui';
import { SegmentWorkspaceStateService, WorkspaceInstance } from '../../services/segment-workspace-state.service';
import { AssignmentStateService } from '../../services/assignment-state.service';
import { NodeAssignmentService } from '../../services/node-assignment.service';
import { ConflictResolutionService } from '../../services/conflict-resolution.service';
import { UndoRedoService } from '../../services/undo-redo.service';
import { PinyesTabComponent } from './tabs/pinyes-tab/pinyes-tab.component';
import { TroncsTabComponent } from './tabs/troncs-tab/troncs-tab.component';
import { DistribucioTabComponent } from './tabs/distribucio-tab/distribucio-tab.component';
import { NodesTabComponent } from './tabs/nodes-tab/nodes-tab.component';
import { PrevisualitzaTabComponent } from './tabs/previsualitza-tab/previsualitza-tab.component';
import { TemplateEditorHelpModalComponent } from '../template-editor-help-modal/template-editor-help-modal.component';
import { SegmentConflictPanelComponent } from '../segment-conflict-panel/segment-conflict-panel.component';
import { ImportPinyaModalComponent } from '../import-pinya-modal/import-pinya-modal.component';

export type WorkspaceTab = 'pinyes' | 'troncs' | 'distribucio' | 'nodes' | 'previsualitza';

const WORKSPACE_TABS: WorkspaceTab[] = ['pinyes', 'troncs', 'distribucio', 'nodes', 'previsualitza'];

const isFiguresViewMode = (value: unknown): value is FiguresViewMode =>
  value === 'pinyes' || value === 'troncs';

@Component({
  selector: 'app-segment-workspace',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucideAngularModule,
    ButtonComponent,
    BadgeComponent,
    ModalComponent,
    TabsComponent,
    PinyesTabComponent,
    TroncsTabComponent,
    DistribucioTabComponent,
    NodesTabComponent,
    PrevisualitzaTabComponent,
    TemplateEditorHelpModalComponent,
    SegmentConflictPanelComponent,
    ImportPinyaModalComponent,
  ],
  templateUrl: './segment-workspace.component.html',
  providers: [SegmentWorkspaceStateService, UndoRedoService, ConflictResolutionService],
})
export class SegmentWorkspaceComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly destroyRef = inject(DestroyRef);
  private readonly layout = inject(LayoutService);
  private readonly viewModeService = inject(FiguresViewModeService);
  private readonly toast = inject(ToastService);
  private readonly assignmentService = inject(NodeAssignmentService);
  private readonly undoRedo = inject(UndoRedoService);
  readonly ws = inject(SegmentWorkspaceStateService);
  readonly state = inject(AssignmentStateService);

  readonly ArrowLeft = ArrowLeft;
  readonly ChevronLeft = ChevronLeft;
  readonly ChevronRight = ChevronRight;
  readonly Lock = Lock;
  readonly CircleQuestionMark = CircleQuestionMark;
  readonly Trash2 = Trash2;

  readonly helpModal = viewChild.required(TemplateEditorHelpModalComponent);

  readonly activeTab = signal<WorkspaceTab>('pinyes');
  readonly isPast = signal(false);

  readonly tabDefs: TabDef[] = [
    { id: 'pinyes', label: 'Pinyes', icon: DOMAIN_ICONS.PINYA },
    { id: 'troncs', label: 'Troncs', icon: DOMAIN_ICONS.TRONC },
    { id: 'distribucio', label: 'Distribució', icon: DOMAIN_ICONS.COMPOSITION },
    { id: 'nodes', label: 'Nodes extra', icon: Shapes },
    { id: 'previsualitza', label: 'Previsualitza', icon: Monitor },
  ];

  /** Set when the route requested a figure explicitly; blocks auto-selection of the first instance. */
  private explicitFigureRequested = false;
  private notFoundHandled = false;

  constructor() {
    effect(() => {
      if (this.ws.notFound() && !this.notFoundHandled) {
        this.notFoundHandled = true;
        this.toast.error('No s\'ha trobat el segment.');
        this.goBack();
      }
    });

    effect(() => {
      const instances = this.ws.instances();
      if (
        !this.explicitFigureRequested &&
        instances.length > 0 &&
        this.ws.selectedInstanceId() === null
      ) {
        this.ws.selectInstance(instances[0].instanceId);
      }
    });
  }

  ngOnInit(): void {
    this.layout.requestFullscreen();

    const queryParams = this.route.snapshot.queryParams;

    const tabParam = queryParams['tab'] as WorkspaceTab | undefined;
    if (tabParam && WORKSPACE_TABS.includes(tabParam)) {
      this.activeTab.set(tabParam);
    } else {
      this.activeTab.set(this.viewModeService.mode());
    }

    this.isPast.set(queryParams['past'] === '1');

    const figureId = queryParams['figure'] ?? this.route.snapshot.params['instanceId'] ?? null;
    if (figureId) {
      this.explicitFigureRequested = true;
      this.ws.selectInstance(figureId);
    }

    // Sibling-segment navigation (prev/next arrows) reuses this component instance and
    // only changes the route params, so the workspace must reload on every emission —
    // not just the first, unlike a plain snapshot read.
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const eventId = params.get('eventId')!;
      const segmentId = params.get('segmentId')!;
      if (eventId === this.ws.eventId() && segmentId === this.ws.segmentId()) return;
      if (this.ws.eventId()) {
        // Not the initial load — reset per-segment selection state before switching.
        this.notFoundHandled = false;
        this.explicitFigureRequested = false;
        this.ws.selectInstance(null);
      }
      this.ws.load(eventId, segmentId);
    });
  }

  navigateToSegment(segmentId: string | null): void {
    if (!segmentId) return;
    const queryParams: Record<string, string> = { tab: this.activeTab() };
    if (this.isPast()) queryParams['past'] = '1';
    const returnUrl = this.route.snapshot.queryParams['returnUrl'];
    if (returnUrl) queryParams['returnUrl'] = returnUrl;
    this.router.navigate(
      ['/pinyes/events', this.ws.eventId(), 'segments', segmentId, 'assign'],
      { queryParams },
    );
  }

  ngOnDestroy(): void {
    this.layout.exitFullscreen();
  }

  setTab(tab: string): void {
    this.activeTab.set(tab as WorkspaceTab);
    if (isFiguresViewMode(tab)) {
      this.viewModeService.set(tab);
    }
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** A tab requested a node that lives in the other tab (e.g. "Anar-hi" on a tronc assignment while in Pinyes). */
  onCrossTabSelect(event: { tab: 'pinyes' | 'troncs'; ref: SegmentNodeRef }): void {
    this.ws.pendingSelection.set(event.ref);
    this.setTab(event.tab);
  }

  /** The browser back button leaves the workspace the same way the back arrow does. */
  @HostListener('window:popstate')
  onPopState(): void {
    this.goBack();
  }

  goBack(): void {
    const returnUrl = this.route.snapshot.queryParams['returnUrl'];
    if (returnUrl) {
      this.router.navigateByUrl(returnUrl, { replaceUrl: true });
    } else {
      this.location.back();
    }
  }

  // ── Import pinya|tronc / reset snapshot (top bar) ─────────────────────────
  // Moved here from the pinyes tab's own footer: both act on the whole
  // instance (all its assignments), not just the pinya canvas, so they belong
  // in the workspace-wide header rather than one tab's chrome. The import
  // trigger shows on both the Pinyes and Troncs tabs (labelled and scoped by
  // origin — see importOrigin()); reset stays pinyes-only.

  readonly importMenuOpen = signal(false);
  readonly importTarget = signal<{
    instanceId: string;
    figureTemplateId: string;
    origin: 'pinya' | 'tronc';
  } | null>(null);
  readonly resetMenuOpen = signal(false);
  readonly resetTarget = signal<string | null>(null);
  readonly resetting = signal(false);

  readonly importTriggerLabel = computed(() =>
    this.activeTab() === 'troncs' ? 'Importa tronc' : 'Importa pinya',
  );
  readonly importTriggerAria = computed(() =>
    "Importa les assignacions d'una figura anterior",
  );

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

  /** 'tronc' when the import was triggered from the Troncs tab, 'pinya' otherwise. */
  private importOrigin(): 'pinya' | 'tronc' {
    return this.activeTab() === 'troncs' ? 'tronc' : 'pinya';
  }

  chooseImportFigure(instanceId: string): void {
    this.importMenuOpen.set(false);
    const instance = this.instanceFor(instanceId);
    if (!instance?.figureTemplateId) return;
    this.importTarget.set({
      instanceId,
      figureTemplateId: instance.figureTemplateId,
      origin: this.importOrigin(),
    });
  }

  onImportCompleted(result: BulkImportResult): void {
    let msg =
      result.conflicts.length > 0
        ? `S'han importat ${result.created.length} assignacions (${result.conflicts.length} conflictes omesos).`
        : `S'han importat ${result.created.length} assignacions.`;
    if (result.clonedAdHocNodes > 0) {
      msg += ` S'han clonat ${result.clonedAdHocNodes} nodes manuals.`;
    }
    const duplicatedPersons = Object.values(result.conflictsByKind).reduce((a, b) => a + b, 0);
    if (duplicatedPersons > 0) {
      msg += ` ${duplicatedPersons} ${duplicatedPersons === 1 ? 'persona ha quedat' : 'persones han quedat'} en conflicte.`;
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

        this.state.setSelectedNodeId(null);
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

  private instanceFor(instanceId: string): WorkspaceInstance | null {
    return this.ws.instances().find((i) => i.instanceId === instanceId) ?? null;
  }
}
