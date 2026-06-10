import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  OnDestroy,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { LayoutService } from '../../../../core/services/layout.service';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';
import { ProjectionService } from '../../services/projection.service';
import { TroncViewComponent } from '../tronc-view/tronc-view.component';
import { FigureCanvasComponent } from '../figure-canvas/figure-canvas.component';
import { ProjectionInstance } from '../../models/projection.model';
import { AssignmentDetail } from '../../models/assignment.model';
import { FigureZone } from '@muixer/shared';

@Component({
  selector: 'app-figure-projection',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, TroncViewComponent, FigureCanvasComponent],
  templateUrl: './figure-projection.component.html',
  styleUrl: './figure-projection.component.scss',
})
export class FigureProjectionComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly router = inject(Router, { optional: true });
  private readonly layoutService = inject(LayoutService, { optional: true });
  private readonly projectionService = inject(ProjectionService, { optional: true });
  private readonly toast = inject(ToastService, { optional: true });

  /**
   * Embedded mode: parent passes the instance directly (e.g. testing).
   * Standalone route mode: left undefined; component loads from route params.
   */
  readonly instance = input<ProjectionInstance>();

  /** Emitted in embedded mode when the back button is clicked. */
  readonly backToSegment = output<void>();

  // ── Standalone mode state ───────────────────────────────────────────────────

  readonly loading = signal(false);
  private readonly loadedInstance = signal<ProjectionInstance | null>(null);

  /**
   * The effective instance — from input (embedded/testing) or loaded via API (standalone).
   */
  readonly activeInstance = computed<ProjectionInstance | null>(
    () => this.instance() ?? this.loadedInstance(),
  );

  /** True when loaded via route (no instance input provided at init time). */
  readonly standaloneMode = signal(false);

  // ── Tronc floating panel ───────────────────────────────────────────────────

  readonly troncPanelOpen = signal(true);
  readonly troncPanelPos = signal({ x: 16, y: 60 });
  private troncDragging = false;
  private troncDragOffset = { x: 0, y: 0 };

  // ── Derived computed (from activeInstance) ──────────────────────────────────

  readonly pinyaNodes = computed(() =>
    this.activeInstance()?.nodes.filter((n) => n.zone !== FigureZone.TRONC) ?? [],
  );

  readonly troncNodes = computed(() =>
    this.activeInstance()?.nodes.filter((n) => n.zone === FigureZone.TRONC) ?? [],
  );

  readonly baseNodes = computed(() =>
    this.activeInstance()?.nodes.filter((n) => n.zone === FigureZone.BASE) ?? [],
  );

  readonly assignmentList = computed<AssignmentDetail[]>(
    () => this.activeInstance()?.assignments ?? [],
  );

  readonly displayName = computed(() => {
    const inst = this.activeInstance();
    return inst?.figureTemplate?.name ?? inst?.label ?? 'Figura';
  });

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  ngOnInit(): void {
    const instanceId = this.route?.snapshot.params['instanceId'];

    if (instanceId && !this.instance()) {
      this.standaloneMode.set(true);
      this.layoutService?.requestFullscreen();
      this.loadFromRoute(instanceId);
    }
  }

  ngOnDestroy(): void {
    if (this.standaloneMode()) {
      this.layoutService?.exitFullscreen();
    }
  }

  // ── Navigation ──────────────────────────────────────────────────────────────

  navigateToAssignment(): void {
    if (this.standaloneMode() && this.router && this.route) {
      const { eventId, segmentId } = this.route.snapshot.params;
      this.router.navigate(['/pinyes/events', eventId, 'segments', segmentId, 'assign']);
    } else {
      this.backToSegment.emit();
    }
  }

  navigateToProjection(): void {
    if (this.router && this.route) {
      const { eventId, segmentId } = this.route.snapshot.params;
      this.router.navigate(['/pinyes/events', eventId, 'segments', segmentId, 'project']);
    }
  }

  // ── Tronc panel drag ──────────────────────────────────────────────────────

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

  // ── Private ─────────────────────────────────────────────────────────────────

  private loadFromRoute(instanceId: string): void {
    if (!this.projectionService || !this.route) return;

    const eventId = this.route.snapshot.params['eventId'];
    const segmentId = this.route.snapshot.params['segmentId'];

    this.loading.set(true);
    this.projectionService.getProjection(eventId, segmentId).subscribe({
      next: (data) => {
        const found = data.instances.find((i) => i.id === instanceId) ?? null;
        this.loadedInstance.set(found);
        this.loading.set(false);
      },
      error: () => {
        this.toast?.error('Error carregant les dades de la figura');
        this.loading.set(false);
      },
    });
  }
}
