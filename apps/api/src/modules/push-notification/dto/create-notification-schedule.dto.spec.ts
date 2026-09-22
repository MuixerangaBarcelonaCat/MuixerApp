import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { NotificationLinkType, NotificationScheduleType, NotificationTargetType } from '@muixer/shared';
import { CreateNotificationScheduleDto } from './create-notification-schedule.dto';

const validate = (payload: Record<string, unknown>) =>
  validateSync(plainToInstance(CreateNotificationScheduleDto, payload), { whitelist: true });

const base = {
  title: 'Assaig',
  body: 'Dijous a les 20h',
  linkTo: NotificationLinkType.HOME,
  target: { type: NotificationTargetType.ALL },
  scheduleType: NotificationScheduleType.ONE_OFF,
  oneOff: { scheduledFor: '2026-12-01T18:00:00.000Z' },
};

describe('CreateNotificationScheduleDto', () => {
  it('accepts a minimal valid ONE_OFF payload', () => {
    expect(validate(base)).toHaveLength(0);
  });

  it('rejects a payload without scheduleType', () => {
    const { scheduleType: _omit, ...rest } = base;
    const errors = validate(rest);
    expect(errors.some((e) => e.property === 'scheduleType')).toBe(true);
  });

  it('rejects WEEKLY and BEFORE_EVENT — not implemented yet', () => {
    for (const scheduleType of [NotificationScheduleType.WEEKLY, NotificationScheduleType.BEFORE_EVENT]) {
      const errors = validate({ ...base, scheduleType });
      expect(errors.some((e) => e.property === 'scheduleType')).toBe(true);
    }
  });

  it('requires oneOff when scheduleType is ONE_OFF', () => {
    const { oneOff: _omit, ...rest } = base;
    const errors = validate(rest);
    expect(errors.some((e) => e.property === 'oneOff')).toBe(true);
  });

  it('rejects a non-ISO scheduledFor', () => {
    const errors = validate({ ...base, oneOff: { scheduledFor: 'not-a-date' } });
    expect(errors.some((e) => e.property === 'oneOff')).toBe(true);
  });

  it('still enforces the shared content validators (e.g. missing target)', () => {
    const { target: _omit, ...rest } = base;
    const errors = validate(rest);
    expect(errors.some((e) => e.property === 'target')).toBe(true);
  });
});
