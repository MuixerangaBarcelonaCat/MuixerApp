import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { NotificationLogEntry, NotificationSource, NotificationTargetType } from '@muixer/shared';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { NotificationHistoryComponent } from './notification-history.component';
import { NotificationService } from '../../services/notification.service';

const mockEntry = (overrides: Partial<NotificationLogEntry> = {}): NotificationLogEntry => ({
  id: 'log-1',
  title: 'Assaig',
  body: 'Dijous a les 20h',
  url: null,
  target: { type: NotificationTargetType.ALL },
  recipientCount: 12,
  source: NotificationSource.MANUAL,
  scheduleId: null,
  triggeredEventId: null,
  triggeredByUserId: 'user-1',
  sentAt: '2026-09-20T18:00:00.000Z',
  ...overrides,
});

describe('NotificationHistoryComponent', () => {
  let component: NotificationHistoryComponent;
  let fixture: ComponentFixture<NotificationHistoryComponent>;
  let notificationService: { getHistory: ReturnType<typeof vi.fn> };

  const setup = async (response = { data: [mockEntry()], meta: { total: 1, page: 1, limit: 25 } }, fail = false) => {
    notificationService = {
      getHistory: vi.fn().mockReturnValue(fail ? throwError(() => new Error('Network error')) : of(response)),
    };

    await TestBed.configureTestingModule({
      imports: [NotificationHistoryComponent],
      providers: [
        { provide: NotificationService, useValue: notificationService },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => null } } } },
        allLucideIconsProvider,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationHistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  it('loads and displays history on init', async () => {
    await setup();
    expect(component.items().length).toBe(1);
    expect(component.loading()).toBe(false);
    expect(notificationService.getHistory).toHaveBeenCalledWith({ source: undefined, page: 1, limit: 25 });
  });

  it('shows error state when the API fails', async () => {
    await setup(undefined, true);
    expect(component.error()).toBe(true);
  });

  it('reloads with the new page when the page changes', async () => {
    await setup();
    component.onPageChange(2);
    expect(notificationService.getHistory).toHaveBeenLastCalledWith({ source: undefined, page: 2, limit: 25 });
  });

  it('resets to page 1 and reloads when the source filter changes', async () => {
    await setup();
    component.onSourceChange(NotificationSource.SCHEDULED_ONE_OFF);
    expect(component.page()).toBe(1);
    expect(notificationService.getHistory).toHaveBeenLastCalledWith({
      source: NotificationSource.SCHEDULED_ONE_OFF,
      page: 1,
      limit: 25,
    });
  });
});
