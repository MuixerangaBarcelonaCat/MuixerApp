import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { EventType, MeEvent } from '@muixer/shared';
import { LucideAngularModule, MapPin, Clock } from 'lucide-angular';
import { AttendanceButtonComponent } from '../attendance-button/attendance-button.component';

const DATE_FORMATTER = new Intl.DateTimeFormat('ca', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

@Component({
  selector: 'app-event-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, AttendanceButtonComponent],
  templateUrl: './event-card.component.html',
})
export class EventCardComponent {
  readonly event = input.required<MeEvent>();

  protected readonly MapPin = MapPin;
  protected readonly Clock = Clock;

  private readonly router = inject(Router);

  protected readonly isAssaig = computed(
    () => this.event().eventType === EventType.ASSAIG,
  );

  protected readonly cardTitle = computed(() => {
    const ev = this.event();
    return ev.eventType === EventType.ASSAIG
      ? this.formatDate(ev.date)
      : ev.title;
  });

  protected readonly cardSubtitle = computed(() => {
    const ev = this.event();
    return ev.eventType === EventType.ASSAIG
      ? 'Assaig'
      : this.formatDate(ev.date);
  });

  protected readonly accentClass = computed(() =>
    this.isAssaig() ? 'border-secondary' : 'border-primary',
  );

  navigateToDetail(): void {
    this.router.navigate(['/events', this.event().id]);
  }

  private formatDate(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    if (isNaN(date.getTime())) return '';
    const formatted = DATE_FORMATTER.format(date);
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }
}
