import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideAngularModule, ArrowLeft, Shapes, Monitor, Lock } from 'lucide-angular';
import { DOMAIN_ICONS } from '../../../../shared/constants/domain-icons';
import { LayoutService } from '../../../../core/services/layout.service';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';
import { SegmentWorkspaceStateService } from '../../services/segment-workspace-state.service';
import { UndoRedoService } from '../../services/undo-redo.service';
import { PinyesTabComponent } from './tabs/pinyes-tab/pinyes-tab.component';
import { TroncsTabComponent } from './tabs/troncs-tab/troncs-tab.component';
import { DistribucioTabComponent } from './tabs/distribucio-tab/distribucio-tab.component';

export type WorkspaceTab = 'pinyes' | 'troncs' | 'distribucio' | 'nodes' | 'previsualitza';

const WORKSPACE_TABS: WorkspaceTab[] = ['pinyes', 'troncs', 'distribucio', 'nodes', 'previsualitza'];

@Component({
  selector: 'app-segment-workspace',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, PinyesTabComponent, TroncsTabComponent, DistribucioTabComponent],
  templateUrl: './segment-workspace.component.html',
  providers: [SegmentWorkspaceStateService, UndoRedoService],
})
export class SegmentWorkspaceComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly layout = inject(LayoutService);
  private readonly toast = inject(ToastService);
  readonly ws = inject(SegmentWorkspaceStateService);

  readonly ArrowLeft = ArrowLeft;
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

    const params = this.route.snapshot.params;
    const queryParams = this.route.snapshot.queryParams;

    const tabParam = queryParams['tab'] as WorkspaceTab | undefined;
    if (tabParam && WORKSPACE_TABS.includes(tabParam)) {
      this.activeTab.set(tabParam);
    }

    this.isPast.set(queryParams['past'] === '1');

    const figureId = queryParams['figure'] ?? params['instanceId'] ?? null;
    if (figureId) {
      this.explicitFigureRequested = true;
      this.ws.selectInstance(figureId);
    }

    this.ws.load(params['eventId'], params['segmentId']);
  }

  ngOnDestroy(): void {
    this.layout.exitFullscreen();
  }

  setTab(tab: WorkspaceTab): void {
    this.activeTab.set(tab);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  goBack(): void {
    const returnUrl = this.route.snapshot.queryParams['returnUrl'];
    if (returnUrl) {
      this.router.navigateByUrl(returnUrl);
    } else {
      this.location.back();
    }
  }
}
