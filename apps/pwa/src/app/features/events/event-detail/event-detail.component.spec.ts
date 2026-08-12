import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ApplicationRef } from '@angular/core';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { AttendanceStatus, DelegateType, EventType, MeEventDetail } from '@muixer/shared';
import { EventDetailComponent } from './event-detail.component';
import { AttendanceButtonComponent } from '../components/attendance-button/attendance-button.component';
import { EventService } from '../services/event.service';
import { ToastService } from '../../../shared/services/toast.service';
import { provideRouter } from '@angular/router';
import { Component } from '@angular/core';

const MOCK_DETAIL: MeEventDetail = {
  id: 'ev-1',
  eventType: EventType.ACTUACIO,
  title: 'Festa Major',
  date: '2026-07-15',
  startTime: '11:00',
  location: 'Plaça Sant Jaume',
  locationUrl: 'https://maps.google.com',
  description: 'Actuació principal',
  information: 'Portar mocador',
  attendanceSummary: { confirmed: 5, declined: 2, pending: 3, attended: 0, lateCancel: 0, children: 1, childrenAttended: 0, total: 10 },
  myAttendance: null,
  managedAttendances: [
    { personId: 'p-1', displayName: 'Marta Puig', isSelf: true, delegateType: null, attendance: null },
  ],
};

@Component({
  standalone: true,
  imports: [EventDetailComponent],
  template: `<app-event-detail [id]="'ev-1'" />`,
})
class TestHostComponent {}

describe('EventDetailComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let eventService: { findOne: ReturnType<typeof vi.fn>; updateAttendance: ReturnType<typeof vi.fn> };

  async function setup(findOneReturn = of(MOCK_DETAIL)) {
    eventService = {
      findOne: vi.fn().mockReturnValue(findOneReturn),
      updateAttendance: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [
        provideRouter([]),
        { provide: EventService, useValue: eventService },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    }).compileComponents();

    const f = TestBed.createComponent(TestHostComponent);
    f.detectChanges();
    await TestBed.inject(ApplicationRef).whenStable();
    f.detectChanges();
    return f;
  }

  it('should load event detail', async () => {
    fixture = await setup();
    expect(eventService.findOne).toHaveBeenCalledWith('ev-1');
  });

  it('should display event title', async () => {
    fixture = await setup();
    const title = fixture.nativeElement.querySelector('.card-title');
    expect(title).toBeTruthy();
    expect(title.textContent).toContain('Festa Major');
  });

  it('should display description', async () => {
    fixture = await setup();
    expect(fixture.nativeElement.textContent).toContain('Actuació principal');
  });

  it('should display information', async () => {
    fixture = await setup();
    expect(fixture.nativeElement.textContent).toContain('Portar mocador');
  });

  it('should show location with link', async () => {
    fixture = await setup();
    const link = fixture.nativeElement.querySelector('a.link');
    expect(link).toBeTruthy();
    expect(link.textContent).toContain('Plaça Sant Jaume');
  });

  it('should show error state on failure', async () => {
    fixture = await setup(throwError(() => new Error('fail')));
    expect(fixture.nativeElement.textContent).toContain("No s'ha pogut carregar");
  });

  describe('tap targets >=24px (WI-03, PW-L4)', () => {
    it('gives the location link a real >=24px tap target instead of the bare glyph height', async () => {
      fixture = await setup();
      const link = fixture.nativeElement.querySelector('a.link') as HTMLElement;
      expect(link.className).toContain('min-h-6');
      expect(link.className).toContain('inline-flex');
    });
  });

  describe('managed attendances', () => {
    it('should render a single attendance button without a name label for one managed person', async () => {
      fixture = await setup();
      const buttons = fixture.debugElement.queryAll(By.directive(AttendanceButtonComponent));
      expect(buttons.length).toBe(1);
      expect(fixture.nativeElement.querySelector('.managed-person-name')).toBeNull();
    });

    it('should render one button per managed person, self first then delegates', async () => {
      const detail: MeEventDetail = {
        ...MOCK_DETAIL,
        managedAttendances: [
          { personId: 'p-1', displayName: 'Marta Puig', isSelf: true, delegateType: null, attendance: null },
          {
            personId: 'p-2',
            displayName: 'Joan Puig',
            isSelf: false,
            delegateType: DelegateType.PARENT,
            attendance: { id: 'att-2', status: AttendanceStatus.ANIRE, respondedAt: '2026-07-01T10:00:00Z' },
          },
        ],
      };
      fixture = await setup(of(detail));

      const buttons = fixture.debugElement.queryAll(By.directive(AttendanceButtonComponent));
      expect(buttons.length).toBe(2);
      expect(buttons.map((b) => b.componentInstance.personId())).toEqual(['p-1', 'p-2']);
      expect(buttons[1].componentInstance.status()).toBe(AttendanceStatus.ANIRE);

      const names = fixture.nativeElement.textContent;
      expect(names).toContain('Marta Puig');
      expect(names).toContain('Joan Puig');
    });
  });
});
