import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import {
  AttendanceStatus,
  BeforeEventOffsetUnit,
  EventReferenceKind,
  EventType,
  NotificationLinkType,
  NotificationScheduleType,
  NotificationTargetType,
} from '@muixer/shared';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { NotificationSendComponent } from './notification-send.component';
import { NotificationService } from '../../services/notification.service';
import { EventService } from '../../../events/services/event.service';
import { toDatetimeLocalValue } from '../../../../shared/utils';

describe('NotificationSendComponent', () => {
  let component: NotificationSendComponent;
  let fixture: ComponentFixture<NotificationSendComponent>;
  let notificationService: { send: ReturnType<typeof vi.fn>; createSchedule: ReturnType<typeof vi.fn> };
  let eventService: { getAll: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    notificationService = {
      send: vi.fn().mockReturnValue(of({ accepted: true })),
      createSchedule: vi.fn().mockReturnValue(of({ id: 'schedule-1' })),
    };
    eventService = { getAll: vi.fn().mockReturnValue(of({ data: [], meta: { total: 0, page: 1, limit: 200 } })) };

    await TestBed.configureTestingModule({
      imports: [NotificationSendComponent],
      providers: [
        { provide: NotificationService, useValue: notificationService },
        { provide: EventService, useValue: eventService },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => null }, data: {} } } },
        allLucideIconsProvider,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationSendComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('initialises with no linked event, HOME link, ALL target, and an invalid empty form', () => {
    expect(component.linkedEvent()).toBeUndefined();
    expect(component.link().type).toBe(NotificationLinkType.HOME);
    expect(component.target().type).toBe(NotificationTargetType.ALL);
    expect(component.isFormValid()).toBe(false);
  });

  it('enables form only when title and body are filled', () => {
    component.title.set('Títol');
    expect(component.isFormValid()).toBe(false);
    component.body.set('Cos');
    expect(component.isFormValid()).toBe(true);
  });

  it('requires an eventId when the linked event is SPECIFIC', () => {
    component.title.set('T');
    component.body.set('B');
    component.linkedEvent.set({ kind: EventReferenceKind.SPECIFIC });
    expect(component.isFormValid()).toBe(false);
    component.linkedEvent.set({ kind: EventReferenceKind.SPECIFIC, eventId: 'evt-1' });
    expect(component.isFormValid()).toBe(true);
  });

  it('requires a url when the link type is CUSTOM', () => {
    component.title.set('T');
    component.body.set('B');
    component.link.set({ type: NotificationLinkType.CUSTOM });
    expect(component.isFormValid()).toBe(false);
    component.link.set({ type: NotificationLinkType.CUSTOM, url: '/noticies/1' });
    expect(component.isFormValid()).toBe(true);
  });

  it('requires an attendance filter when the target is EVENT_ATTENDANCE', () => {
    component.title.set('T');
    component.body.set('B');
    component.linkedEvent.set({ kind: EventReferenceKind.NEXT_ACTUACIO });
    component.target.set({ type: NotificationTargetType.EVENT_ATTENDANCE });
    expect(component.isFormValid()).toBe(false);
    component.target.set({ type: NotificationTargetType.EVENT_ATTENDANCE, attendanceFilter: AttendanceStatus.ANIRE });
    expect(component.isFormValid()).toBe(true);
  });

  it('requires at least one person when target is PERSON', () => {
    component.title.set('T');
    component.body.set('B');
    component.target.set({ type: NotificationTargetType.PERSON });
    expect(component.isFormValid()).toBe(false);
    component.target.set({ type: NotificationTargetType.PERSON, personIds: ['p1'] });
    expect(component.isFormValid()).toBe(true);
  });

  it('clears the link back to HOME when the linked event is removed while linked to EVENT', () => {
    component.linkedEvent.set({ kind: EventReferenceKind.NEXT_ACTUACIO });
    component.link.set({ type: NotificationLinkType.EVENT });
    fixture.detectChanges();

    component.linkedEvent.set(undefined);
    fixture.detectChanges();

    expect(component.link().type).toBe(NotificationLinkType.HOME);
  });

  it('resets the target back to ALL when the linked event is removed while targeting EVENT_ATTENDANCE', () => {
    component.linkedEvent.set({ kind: EventReferenceKind.NEXT_ACTUACIO });
    component.target.set({ type: NotificationTargetType.EVENT_ATTENDANCE, attendanceFilter: AttendanceStatus.ANIRE });
    fixture.detectChanges();

    component.linkedEvent.set(undefined);
    fixture.detectChanges();

    expect(component.target().type).toBe(NotificationTargetType.ALL);
  });

  it('sends the minimal ALL / HOME payload', () => {
    component.title.set('Assaig cancel·lat');
    component.body.set('Avui no hi ha assaig.');
    component.send();

    expect(notificationService.send).toHaveBeenCalledWith({
      title: 'Assaig cancel·lat',
      body: 'Avui no hi ha assaig.',
      linkedEvent: undefined,
      linkTo: NotificationLinkType.HOME,
      url: undefined,
      target: { type: NotificationTargetType.ALL },
    });
  });

  it('sends the linked event and EVENT_ATTENDANCE target together', () => {
    component.title.set('T');
    component.body.set('B');
    component.linkedEvent.set({ kind: EventReferenceKind.NEXT_ACTUACIO });
    component.target.set({ type: NotificationTargetType.EVENT_ATTENDANCE, attendanceFilter: AttendanceStatus.ANIRE });
    component.send();

    expect(notificationService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        linkedEvent: { kind: EventReferenceKind.NEXT_ACTUACIO },
        target: { type: NotificationTargetType.EVENT_ATTENDANCE, attendanceFilter: AttendanceStatus.ANIRE },
      }),
    );
  });

  it('sends PERSON notification with personIds', () => {
    component.title.set('T');
    component.body.set('B');
    component.target.set({ type: NotificationTargetType.PERSON, personIds: ['p1', 'p2'] });
    component.send();

    expect(notificationService.send).toHaveBeenCalledWith(
      expect.objectContaining({ target: { type: NotificationTargetType.PERSON, personIds: ['p1', 'p2'] } }),
    );
  });

  it('sends linkTo CUSTOM with its url', () => {
    component.title.set('T');
    component.body.set('B');
    component.link.set({ type: NotificationLinkType.CUSTOM, url: '/noticies/123' });
    component.send();

    expect(notificationService.send).toHaveBeenCalledWith(
      expect.objectContaining({ linkTo: NotificationLinkType.CUSTOM, url: '/noticies/123' }),
    );
  });

  it('sends linkTo EVENT with the linked event, and no url', () => {
    component.title.set('T');
    component.body.set('B');
    component.linkedEvent.set({ kind: EventReferenceKind.NEXT_ACTUACIO });
    component.link.set({ type: NotificationLinkType.EVENT });
    component.send();

    expect(notificationService.send).toHaveBeenCalledWith(
      expect.objectContaining({ linkTo: NotificationLinkType.EVENT, url: undefined }),
    );
  });

  it('sets state to success on successful send', () => {
    component.title.set('T');
    component.body.set('B');
    component.send();
    expect(component.state()).toBe('success');
  });

  it('sets state to error and stores message on failed send', () => {
    notificationService.send.mockReturnValue(throwError(() => ({ error: { message: 'Sense subscriptors' } })));
    component.title.set('T');
    component.body.set('B');
    component.send();
    expect(component.state()).toBe('error');
    expect(component.errorMessage()).toBe('Sense subscriptors');
  });

  it('resets form back to initial state', () => {
    component.title.set('T');
    component.body.set('B');
    component.linkedEvent.set({ kind: EventReferenceKind.NEXT_ACTUACIO });
    component.link.set({ type: NotificationLinkType.EVENT });
    component.target.set({ type: NotificationTargetType.PERSON, personIds: ['p1'] });
    component.state.set('success');
    component.reset();
    expect(component.title()).toBe('');
    expect(component.linkedEvent()).toBeUndefined();
    expect(component.link()).toEqual({ type: NotificationLinkType.HOME });
    expect(component.target()).toEqual({ type: NotificationTargetType.ALL });
    expect(component.state()).toBe('idle');
  });

  it('defaults to send mode when the route carries no mode', () => {
    expect(component.mode()).toBe('send');
    expect(component.submitLabel()).toBe('Envia notificació');
  });
});

describe('NotificationSendComponent (schedule mode)', () => {
  let component: NotificationSendComponent;
  let fixture: ComponentFixture<NotificationSendComponent>;
  let notificationService: { send: ReturnType<typeof vi.fn>; createSchedule: ReturnType<typeof vi.fn> };
  let eventService: { getAll: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    notificationService = {
      send: vi.fn().mockReturnValue(of({ accepted: true })),
      createSchedule: vi.fn().mockReturnValue(of({ id: 'schedule-1' })),
    };
    eventService = { getAll: vi.fn().mockReturnValue(of({ data: [], meta: { total: 0, page: 1, limit: 200 } })) };

    await TestBed.configureTestingModule({
      imports: [NotificationSendComponent],
      providers: [
        { provide: NotificationService, useValue: notificationService },
        { provide: EventService, useValue: eventService },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => null }, data: { mode: 'schedule' } } } },
        allLucideIconsProvider,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationSendComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('reads mode from route data and adjusts the submit label', () => {
    expect(component.mode()).toBe('schedule');
    expect(component.submitLabel()).toBe('Programa notificació');
  });

  it('is invalid without a scheduledFor even when content is valid', () => {
    component.title.set('T');
    component.body.set('B');
    expect(component.isFormValid()).toBe(false);
    component.scheduledFor.set('2026-06-01T18:00');
    expect(component.isFormValid()).toBe(true);
  });

  it('creates a ONE_OFF schedule with the ISO scheduledFor instead of sending immediately', () => {
    component.title.set('Assaig');
    component.body.set('Dijous a les 20h');
    component.scheduledFor.set('2026-06-01T18:00');
    component.send();

    expect(notificationService.createSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Assaig',
        body: 'Dijous a les 20h',
        scheduleType: NotificationScheduleType.ONE_OFF,
        oneOff: { scheduledFor: new Date('2026-06-01T18:00').toISOString() },
      }),
    );
    expect(notificationService.send).not.toHaveBeenCalled();
  });

  it('sets state to success on successful schedule creation', () => {
    component.title.set('T');
    component.body.set('B');
    component.scheduledFor.set('2026-06-01T18:00');
    component.send();
    expect(component.state()).toBe('success');
  });

  it('resets scheduledFor back to empty', () => {
    component.scheduledFor.set('2026-06-01T18:00');
    component.reset();
    expect(component.scheduledFor()).toBe('');
  });

  it('defaults to ONE_OFF scheduleKind', () => {
    expect(component.scheduleKind()).toBe(NotificationScheduleType.ONE_OFF);
  });

  describe('WEEKLY', () => {
    beforeEach(() => {
      component.scheduleKind.set(NotificationScheduleType.WEEKLY);
    });

    it('is invalid without both a day of week and a time of day', () => {
      component.title.set('T');
      component.body.set('B');
      expect(component.isFormValid()).toBe(false);
      component.weeklyDayOfWeek.set(1);
      expect(component.isFormValid()).toBe(false);
      component.weeklyTimeOfDay.set('18:00');
      expect(component.isFormValid()).toBe(true);
    });

    it('accepts dayOfWeek 0 (Sunday) as valid, not falsy-missing', () => {
      component.title.set('T');
      component.body.set('B');
      component.weeklyDayOfWeek.set(0);
      component.weeklyTimeOfDay.set('09:00');
      expect(component.isFormValid()).toBe(true);
    });

    it('creates a WEEKLY schedule with dayOfWeek/timeOfDay instead of oneOff', () => {
      component.title.set('Assaig');
      component.body.set('Cada dilluns');
      component.weeklyDayOfWeek.set(1);
      component.weeklyTimeOfDay.set('18:00');
      component.send();

      expect(notificationService.createSchedule).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduleType: NotificationScheduleType.WEEKLY,
          weekly: { dayOfWeek: 1, timeOfDay: '18:00' },
        }),
      );
      expect(notificationService.createSchedule.mock.calls[0][0].oneOff).toBeUndefined();
    });

    it('lists the day-of-week options Monday-first, with Sunday last', () => {
      fixture.detectChanges();
      const options = Array.from(
        fixture.nativeElement.querySelectorAll('select[name="weeklyDayOfWeek"] option'),
      ) as HTMLOptionElement[];
      const labels = options.map((o) => o.textContent?.trim());
      expect(labels).toEqual([
        'Seleccioneu un dia...',
        'Dilluns',
        'Dimarts',
        'Dimecres',
        'Dijous',
        'Divendres',
        'Dissabte',
        'Diumenge',
      ]);
    });

    describe('startDate/endDate', () => {
      it('is valid with no startDate/endDate (unbounded)', () => {
        component.title.set('T');
        component.body.set('B');
        component.weeklyDayOfWeek.set(1);
        component.weeklyTimeOfDay.set('18:00');
        expect(component.isFormValid()).toBe(true);
      });

      it('is invalid when endDate is before startDate', () => {
        component.title.set('T');
        component.body.set('B');
        component.weeklyDayOfWeek.set(1);
        component.weeklyTimeOfDay.set('18:00');
        component.weeklyStartDate.set('2026-12-31');
        component.weeklyEndDate.set('2026-06-01');
        expect(component.isFormValid()).toBe(false);
      });

      it('is valid when endDate equals startDate', () => {
        component.title.set('T');
        component.body.set('B');
        component.weeklyDayOfWeek.set(1);
        component.weeklyTimeOfDay.set('18:00');
        component.weeklyStartDate.set('2026-06-01');
        component.weeklyEndDate.set('2026-06-01');
        expect(component.isFormValid()).toBe(true);
      });

      it('sends startDate/endDate when set', () => {
        component.title.set('Assaig');
        component.body.set('Cada dilluns');
        component.weeklyDayOfWeek.set(1);
        component.weeklyTimeOfDay.set('18:00');
        component.weeklyStartDate.set('2026-06-01');
        component.weeklyEndDate.set('2026-12-31');
        component.send();

        expect(notificationService.createSchedule).toHaveBeenCalledWith(
          expect.objectContaining({
            weekly: { dayOfWeek: 1, timeOfDay: '18:00', startDate: '2026-06-01', endDate: '2026-12-31' },
          }),
        );
      });

      it('omits startDate/endDate from the payload when not set', () => {
        component.title.set('Assaig');
        component.body.set('Cada dilluns');
        component.weeklyDayOfWeek.set(1);
        component.weeklyTimeOfDay.set('18:00');
        component.send();

        expect(notificationService.createSchedule).toHaveBeenCalledWith(
          expect.objectContaining({ weekly: { dayOfWeek: 1, timeOfDay: '18:00' } }),
        );
      });
    });
  });

  describe('BEFORE_EVENT', () => {
    beforeEach(() => {
      component.scheduleKind.set(NotificationScheduleType.BEFORE_EVENT);
    });

    it('is invalid without eventType, offsetValue, and (for DAYS) timeOfDay', () => {
      component.title.set('T');
      component.body.set('B');
      expect(component.isFormValid()).toBe(false);
      component.beforeEventType.set(EventType.ACTUACIO);
      expect(component.isFormValid()).toBe(false);
      component.beforeEventOffsetValue.set(3);
      expect(component.isFormValid()).toBe(false);
      component.beforeEventTimeOfDay.set('09:00');
      expect(component.isFormValid()).toBe(true);
    });

    it('does not require timeOfDay for a HOURS offset', () => {
      component.title.set('T');
      component.body.set('B');
      component.beforeEventType.set(EventType.ACTUACIO);
      component.beforeEventOffsetValue.set(3);
      component.beforeEventOffsetUnit.set(BeforeEventOffsetUnit.HOURS);
      expect(component.isFormValid()).toBe(true);
    });

    it('is invalid when endDate is before startDate', () => {
      component.title.set('T');
      component.body.set('B');
      component.beforeEventType.set(EventType.ACTUACIO);
      component.beforeEventOffsetValue.set(3);
      component.beforeEventTimeOfDay.set('09:00');
      component.beforeEventStartDate.set('2026-12-31');
      component.beforeEventEndDate.set('2026-06-01');
      expect(component.isFormValid()).toBe(false);
    });

    it('creates a BEFORE_EVENT/DAYS schedule instead of oneOff or weekly', () => {
      component.title.set('Actuació');
      component.body.set('Recordatori');
      component.beforeEventType.set(EventType.ACTUACIO);
      component.beforeEventOffsetValue.set(3);
      component.beforeEventTimeOfDay.set('09:00');
      component.send();

      expect(notificationService.createSchedule).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduleType: NotificationScheduleType.BEFORE_EVENT,
          beforeEvent: { eventType: EventType.ACTUACIO, offsetUnit: BeforeEventOffsetUnit.DAYS, offsetValue: 3, timeOfDay: '09:00' },
        }),
      );
      expect(notificationService.createSchedule.mock.calls[0][0].oneOff).toBeUndefined();
      expect(notificationService.createSchedule.mock.calls[0][0].weekly).toBeUndefined();
    });

    it('creates a BEFORE_EVENT/HOURS schedule without a timeOfDay', () => {
      component.title.set('Actuació');
      component.body.set('Recordatori');
      component.beforeEventType.set(EventType.ACTUACIO);
      component.beforeEventOffsetValue.set(2);
      component.beforeEventOffsetUnit.set(BeforeEventOffsetUnit.HOURS);
      component.send();

      expect(notificationService.createSchedule).toHaveBeenCalledWith(
        expect.objectContaining({
          beforeEvent: { eventType: EventType.ACTUACIO, offsetUnit: BeforeEventOffsetUnit.HOURS, offsetValue: 2 },
        }),
      );
    });

    it('sends startDate/endDate when set', () => {
      component.title.set('Actuació');
      component.body.set('Recordatori');
      component.beforeEventType.set(EventType.ACTUACIO);
      component.beforeEventOffsetValue.set(3);
      component.beforeEventTimeOfDay.set('09:00');
      component.beforeEventStartDate.set('2026-06-01');
      component.beforeEventEndDate.set('2026-12-31');
      component.send();

      expect(notificationService.createSchedule).toHaveBeenCalledWith(
        expect.objectContaining({
          beforeEvent: {
            eventType: EventType.ACTUACIO,
            offsetUnit: BeforeEventOffsetUnit.DAYS,
            offsetValue: 3,
            timeOfDay: '09:00',
            startDate: '2026-06-01',
            endDate: '2026-12-31',
          },
        }),
      );
    });
  });

  it('resets scheduleKind and weekly fields back to defaults', () => {
    component.scheduleKind.set(NotificationScheduleType.WEEKLY);
    component.weeklyDayOfWeek.set(3);
    component.weeklyTimeOfDay.set('12:00');
    component.weeklyStartDate.set('2026-06-01');
    component.weeklyEndDate.set('2026-12-31');
    component.reset();
    expect(component.scheduleKind()).toBe(NotificationScheduleType.ONE_OFF);
    expect(component.weeklyStartDate()).toBe('');
    expect(component.weeklyEndDate()).toBe('');
    expect(component.weeklyDayOfWeek()).toBeNull();
    expect(component.weeklyTimeOfDay()).toBe('');
  });

  it('resets beforeEvent fields back to defaults', () => {
    component.scheduleKind.set(NotificationScheduleType.BEFORE_EVENT);
    component.beforeEventType.set(EventType.ACTUACIO);
    component.beforeEventOffsetUnit.set(BeforeEventOffsetUnit.HOURS);
    component.beforeEventOffsetValue.set(3);
    component.beforeEventTimeOfDay.set('09:00');
    component.beforeEventStartDate.set('2026-06-01');
    component.beforeEventEndDate.set('2026-12-31');
    component.reset();
    expect(component.beforeEventType()).toBeNull();
    expect(component.beforeEventOffsetUnit()).toBe(BeforeEventOffsetUnit.DAYS);
    expect(component.beforeEventOffsetValue()).toBeNull();
    expect(component.beforeEventTimeOfDay()).toBe('');
    expect(component.beforeEventStartDate()).toBe('');
    expect(component.beforeEventEndDate()).toBe('');
  });
});

describe('NotificationSendComponent (edit mode)', () => {
  let component: NotificationSendComponent;
  let fixture: ComponentFixture<NotificationSendComponent>;
  let notificationService: {
    send: ReturnType<typeof vi.fn>;
    createSchedule: ReturnType<typeof vi.fn>;
    getSchedule: ReturnType<typeof vi.fn>;
    updateSchedule: ReturnType<typeof vi.fn>;
  };
  let eventService: { getAll: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  const mockSchedule = {
    id: 'schedule-1',
    title: 'Assaig',
    body: 'Dijous a les 20h',
    linkedEvent: { kind: EventReferenceKind.NEXT_ACTUACIO },
    linkTo: NotificationLinkType.HOME,
    url: null,
    target: { type: NotificationTargetType.ALL },
    scheduleType: NotificationScheduleType.ONE_OFF,
    ruleConfig: { scheduledFor: '2026-06-01T18:00:00.000Z' },
    isActive: true,
    createdByUserId: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(async () => {
    notificationService = {
      send: vi.fn().mockReturnValue(of({ accepted: true })),
      createSchedule: vi.fn().mockReturnValue(of({ id: 'schedule-1' })),
      getSchedule: vi.fn().mockReturnValue(of(mockSchedule)),
      updateSchedule: vi.fn().mockReturnValue(of(mockSchedule)),
    };
    eventService = { getAll: vi.fn().mockReturnValue(of({ data: [], meta: { total: 0, page: 1, limit: 200 } })) };
    router = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [NotificationSendComponent],
      providers: [
        { provide: NotificationService, useValue: notificationService },
        { provide: EventService, useValue: eventService },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'schedule-1' }, data: { mode: 'schedule' } } },
        },
        allLucideIconsProvider,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationSendComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('is in edit mode with an adjusted title and submit label', () => {
    expect(component.isEditMode()).toBe(true);
    expect(component.pageTitle()).toBe('Edita la notificació programada');
    expect(component.submitLabel()).toBe('Desa els canvis');
  });

  it('loads and prefills the existing schedule', () => {
    expect(notificationService.getSchedule).toHaveBeenCalledWith('schedule-1');
    expect(component.title()).toBe('Assaig');
    expect(component.body()).toBe('Dijous a les 20h');
    expect(component.linkedEvent()).toEqual({ kind: EventReferenceKind.NEXT_ACTUACIO });
    expect(component.link()).toEqual({ type: NotificationLinkType.HOME, url: undefined });
    expect(component.target()).toEqual({ type: NotificationTargetType.ALL });
    expect(component.scheduledFor()).toBe(toDatetimeLocalValue(mockSchedule.ruleConfig.scheduledFor));
  });

  it('updates the schedule instead of creating a new one', () => {
    component.title.set('Updated title');
    component.send();

    expect(notificationService.updateSchedule).toHaveBeenCalledWith(
      'schedule-1',
      expect.objectContaining({ title: 'Updated title' }),
    );
    expect(notificationService.createSchedule).not.toHaveBeenCalled();
    expect(component.state()).toBe('success');
  });

  it('shows an error state when the schedule fails to load', async () => {
    notificationService.getSchedule.mockReturnValue(throwError(() => new Error('boom')));

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [NotificationSendComponent],
      providers: [
        { provide: NotificationService, useValue: notificationService },
        { provide: EventService, useValue: eventService },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'schedule-1' }, data: { mode: 'schedule' } } },
        },
        allLucideIconsProvider,
      ],
    }).compileComponents();
    const failingFixture = TestBed.createComponent(NotificationSendComponent);
    failingFixture.detectChanges();

    expect(failingFixture.componentInstance.state()).toBe('error');
  });

  it('navigates back to the schedule list on cancelEdit', () => {
    component.cancelEdit();
    expect(router.navigate).toHaveBeenCalledWith(['/communication/notifications/schedules']);
  });
});

describe('NotificationSendComponent (edit mode, WEEKLY)', () => {
  it('prefills scheduleKind and the day-of-week/time-of-day fields', async () => {
    const weeklySchedule = {
      id: 'schedule-2',
      title: 'Recordatori',
      body: 'Cada dilluns',
      linkedEvent: undefined,
      linkTo: NotificationLinkType.HOME,
      url: null,
      target: { type: NotificationTargetType.ALL },
      scheduleType: NotificationScheduleType.WEEKLY,
      ruleConfig: { dayOfWeek: 1, timeOfDay: '18:00', startDate: '2026-06-01', endDate: '2026-12-31' },
      isActive: true,
      createdByUserId: 'user-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const notificationService = {
      send: vi.fn().mockReturnValue(of({ accepted: true })),
      createSchedule: vi.fn().mockReturnValue(of({ id: 'schedule-2' })),
      getSchedule: vi.fn().mockReturnValue(of(weeklySchedule)),
      updateSchedule: vi.fn().mockReturnValue(of(weeklySchedule)),
    };
    const eventService = { getAll: vi.fn().mockReturnValue(of({ data: [], meta: { total: 0, page: 1, limit: 200 } })) };

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [NotificationSendComponent],
      providers: [
        { provide: NotificationService, useValue: notificationService },
        { provide: EventService, useValue: eventService },
        { provide: Router, useValue: { navigate: vi.fn() } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'schedule-2' }, data: { mode: 'schedule' } } },
        },
        allLucideIconsProvider,
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(NotificationSendComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.scheduleKind()).toBe(NotificationScheduleType.WEEKLY);
    expect(component.weeklyDayOfWeek()).toBe(1);
    expect(component.weeklyTimeOfDay()).toBe('18:00');
    expect(component.weeklyStartDate()).toBe('2026-06-01');
    expect(component.weeklyEndDate()).toBe('2026-12-31');
  });
});

describe('NotificationSendComponent (edit mode, BEFORE_EVENT)', () => {
  it('prefills scheduleKind and the eventType/offset/timeOfDay fields', async () => {
    const beforeEventSchedule = {
      id: 'schedule-3',
      title: 'Recordatori',
      body: 'Abans de l’actuació',
      linkedEvent: undefined,
      linkTo: NotificationLinkType.HOME,
      url: null,
      target: { type: NotificationTargetType.ALL },
      scheduleType: NotificationScheduleType.BEFORE_EVENT,
      ruleConfig: {
        eventType: EventType.ACTUACIO,
        offsetUnit: BeforeEventOffsetUnit.HOURS,
        offsetValue: 2,
        startDate: '2026-06-01',
        endDate: '2026-12-31',
      },
      isActive: true,
      createdByUserId: 'user-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const notificationService = {
      send: vi.fn().mockReturnValue(of({ accepted: true })),
      createSchedule: vi.fn().mockReturnValue(of({ id: 'schedule-3' })),
      getSchedule: vi.fn().mockReturnValue(of(beforeEventSchedule)),
      updateSchedule: vi.fn().mockReturnValue(of(beforeEventSchedule)),
    };
    const eventService = { getAll: vi.fn().mockReturnValue(of({ data: [], meta: { total: 0, page: 1, limit: 200 } })) };

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [NotificationSendComponent],
      providers: [
        { provide: NotificationService, useValue: notificationService },
        { provide: EventService, useValue: eventService },
        { provide: Router, useValue: { navigate: vi.fn() } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'schedule-3' }, data: { mode: 'schedule' } } },
        },
        allLucideIconsProvider,
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(NotificationSendComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.scheduleKind()).toBe(NotificationScheduleType.BEFORE_EVENT);
    expect(component.beforeEventType()).toBe(EventType.ACTUACIO);
    expect(component.beforeEventOffsetUnit()).toBe(BeforeEventOffsetUnit.HOURS);
    expect(component.beforeEventOffsetValue()).toBe(2);
    expect(component.beforeEventStartDate()).toBe('2026-06-01');
    expect(component.beforeEventEndDate()).toBe('2026-12-31');
  });
});
