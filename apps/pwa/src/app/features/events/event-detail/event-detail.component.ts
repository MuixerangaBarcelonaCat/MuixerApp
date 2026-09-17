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
  protected readonly AttendanceStatus = AttendanceStatus;

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

  protected readonly isToday = computed(() => this.event()?.date === new Date().toISOString().slice(0, 10));
  // ponytail: day-of restriction on "Passa llista" temporarily disabled for testing, restore `this.isStaff() && this.isToday()` once verified live — tracked as docs/DEBT.md F13
  protected readonly showRollCallLink = computed(() => this.isStaff());

  protected readonly segmentsResource = rxResource<MeSegment[], string>({
    params: () => this.id(),
    stream: ({ params: id }) => this.eventService.findSegments(id),
  });

  protected readonly attendanceStatsResource = rxResource<
    EventAttendanceStats | null,
    string | undefined
  >({
    params: () => (this.isStaff() ? this.id() : undefined),
    stream: ({ params: id }) => (id ? this.eventService.getAttendanceStats(id) : of(null)),
  });

  protected readonly attendanceStats = computed(() => this.attendanceStatsResource.value());

  private static readonly STATUS_LABELS: Record<AttendanceStatus, string> = {
    [AttendanceStatus.ASSISTIT]: 'Assistit',
    [AttendanceStatus.ANIRE]: 'Vindran',
    [AttendanceStatus.NO_VAIG]: 'No vindran',
    [AttendanceStatus.PENDENT]: 'Pendents',
  };

  /**
   * Real-world order: sign up, physically arrive (assaig only, via Passa llista), decline — then
   * PENDENT last and muted, matching the roll-call screen's "no s'han apuntat" section, since
   * someone who hasn't bothered to answer isn't as relevant as someone who did.
   */
  protected attendanceStatusTiles(
    stats: EventAttendanceStats,
  ): { status: AttendanceStatus; label: string; adults: number; xicalla: number }[] {
    const statuses =
      this.event()?.eventType === EventType.ASSAIG
        ? [AttendanceStatus.ANIRE, AttendanceStatus.ASSISTIT, AttendanceStatus.NO_VAIG, AttendanceStatus.PENDENT]
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
