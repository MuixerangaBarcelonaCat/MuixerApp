import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  inject,
  signal,
  computed,
  OnInit,
  input,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SlicePipe } from '@angular/common';
import { MeEventDetail, EventType } from '@muixer/shared';
import { LucideAngularModule, MapPin, Clock, Info } from 'lucide-angular';
import { MobileHeaderComponent } from '../../../shared/components/mobile-header/mobile-header.component';
import { SkeletonCardComponent } from '../../../shared/components/skeleton-card/skeleton-card.component';
import { AttendanceButtonComponent } from '../components/attendance-button/attendance-button.component';
import { FormatEventDatePipe } from '../../../shared/pipes/format-event-date.pipe';
import { EventService } from '../services/event.service';

@Component({
  selector: 'app-event-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucideAngularModule,
    MobileHeaderComponent,
    SkeletonCardComponent,
    AttendanceButtonComponent,
    FormatEventDatePipe,
    SlicePipe,
  ],
  templateUrl: './event-detail.component.html',
})
export class EventDetailComponent implements OnInit {
  readonly id = input.required<string>();

  protected readonly MapPin = MapPin;
  protected readonly Clock = Clock;
  protected readonly Info = Info;

  private readonly eventService = inject(EventService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly event = signal<MeEventDetail | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly hasError = signal(false);

  protected readonly isAssaig = computed(
    () => this.event()?.eventType === EventType.ASSAIG,
  );

  protected readonly isPast = computed(() => {
    const date = this.event()?.date;
    if (!date) return false;
    return date < new Date().toISOString().slice(0, 10);
  });

  ngOnInit(): void {
    this.eventService.findOne(this.id()).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (ev) => {
        this.event.set(ev);
        this.isLoading.set(false);
      },
      error: () => {
        this.hasError.set(true);
        this.isLoading.set(false);
      },
    });
  }
}
