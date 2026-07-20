import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { EventType, MeEvent } from '@muixer/shared';
import { EventCardComponent } from './event-card.component';
import { EventService } from '../../services/event.service';
import { ToastService } from '../../../../shared/services/toast.service';

const MOCK_ASSAIG: MeEvent = {
  id: 'ev-1',
  eventType: EventType.ASSAIG,
  title: 'Assaig setmanal',
  date: '2026-06-23',
  startTime: '20:00',
  location: 'Local',
  attendanceSummary: { confirmed: 0, declined: 0, pending: 0, attended: 0, lateCancel: 0, children: 0, childrenAttended: 0, total: 0 },
  myAttendance: null,
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

  it('should have secondary border for assaig', () => {
    const fixture = createCard(MOCK_ASSAIG);
    const card = fixture.nativeElement.querySelector('.card');
    expect(card.classList.contains('border-secondary')).toBe(true);
  });

  it('should have primary border for actuacio', () => {
    const fixture = createCard(MOCK_ACTUACIO);
    const card = fixture.nativeElement.querySelector('.card');
    expect(card.classList.contains('border-primary')).toBe(true);
  });

  it('should navigate to detail on click', () => {
    const fixture = createCard(MOCK_ASSAIG);
    const card = fixture.nativeElement.querySelector('.card');
    card.click();
    expect(router.navigate).toHaveBeenCalledWith(['/events', 'ev-1']);
  });
});
