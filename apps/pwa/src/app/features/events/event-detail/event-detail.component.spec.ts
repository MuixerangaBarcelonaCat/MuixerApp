import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ApplicationRef } from '@angular/core';
import { of, throwError } from 'rxjs';
import { EventType, MeEventDetail } from '@muixer/shared';
import { EventDetailComponent } from './event-detail.component';
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
});
