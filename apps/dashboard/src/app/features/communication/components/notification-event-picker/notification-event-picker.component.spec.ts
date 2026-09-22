import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EventReferenceKind, EventType } from '@muixer/shared';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { NotificationEventPickerComponent } from './notification-event-picker.component';
import { EventReferenceValue } from '../../services/notification.service';
import { EventListItem } from '../../../events/models/event.model';

const mockEvent = (overrides: Partial<EventListItem> = {}): EventListItem => ({
  id: 'evt-1',
  eventType: EventType.ASSAIG,
  title: 'Assaig general',
  date: '2026-10-01',
  startTime: null,
  location: null,
  countsForStatistics: true,
  attendanceSummary: {} as EventListItem['attendanceSummary'],
  season: null,
  segmentsSummary: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('NotificationEventPickerComponent', () => {
  let component: NotificationEventPickerComponent;
  let fixture: ComponentFixture<NotificationEventPickerComponent>;

  const setup = async (linkedEvent: EventReferenceValue | undefined = undefined, events: EventListItem[] = [mockEvent()]) => {
    await TestBed.configureTestingModule({
      imports: [NotificationEventPickerComponent],
      providers: [allLucideIconsProvider],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationEventPickerComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('linkedEvent', linkedEvent);
    fixture.componentRef.setInput('events', events);
    fixture.detectChanges();
  };

  it('starts with no linked event by default', async () => {
    await setup();
    expect(component.linkedEvent()).toBeUndefined();
  });

  it('sets a NEXT_* kind', async () => {
    await setup();
    component.setKind(EventReferenceKind.NEXT_ACTUACIO);
    expect(component.linkedEvent()).toEqual({ kind: EventReferenceKind.NEXT_ACTUACIO });
  });

  it('clears the linked event when kind is set to empty', async () => {
    await setup({ kind: EventReferenceKind.NEXT_ACTUACIO });
    component.setKind('');
    expect(component.linkedEvent()).toBeUndefined();
  });

  it('sets a specific event id', async () => {
    await setup({ kind: EventReferenceKind.SPECIFIC });
    component.setSpecificEventId('evt-42');
    expect(component.linkedEvent()).toEqual({ kind: EventReferenceKind.SPECIFIC, eventId: 'evt-42' });
  });

  it('clears eventId when switching away from SPECIFIC', async () => {
    await setup({ kind: EventReferenceKind.SPECIFIC, eventId: 'evt-1' });
    component.setKind(EventReferenceKind.NEXT_ASSAIG);
    expect(component.linkedEvent()).toEqual({ kind: EventReferenceKind.NEXT_ASSAIG });
  });

  it('does not show the "Aquest esdeveniment" option unless allowTriggeringEvent is set', async () => {
    await setup();
    const html = fixture.nativeElement.innerHTML as string;
    expect(html).not.toContain('Aquest esdeveniment');
  });

  it('shows the "Aquest esdeveniment" option when allowTriggeringEvent is set', async () => {
    await setup();
    fixture.componentRef.setInput('allowTriggeringEvent', true);
    fixture.detectChanges();
    const html = fixture.nativeElement.innerHTML as string;
    expect(html).toContain('Aquest esdeveniment');
  });
});
