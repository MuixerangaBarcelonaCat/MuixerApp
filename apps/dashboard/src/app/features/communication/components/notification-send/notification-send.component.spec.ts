import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { AttendanceStatus, EventReferenceKind, NotificationLinkType, NotificationTargetType } from '@muixer/shared';
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

  it('initialises with no linked event, HOME link, ALL target, and an invalid empty form', () => {
    expect(component.linkedEvent()).toBeUndefined();
    expect(component.link().type).toBe(NotificationLinkType.HOME);
    expect(component.target().type).toBe(NotificationTargetType.ALL);
    expect(component.isFormValid()).toBe(false);
  });

  it('enables form only when title and body are filled', () => {
    component.title.set('Títol');
    expect(component.isFormValid()).toBe(false);
    component.body.set('Cos');
    expect(component.isFormValid()).toBe(true);
  });

  it('requires an eventId when the linked event is SPECIFIC', () => {
    component.title.set('T');
    component.body.set('B');
    component.linkedEvent.set({ kind: EventReferenceKind.SPECIFIC });
    expect(component.isFormValid()).toBe(false);
    component.linkedEvent.set({ kind: EventReferenceKind.SPECIFIC, eventId: 'evt-1' });
    expect(component.isFormValid()).toBe(true);
  });

  it('requires a url when the link type is CUSTOM', () => {
    component.title.set('T');
    component.body.set('B');
    component.link.set({ type: NotificationLinkType.CUSTOM });
    expect(component.isFormValid()).toBe(false);
    component.link.set({ type: NotificationLinkType.CUSTOM, url: '/noticies/1' });
    expect(component.isFormValid()).toBe(true);
  });

  it('requires an attendance filter when the target is EVENT_ATTENDANCE', () => {
    component.title.set('T');
    component.body.set('B');
    component.linkedEvent.set({ kind: EventReferenceKind.NEXT_ACTUACIO });
    component.target.set({ type: NotificationTargetType.EVENT_ATTENDANCE });
    expect(component.isFormValid()).toBe(false);
    component.target.set({ type: NotificationTargetType.EVENT_ATTENDANCE, attendanceFilter: AttendanceStatus.ANIRE });
    expect(component.isFormValid()).toBe(true);
  });

  it('requires at least one person when target is PERSON', () => {
    component.title.set('T');
    component.body.set('B');
    component.target.set({ type: NotificationTargetType.PERSON });
    expect(component.isFormValid()).toBe(false);
    component.target.set({ type: NotificationTargetType.PERSON, personIds: ['p1'] });
    expect(component.isFormValid()).toBe(true);
  });

  it('clears the link back to HOME when the linked event is removed while linked to EVENT', () => {
    component.linkedEvent.set({ kind: EventReferenceKind.NEXT_ACTUACIO });
    component.link.set({ type: NotificationLinkType.EVENT });
    fixture.detectChanges();

    component.linkedEvent.set(undefined);
    fixture.detectChanges();

    expect(component.link().type).toBe(NotificationLinkType.HOME);
  });

  it('resets the target back to ALL when the linked event is removed while targeting EVENT_ATTENDANCE', () => {
    component.linkedEvent.set({ kind: EventReferenceKind.NEXT_ACTUACIO });
    component.target.set({ type: NotificationTargetType.EVENT_ATTENDANCE, attendanceFilter: AttendanceStatus.ANIRE });
    fixture.detectChanges();

    component.linkedEvent.set(undefined);
    fixture.detectChanges();

    expect(component.target().type).toBe(NotificationTargetType.ALL);
  });

  it('sends the minimal ALL / HOME payload', () => {
    component.title.set('Assaig cancel·lat');
    component.body.set('Avui no hi ha assaig.');
    component.send();

    expect(notificationService.send).toHaveBeenCalledWith({
      title: 'Assaig cancel·lat',
      body: 'Avui no hi ha assaig.',
      linkedEvent: undefined,
      linkTo: NotificationLinkType.HOME,
      url: undefined,
      target: { type: NotificationTargetType.ALL },
    });
  });

  it('sends the linked event and EVENT_ATTENDANCE target together', () => {
    component.title.set('T');
    component.body.set('B');
    component.linkedEvent.set({ kind: EventReferenceKind.NEXT_ACTUACIO });
    component.target.set({ type: NotificationTargetType.EVENT_ATTENDANCE, attendanceFilter: AttendanceStatus.ANIRE });
    component.send();

    expect(notificationService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        linkedEvent: { kind: EventReferenceKind.NEXT_ACTUACIO },
        target: { type: NotificationTargetType.EVENT_ATTENDANCE, attendanceFilter: AttendanceStatus.ANIRE },
      }),
    );
  });

  it('sends PERSON notification with personIds', () => {
    component.title.set('T');
    component.body.set('B');
    component.target.set({ type: NotificationTargetType.PERSON, personIds: ['p1', 'p2'] });
    component.send();

    expect(notificationService.send).toHaveBeenCalledWith(
      expect.objectContaining({ target: { type: NotificationTargetType.PERSON, personIds: ['p1', 'p2'] } }),
    );
  });

  it('sends linkTo CUSTOM with its url', () => {
    component.title.set('T');
    component.body.set('B');
    component.link.set({ type: NotificationLinkType.CUSTOM, url: '/noticies/123' });
    component.send();

    expect(notificationService.send).toHaveBeenCalledWith(
      expect.objectContaining({ linkTo: NotificationLinkType.CUSTOM, url: '/noticies/123' }),
    );
  });

  it('sends linkTo EVENT with the linked event, and no url', () => {
    component.title.set('T');
    component.body.set('B');
    component.linkedEvent.set({ kind: EventReferenceKind.NEXT_ACTUACIO });
    component.link.set({ type: NotificationLinkType.EVENT });
    component.send();

    expect(notificationService.send).toHaveBeenCalledWith(
      expect.objectContaining({ linkTo: NotificationLinkType.EVENT, url: undefined }),
    );
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
    component.linkedEvent.set({ kind: EventReferenceKind.NEXT_ACTUACIO });
    component.link.set({ type: NotificationLinkType.EVENT });
    component.target.set({ type: NotificationTargetType.PERSON, personIds: ['p1'] });
    component.state.set('success');
    component.reset();
    expect(component.title()).toBe('');
    expect(component.linkedEvent()).toBeUndefined();
    expect(component.link()).toEqual({ type: NotificationLinkType.HOME });
    expect(component.target()).toEqual({ type: NotificationTargetType.ALL });
    expect(component.state()).toBe('idle');
  });
});
