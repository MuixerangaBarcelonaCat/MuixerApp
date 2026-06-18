import { TestBed, ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';
import { EventType, MeEvent, UserRole } from '@muixer/shared';
import { HomeComponent } from './home.component';
import { HomeService } from './services/home.service';
import { AuthService } from '../../core/auth/services/auth.service';
import { EventService } from '../events/services/event.service';
import { ToastService } from '../../shared/services/toast.service';
import { provideRouter } from '@angular/router';

const MOCK_EVENT: MeEvent = {
  id: 'ev-1',
  eventType: EventType.ASSAIG,
  title: 'Assaig',
  date: '2026-06-23',
  startTime: '20:00',
  location: 'Local',
  attendanceSummary: { confirmed: 0, declined: 0, pending: 0, attended: 0, noShow: 0, lateCancel: 0, children: 0, total: 0 },
  myAttendance: null,
};

describe('HomeComponent', () => {
  let fixture: ComponentFixture<HomeComponent>;
  let homeService: { loadHomeData: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    homeService = {
      loadHomeData: vi.fn().mockReturnValue(
        of({ nextRehearsals: [MOCK_EVENT], nextPerformances: [] }),
      ),
    };

    await TestBed.configureTestingModule({
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
              person: { id: 'p-1', name: 'Joan', firstSurname: 'Garcia', alias: 'Joanet', email: null },
            }),
          },
        },
        { provide: EventService, useValue: { updateAttendance: vi.fn() } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    }).compileComponents();

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

  it('should display rehearsal section', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Propers assajos');
  });

  it('should display event cards', () => {
    const cards = fixture.nativeElement.querySelectorAll('app-event-card');
    expect(cards.length).toBe(1);
  });

  it('should show empty state when no events', async () => {
    homeService.loadHomeData.mockReturnValue(
      of({ nextRehearsals: [], nextPerformances: [] }),
    );

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        provideRouter([]),
        { provide: HomeService, useValue: homeService },
        {
          provide: AuthService,
          useValue: { currentUser: () => ({ person: null }) },
        },
        { provide: EventService, useValue: { updateAttendance: vi.fn() } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    }).compileComponents();

    const newFixture = TestBed.createComponent(HomeComponent);
    newFixture.detectChanges();

    const emptyState = newFixture.nativeElement.querySelector('app-empty-state');
    expect(emptyState).toBeTruthy();
  });
});
