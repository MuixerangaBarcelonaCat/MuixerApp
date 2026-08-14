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
import { MeEventDetail, MeSegment, EventType, computeSegmentDisplayName } from '@muixer/shared';
import { LucideAngularModule, MapPin, Clock, Info } from 'lucide-angular';
import { MobileHeaderComponent } from '../../../shared/components/mobile-header/mobile-header.component';
import { SkeletonCardComponent } from '../../../shared/components/skeleton-card/skeleton-card.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { AttendanceButtonComponent } from '../components/attendance-button/attendance-button.component';
import { FormatEventDatePipe } from '../../../shared/pipes/format-event-date.pipe';
import { EventService } from '../services/event.service';

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

  private readonly eventService = inject(EventService);
  private readonly titleService = inject(Title);

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

  protected readonly segmentsResource = rxResource<MeSegment[], string>({
    params: () => this.id(),
    stream: ({ params: id }) => this.eventService.findSegments(id),
  });

  protected readonly segments = computed(() => this.segmentsResource.value() ?? []);

  protected segmentLabel(segment: MeSegment): string {
    return computeSegmentDisplayName(segment.name, segment.instances);
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
