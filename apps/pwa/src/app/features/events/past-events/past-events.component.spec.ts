import { TestBed, ComponentFixture } from '@angular/core/testing';
import { Component, input, output } from '@angular/core';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { AttendanceStatus } from '@muixer/shared';
import { PastEventsComponent } from './past-events.component';
import { EventFeedComponent } from '../components/event-feed/event-feed.component';
import { MobileHeaderComponent } from '../../../shared/components/mobile-header/mobile-header.component';

@Component({
  selector: 'app-event-feed',
  standalone: true,
  template: '',
})
class EventFeedStub {
  readonly timeFilter = input.required<'upcoming' | 'past'>();
  readonly emptyMessage = input.required<string>();
  readonly attendanceChanged = output<{ eventId: string; personId: string; status: AttendanceStatus }>();
}

describe('PastEventsComponent', () => {
  let fixture: ComponentFixture<PastEventsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PastEventsComponent],
      providers: [provideRouter([])],
    })
      .overrideComponent(PastEventsComponent, {
        remove: { imports: [EventFeedComponent] },
        add: { imports: [EventFeedStub] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PastEventsComponent);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show a header titled "Esdeveniments passats" with a back button', () => {
    const header = fixture.debugElement.query(By.directive(MobileHeaderComponent))
      .componentInstance as MobileHeaderComponent;
    expect(header.title()).toBe('Esdeveniments passats');
    expect(header.showBack()).toBe(true);
  });

  it('should render the feed scoped to past events', () => {
    const feed = fixture.debugElement.query(By.directive(EventFeedStub))
      .componentInstance as EventFeedStub;
    expect(feed.timeFilter()).toBe('past');
    expect(feed.emptyMessage()).toBe('No hi ha assajos ni actuacions passats.');
  });
});
