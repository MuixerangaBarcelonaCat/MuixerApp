import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { LayoutService } from '../../../../core/services/layout.service';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';
import { ProjectionService } from '../../services/projection.service';
import { ProjectionSegmentData, ProjectionInstance } from '../../models/projection.model';
import { InstanceNodeItem } from '../../models/assignment.model';
import { FigureCanvasComponent } from '../figure-canvas/figure-canvas.component';
import { TroncViewComponent, TroncNodeItem } from '../tronc-view/tronc-view.component';
import { FigureZone } from '@muixer/shared';
import { ICON_FIGURA_NETA } from '../../../../shared/constants/domain-icons';
import { computeCordoObertOverrides } from '../../utils/cordo-obert.util';

@Component({
  selector: 'app-projection-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterLink,
    LucideAngularModule,
    FigureCanvasComponent,
    TroncViewComponent,
  ],
  templateUrl: './projection-view.component.html',
  styleUrl: './projection-view.component.scss',
})
export class ProjectionViewComponent implements OnInit, OnDestroy {
  readonly ICON_FIGURA_NETA = ICON_FIGURA_NETA;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly layoutService = inject(LayoutService);
  private readonly projectionService = inject(ProjectionService);
  private readonly toast = inject(ToastService);

  // ── State signals ───────────────────────────────────────────────────────────

  readonly loading = signal(true);
  readonly segmentData = signal<ProjectionSegmentData | null>(null);
  readonly cursorVisible = signal(true);
  readonly helpModalOpen = signal(false);

  // ── Computed ────────────────────────────────────────────────────────────────

  readonly filteredInstances = computed(() => {
    const instances = this.segmentData()?.instances ?? [];
    return this.instanceId ? instances.filter((i) => i.id === this.instanceId) : instances;
  });

  readonly gridCols = computed(() => {
    const n = this.filteredInstances().length;
    if (n <= 1) return 1;
    if (n === 2) return 2;
    if (n === 3) return 3;
    if (n === 4) return 2;
    return 3;
  });

  readonly gridRows = computed(() => {
    const n = this.filteredInstances().length;
    return Math.ceil(n / this.gridCols());
  });

  readonly itemWidthStyle = computed(() => `calc(${100 / this.gridCols()}% - 6px)`);
  readonly itemHeightStyle = computed(() => `calc(${100 / this.gridRows()}% - 6px)`);

  // ── Route params ────────────────────────────────────────────────────────────

  eventId = '';
  segmentId = '';
  instanceId = '';

  private cursorTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.layoutService.requestFullscreen();
    const params = this.route.snapshot.params;
    this.eventId = params['eventId'];
    this.segmentId = params['segmentId'];
    this.instanceId = params['instanceId'] ?? '';
    this.loadSegment();
  }

  ngOnDestroy(): void {
    this.layoutService.exitFullscreen();
    if (this.cursorTimer) clearTimeout(this.cursorTimer);
  }

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') this.navigateSegment('prev');
    if (event.key === 'ArrowRight') this.navigateSegment('next');
    if (event.key === 'Escape') this.handleEscape();
    if (event.key === 'f' || event.key === 'F') this.toggleBrowserFullscreen();
    if (event.key === '?' || event.key === 'h' || event.key === 'H') {
      this.helpModalOpen.update((v) => !v);
    }
  }

  // ── Mouse / cursor management ───────────────────────────────────────────────

  onMouseMove(): void {
    this.cursorVisible.set(true);
    if (this.cursorTimer) clearTimeout(this.cursorTimer);
    this.cursorTimer = setTimeout(() => this.cursorVisible.set(false), 3000);
  }

  // ── Node data accessors ───────────────────────────────────────────────────

  /** Nodes to render on the Konva canvas: PINYA + BASE + DECORATION (spatial x,y nodes).
   *  Excludes TRONC/DIRECTION (shown in tronc header) and unassigned PINYA nodes.
   *  Assigned cordo-obert nodes collapse to the first empty slot in their rengla. */
  getInstanceProjectionNodes(instance: ProjectionInstance): InstanceNodeItem[] {
    const assignedNodeIds = new Set(instance.assignments.map((a) => a.node.id));
    const overrides = computeCordoObertOverrides(
      instance.nodes,
      (co, others) =>
        assignedNodeIds.has(co.id)
          ? others.find((n) => !assignedNodeIds.has(n.id))
          : undefined,
    );

    return instance.nodes
      .filter((n) =>
        (n.zone === FigureZone.PINYA || n.zone === FigureZone.BASE || n.zone === FigureZone.DECORATION) &&
        !(n.zone === FigureZone.PINYA && !assignedNodeIds.has(n.id)),
      )
      .map((n) => {
        const pos = overrides.get(n.id);
        return pos ? { ...n, x: pos.x, y: pos.y } : n;
      });
  }

  getInstanceTroncNodes(instance: ProjectionInstance): TroncNodeItem[] {
    return instance.nodes.filter((n) => n.zone === FigureZone.TRONC) as TroncNodeItem[];
  }

  getInstanceBaseNodes(instance: ProjectionInstance): TroncNodeItem[] {
    return instance.nodes.filter((n) => n.zone === FigureZone.BASE) as TroncNodeItem[];
  }

  getInstanceDirectionNodes(instance: ProjectionInstance): TroncNodeItem[] {
    return instance.nodes.filter(
      (n) => n.zone === FigureZone.FIGURE_DIRECTION || n.zone === FigureZone.XICALLA_DIRECTION,
    ) as TroncNodeItem[];
  }

  isNetaFigure(instance: ProjectionInstance): boolean {
    return instance.figureTemplate?.hasPinya === false || instance.figureMode === 'REMAT';
  }

  getInstanceName(instance: ProjectionInstance): string {
    const base = instance.label ?? instance.figureTemplate?.name ?? 'Figura';
    if (instance.figureMode === 'PEU') return `Peu de ${base}`;
    if (instance.figureMode === 'REMAT') return `Remat de ${base}`;
    return base;
  }

  // ── Segment navigation ──────────────────────────────────────────────────────

  navigateSegment(direction: 'prev' | 'next'): void {
    const data = this.segmentData();
    if (!data) return;
    const targetId = direction === 'prev' ? data.segment.prevSegmentId : data.segment.nextSegmentId;
    if (!targetId) return;
    this.router.navigate(['/pinyes/events', this.eventId, 'segments', targetId, 'project']);
    this.segmentId = targetId;
    this.loadSegment();
  }

  goBack(): void {
    this.router.navigate(['/events', this.eventId]);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private handleEscape(): void {
    if (this.helpModalOpen()) {
      this.helpModalOpen.set(false);
      return;
    }
    this.goBack();
  }

  private toggleBrowserFullscreen(): void {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => { /* best-effort */ });
    } else {
      document.exitFullscreen().catch(() => { /* best-effort */ });
    }
  }

  private loadSegment(): void {
    this.loading.set(true);
    this.projectionService.getProjection(this.eventId, this.segmentId).subscribe({
      next: (data) => {
        this.segmentData.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('Error carregant les dades de projecció');
        this.loading.set(false);
      },
    });
  }
}
