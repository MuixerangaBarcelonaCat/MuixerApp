import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AttendanceStatus, DelegateType, EventType, MeEvent } from '@muixer/shared';
import { EventCardComponent } from './event-card.component';
import { EventService } from '../../services/event.service';
import { ToastService } from '@muixer/ui';

const MOCK_ASSAIG: MeEvent = {
  id: 'ev-1',
  eventType: EventType.ASSAIG,
  title: 'Assaig setmanal',
  date: '2026-06-23',
  startTime: '20:00',
  location: 'Local',
  attendanceSummary: { confirmed: 0, declined: 0, pending: 0, attended: 0, lateCancel: 0, children: 0, childrenAttended: 0, total: 0 },
  myAttendance: null,
  managedAttendances: [
    { personId: 'p-1', displayName: 'MartaP', isSelf: true, delegateType: null, attendance: null },
  ],
};

const MOCK_ACTUACIO: MeEvent = {
  ...MOCK_ASSAIG,
  id: 'ev-2',
  eventType: EventType.ACTUACIO,
  title: 'Festa Major',
};

describe('EventCardComponent', () => {
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EventCardComponent],
      providers: [
        provideRouter([]),
        { provide: EventService, useValue: { updateAttendance: vi.fn() } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  function createCard(event: MeEvent): ComponentFixture<EventCardComponent> {
    const fixture = TestBed.createComponent(EventCardComponent);
    fixture.componentRef.setInput('event', event);
    fixture.detectChanges();
    return fixture;
  }

  it('should display date as title for assaig', () => {
    const fixture = createCard(MOCK_ASSAIG);
    const title = fixture.nativeElement.querySelector('.card-title');
    expect(title.textContent.toLowerCase()).toContain('23');
  });

  it('should display event title for actuacio', () => {
    const fixture = createCard(MOCK_ACTUACIO);
    const title = fixture.nativeElement.querySelector('.card-title');
    expect(title.textContent).toContain('Festa Major');
  });

  it('should use the default (base-100) tone for assaig', () => {
    const fixture = createCard(MOCK_ASSAIG);
    const card = fixture.nativeElement.querySelector('.card');
    expect(card.classList.contains('bg-base-100')).toBe(true);
  });

  it('should use the primary tone for actuacio', () => {
    const fixture = createCard(MOCK_ACTUACIO);
    const card = fixture.nativeElement.querySelector('.card');
    expect(card.classList.contains('bg-primary/10')).toBe(true);
  });

  it('should show a primary-colored star icon before the title for actuacio', () => {
    const fixture = createCard(MOCK_ACTUACIO);
    const star = fixture.nativeElement.querySelector('[data-testid="actuacio-star-icon"]');
    expect(star).not.toBeNull();
    expect(star.classList.contains('text-primary')).toBe(true);
  });

  it('should not show a star icon for assaig', () => {
    const fixture = createCard(MOCK_ASSAIG);
    expect(fixture.nativeElement.querySelector('[data-testid="actuacio-star-icon"]')).toBeNull();
  });

  it('should display the rehearsal name as subtitle below the date for assaig', () => {
    const fixture = createCard({ ...MOCK_ASSAIG, title: 'Assaig general' });
    const subtitle = fixture.nativeElement.querySelector('p.text-sm');
    expect(subtitle.textContent.trim()).toBe('Assaig general');
  });

  it('should display the date as subtitle for actuacio, with no type label text', () => {
    const fixture = createCard(MOCK_ACTUACIO);
    const subtitle = fixture.nativeElement.querySelector('p.text-sm');
    expect(subtitle.textContent).toContain('23');
    expect(fixture.nativeElement.textContent).not.toContain('Assaig');
    expect(fixture.nativeElement.textContent).not.toContain('Actuació');
  });

  it('should navigate to detail on click', () => {
    const fixture = createCard(MOCK_ASSAIG);
    const card = fixture.nativeElement.querySelector('.card');
    card.click();
    expect(router.navigate).toHaveBeenCalledWith(['/events', 'ev-1']);
  });

  it('should render a single button for one managed person, no name label', () => {
    const fixture = createCard(MOCK_ASSAIG);
    const buttons = fixture.nativeElement.querySelectorAll('app-attendance-button');
    expect(buttons.length).toBe(1);
    expect(fixture.nativeElement.querySelector('.managed-person-name')).toBeNull();
  });

  it('should render one row per managed person when there are multiple', () => {
    const multiPersonEvent: MeEvent = {
      ...MOCK_ASSAIG,
      managedAttendances: [
        { personId: 'p-1', displayName: 'MartaP', isSelf: true, delegateType: null, attendance: null },
        {
          personId: 'p-2',
          displayName: 'JoanP',
          isSelf: false,
          delegateType: DelegateType.PARENT,
          attendance: { id: 'att-2', status: AttendanceStatus.ANIRE, respondedAt: null },
        },
      ],
    };
    const fixture = createCard(multiPersonEvent);

    const buttons = fixture.nativeElement.querySelectorAll('app-attendance-button');
    expect(buttons.length).toBe(2);
    const names = fixture.nativeElement.textContent;
    expect(names).toContain('MartaP');
    expect(names).toContain('JoanP');
  });

  it('should emit attendanceChanged with the eventId and personId', () => {
    const fixture = createCard(MOCK_ASSAIG);
    const component = fixture.componentInstance;
    const emitted: { eventId: string; personId: string; status: AttendanceStatus }[] = [];
    component.attendanceChanged.subscribe((e) => emitted.push(e));

    component.onAttendanceChanged('p-1', AttendanceStatus.ANIRE);

    expect(emitted).toEqual([{ eventId: 'ev-1', personId: 'p-1', status: AttendanceStatus.ANIRE }]);
  });

  describe('showAttendance', () => {
    it('hides the attendance buttons when set to false', () => {
      const fixture = createCard(MOCK_ASSAIG);
      fixture.componentRef.setInput('showAttendance', false);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('app-attendance-button')).toBeNull();
    });
  });

  describe('clickable', () => {
    it('does not navigate on click when set to false', () => {
      const fixture = createCard(MOCK_ASSAIG);
      fixture.componentRef.setInput('clickable', false);
      fixture.detectChanges();

      const card = fixture.nativeElement.querySelector('.card');
      card.click();

      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('drops the tabindex/cursor-pointer affordance when set to false', () => {
      const fixture = createCard(MOCK_ASSAIG);
      fixture.componentRef.setInput('clickable', false);
      fixture.detectChanges();

      const wrapper = fixture.nativeElement.querySelector('[role="article"]');
      expect(wrapper.hasAttribute('tabindex')).toBe(false);
      expect(wrapper.className).not.toContain('cursor-pointer');
    });
  });

  describe('locationUrl', () => {
    it('renders the location as a link when set', () => {
      const fixture = createCard(MOCK_ASSAIG);
      fixture.componentRef.setInput('locationUrl', 'https://maps.example/local');
      fixture.detectChanges();

      const link: HTMLAnchorElement = fixture.nativeElement.querySelector('a.link');
      expect(link).not.toBeNull();
      expect(link.getAttribute('href')).toBe('https://maps.example/local');
      expect(link.textContent).toContain('Local');
    });

    it('renders the location as plain text when not set', () => {
      const fixture = createCard(MOCK_ASSAIG);
      expect(fixture.nativeElement.querySelector('a.link')).toBeNull();
      expect(fixture.nativeElement.textContent).toContain('Local');
    });
  });
});
