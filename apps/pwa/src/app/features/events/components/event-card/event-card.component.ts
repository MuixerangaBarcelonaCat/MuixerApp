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
import { LucideAngularModule, MapPin, Clock } from 'lucide-angular';
import { AttendanceButtonComponent } from '../attendance-button/attendance-button.component';
import { formatEventDate } from '../../../../shared/pipes/format-event-date.pipe';

@Component({
  selector: 'app-event-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, AttendanceButtonComponent, SlicePipe],
  templateUrl: './event-card.component.html',
})
export class EventCardComponent {
  readonly event = input.required<MeEvent>();
  readonly attendanceChanged = output<{ eventId: string; personId: string; status: AttendanceStatus }>();

  protected readonly MapPin = MapPin;
  protected readonly Clock = Clock;

  private readonly router = inject(Router);

  protected readonly isAssaig = computed(
    () => this.event().eventType === EventType.ASSAIG,
  );

  protected readonly isPast = computed(() => {
    const today = new Date().toISOString().slice(0, 10);
    return this.event().date < today;
  });

  protected readonly cardTitle = computed(() => {
    const ev = this.event();
    return ev.eventType === EventType.ASSAIG
      ? formatEventDate(ev.date)
      : ev.title;
  });

  protected readonly cardSubtitle = computed(() => {
    const ev = this.event();
    return ev.eventType === EventType.ASSAIG
      ? 'Assaig'
      : formatEventDate(ev.date);
  });

  protected readonly accentClass = computed(() =>
    this.isAssaig() ? 'border-secondary' : 'border-primary',
  );

  navigateToDetail(): void {
    this.router.navigate(['/events', this.event().id]);
  }

  onAttendanceChanged(personId: string, status: AttendanceStatus): void {
    this.attendanceChanged.emit({ eventId: this.event().id, personId, status });
  }
}
