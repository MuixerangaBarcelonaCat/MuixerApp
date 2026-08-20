import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { NotificationTargetType, AttendanceStatus } from '@muixer/shared';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { NotificationSendComponent } from './notification-send.component';
import { NotificationService } from '../../services/notification.service';
import { EventService } from '../../../events/services/event.service';

describe('NotificationSendComponent', () => {
  let component: NotificationSendComponent;
  let fixture: ComponentFixture<NotificationSendComponent>;
  let notificationService: { send: ReturnType<typeof vi.fn> };
  let eventService: { getAll: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    notificationService = { send: vi.fn().mockReturnValue(of({ accepted: true })) };
    eventService = { getAll: vi.fn().mockReturnValue(of({ data: [], meta: { total: 0, page: 1, limit: 200 } })) };

    await TestBed.configureTestingModule({
      imports: [NotificationSendComponent],
      providers: [
        { provide: NotificationService, useValue: notificationService },
        { provide: EventService, useValue: eventService },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => null } } } },
        allLucideIconsProvider,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationSendComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('initialises with ALL target and empty form', () => {
    expect(component.targetType()).toBe(NotificationTargetType.ALL);
    expect(component.title()).toBe('');
    expect(component.isFormValid()).toBe(false);
  });

  it('enables form only when title and body are filled', () => {
    component.title.set('Títol');
    expect(component.isFormValid()).toBe(false);
    component.body.set('Cos');
    expect(component.isFormValid()).toBe(true);
  });

  it('requires an event when target is EVENT_ATTENDANCE', () => {
    component.title.set('T');
    component.body.set('B');
    component.targetType.set(NotificationTargetType.EVENT_ATTENDANCE);
    expect(component.isFormValid()).toBe(false);
    component.selectedEventId.set('evt-1');
    expect(component.isFormValid()).toBe(true);
  });

  it('requires at least one person when target is PERSON', () => {
    component.title.set('T');
    component.body.set('B');
    component.targetType.set(NotificationTargetType.PERSON);
    expect(component.isFormValid()).toBe(false);
    component.addPerson({ id: 'p1', name: 'Anna', firstSurname: 'Ferrer' } as any);
    expect(component.isFormValid()).toBe(true);
  });

  it('sends ALL notification with correct payload', () => {
    component.title.set('Assaig cancel·lat');
    component.body.set('Avui no hi ha assaig.');
    component.send();

    expect(notificationService.send).toHaveBeenCalledWith({
      title: 'Assaig cancel·lat',
      body: 'Avui no hi ha assaig.',
      url: undefined,
      target: { type: NotificationTargetType.ALL },
    });
  });

  it('sends EVENT_ATTENDANCE notification with eventId and filter', () => {
    component.title.set('T');
    component.body.set('B');
    component.targetType.set(NotificationTargetType.EVENT_ATTENDANCE);
    component.selectedEventId.set('evt-42');
    component.attendanceFilter.set(AttendanceStatus.ANIRE);
    component.send();

    expect(notificationService.send).toHaveBeenCalledWith({
      title: 'T',
      body: 'B',
      url: undefined,
      target: {
        type: NotificationTargetType.EVENT_ATTENDANCE,
        eventId: 'evt-42',
        attendanceFilter: AttendanceStatus.ANIRE,
      },
    });
  });

  it('sends PERSON notification with personIds', () => {
    component.title.set('T');
    component.body.set('B');
    component.targetType.set(NotificationTargetType.PERSON);
    component.addPerson({ id: 'p1', name: 'Anna', firstSurname: 'Ferrer' } as any);
    component.addPerson({ id: 'p2', name: 'Joan', firstSurname: 'Puig' } as any);
    component.send();

    expect(notificationService.send).toHaveBeenCalledWith(
      expect.objectContaining({ target: { type: NotificationTargetType.PERSON, personIds: ['p1', 'p2'] } }),
    );
  });

  it('does not add the same person twice', () => {
    component.addPerson({ id: 'p1', name: 'Anna', firstSurname: 'Ferrer' } as any);
    component.addPerson({ id: 'p1', name: 'Anna', firstSurname: 'Ferrer' } as any);
    expect(component.selectedPersons().length).toBe(1);
  });

  it('removes a person by id', () => {
    component.addPerson({ id: 'p1', name: 'Anna', firstSurname: 'Ferrer' } as any);
    component.addPerson({ id: 'p2', name: 'Joan', firstSurname: 'Puig' } as any);
    component.removePerson('p1');
    expect(component.selectedPersons().length).toBe(1);
    expect(component.selectedPersons()[0].id).toBe('p2');
  });

  it('sets state to success on successful send', () => {
    component.title.set('T');
    component.body.set('B');
    component.send();
    expect(component.state()).toBe('success');
  });

  it('sets state to error and stores message on failed send', () => {
    notificationService.send.mockReturnValue(throwError(() => ({ error: { message: 'Sense subscriptors' } })));
    component.title.set('T');
    component.body.set('B');
    component.send();
    expect(component.state()).toBe('error');
    expect(component.errorMessage()).toBe('Sense subscriptors');
  });

  it('resets form back to initial state', () => {
    component.title.set('T');
    component.body.set('B');
    component.state.set('success');
    component.reset();
    expect(component.title()).toBe('');
    expect(component.state()).toBe('idle');
  });
});
