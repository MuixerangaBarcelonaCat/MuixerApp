import { ProjectionSegmentData, PinyaProjectionComponent } from '@muixer/pinyes-render';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  inject,
  input,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { LayoutService } from '../../../../core/services/layout.service';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';
import { ProjectionService } from '../../services/projection.service';

@Component({
  selector: 'app-projection-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    LucideAngularModule,
    PinyaProjectionComponent,
  ],
  templateUrl: './projection-view.component.html',
})
export class ProjectionViewComponent implements OnInit, OnDestroy {
  /** True when rendered inside another shell (e.g. the segment workspace's Previsualitza tab),
   *  which already owns fullscreen layout — the standalone route always leaves this false. */
  readonly embedded = input(false);

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

  /** Restricts the projection to a single figure. A real signal (not a plain
   *  field) so `PinyaProjectionComponent`'s `filteredInstances` computed tracks
   *  it correctly — see `navigateSegment`, which resets it on every segment
   *  change so the URL and the rendered instance set never disagree. */
  readonly instanceIdSignal = signal<string | null>(null);

  // ── Route params ────────────────────────────────────────────────────────────

  eventId = '';
  segmentId = '';

  private cursorTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  ngOnInit(): void {
    if (!this.embedded()) {
      this.layoutService.requestFullscreen();
    }
    const params = this.route.snapshot.params;
    this.eventId = params['eventId'];
    this.segmentId = params['segmentId'];
    this.instanceIdSignal.set(this.embedded() ? null : (params['instanceId'] ?? null));
    this.loadSegment();
  }

  ngOnDestroy(): void {
    if (!this.embedded()) {
      this.layoutService.exitFullscreen();
    }
    if (this.cursorTimer) clearTimeout(this.cursorTimer);
  }

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (!this.embedded()) {
      if (event.key === 'ArrowLeft') this.navigateSegment('prev');
      if (event.key === 'ArrowRight') this.navigateSegment('next');
    }
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

  // ── Segment navigation ──────────────────────────────────────────────────────

  navigateSegment(direction: 'prev' | 'next'): void {
    const data = this.segmentData();
    if (!data) return;
    const targetId = direction === 'prev' ? data.segment.prevSegmentId : data.segment.nextSegmentId;
    if (!targetId) return;
    this.router.navigate(['/pinyes/events', this.eventId, 'segments', targetId, 'project']);
    this.segmentId = targetId;
    // The target URL carries no instance id — the previous segment's instance
    // filter must not leak into the next one (design decision 6).
    this.instanceIdSignal.set(null);
    this.loadSegment();
  }

  /** The browser back button leaves the projection the same way the HUD arrow does.
   *  No-op when embedded — the host shell (e.g. the segment workspace) owns that. */
  @HostListener('window:popstate')
  onPopState(): void {
    if (this.embedded()) return;
    this.goBack();
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
