import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  effect,
  OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { EventReferenceKind, NotificationLinkType, NotificationTargetType } from '@muixer/shared';
import { AlertComponent, ButtonComponent, FormFieldComponent } from '@muixer/ui';
import {
  EventReferenceValue,
  NotificationLinkValue,
  NotificationService,
  NotificationTargetValue,
  SendNotificationPayload,
} from '../../services/notification.service';
import { EventService } from '../../../events/services/event.service';
import { EventListItem } from '../../../events/models/event.model';
import { PageHeaderComponent } from '../../../../shared/components/data/page-header/page-header.component';
import { NotificationEventPickerComponent } from '../notification-event-picker/notification-event-picker.component';
import { NotificationLinkPickerComponent } from '../notification-link-picker/notification-link-picker.component';
import { NotificationTargetPickerComponent } from '../notification-target-picker/notification-target-picker.component';

type SendState = 'idle' | 'sending' | 'success' | 'error';

@Component({
  selector: 'app-notification-send',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    LucideAngularModule,
    PageHeaderComponent,
    NotificationEventPickerComponent,
    NotificationLinkPickerComponent,
    NotificationTargetPickerComponent,
    AlertComponent,
    ButtonComponent,
    FormFieldComponent,
  ],
  templateUrl: './notification-send.component.html',
})
export class NotificationSendComponent implements OnInit {
  private readonly notificationService = inject(NotificationService);
  private readonly eventService = inject(EventService);

  title = signal('');
  body = signal('');
  linkedEvent = signal<EventReferenceValue | undefined>(undefined);
  link = signal<NotificationLinkValue>({ type: NotificationLinkType.HOME });
  target = signal<NotificationTargetValue>({ type: NotificationTargetType.ALL });
  events = signal<EventListItem[]>([]);
  state = signal<SendState>('idle');
  errorMessage = signal('');

  readonly isSending = computed(() => this.state() === 'sending');
  readonly hasLinkedEvent = computed(() => !!this.linkedEvent());

  readonly isFormValid = computed(() => {
    if (!this.title().trim() || !this.body().trim()) return false;

    const linkedEvent = this.linkedEvent();
    if (linkedEvent?.kind === EventReferenceKind.SPECIFIC && !linkedEvent.eventId) return false;

    const link = this.link();
    if (link.type === NotificationLinkType.CUSTOM && !link.url?.trim()) return false;

    const target = this.target();
    if (target.type === NotificationTargetType.EVENT_ATTENDANCE && !target.attendanceFilter) return false;
    if (target.type === NotificationTargetType.PERSON && !target.personIds?.length) return false;

    return true;
  });

  constructor() {
    // "Segons assistència" and a link to "the event" both only make sense with a linked event —
    // if it's cleared, fall back rather than leave the form pointing at a now-meaningless choice.
    effect(() => {
      if (this.linkedEvent()) return;
      if (this.link().type === NotificationLinkType.EVENT) {
        this.link.set({ type: NotificationLinkType.HOME });
      }
      if (this.target().type === NotificationTargetType.EVENT_ATTENDANCE) {
        this.target.set({ type: NotificationTargetType.ALL });
      }
    });
  }

  ngOnInit(): void {
    this.eventService.getAll({ limit: 100 }).subscribe({
      next: (resp) => this.events.set(resp.data),
      error: (_err: unknown) => { /* events silently fail — form just shows empty select */ },
    });
  }

  send(): void {
    if (!this.isFormValid() || this.isSending()) return;

    const link = this.link();
    const payload: SendNotificationPayload = {
      title: this.title().trim(),
      body: this.body().trim(),
      linkedEvent: this.linkedEvent(),
      linkTo: link.type,
      url: link.type === NotificationLinkType.CUSTOM ? link.url?.trim() : undefined,
      target: this.target(),
    };

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
    this.linkedEvent.set(undefined);
    this.link.set({ type: NotificationLinkType.HOME });
    this.target.set({ type: NotificationTargetType.ALL });
    this.state.set('idle');
    this.errorMessage.set('');
  }
}
