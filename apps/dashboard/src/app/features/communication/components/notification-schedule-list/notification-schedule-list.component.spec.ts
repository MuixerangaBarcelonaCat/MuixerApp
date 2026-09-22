import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DatePipe } from '@angular/common';
import { vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastService } from '@muixer/ui';
import {
  BeforeEventOffsetUnit,
  EventType,
  NotificationLinkType,
  NotificationScheduleEntry,
  NotificationScheduleType,
  NotificationTargetType,
} from '@muixer/shared';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { NotificationScheduleListComponent } from './notification-schedule-list.component';
import { NotificationService } from '../../services/notification.service';

const mockEntry = (overrides: Partial<NotificationScheduleEntry> = {}): NotificationScheduleEntry => ({
  id: 'schedule-1',
  title: 'Assaig',
  body: 'Dijous a les 20h',
  linkedEvent: null,
  linkTo: NotificationLinkType.HOME,
  url: null,
  target: { type: NotificationTargetType.ALL },
  scheduleType: NotificationScheduleType.ONE_OFF,
  ruleConfig: { scheduledFor: '2026-06-01T18:00:00.000Z' },
  nextRunAt: '2026-06-01T18:00:00.000Z',
  isActive: true,
  createdByUserId: 'user-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('NotificationScheduleListComponent', () => {
  let component: NotificationScheduleListComponent;
  let fixture: ComponentFixture<NotificationScheduleListComponent>;
  let notificationService: { getSchedules: ReturnType<typeof vi.fn>; cancelSchedule: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  const setup = async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationScheduleListComponent],
      providers: [
        { provide: NotificationService, useValue: notificationService },
        { provide: ToastService, useValue: toast },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => null } } } },
        allLucideIconsProvider,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationScheduleListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  beforeEach(() => {
    notificationService = {
      getSchedules: vi.fn().mockReturnValue(of({ data: [mockEntry()], meta: { total: 1, page: 1, limit: 25 } })),
      cancelSchedule: vi.fn().mockReturnValue(of(undefined)),
    };
    toast = { success: vi.fn(), error: vi.fn() };
  });

  it('loads pending schedules by default', async () => {
    await setup();
    expect(notificationService.getSchedules).toHaveBeenCalledWith({ isActive: true, page: 1, limit: 25 });
    expect(component.items()).toEqual([mockEntry()]);
    expect(component.loading()).toBe(false);
  });

  it('reloads with isActive undefined when switching to "all"', async () => {
    await setup();
    component.onActiveFilterChange('all');
    expect(notificationService.getSchedules).toHaveBeenCalledWith({ isActive: undefined, page: 1, limit: 25 });
  });

  it('sets error state when loading fails', async () => {
    notificationService.getSchedules.mockReturnValue(throwError(() => new Error('boom')));
    await setup();
    expect(component.error()).toBe(true);
    expect(component.loading()).toBe(false);
  });

  it('summarises the target for the row', async () => {
    await setup();
    expect(component.targetSummary({ type: NotificationTargetType.ALL })).toBe('Tothom');
    expect(component.targetSummary({ type: NotificationTargetType.PERSON, personIds: ['p1', 'p2'] })).toBe('2 persones');
  });

  describe('ruleSummary', () => {
    it('formats a ONE_OFF ruleConfig as a date/time', async () => {
      await setup();
      const expected = new DatePipe('en-US').transform('2026-06-01T18:00:00.000Z', 'dd/MM/yyyy HH:mm');
      expect(component.ruleSummary(mockEntry())).toBe(expected);
    });

    it('formats a WEEKLY ruleConfig as "Cada <day> a les <time>"', async () => {
      await setup();
      const weekly = mockEntry({
        scheduleType: NotificationScheduleType.WEEKLY,
        ruleConfig: { dayOfWeek: 1, timeOfDay: '18:00' },
      });
      expect(component.ruleSummary(weekly)).toBe('Cada Dilluns a les 18:00');
    });

    it('uses Diumenge for dayOfWeek 0', async () => {
      await setup();
      const weekly = mockEntry({
        scheduleType: NotificationScheduleType.WEEKLY,
        ruleConfig: { dayOfWeek: 0, timeOfDay: '09:00' },
      });
      expect(component.ruleSummary(weekly)).toBe('Cada Diumenge a les 09:00');
    });

    const formatDate = (value: string) => new DatePipe('en-US').transform(value, 'dd/MM/yyyy');

    it('appends "des del <date>" when only startDate is set', async () => {
      await setup();
      const weekly = mockEntry({
        scheduleType: NotificationScheduleType.WEEKLY,
        ruleConfig: { dayOfWeek: 1, timeOfDay: '18:00', startDate: '2026-06-01' },
      });
      expect(component.ruleSummary(weekly)).toBe(`Cada Dilluns a les 18:00 (des del ${formatDate('2026-06-01')})`);
    });

    it('appends "fins al <date>" when only endDate is set', async () => {
      await setup();
      const weekly = mockEntry({
        scheduleType: NotificationScheduleType.WEEKLY,
        ruleConfig: { dayOfWeek: 1, timeOfDay: '18:00', endDate: '2026-12-31' },
      });
      expect(component.ruleSummary(weekly)).toBe(`Cada Dilluns a les 18:00 (fins al ${formatDate('2026-12-31')})`);
    });

    it('appends both bounds when startDate and endDate are set', async () => {
      await setup();
      const weekly = mockEntry({
        scheduleType: NotificationScheduleType.WEEKLY,
        ruleConfig: { dayOfWeek: 1, timeOfDay: '18:00', startDate: '2026-06-01', endDate: '2026-12-31' },
      });
      expect(component.ruleSummary(weekly)).toBe(
        `Cada Dilluns a les 18:00 (des del ${formatDate('2026-06-01')} fins al ${formatDate('2026-12-31')})`,
      );
    });

    it('formats a BEFORE_EVENT/DAYS ruleConfig with the event type and time', async () => {
      await setup();
      const beforeEvent = mockEntry({
        scheduleType: NotificationScheduleType.BEFORE_EVENT,
        ruleConfig: { eventType: EventType.ACTUACIO, offsetUnit: BeforeEventOffsetUnit.DAYS, offsetValue: 3, timeOfDay: '09:00' },
      });
      expect(component.ruleSummary(beforeEvent)).toBe('3 dies abans de cada Actuació, a les 09:00');
    });

    it('formats a BEFORE_EVENT/HOURS ruleConfig relative to the event start time', async () => {
      await setup();
      const beforeEvent = mockEntry({
        scheduleType: NotificationScheduleType.BEFORE_EVENT,
        ruleConfig: { eventType: EventType.ASSAIG, offsetUnit: BeforeEventOffsetUnit.HOURS, offsetValue: 2 },
      });
      expect(component.ruleSummary(beforeEvent)).toBe("2 hores abans de cada Assaig");
    });

    it('appends bounds to a BEFORE_EVENT ruleConfig the same way as WEEKLY', async () => {
      await setup();
      const beforeEvent = mockEntry({
        scheduleType: NotificationScheduleType.BEFORE_EVENT,
        ruleConfig: {
          eventType: EventType.ACTUACIO,
          offsetUnit: BeforeEventOffsetUnit.DAYS,
          offsetValue: 3,
          timeOfDay: '09:00',
          startDate: '2026-06-01',
          endDate: '2026-12-31',
        },
      });
      expect(component.ruleSummary(beforeEvent)).toBe(
        `3 dies abans de cada Actuació, a les 09:00 (des del ${formatDate('2026-06-01')} fins al ${formatDate('2026-12-31')})`,
      );
    });
  });

  describe('nextRunLabel', () => {
    it('formats nextRunAt as a date and time', async () => {
      await setup();
      const expected = new DatePipe('en-US').transform('2026-06-08T07:00:00.000Z', 'dd/MM/yyyy HH:mm');
      expect(component.nextRunLabel(mockEntry({ nextRunAt: '2026-06-08T07:00:00.000Z' }))).toBe(expected);
    });

    it('returns a dash when the schedule will not fire again', async () => {
      await setup();
      expect(component.nextRunLabel(mockEntry({ nextRunAt: null }))).toBe('—');
    });
  });

  it('shows a "Pròxim enviament" column', async () => {
    await setup();
    expect(fixture.nativeElement.innerHTML as string).toContain('Pròxim enviament');
  });

  describe('statusLabel', () => {
    it('returns Inactiva for an inactive schedule regardless of type', async () => {
      await setup();
      expect(component.statusLabel(mockEntry({ isActive: false }))).toBe('Inactiva');
      expect(
        component.statusLabel(mockEntry({ isActive: false, scheduleType: NotificationScheduleType.WEEKLY })),
      ).toBe('Inactiva');
    });

    it('returns Pendent for an active ONE_OFF schedule', async () => {
      await setup();
      expect(component.statusLabel(mockEntry())).toBe('Pendent');
    });

    it('returns Activa for an active WEEKLY schedule', async () => {
      await setup();
      expect(component.statusLabel(mockEntry({ scheduleType: NotificationScheduleType.WEEKLY }))).toBe('Activa');
    });

    it('returns Activa for an active BEFORE_EVENT schedule', async () => {
      await setup();
      expect(component.statusLabel(mockEntry({ scheduleType: NotificationScheduleType.BEFORE_EVENT }))).toBe('Activa');
    });
  });

  it('shows an edit link for a pending schedule', async () => {
    await setup();
    const html = fixture.nativeElement.innerHTML as string;
    expect(html).toContain('Edita');
  });

  it('does not show an edit link for an inactive schedule', async () => {
    notificationService.getSchedules.mockReturnValue(
      of({ data: [mockEntry({ isActive: false })], meta: { total: 1, page: 1, limit: 25 } }),
    );
    await setup();
    const html = fixture.nativeElement.innerHTML as string;
    expect(html).not.toContain('Edita');
  });

  describe('cancel', () => {
    it('opens the confirm target on confirmCancel', async () => {
      await setup();
      component.confirmCancel(mockEntry());
      expect(component.cancelTarget()).toEqual(mockEntry());
    });

    it('clears the confirm target on closeCancel', async () => {
      await setup();
      component.confirmCancel(mockEntry());
      component.closeCancel();
      expect(component.cancelTarget()).toBeNull();
    });

    it('cancels the schedule and reloads the list', async () => {
      await setup();
      component.confirmCancel(mockEntry());
      component.executeCancel();

      expect(notificationService.cancelSchedule).toHaveBeenCalledWith('schedule-1');
      expect(toast.success).toHaveBeenCalled();
      expect(component.cancelTarget()).toBeNull();
      expect(notificationService.getSchedules).toHaveBeenCalledTimes(2);
    });

    it('shows an error toast when cancellation fails', async () => {
      notificationService.cancelSchedule.mockReturnValue(throwError(() => ({ error: { message: 'Ja no és pendent' } })));
      await setup();
      component.confirmCancel(mockEntry());
      component.executeCancel();

      expect(toast.error).toHaveBeenCalledWith('Ja no és pendent');
      expect(component.cancelTarget()).toBeNull();
    });
  });
});
