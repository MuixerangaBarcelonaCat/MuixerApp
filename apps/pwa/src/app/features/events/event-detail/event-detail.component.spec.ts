import { TestBed, ComponentFixture } from '@angular/core/testing';
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

  beforeEach(async () => {
    eventService = {
      findOne: vi.fn().mockReturnValue(of(MOCK_DETAIL)),
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

    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
  });

  it('should load event detail', () => {
    expect(eventService.findOne).toHaveBeenCalledWith('ev-1');
  });

  it('should display event title', () => {
    const title = fixture.nativeElement.querySelector('.card-title');
    expect(title.textContent).toContain('Festa Major');
  });

  it('should display description', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Actuació principal');
  });

  it('should display information', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Portar mocador');
  });

  it('should show location with link', () => {
    const link = fixture.nativeElement.querySelector('a.link');
    expect(link).toBeTruthy();
    expect(link.textContent).toContain('Plaça Sant Jaume');
  });

  it('should show error state on failure', async () => {
    eventService.findOne.mockReturnValue(throwError(() => new Error('fail')));

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [
        provideRouter([]),
        { provide: EventService, useValue: eventService },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    }).compileComponents();

    const newFixture = TestBed.createComponent(TestHostComponent);
    newFixture.detectChanges();

    const text = newFixture.nativeElement.textContent;
    expect(text).toContain("No s'ha pogut carregar");
  });
});
