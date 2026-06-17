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
import { CommonModule, Location } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { LayoutService } from '../../../../core/services/layout.service';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';
import { ProjectionService } from '../../services/projection.service';
import { ProjectionSegmentData, ProjectionInstance } from '../../models/projection.model';
import { FigureCanvasComponent } from '../figure-canvas/figure-canvas.component';
import { TroncViewComponent, TroncNodeItem } from '../tronc-view/tronc-view.component';
import { FigureZone } from '@muixer/shared';

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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly layoutService = inject(LayoutService);
  private readonly projectionService = inject(ProjectionService);
  private readonly toast = inject(ToastService);

  // ── State signals ───────────────────────────────────────────────────────────

  readonly loading = signal(true);
  readonly segmentData = signal<ProjectionSegmentData | null>(null);
  readonly cursorVisible = signal(true);
  readonly helpModalOpen = signal(false);

  // ── Computed ────────────────────────────────────────────────────────────────

  readonly gridCols = computed(() => {
    const n = this.segmentData()?.instances.length ?? 0;
    if (n <= 1) return 1;
    if (n === 2) return 2;
    if (n === 3) return 3;
    if (n === 4) return 2;
    return 3;
  });

  readonly gridRows = computed(() => {
    const n = this.segmentData()?.instances.length ?? 0;
    return Math.ceil(n / this.gridCols());
  });

  readonly itemWidthStyle = computed(() => `calc(${100 / this.gridCols()}% - 6px)`);
  readonly itemHeightStyle = computed(() => `calc(${100 / this.gridRows()}% - 6px)`);

  // ── Route params ────────────────────────────────────────────────────────────

  eventId = '';
  segmentId = '';

  private cursorTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.layoutService.requestFullscreen();
    const params = this.route.snapshot.params;
    this.eventId = params['eventId'];
    this.segmentId = params['segmentId'];
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

  /** Nodes to render in the pinya canvas: excludes TRONC and unassigned PINYA nodes. */
  getInstanceProjectionNodes(instance: ProjectionInstance) {
    const assignedNodeIds = new Set(instance.assignments.map((a) => a.node.id));
    return instance.nodes.filter(
      (n) => n.zone !== FigureZone.TRONC && !(n.zone === FigureZone.PINYA && !assignedNodeIds.has(n.id)),
    );
  }

  getInstanceTroncNodes(instance: ProjectionInstance): TroncNodeItem[] {
    return instance.nodes.filter((n) => n.zone === FigureZone.TRONC) as TroncNodeItem[];
  }

  getInstanceBaseNodes(instance: ProjectionInstance): TroncNodeItem[] {
    return instance.nodes.filter((n) => n.zone === FigureZone.BASE) as TroncNodeItem[];
  }

  getInstanceName(instance: ProjectionInstance): string {
    return instance.label ?? instance.figureTemplate?.name ?? 'Figura';
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
    this.location.back();
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
