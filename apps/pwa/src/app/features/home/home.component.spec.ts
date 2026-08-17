import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ApplicationRef } from '@angular/core';
import { of, Subject } from 'rxjs';
import { EventType, Gender, MeEvent, MeNewsItem, PendingDependent, UserRole } from '@muixer/shared';
import { HomeComponent } from './home.component';
import { HomeService, HomeData } from './services/home.service';
import { AuthService } from '../../core/auth/services/auth.service';
import { EventService } from '../events/services/event.service';
import { ToastService } from '../../shared/services/toast.service';
import { DependentsService } from '../../core/services/dependents.service';
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
  managedAttendances: [],
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
  managedAttendances: [],
};

function createTestBed(
  homeData: Partial<HomeData> | Subject<HomeData>,
  person: Record<string, unknown> | null = { id: 'p-1', name: 'Joan', firstSurname: 'Garcia', alias: 'Joanet', email: null },
  pendingDependents: PendingDependent[] = [],
) {
  const isSubject = homeData instanceof Subject;
  const homeService = {
    loadHomeData: vi.fn().mockReturnValue(
      isSubject ? homeData.asObservable() : of({ news: [], ...homeData } as HomeData),
    ),
  };
  const dependentsService = {
    getPending: vi.fn().mockReturnValue(of(pendingDependents)),
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
      { provide: DependentsService, useValue: dependentsService },
    ],
  });

  return { homeService, dependentsService };
}

async function stableFixture(fixture: ComponentFixture<HomeComponent>): Promise<void> {
  fixture.detectChanges();
  await TestBed.inject(ApplicationRef).whenStable();
  fixture.detectChanges();
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
      await stableFixture(fixture);
    });

    it('should create', () => {
      expect(fixture.componentInstance).toBeTruthy();
    });

    it('should display greeting with alias', () => {
      expect(fixture.nativeElement.textContent).toContain('Hola, Joanet!');
    });

    it('should display avatar with initial', () => {
      const avatar = fixture.nativeElement.querySelector('.rounded-full');
      expect(avatar).toBeTruthy();
      expect(avatar.textContent.trim()).toBe('J');
    });

    it('should display next rehearsal section', () => {
      expect(fixture.nativeElement.textContent).toContain('Pròxim assaig');
    });

    it('should display next performance section', () => {
      expect(fixture.nativeElement.textContent).toContain('Pròxima actuació');
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
      await stableFixture(fixture);
    });

    it('should render 1 event card', () => {
      const cards = fixture.nativeElement.querySelectorAll('app-event-card');
      expect(cards.length).toBe(1);
    });

    it('should not show performance section', () => {
      expect(fixture.nativeElement.textContent).not.toContain('Pròxima actuació');
    });
  });

  describe('with no events', () => {
    beforeEach(async () => {
      createTestBed({ nextRehearsal: null, nextPerformance: null });
      await TestBed.compileComponents();
      fixture = TestBed.createComponent(HomeComponent);
      await stableFixture(fixture);
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
      await stableFixture(fixture);
    });

    it('should display generic greeting', () => {
      expect(fixture.nativeElement.textContent).toContain('Hola!');
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
      await stableFixture(fixture);
    });

    it('should reload resource on pull-to-refresh', async () => {
      expect(homeService.loadHomeData).toHaveBeenCalledTimes(1);
      (fixture.componentInstance as unknown as { reload(): void }).reload();
      await stableFixture(fixture);
      expect(homeService.loadHomeData).toHaveBeenCalledTimes(2);
    });
  });

  describe('pending dependents banner', () => {
    const child: PendingDependent = {
      personId: 'child-1',
      alias: 'xicalla1',
      name: 'Provisional',
      firstSurname: '',
      secondSurname: null,
      gender: Gender.MALE,
      phone: null,
      birthDate: null,
    };

    it('is hidden when there are no pending dependents', async () => {
      createTestBed({ nextRehearsal: null, nextPerformance: null }, undefined, []);
      await TestBed.compileComponents();
      fixture = TestBed.createComponent(HomeComponent);
      await stableFixture(fixture);

      const banner = fixture.nativeElement.querySelector('[data-testid="pending-dependents-banner"]');
      expect(banner).toBeFalsy();
    });

    it('shows the dependent alias when there is exactly one pending', async () => {
      createTestBed({ nextRehearsal: null, nextPerformance: null }, undefined, [child]);
      await TestBed.compileComponents();
      fixture = TestBed.createComponent(HomeComponent);
      await stableFixture(fixture);

      const banner = fixture.nativeElement.querySelector('[data-testid="pending-dependents-banner"]');
      expect(banner).toBeTruthy();
      expect(banner.textContent).toContain('xicalla1');
    });

    it('shows a count when there is more than one pending dependent', async () => {
      createTestBed({ nextRehearsal: null, nextPerformance: null }, undefined, [
        child,
        { ...child, personId: 'child-2', alias: 'xicalla2' },
      ]);
      await TestBed.compileComponents();
      fixture = TestBed.createComponent(HomeComponent);
      await stableFixture(fixture);

      const banner = fixture.nativeElement.querySelector('[data-testid="pending-dependents-banner"]');
      expect(banner.textContent).toContain('2');
    });

    it('links to the pending-dependents route', async () => {
      createTestBed({ nextRehearsal: null, nextPerformance: null }, undefined, [child]);
      await TestBed.compileComponents();
      fixture = TestBed.createComponent(HomeComponent);
      await stableFixture(fixture);

      const link = fixture.nativeElement.querySelector('[data-testid="pending-dependents-banner"] a');
      expect(link.getAttribute('href')).toBe('/pending-dependents');
    });
  });

  describe('news section', () => {
    const MOCK_NEWS: MeNewsItem[] = [
      {
        id: 'n-1',
        title: 'Nova temporada',
        publishedAt: '2026-01-01T00:00:00.000Z',
        body: 'Cos de la notícia',
      },
      {
        id: 'n-2',
        title: 'Canvi de local',
        publishedAt: '2026-02-01T00:00:00.000Z',
        body: 'Altre cos',
      },
    ];

    it('shows a Notícies section with a link per published news', async () => {
      createTestBed({ nextRehearsal: null, nextPerformance: null, news: MOCK_NEWS });
      await TestBed.compileComponents();
      fixture = TestBed.createComponent(HomeComponent);
      await stableFixture(fixture);

      expect(fixture.nativeElement.textContent).toContain('Notícies');
      const links = fixture.nativeElement.querySelectorAll('[data-testid="news-item"]');
      expect(links.length).toBe(2);
      expect(links[0].textContent).toContain('Nova temporada');
      expect(links[0].getAttribute('href')).toBe('/news/n-1');
    });

    it('hides the Notícies section when there is no published news', async () => {
      createTestBed({ nextRehearsal: null, nextPerformance: null, news: [] });
      await TestBed.compileComponents();
      fixture = TestBed.createComponent(HomeComponent);
      await stableFixture(fixture);

      expect(fixture.nativeElement.querySelector('[data-testid="news-item"]')).toBeFalsy();
    });

    it('shows a plain-text excerpt of the body below the title', async () => {
      createTestBed({
        nextRehearsal: null,
        nextPerformance: null,
        news: [{ ...MOCK_NEWS[0], body: 'Cos amb **negreta** i [enllaç](https://x.cat)' }],
      });
      await TestBed.compileComponents();
      fixture = TestBed.createComponent(HomeComponent);
      await stableFixture(fixture);

      const excerpt = fixture.nativeElement.querySelector('[data-testid="news-item-excerpt"]');
      expect(excerpt.textContent.trim()).toBe('Cos amb negreta i enllaç');
    });

    it('truncates the excerpt to the configured character count', async () => {
      const longBody = 'a'.repeat(400);
      createTestBed({
        nextRehearsal: null,
        nextPerformance: null,
        news: [{ ...MOCK_NEWS[0], body: longBody }],
      });
      await TestBed.compileComponents();
      fixture = TestBed.createComponent(HomeComponent);
      await stableFixture(fixture);

      const excerpt = fixture.nativeElement.querySelector('[data-testid="news-item-excerpt"]');
      expect(excerpt.textContent.trim()).toBe(`${'a'.repeat(300)}…`);
    });
  });

  describe('loading state', () => {
    beforeEach(async () => {
      const subject = new Subject<HomeData>();
      createTestBed(subject, { name: 'Test', alias: null });
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
