import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SlicePipe } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { NotificationTargetType, AttendanceStatus } from '@muixer/shared';
import {
  BadgeComponent,
  ButtonComponent,
  ButtonGroupComponent,
  SelectComponent,
} from '@muixer/ui';
import { NotificationService, SendNotificationPayload } from '../../services/notification.service';
import { EventService } from '../../../events/services/event.service';
import { EventListItem } from '../../../events/models/event.model';
import { Person } from '../../../persons/models/person.model';
import { PageHeaderComponent } from '../../../../shared/components/data/page-header/page-header.component';
import { PersonSearchInputComponent } from '../../../../shared/components/forms/person-search-input/person-search-input.component';

type SendState = 'idle' | 'sending' | 'success' | 'error';

@Component({
  selector: 'app-notification-send',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    SlicePipe,
    LucideAngularModule,
    PageHeaderComponent,
    PersonSearchInputComponent,
    BadgeComponent,
    ButtonComponent,
    ButtonGroupComponent,
    SelectComponent,
  ],
  templateUrl: './notification-send.component.html',
})
export class NotificationSendComponent implements OnInit {
  private readonly notificationService = inject(NotificationService);
  private readonly eventService = inject(EventService);

  readonly TargetType = NotificationTargetType;
  readonly AttendanceStatus = AttendanceStatus;

  title = signal('');
  body = signal('');
  url = signal('');
  targetType = signal<NotificationTargetType>(NotificationTargetType.ALL);
  selectedEventId = signal<string>('');
  attendanceFilter = signal<AttendanceStatus | ''>('');
  selectedPersons = signal<Person[]>([]);
  events = signal<EventListItem[]>([]);
  state = signal<SendState>('idle');
  errorMessage = signal('');

  readonly isSending = computed(() => this.state() === 'sending');

  readonly personIds = computed(() => this.selectedPersons().map((p) => p.id));

  readonly isFormValid = computed(() => {
    if (!this.title().trim() || !this.body().trim()) return false;
    if (this.targetType() === NotificationTargetType.EVENT_ATTENDANCE && !this.selectedEventId()) return false;
    if (this.targetType() === NotificationTargetType.PERSON && this.selectedPersons().length === 0) return false;
    return true;
  });

  ngOnInit(): void {
    this.eventService.getAll({ limit: 200 }).subscribe({
      next: (resp) => this.events.set(resp.data),
      error: (_err: unknown) => { /* events silently fail — form just shows empty select */ },
    });
  }

  addPerson(person: Person): void {
    if (!this.selectedPersons().some((p) => p.id === person.id)) {
      this.selectedPersons.update((list) => [...list, person]);
    }
  }

  removePerson(id: string): void {
    this.selectedPersons.update((list) => list.filter((p) => p.id !== id));
  }

  send(): void {
    if (!this.isFormValid() || this.isSending()) return;

    const payload: SendNotificationPayload = {
      title: this.title().trim(),
      body: this.body().trim(),
      url: this.url().trim() || undefined,
      target: { type: this.targetType() },
    };

    if (this.targetType() === NotificationTargetType.EVENT_ATTENDANCE) {
      payload.target.eventId = this.selectedEventId();
      if (this.attendanceFilter()) {
        payload.target.attendanceFilter = this.attendanceFilter() as AttendanceStatus;
      }
    }

    if (this.targetType() === NotificationTargetType.PERSON) {
      payload.target.personIds = this.personIds();
    }

    this.state.set('sending');
    this.notificationService.send(payload).subscribe({
      next: () => this.state.set('success'),
      error: (err) => {
        this.errorMessage.set(err?.error?.message ?? 'Error desconegut en enviar la notificació.');
        this.state.set('error');
      },
    });
  }

  reset(): void {
    this.title.set('');
    this.body.set('');
    this.url.set('');
    this.targetType.set(NotificationTargetType.ALL);
    this.selectedEventId.set('');
    this.attendanceFilter.set('');
    this.selectedPersons.set([]);
    this.state.set('idle');
    this.errorMessage.set('');
  }
}
