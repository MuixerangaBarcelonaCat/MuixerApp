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
import {
  BeforeEventOffsetUnit,
  EventReferenceKind,
  EventType,
  NotificationLinkType,
  NotificationScheduleType,
  NotificationTargetType,
} from '@muixer/shared';
import { AlertComponent, ButtonComponent, ButtonGroupComponent, FormFieldComponent } from '@muixer/ui';
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
import { WEEKDAY_NAMES, WEEKDAY_DISPLAY_ORDER } from '../../utils/weekday-names';
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
    ButtonGroupComponent,
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
  readonly OffsetUnit = BeforeEventOffsetUnit;
  readonly EventTypeEnum = EventType;
  readonly weekdayNames = WEEKDAY_NAMES;
  readonly weekdayDisplayOrder = WEEKDAY_DISPLAY_ORDER;

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
  /** Which recurrence shape the "Programació" section shows — only used when mode() === 'schedule'. */
  scheduleKind = signal<NotificationScheduleType>(NotificationScheduleType.ONE_OFF);
  /** 0 (Sunday) .. 6 (Saturday) — only used when scheduleKind() === WEEKLY. */
  weeklyDayOfWeek = signal<number | null>(null);
  weeklyTimeOfDay = signal('');
  /** Optional active window (`type="date"` values) — empty means unbounded. */
  weeklyStartDate = signal('');
  weeklyEndDate = signal('');
  /** Only used when scheduleKind() === BEFORE_EVENT. */
  beforeEventType = signal<EventType | null>(null);
  beforeEventOffsetUnit = signal<BeforeEventOffsetUnit>(BeforeEventOffsetUnit.DAYS);
  beforeEventOffsetValue = signal<number | null>(null);
  /** Required for DAYS, unused for HOURS (fires relative to the event's own start time instead). */
  beforeEventTimeOfDay = signal('');
  beforeEventStartDate = signal('');
  beforeEventEndDate = signal('');
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

    if (this.isSchedule()) {
      if (this.scheduleKind() === NotificationScheduleType.WEEKLY) {
        if (this.weeklyDayOfWeek() === null || !this.weeklyTimeOfDay()) return false;
        const start = this.weeklyStartDate();
        const end = this.weeklyEndDate();
        if (start && end && end < start) return false;
      } else if (this.scheduleKind() === NotificationScheduleType.BEFORE_EVENT) {
        if (!this.beforeEventType() || !this.beforeEventOffsetValue()) return false;
        if (this.beforeEventOffsetUnit() === BeforeEventOffsetUnit.DAYS && !this.beforeEventTimeOfDay()) return false;
        const start = this.beforeEventStartDate();
        const end = this.beforeEventEndDate();
        if (start && end && end < start) return false;
      } else if (!this.scheduledFor()) {
        return false;
      }
    }

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

    // "Aquest esdeveniment" is resolved by the BEFORE_EVENT cron tick from the event it matched —
    // on any other recurrence there is no such event, and the dispatch would throw every minute.
    effect(() => {
      if (this.isSchedule() && this.scheduleKind() === NotificationScheduleType.BEFORE_EVENT) return;
      if (this.linkedEvent()?.kind === EventReferenceKind.TRIGGERING_EVENT) {
        this.linkedEvent.set(undefined);
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
          this.scheduleKind.set(schedule.scheduleType);
          if ('scheduledFor' in schedule.ruleConfig) {
            this.scheduledFor.set(toDatetimeLocalValue(schedule.ruleConfig.scheduledFor));
          } else if ('dayOfWeek' in schedule.ruleConfig) {
            this.weeklyDayOfWeek.set(schedule.ruleConfig.dayOfWeek);
            this.weeklyTimeOfDay.set(schedule.ruleConfig.timeOfDay);
            this.weeklyStartDate.set(schedule.ruleConfig.startDate ?? '');
            this.weeklyEndDate.set(schedule.ruleConfig.endDate ?? '');
          } else if ('eventType' in schedule.ruleConfig) {
            this.beforeEventType.set(schedule.ruleConfig.eventType);
            this.beforeEventOffsetUnit.set(schedule.ruleConfig.offsetUnit);
            this.beforeEventOffsetValue.set(schedule.ruleConfig.offsetValue);
            this.beforeEventTimeOfDay.set(schedule.ruleConfig.timeOfDay ?? '');
            this.beforeEventStartDate.set(schedule.ruleConfig.startDate ?? '');
            this.beforeEventEndDate.set(schedule.ruleConfig.endDate ?? '');
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
      const scheduleKind = this.scheduleKind();
      const payload: NotificationSchedulePayload = {
        ...content,
        scheduleType: scheduleKind,
        ...(scheduleKind === NotificationScheduleType.WEEKLY
          ? {
              weekly: {
                dayOfWeek: this.weeklyDayOfWeek() as number,
                timeOfDay: this.weeklyTimeOfDay(),
                ...(this.weeklyStartDate() ? { startDate: this.weeklyStartDate() } : {}),
                ...(this.weeklyEndDate() ? { endDate: this.weeklyEndDate() } : {}),
              },
            }
          : scheduleKind === NotificationScheduleType.BEFORE_EVENT
            ? {
                beforeEvent: {
                  eventType: this.beforeEventType() as EventType,
                  offsetUnit: this.beforeEventOffsetUnit(),
                  offsetValue: this.beforeEventOffsetValue() as number,
                  ...(this.beforeEventOffsetUnit() === BeforeEventOffsetUnit.DAYS
                    ? { timeOfDay: this.beforeEventTimeOfDay() }
                    : {}),
                  ...(this.beforeEventStartDate() ? { startDate: this.beforeEventStartDate() } : {}),
                  ...(this.beforeEventEndDate() ? { endDate: this.beforeEventEndDate() } : {}),
                },
              }
            : { oneOff: { scheduledFor: new Date(this.scheduledFor()).toISOString() } }),
      };
      const request = editId
        // On a PATCH an absent field means "leave it as it is", so a cleared link has to travel as
        // an explicit null — otherwise it can never be removed once set.
        ? this.notificationService.updateSchedule(editId, {
            ...payload,
            linkedEvent: payload.linkedEvent ?? null,
            url: payload.url ?? null,
          })
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
    this.scheduleKind.set(NotificationScheduleType.ONE_OFF);
    this.weeklyDayOfWeek.set(null);
    this.weeklyTimeOfDay.set('');
    this.weeklyStartDate.set('');
    this.weeklyEndDate.set('');
    this.beforeEventType.set(null);
    this.beforeEventOffsetUnit.set(BeforeEventOffsetUnit.DAYS);
    this.beforeEventOffsetValue.set(null);
    this.beforeEventTimeOfDay.set('');
    this.beforeEventStartDate.set('');
    this.beforeEventEndDate.set('');
    this.state.set('idle');
    this.errorMessage.set('');
  }

  cancelEdit(): void {
    this.router.navigate(['/communication/notifications/schedules']);
  }
}
