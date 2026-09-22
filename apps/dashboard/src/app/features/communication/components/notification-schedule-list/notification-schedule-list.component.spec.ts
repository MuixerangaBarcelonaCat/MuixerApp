import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastService } from '@muixer/ui';
import {
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
