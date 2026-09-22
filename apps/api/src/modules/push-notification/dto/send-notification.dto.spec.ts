import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AttendanceStatus, EventReferenceKind, NotificationLinkType, NotificationTargetType } from '@muixer/shared';
import { SendNotificationDto } from './send-notification.dto';

const validate = (payload: Record<string, unknown>) =>
  validateSync(plainToInstance(SendNotificationDto, payload), { whitelist: true });

const EVENT_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

const base = {
  title: 'Assaig',
  body: 'Dijous a les 20h',
  linkTo: NotificationLinkType.HOME,
  target: { type: NotificationTargetType.ALL },
};

describe('SendNotificationDto', () => {
  it('rejects a payload without target', () => {
    const errors = validate({ title: base.title, body: base.body, linkTo: base.linkTo });
    expect(errors.some((e) => e.property === 'target')).toBe(true);
  });

  it('rejects a payload without linkTo', () => {
    const errors = validate({ title: base.title, body: base.body, target: base.target });
    expect(errors.some((e) => e.property === 'linkTo')).toBe(true);
  });

  it('accepts the minimal ALL / HOME payload', () => {
    expect(validate(base)).toHaveLength(0);
  });

  describe('linkTo', () => {
    it('accepts HOME with no url', () => {
      expect(validate({ ...base, linkTo: NotificationLinkType.HOME })).toHaveLength(0);
    });

    it('rejects CUSTOM without a url', () => {
      const errors = validate({ ...base, linkTo: NotificationLinkType.CUSTOM });
      expect(errors.some((e) => e.property === 'url')).toBe(true);
    });

    it('accepts CUSTOM with an in-app path', () => {
      expect(validate({ ...base, linkTo: NotificationLinkType.CUSTOM, url: '/noticies/123' })).toHaveLength(0);
    });

    it('accepts CUSTOM with an absolute url', () => {
      expect(validate({ ...base, linkTo: NotificationLinkType.CUSTOM, url: 'https://muixeranga.cat/noticies' })).toHaveLength(0);
    });

    it('rejects a url that is neither absolute nor a path', () => {
      const errors = validate({ ...base, linkTo: NotificationLinkType.CUSTOM, url: 'noticies/123' });
      expect(errors.some((e) => e.property === 'url')).toBe(true);
    });

    it('rejects EVENT without a linkedEvent', () => {
      const errors = validate({ ...base, linkTo: NotificationLinkType.EVENT });
      expect(errors.some((e) => e.property === 'linkedEvent')).toBe(true);
    });

    it('accepts EVENT with a linkedEvent', () => {
      expect(
        validate({ ...base, linkTo: NotificationLinkType.EVENT, linkedEvent: { kind: EventReferenceKind.NEXT_ACTUACIO } }),
      ).toHaveLength(0);
    });
  });

  describe('linkedEvent', () => {
    it('is not required when unrelated to linkTo or target', () => {
      expect(validate(base)).toHaveLength(0);
    });

    it('is required when the target is EVENT_ATTENDANCE', () => {
      const errors = validate({
        ...base,
        target: { type: NotificationTargetType.EVENT_ATTENDANCE, attendanceFilter: AttendanceStatus.ANIRE },
      });
      expect(errors.some((e) => e.property === 'linkedEvent')).toBe(true);
    });

    it('accepts NEXT_ACTUACIO / NEXT_ASSAIG / NEXT_ACTUACIO_OR_ASSAIG without an eventId', () => {
      for (const kind of [EventReferenceKind.NEXT_ACTUACIO, EventReferenceKind.NEXT_ASSAIG, EventReferenceKind.NEXT_ACTUACIO_OR_ASSAIG]) {
        expect(validate({ ...base, linkTo: NotificationLinkType.EVENT, linkedEvent: { kind } })).toHaveLength(0);
      }
    });

    it('accepts SPECIFIC with an eventId', () => {
      expect(
        validate({
          ...base,
          linkTo: NotificationLinkType.EVENT,
          linkedEvent: { kind: EventReferenceKind.SPECIFIC, eventId: EVENT_ID },
        }),
      ).toHaveLength(0);
    });

    it('rejects SPECIFIC without an eventId', () => {
      const errors = validate({
        ...base,
        linkTo: NotificationLinkType.EVENT,
        linkedEvent: { kind: EventReferenceKind.SPECIFIC },
      });
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('target.attendanceFilter', () => {
    const eventAttendanceTarget = (attendanceFilter?: unknown) => ({
      title: base.title,
      body: base.body,
      linkTo: NotificationLinkType.HOME,
      linkedEvent: { kind: EventReferenceKind.NEXT_ACTUACIO },
      target: { type: NotificationTargetType.EVENT_ATTENDANCE, attendanceFilter },
    });

    it('rejects an EVENT_ATTENDANCE target without an attendance filter — otherwise it is indistinguishable from ALL', () => {
      const errors = validate({
        title: base.title,
        body: base.body,
        linkTo: NotificationLinkType.HOME,
        linkedEvent: { kind: EventReferenceKind.NEXT_ACTUACIO },
        target: { type: NotificationTargetType.EVENT_ATTENDANCE },
      });
      expect(errors.some((e) => e.property === 'target')).toBe(true);
    });

    it.each([AttendanceStatus.ANIRE, AttendanceStatus.NO_VAIG, AttendanceStatus.PENDENT, AttendanceStatus.ASSISTIT])(
      'accepts %s as an attendance filter',
      (status) => {
        expect(validate(eventAttendanceTarget(status))).toHaveLength(0);
      },
    );

    it('does not require an attendance filter for ALL or PERSON targets', () => {
      expect(validate({ ...base, target: { type: NotificationTargetType.ALL } })).toHaveLength(0);
      expect(
        validate({ ...base, target: { type: NotificationTargetType.PERSON, personIds: [EVENT_ID] } }),
      ).toHaveLength(0);
    });
  });
});
