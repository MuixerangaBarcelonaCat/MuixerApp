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
import { FormatEventDatePipe } from '../../../../shared/pipes/format-event-date.pipe';

const datePipe = new FormatEventDatePipe();

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
      ? datePipe.transform(ev.date)
      : ev.title;
  });

  protected readonly cardSubtitle = computed(() => {
    const ev = this.event();
    return ev.eventType === EventType.ASSAIG
      ? 'Assaig'
      : datePipe.transform(ev.date);
  });

  protected readonly accentClass = computed(() =>
    this.isAssaig() ? 'border-secondary' : 'border-primary',
  );

  navigateToDetail(): void {
    this.router.navigate(['/events', this.event().id]);
  }
}
