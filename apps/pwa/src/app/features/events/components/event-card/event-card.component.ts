import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { SlicePipe } from '@angular/common';
import { AttendanceStatus, EventType, MeEvent } from '@muixer/shared';
import { LucideAngularModule, MapPin, Clock, Star } from 'lucide-angular';
import { CardComponent, CardTone } from '@muixer/ui';
import { AttendanceButtonComponent } from '../attendance-button/attendance-button.component';
import { formatEventDate } from '../../../../shared/pipes/format-event-date.pipe';

@Component({
  selector: 'app-event-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, AttendanceButtonComponent, CardComponent, SlicePipe],
  templateUrl: './event-card.component.html',
})
export class EventCardComponent {
  readonly event = input.required<MeEvent>();
  // Set to false when this card is embedded read-only somewhere that already has its own
  // attendance controls (e.g. event-detail's own attendance section below it).
  readonly showAttendance = input(true);
  // Set to false when the card isn't a list-row-to-detail link — e.g. embedded in the detail
  // screen it would otherwise navigate to, where "click to view details" makes no sense.
  readonly clickable = input(true);
  // Optional canonical map link for the location — rendered as a real link only when given (the
  // list view never passes one: nesting a real <a> inside its own click-to-navigate card would
  // be the same invalid-nested-interactive-content problem the attendance buttons already avoid).
  readonly locationUrl = input<string | null>(null);
  readonly attendanceChanged = output<{ eventId: string; personId: string; status: AttendanceStatus }>();

  protected readonly MapPin = MapPin;
  protected readonly Clock = Clock;
  protected readonly Star = Star;

  private readonly router = inject(Router);

  protected readonly isAssaig = computed(
    () => this.event().eventType === EventType.ASSAIG,
  );

  protected readonly isPast = computed(() => {
    const today = new Date().toISOString().slice(0, 10);
    return this.event().date < today;
  });

  // Assaig: the date is the heading, the rehearsal's own name (e.g. "Assaig general") sits below
  // it. Actuació: the event name is the heading (with a star icon ahead of it — the only place
  // the type still shows up now that neither the sash nor a text label carries it) and the date
  // moves to the subtitle line instead.
  protected readonly cardTitle = computed(() => {
    const ev = this.event();
    return ev.eventType === EventType.ASSAIG
      ? formatEventDate(ev.date)
      : ev.title;
  });

  protected readonly cardSubtitle = computed(() => {
    const ev = this.event();
    return ev.eventType === EventType.ASSAIG
      ? ev.title
      : formatEventDate(ev.date);
  });

  protected readonly ariaLabel = computed(() => {
    const subtitle = this.cardSubtitle();
    return subtitle ? `${this.cardTitle()}, ${subtitle}` : this.cardTitle();
  });

  protected readonly cardTone = computed<CardTone>(() =>
    this.isAssaig() ? 'default' : 'primary',
  );

  navigateToDetail(): void {
    if (!this.clickable()) return;
    this.router.navigate(['/events', this.event().id]);
  }

  onAttendanceChanged(personId: string, status: AttendanceStatus): void {
    this.attendanceChanged.emit({ eventId: this.event().id, personId, status });
  }
}
