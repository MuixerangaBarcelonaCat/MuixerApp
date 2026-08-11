import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { AttendanceStatus, EventType, MeEvent } from '@muixer/shared';
import { CalendarViewComponent } from './calendar-view.component';

const EMPTY_SUMMARY = {
  confirmed: 0,
  declined: 0,
  pending: 0,
  attended: 0,
  lateCancel: 0,
  children: 0,
  childrenAttended: 0,
  total: 0,
};

function makeEvent(overrides: Partial<MeEvent> = {}): MeEvent {
  return {
    id: 'ev-1',
    eventType: EventType.ASSAIG,
    title: 'Assaig',
    date: '2026-07-16',
    startTime: '20:00',
    location: 'Local',
    attendanceSummary: EMPTY_SUMMARY,
    myAttendance: null,
    ...overrides,
  };
}

@Component({
  standalone: true,
  imports: [CalendarViewComponent],
  template: `
    <app-calendar-view
      [events]="events()"
      [selectedDate]="selectedDate()"
      (selectedDateChange)="selectedDate.set($event)"
    />
  `,
})
class TestHostComponent {
  events = signal<MeEvent[]>([]);
  selectedDate = signal<string | null>(null);
}

describe('CalendarViewComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-16T10:00:00'));

    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render 7 day-of-week headers in Catalan', () => {
    const headers = fixture.nativeElement.querySelectorAll('[role="columnheader"]');
    expect(headers.length).toBe(7);
    const texts = Array.from(headers).map((h: any) => h.textContent.trim());
    expect(texts).toEqual(['Dl', 'Dt', 'Dc', 'Dj', 'Dv', 'Ds', 'Dg']);
  });

  it('should render correct number of weeks for current month', () => {
    const rows = fixture.nativeElement.querySelectorAll('[role="row"]');
    // Subtract 1 for the header row
    const weekRows = rows.length - 1;
    expect(weekRows).toBeGreaterThanOrEqual(4);
    expect(weekRows).toBeLessThanOrEqual(6);
  });

  it('should show today with highlight ring', () => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const cells = fixture.nativeElement.querySelectorAll('[role="gridcell"]');
    const todayCell = Array.from(cells).find(
      (c: any) => c.getAttribute('aria-label')?.includes(String(today.getDate()) + ' de'),
    ) as HTMLElement | undefined;

    if (todayCell) {
      expect(
        todayCell.classList.contains('ring-2') ||
        todayCell.classList.contains('ring-primary'),
      ).toBe(true);
    }
  });

  it('should show dots for days with events', () => {
    host.events.set([makeEvent({ date: '2026-07-16' })]);
    fixture.detectChanges();

    const dots = fixture.nativeElement.querySelectorAll('[role="gridcell"] .rounded-full');
    expect(dots.length).toBeGreaterThanOrEqual(1);
  });

  it('should apply secondary color dot for assaig event with ANIRE', () => {
    host.events.set([
      makeEvent({
        date: '2026-07-16',
        eventType: EventType.ASSAIG,
        myAttendance: { id: 'a1', status: AttendanceStatus.ANIRE, respondedAt: null },
      }),
    ]);
    fixture.detectChanges();

    const dots = fixture.nativeElement.querySelectorAll('.rounded-full');
    const dot = Array.from(dots).find((d: any) =>
      d.classList.contains('bg-secondary'),
    );
    expect(dot).toBeTruthy();
  });

  it('should apply border-only dot for pendent event', () => {
    host.events.set([makeEvent({ date: '2026-07-16', myAttendance: null })]);
    fixture.detectChanges();

    const dots = fixture.nativeElement.querySelectorAll('.rounded-full');
    const dot = Array.from(dots).find((d: any) =>
      d.classList.contains('border-secondary') || d.classList.contains('border'),
    );
    expect(dot).toBeTruthy();
  });

  it('should emit selectedDateChange when tapping a day', () => {
    host.events.set([makeEvent({ date: '2026-07-16' })]);
    fixture.detectChanges();

    const cells = fixture.nativeElement.querySelectorAll('[role="gridcell"]');
    const day16 = Array.from(cells).find(
      (c: any) => c.querySelector('span')?.textContent?.trim() === '16',
    ) as HTMLElement | undefined;

    day16?.click();
    fixture.detectChanges();

    expect(host.selectedDate()).toBe('2026-07-16');
  });

  it('should emit null when tapping same day again (deselect)', () => {
    host.events.set([makeEvent({ date: '2026-07-16' })]);
    host.selectedDate.set('2026-07-16');
    fixture.detectChanges();

    const cells = fixture.nativeElement.querySelectorAll('[role="gridcell"]');
    const day16 = Array.from(cells).find(
      (c: any) => c.querySelector('span')?.textContent?.trim() === '16',
    ) as HTMLElement | undefined;

    day16?.click();
    fixture.detectChanges();

    expect(host.selectedDate()).toBeNull();
  });

  it('should navigate to next month with arrow', () => {
    const nextBtn = fixture.nativeElement.querySelector('[aria-label="Mes següent"]');
    const monthBefore = fixture.nativeElement.querySelector('h3')?.textContent?.trim();

    nextBtn?.click();
    fixture.detectChanges();

    const monthAfter = fixture.nativeElement.querySelector('h3')?.textContent?.trim();
    expect(monthAfter).not.toBe(monthBefore);
  });

  it('should navigate to previous month with arrow', () => {
    const prevBtn = fixture.nativeElement.querySelector('[aria-label="Mes anterior"]');
    const monthBefore = fixture.nativeElement.querySelector('h3')?.textContent?.trim();

    prevBtn?.click();
    fixture.detectChanges();

    const monthAfter = fixture.nativeElement.querySelector('h3')?.textContent?.trim();
    expect(monthAfter).not.toBe(monthBefore);
  });

  it('should clear selected date when navigating months', () => {
    host.events.set([makeEvent({ date: '2026-07-16' })]);
    host.selectedDate.set('2026-07-16');
    fixture.detectChanges();

    const nextBtn = fixture.nativeElement.querySelector('[aria-label="Mes següent"]');
    nextBtn?.click();
    fixture.detectChanges();

    expect(host.selectedDate()).toBeNull();
  });

  it('should handle swipe left to advance month', () => {
    const calendarDebug = fixture.debugElement.query(
      (de) => de.componentInstance instanceof CalendarViewComponent,
    );
    const calendarComponent = calendarDebug.componentInstance as CalendarViewComponent;
    const monthBefore = fixture.nativeElement.querySelector('h3')?.textContent?.trim();

    const spy = vi.spyOn(calendarComponent, 'nextMonth');
    const el = calendarDebug.nativeElement as HTMLElement;

    const startEvent = new Event('touchstart', { bubbles: true }) as any;
    startEvent.touches = [{ clientX: 200, clientY: 100 }];
    el.dispatchEvent(startEvent);

    const endEvent = new Event('touchend', { bubbles: true }) as any;
    endEvent.changedTouches = [{ clientX: 100, clientY: 100 }];
    el.dispatchEvent(endEvent);
    fixture.detectChanges();

    expect(spy).toHaveBeenCalled();
    const monthAfter = fixture.nativeElement.querySelector('h3')?.textContent?.trim();
    expect(monthAfter).not.toBe(monthBefore);
  });

  it('should handle swipe right to go to previous month', () => {
    const calendarDebug = fixture.debugElement.query(
      (de) => de.componentInstance instanceof CalendarViewComponent,
    );
    const calendarComponent = calendarDebug.componentInstance as CalendarViewComponent;
    const monthBefore = fixture.nativeElement.querySelector('h3')?.textContent?.trim();

    const spy = vi.spyOn(calendarComponent, 'previousMonth');
    const el = calendarDebug.nativeElement as HTMLElement;

    const startEvent = new Event('touchstart', { bubbles: true }) as any;
    startEvent.touches = [{ clientX: 100, clientY: 100 }];
    el.dispatchEvent(startEvent);

    const endEvent = new Event('touchend', { bubbles: true }) as any;
    endEvent.changedTouches = [{ clientX: 200, clientY: 100 }];
    el.dispatchEvent(endEvent);
    fixture.detectChanges();

    expect(spy).toHaveBeenCalled();
    const monthAfter = fixture.nativeElement.querySelector('h3')?.textContent?.trim();
    expect(monthAfter).not.toBe(monthBefore);
  });

  it('should dim days outside current month', () => {
    const cells = fixture.nativeElement.querySelectorAll('[role="gridcell"]');
    const nonCurrentCells = Array.from(cells).filter(
      (c: any) => c.getAttribute('tabindex') === '-1',
    );
    expect(nonCurrentCells.length).toBeGreaterThan(0);
  });
});
