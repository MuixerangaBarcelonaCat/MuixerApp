import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, inject, input, computed } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { LucideAngularModule, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-angular';
import { computeSegmentDisplayName } from '@muixer/shared';
import { ProjectionSegmentData, PinyaProjectionComponent } from '@muixer/pinyes-render';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ProjectionService } from '../services/projection.service';
import { LayoutService } from '../../../core/services/layout.service';
import { AuthService } from '../../../core/auth/services/auth.service';

@Component({
  selector: 'app-segment-projection',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, PinyaProjectionComponent, EmptyStateComponent],
  templateUrl: './segment-projection.component.html',
})
export class SegmentProjectionComponent implements OnInit, OnDestroy {
  readonly eventId = input.required<string>();
  readonly segmentId = input.required<string>();

  protected readonly ArrowLeft = ArrowLeft;
  protected readonly ChevronLeft = ChevronLeft;
  protected readonly ChevronRight = ChevronRight;

  private readonly router = inject(Router);
  private readonly projectionService = inject(ProjectionService);
  private readonly layoutService = inject(LayoutService);
  private readonly authService = inject(AuthService);

  /** The viewer's own linked Person, if any — enables the "you are here" banner. */
  protected readonly highlightPersonId = computed(() => this.authService.currentUser()?.person?.id ?? null);

  ngOnInit(): void {
    this.layoutService.requestFullscreen();
  }

  ngOnDestroy(): void {
    this.layoutService.exitFullscreen();
  }

  protected readonly projectionResource = rxResource<
    ProjectionSegmentData,
    { eventId: string; segmentId: string }
  >({
    params: () => ({ eventId: this.eventId(), segmentId: this.segmentId() }),
    stream: ({ params }) => this.projectionService.getProjection(params.eventId, params.segmentId),
  });

  protected readonly data = computed((): ProjectionSegmentData | undefined =>
    this.projectionResource.error() ? undefined : this.projectionResource.value(),
  );
  protected readonly isLoading = this.projectionResource.isLoading;
  protected readonly hasError = computed(() => !!this.projectionResource.error());

  protected readonly segmentLabel = computed(() => {
    const data = this.data();
    if (!data) return '';
    return computeSegmentDisplayName(data.segment.name, data.instances);
  });

  goBack(): void {
    this.router.navigate(['/events', this.eventId()]);
  }

  navigateSegment(direction: 'prev' | 'next'): void {
    const data = this.data();
    if (!data) return;
    const targetId = direction === 'prev' ? data.segment.prevSegmentId : data.segment.nextSegmentId;
    if (!targetId) return;
    this.router.navigate(['/events', this.eventId(), 'segments', targetId]);
  }
}
