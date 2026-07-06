import { TestBed, ComponentFixture } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { EventType, MeEvent, UserRole } from '@muixer/shared';
import { HomeComponent } from './home.component';
import { HomeService, HomeData } from './services/home.service';
import { AuthService } from '../../core/auth/services/auth.service';
import { EventService } from '../events/services/event.service';
import { ToastService } from '../../shared/services/toast.service';
import { provideRouter } from '@angular/router';

const EMPTY_SUMMARY = {
  confirmed: 0, declined: 0, pending: 0,
  attended: 0, lateCancel: 0, children: 0, childrenAttended: 0, total: 0,
};

const MOCK_REHEARSAL: MeEvent = {
  id: 'ev-1',
  eventType: EventType.ASSAIG,
  title: 'Assaig',
  date: '2026-07-10',
  startTime: '20:00',
  location: 'Local',
  attendanceSummary: EMPTY_SUMMARY,
  myAttendance: null,
};

const MOCK_PERFORMANCE: MeEvent = {
  id: 'ev-2',
  eventType: EventType.ACTUACIO,
  title: 'Festa Major',
  date: '2026-07-15',
  startTime: '11:00',
  location: 'Plaça',
  attendanceSummary: EMPTY_SUMMARY,
  myAttendance: null,
};

function createTestBed(homeData: HomeData, person: Record<string, unknown> | null = { id: 'p-1', name: 'Joan', firstSurname: 'Garcia', alias: 'Joanet', email: null }) {
  const homeService = {
    loadHomeData: vi.fn().mockReturnValue(of(homeData)),
  };

  TestBed.configureTestingModule({
    imports: [HomeComponent],
    providers: [
      provideRouter([]),
      { provide: HomeService, useValue: homeService },
      {
        provide: AuthService,
        useValue: {
          currentUser: () => ({
            id: 'u-1',
            email: 'test@test.com',
            role: UserRole.MEMBER,
            isActive: true,
            person,
          }),
        },
      },
      { provide: EventService, useValue: { updateAttendance: vi.fn() } },
      { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
    ],
  });

  return { homeService };
}

describe('HomeComponent', () => {
  let fixture: ComponentFixture<HomeComponent>;

  describe('with events', () => {
    beforeEach(async () => {
      createTestBed({
        nextRehearsal: MOCK_REHEARSAL,
        nextPerformance: MOCK_PERFORMANCE,
      });
      await TestBed.compileComponents();
      fixture = TestBed.createComponent(HomeComponent);
      fixture.detectChanges();
    });

    it('should create', () => {
      expect(fixture.componentInstance).toBeTruthy();
    });

    it('should display greeting with alias', () => {
      const text = fixture.nativeElement.textContent;
      expect(text).toContain('Hola, Joanet!');
    });

    it('should display avatar with initial', () => {
      const avatar = fixture.nativeElement.querySelector('.rounded-full');
      expect(avatar).toBeTruthy();
      expect(avatar.textContent.trim()).toBe('J');
    });

    it('should display next rehearsal section', () => {
      const text = fixture.nativeElement.textContent;
      expect(text).toContain('Pròxim assaig');
    });

    it('should display next performance section', () => {
      const text = fixture.nativeElement.textContent;
      expect(text).toContain('Pròxima actuació');
    });

    it('should render exactly 2 event cards', () => {
      const cards = fixture.nativeElement.querySelectorAll('app-event-card');
      expect(cards.length).toBe(2);
    });
  });

  describe('with only rehearsal', () => {
    beforeEach(async () => {
      createTestBed({ nextRehearsal: MOCK_REHEARSAL, nextPerformance: null });
      await TestBed.compileComponents();
      fixture = TestBed.createComponent(HomeComponent);
      fixture.detectChanges();
    });

    it('should render 1 event card', () => {
      const cards = fixture.nativeElement.querySelectorAll('app-event-card');
      expect(cards.length).toBe(1);
    });

    it('should not show performance section', () => {
      const text = fixture.nativeElement.textContent;
      expect(text).not.toContain('Pròxima actuació');
    });
  });

  describe('with no events', () => {
    beforeEach(async () => {
      createTestBed({ nextRehearsal: null, nextPerformance: null });
      await TestBed.compileComponents();
      fixture = TestBed.createComponent(HomeComponent);
      fixture.detectChanges();
    });

    it('should show empty state', () => {
      const emptyState = fixture.nativeElement.querySelector('app-empty-state');
      expect(emptyState).toBeTruthy();
    });
  });

  describe('with no person linked', () => {
    beforeEach(async () => {
      createTestBed({ nextRehearsal: null, nextPerformance: null }, null);
      await TestBed.compileComponents();
      fixture = TestBed.createComponent(HomeComponent);
      fixture.detectChanges();
    });

    it('should display generic greeting', () => {
      const text = fixture.nativeElement.textContent;
      expect(text).toContain('Hola!');
    });

    it('should show fallback avatar icon', () => {
      const iconAvatar = fixture.nativeElement.querySelector('.bg-base-300');
      expect(iconAvatar).toBeTruthy();
    });
  });

  describe('pull-to-refresh', () => {
    let homeService: { loadHomeData: ReturnType<typeof vi.fn> };

    beforeEach(async () => {
      const result = createTestBed({
        nextRehearsal: MOCK_REHEARSAL,
        nextPerformance: null,
      });
      homeService = result.homeService;
      await TestBed.compileComponents();
      fixture = TestBed.createComponent(HomeComponent);
      fixture.detectChanges();
    });

    it('should call loadHomeData again on reload', () => {
      expect(homeService.loadHomeData).toHaveBeenCalledTimes(1);
      (fixture.componentInstance as unknown as { reload(): void }).reload();
      expect(homeService.loadHomeData).toHaveBeenCalledTimes(2);
    });
  });

  describe('loading state', () => {
    beforeEach(async () => {
      const subject = new Subject<HomeData>();
      TestBed.configureTestingModule({
        imports: [HomeComponent],
        providers: [
          provideRouter([]),
          { provide: HomeService, useValue: { loadHomeData: () => subject.asObservable() } },
          {
            provide: AuthService,
            useValue: { currentUser: () => ({ person: { name: 'Test', alias: null } }) },
          },
          { provide: EventService, useValue: { updateAttendance: vi.fn() } },
          { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
        ],
      });
      await TestBed.compileComponents();
      fixture = TestBed.createComponent(HomeComponent);
      fixture.detectChanges();
    });

    it('should show skeleton cards during loading', () => {
      const skeleton = fixture.nativeElement.querySelector('app-skeleton-card');
      expect(skeleton).toBeTruthy();
    });
  });
});
