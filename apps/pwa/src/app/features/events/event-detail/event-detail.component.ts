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
import { RouterLink } from '@angular/router';
import { of } from 'rxjs';
import {
  MeEventDetail,
  MeSegment,
  EventType,
  UserRole,
  AttendanceStatus,
  EventAttendanceStats,
  computeSegmentDisplayName,
  formatOwnPositionSummary,
  OwnPositionSummary,
  OWN_POSITION_MULTIPLE_PLACEMENTS,
} from '@muixer/shared';
import { LucideAngularModule, Info, ChevronRight } from 'lucide-angular';
import { MobileHeaderComponent } from '../../../shared/components/mobile-header/mobile-header.component';
import { SkeletonCardComponent } from '../../../shared/components/skeleton-card/skeleton-card.component';
import { ButtonComponent, CardComponent, EmptyStateComponent } from '@muixer/ui';
import { AttendanceButtonComponent } from '../components/attendance-button/attendance-button.component';
import { EventCardComponent } from '../components/event-card/event-card.component';
import { EventService } from '../services/event.service';
import { AuthService } from '../../../core/auth/services/auth.service';
import { pollTick } from '../../../shared/utils/poll-tick.util';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-event-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucideAngularModule,
    RouterLink,
    MobileHeaderComponent,
    SkeletonCardComponent,
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    AttendanceButtonComponent,
    EventCardComponent,
  ],
  templateUrl: './event-detail.component.html',
})
export class EventDetailComponent {
  readonly id = input.required<string>();

  protected readonly Info = Info;
  protected readonly ChevronRight = ChevronRight;

  private readonly eventService = inject(EventService);
  private readonly titleService = inject(Title);
  private readonly authService = inject(AuthService);

  protected readonly isStaff = computed(() => {
    const role = this.authService.userRole();
    return role === UserRole.TECHNICAL || role === UserRole.ADMIN;
  });

  /** Refetches attendance-facing data periodically so staff marking arrivals ("Passa llista") is reflected without a manual reload. */
  private readonly attendancePoll = pollTick(environment.attendancePollIntervalMs);

  protected readonly eventResource = rxResource<MeEventDetail, { id: string; tick: number }>({
    params: () => ({ id: this.id(), tick: this.attendancePoll() }),
    stream: ({ params }) => this.eventService.findOne(params.id),
  });

  protected readonly event = computed((): MeEventDetail | undefined =>
    this.eventResource.error() ? undefined : this.eventResource.value(),
  );
  protected readonly isLoading = this.eventResource.isLoading;
  protected readonly hasError = computed(() => !!this.eventResource.error());

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
   * ponytail: temporarily disabled for testing (2026-09) — flip back to `true` to restore the
   * day-of-only restriction once the real-time refresh/attendance-stats work is verified live.
   */
  private static readonly ENFORCE_ROLL_CALL_DATE_RESTRICTION = false;

  /**
   * Roll-call ("Passa llista") is a day-of tool for marking who physically showed up — only
   * relevant the day it applies to, so it's hidden any other day rather than cluttering every
   * future/past event screen for TECHNICAL/ADMIN accounts.
   */
  protected readonly isToday = computed(() => this.event()?.date === new Date().toISOString().slice(0, 10));
  protected readonly showRollCallLink = computed(
    () =>
      this.isStaff() &&
      (this.isToday() || !EventDetailComponent.ENFORCE_ROLL_CALL_DATE_RESTRICTION),
  );

  protected readonly segmentsResource = rxResource<MeSegment[], { id: string; tick: number }>({
    params: () => ({ id: this.id(), tick: this.attendancePoll() }),
    stream: ({ params }) => this.eventService.findSegments(params.id),
  });

  protected readonly attendanceStatsResource = rxResource<
    EventAttendanceStats | null,
    { id: string; tick: number } | undefined
  >({
    params: () => (this.isStaff() ? { id: this.id(), tick: this.attendancePoll() } : undefined),
    stream: ({ params }) => (params ? this.eventService.getAttendanceStats(params.id) : of(null)),
  });

  protected readonly attendanceStats = computed(() => this.attendanceStatsResource.value());

  private static readonly STATUS_LABELS: Record<AttendanceStatus, string> = {
    [AttendanceStatus.ASSISTIT]: 'Assistit',
    [AttendanceStatus.ANIRE]: 'Vindran',
    [AttendanceStatus.NO_VAIG]: 'No vindran',
    [AttendanceStatus.PENDENT]: 'Pendents',
  };

  /** Assaig shows all 4 statuses (incl. "Assistit", from Passa llista); actuació has no roll-call flow. */
  protected attendanceStatusTiles(
    stats: EventAttendanceStats,
  ): { status: AttendanceStatus; label: string; adults: number; xicalla: number }[] {
    const statuses =
      this.event()?.eventType === EventType.ASSAIG
        ? [AttendanceStatus.ASSISTIT, AttendanceStatus.ANIRE, AttendanceStatus.NO_VAIG, AttendanceStatus.PENDENT]
        : [AttendanceStatus.ANIRE, AttendanceStatus.NO_VAIG, AttendanceStatus.PENDENT];

    return statuses.map((status) => {
      const count = stats.byStatus[status];
      return {
        status,
        label: EventDetailComponent.STATUS_LABELS[status],
        adults: count.adults,
        xicalla: count.xicalla,
      };
    });
  }

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
