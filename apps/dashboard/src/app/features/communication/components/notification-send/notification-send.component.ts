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
import { ActivatedRoute, Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { EventReferenceKind, NotificationLinkType, NotificationScheduleType, NotificationTargetType } from '@muixer/shared';
import { AlertComponent, ButtonComponent, FormFieldComponent } from '@muixer/ui';
import {
  EventReferenceValue,
  NotificationLinkValue,
  NotificationSchedulePayload,
  NotificationService,
  NotificationTargetValue,
  SendNotificationPayload,
} from '../../services/notification.service';
import { EventService } from '../../../events/services/event.service';
import { EventListItem } from '../../../events/models/event.model';
import { toDatetimeLocalValue } from '../../../../shared/utils';
import { PageHeaderComponent } from '../../../../shared/components/data/page-header/page-header.component';
import { NotificationEventPickerComponent } from '../notification-event-picker/notification-event-picker.component';
import { NotificationLinkPickerComponent } from '../notification-link-picker/notification-link-picker.component';
import { NotificationTargetPickerComponent } from '../notification-target-picker/notification-target-picker.component';

type SendState = 'idle' | 'sending' | 'success' | 'error';
type NotificationSendMode = 'send' | 'schedule';

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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly ScheduleType = NotificationScheduleType;

  /** Set via route `data.mode` — `/communication/notifications` (send) and
   *  `/communication/notifications/schedules/new` (schedule) render this same component. */
  readonly mode = signal<NotificationSendMode>((this.route.snapshot.data['mode'] as NotificationSendMode) ?? 'send');
  /** Present only on `/communication/notifications/schedules/:id/edit` — same component, same
   *  pattern as NewsEditorComponent toggling create/edit off the presence of the `id` param. */
  private readonly scheduleId = signal<string | null>(this.route.snapshot.paramMap.get('id'));
  readonly isEditMode = computed(() => this.scheduleId() !== null);

  title = signal('');
  body = signal('');
  linkedEvent = signal<EventReferenceValue | undefined>(undefined);
  link = signal<NotificationLinkValue>({ type: NotificationLinkType.HOME });
  target = signal<NotificationTargetValue>({ type: NotificationTargetType.ALL });
  /** `datetime-local` input value (local time, no timezone) — only used when mode() === 'schedule'. */
  scheduledFor = signal('');
  events = signal<EventListItem[]>([]);
  state = signal<SendState>('idle');
  errorMessage = signal('');

  readonly isSending = computed(() => this.state() === 'sending');
  readonly hasLinkedEvent = computed(() => !!this.linkedEvent());
  readonly isSchedule = computed(() => this.mode() === 'schedule');

  readonly pageTitle = computed(() => {
    if (this.isEditMode()) return 'Edita la notificació programada';
    return this.isSchedule() ? 'Programa notificació' : 'Envia notificació';
  });
  readonly submitLabel = computed(() => {
    if (this.isEditMode()) return 'Desa els canvis';
    return this.isSchedule() ? 'Programa notificació' : 'Envia notificació';
  });

  readonly isFormValid = computed(() => {
    if (!this.title().trim() || !this.body().trim()) return false;

    const linkedEvent = this.linkedEvent();
    if (linkedEvent?.kind === EventReferenceKind.SPECIFIC && !linkedEvent.eventId) return false;

    const link = this.link();
    if (link.type === NotificationLinkType.CUSTOM && !link.url?.trim()) return false;

    const target = this.target();
    if (target.type === NotificationTargetType.EVENT_ATTENDANCE && !target.attendanceFilter) return false;
    if (target.type === NotificationTargetType.PERSON && !target.personIds?.length) return false;

    if (this.isSchedule() && !this.scheduledFor()) return false;

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

    const id = this.scheduleId();
    if (id) {
      this.notificationService.getSchedule(id).subscribe({
        next: (schedule) => {
          this.title.set(schedule.title);
          this.body.set(schedule.body);
          this.linkedEvent.set(schedule.linkedEvent ?? undefined);
          this.link.set({ type: schedule.linkTo, url: schedule.url ?? undefined });
          this.target.set(schedule.target);
          if ('scheduledFor' in schedule.ruleConfig) {
            this.scheduledFor.set(toDatetimeLocalValue(schedule.ruleConfig.scheduledFor));
          }
        },
        error: () => {
          this.errorMessage.set('Error en carregar la notificació programada.');
          this.state.set('error');
        },
      });
    }
  }

  send(): void {
    if (!this.isFormValid() || this.isSending()) return;

    const link = this.link();
    const content = {
      title: this.title().trim(),
      body: this.body().trim(),
      linkedEvent: this.linkedEvent(),
      linkTo: link.type,
      url: link.type === NotificationLinkType.CUSTOM ? link.url?.trim() : undefined,
      target: this.target(),
    };

    this.state.set('sending');

    const onError = (err: { error?: { message?: string } }) => {
      this.errorMessage.set(err?.error?.message ?? 'Error desconegut en processar la notificació.');
      this.state.set('error');
    };

    const editId = this.scheduleId();
    if (this.isSchedule() || editId) {
      const payload: NotificationSchedulePayload = {
        ...content,
        scheduleType: NotificationScheduleType.ONE_OFF,
        oneOff: { scheduledFor: new Date(this.scheduledFor()).toISOString() },
      };
      const request = editId
        ? this.notificationService.updateSchedule(editId, payload)
        : this.notificationService.createSchedule(payload);
      request.subscribe({
        next: () => this.state.set('success'),
        error: onError,
      });
      return;
    }

    const payload: SendNotificationPayload = content;
    this.notificationService.send(payload).subscribe({
      next: () => this.state.set('success'),
      error: onError,
    });
  }

  reset(): void {
    this.title.set('');
    this.body.set('');
    this.linkedEvent.set(undefined);
    this.link.set({ type: NotificationLinkType.HOME });
    this.target.set({ type: NotificationTargetType.ALL });
    this.scheduledFor.set('');
    this.state.set('idle');
    this.errorMessage.set('');
  }

  cancelEdit(): void {
    this.router.navigate(['/communication/notifications/schedules']);
  }
}
