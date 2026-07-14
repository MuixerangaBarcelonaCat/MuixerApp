import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnDestroy,
  OnInit,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideAngularModule, ArrowLeft, ChevronLeft, ChevronRight, Shapes, Monitor, Lock } from 'lucide-angular';
import { DOMAIN_ICONS } from '../../../../shared/constants/domain-icons';
import { LayoutService } from '../../../../core/services/layout.service';
import { FiguresViewModeService, FiguresViewMode } from '../../services/figures-view-mode.service';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';
import { SegmentWorkspaceStateService } from '../../services/segment-workspace-state.service';
import { UndoRedoService } from '../../services/undo-redo.service';
import { PinyesTabComponent } from './tabs/pinyes-tab/pinyes-tab.component';
import { TroncsTabComponent } from './tabs/troncs-tab/troncs-tab.component';
import { DistribucioTabComponent } from './tabs/distribucio-tab/distribucio-tab.component';
import { NodesTabComponent } from './tabs/nodes-tab/nodes-tab.component';
import { PrevisualitzaTabComponent } from './tabs/previsualitza-tab/previsualitza-tab.component';

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
    PinyesTabComponent,
    TroncsTabComponent,
    DistribucioTabComponent,
    NodesTabComponent,
    PrevisualitzaTabComponent,
  ],
  templateUrl: './segment-workspace.component.html',
  providers: [SegmentWorkspaceStateService, UndoRedoService],
})
export class SegmentWorkspaceComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly destroyRef = inject(DestroyRef);
  private readonly layout = inject(LayoutService);
  private readonly viewModeService = inject(FiguresViewModeService);
  private readonly toast = inject(ToastService);
  readonly ws = inject(SegmentWorkspaceStateService);

  readonly ArrowLeft = ArrowLeft;
  readonly ChevronLeft = ChevronLeft;
  readonly ChevronRight = ChevronRight;
  readonly Lock = Lock;

  readonly activeTab = signal<WorkspaceTab>('pinyes');
  readonly isPast = signal(false);

  readonly tabDefs: { id: WorkspaceTab; label: string; icon: typeof DOMAIN_ICONS.PINYA }[] = [
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

  setTab(tab: WorkspaceTab): void {
    this.activeTab.set(tab);
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
}
