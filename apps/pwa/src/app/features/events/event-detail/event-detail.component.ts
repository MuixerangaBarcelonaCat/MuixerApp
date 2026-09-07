import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
  input,
  effect,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { SlicePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  MeEventDetail,
  MeSegment,
  EventType,
  UserRole,
  computeSegmentDisplayName,
  formatOwnPositionSummary,
  OwnPositionSummary,
  OWN_POSITION_MULTIPLE_PLACEMENTS,
} from '@muixer/shared';
import { LucideAngularModule, MapPin, Clock, Info, ChevronRight } from 'lucide-angular';
import { MobileHeaderComponent } from '../../../shared/components/mobile-header/mobile-header.component';
import { SkeletonCardComponent } from '../../../shared/components/skeleton-card/skeleton-card.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { AttendanceButtonComponent } from '../components/attendance-button/attendance-button.component';
import { FormatEventDatePipe } from '../../../shared/pipes/format-event-date.pipe';
import { EventService } from '../services/event.service';
import { AuthService } from '../../../core/auth/services/auth.service';

@Component({
  selector: 'app-event-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucideAngularModule,
    RouterLink,
    MobileHeaderComponent,
    SkeletonCardComponent,
    EmptyStateComponent,
    AttendanceButtonComponent,
    FormatEventDatePipe,
    SlicePipe,
  ],
  templateUrl: './event-detail.component.html',
})
export class EventDetailComponent {
  readonly id = input.required<string>();

  protected readonly MapPin = MapPin;
  protected readonly Clock = Clock;
  protected readonly Info = Info;
  protected readonly ChevronRight = ChevronRight;

  private readonly eventService = inject(EventService);
  private readonly titleService = inject(Title);
  private readonly authService = inject(AuthService);

  protected readonly isStaff = computed(() => {
    const role = this.authService.userRole();
    return role === UserRole.TECHNICAL || role === UserRole.ADMIN;
  });

  protected readonly eventResource = rxResource<MeEventDetail, string>({
    params: () => this.id(),
    stream: ({ params: id }) => this.eventService.findOne(id),
  });

  protected readonly event = computed((): MeEventDetail | undefined =>
    this.eventResource.error() ? undefined : this.eventResource.value(),
  );
  protected readonly isLoading = this.eventResource.isLoading;
  protected readonly hasError = computed(() => !!this.eventResource.error());

  protected readonly isAssaig = computed(
    () => this.event()?.eventType === EventType.ASSAIG,
  );

  protected readonly headerTitle = computed(() => {
    const ev = this.event();
    if (!ev) return 'Detall';
    if (ev.title) return ev.title;
    return ev.eventType === EventType.ASSAIG ? "Detall de l'assaig" : "Detall de l'actuació";
  });

  protected readonly isPast = computed(() => {
    const date = this.event()?.date;
    if (!date) return false;
    return date < new Date().toISOString().slice(0, 10);
  });

  /**
   * Roll-call ("Passa llista") is a day-of tool for marking who physically showed up — only
   * relevant the day it applies to, so it's hidden any other day rather than cluttering every
   * future/past event screen for TECHNICAL/ADMIN accounts.
   */
  protected readonly isToday = computed(() => this.event()?.date === new Date().toISOString().slice(0, 10));
  protected readonly showRollCallLink = computed(() => this.isStaff() && this.isToday());

  protected readonly segmentsResource = rxResource<MeSegment[], string>({
    params: () => this.id(),
    stream: ({ params: id }) => this.eventService.findSegments(id),
  });

  protected readonly segments = computed(() => this.segmentsResource.value() ?? []);

  protected segmentLabel(segment: MeSegment): string {
    return computeSegmentDisplayName(segment.name, segment.instances);
  }

  protected readonly OWN_POSITION_MULTIPLE_PLACEMENTS = OWN_POSITION_MULTIPLE_PLACEMENTS;

  protected hasMultiplePlacements(segment: MeSegment): boolean {
    return segment.myPlacements.length > 1;
  }

  protected ownPositionSummary(segment: MeSegment): OwnPositionSummary | null {
    if (segment.myPlacements.length !== 1) return null;
    return formatOwnPositionSummary(segment.myPlacements[0]);
  }

  constructor() {
    effect(() => {
      const ev = this.event();
      if (ev) {
        this.titleService.setTitle(`${ev.title || this.headerTitle()} — MuixerApp`);
      }
    });
  }
}
