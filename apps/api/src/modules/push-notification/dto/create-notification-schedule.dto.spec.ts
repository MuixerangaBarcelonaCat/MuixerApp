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

  it('rejects BEFORE_EVENT — not implemented yet', () => {
    const errors = validate({ ...base, scheduleType: NotificationScheduleType.BEFORE_EVENT });
    expect(errors.some((e) => e.property === 'scheduleType')).toBe(true);
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

  describe('WEEKLY', () => {
    const weeklyBase = {
      title: 'Assaig',
      body: 'Dijous a les 20h',
      linkTo: NotificationLinkType.HOME,
      target: { type: NotificationTargetType.ALL },
      scheduleType: NotificationScheduleType.WEEKLY,
      weekly: { dayOfWeek: 1, timeOfDay: '18:00' },
    };

    it('accepts a minimal valid WEEKLY payload', () => {
      expect(validate(weeklyBase)).toHaveLength(0);
    });

    it('requires weekly when scheduleType is WEEKLY', () => {
      const { weekly: _omit, ...rest } = weeklyBase;
      const errors = validate(rest);
      expect(errors.some((e) => e.property === 'weekly')).toBe(true);
    });

    it('does not require oneOff for a WEEKLY payload', () => {
      expect(validate(weeklyBase).some((e) => e.property === 'oneOff')).toBe(false);
    });

    it.each([-1, 7, 1.5])('rejects an out-of-range or non-integer dayOfWeek (%s)', (dayOfWeek) => {
      const errors = validate({ ...weeklyBase, weekly: { dayOfWeek, timeOfDay: '18:00' } });
      expect(errors.some((e) => e.property === 'weekly')).toBe(true);
    });

    it.each(['24:00', '9:00', '18:60', 'not-a-time'])('rejects an invalid timeOfDay (%s)', (timeOfDay) => {
      const errors = validate({ ...weeklyBase, weekly: { dayOfWeek: 1, timeOfDay } });
      expect(errors.some((e) => e.property === 'weekly')).toBe(true);
    });

    it('accepts every valid dayOfWeek from 0 to 6', () => {
      for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
        expect(validate({ ...weeklyBase, weekly: { dayOfWeek, timeOfDay: '09:00' } })).toHaveLength(0);
      }
    });

    describe('startDate/endDate', () => {
      it('accepts a weekly payload with no startDate/endDate (unbounded)', () => {
        expect(validate(weeklyBase)).toHaveLength(0);
      });

      it('accepts a valid startDate and endDate', () => {
        const errors = validate({
          ...weeklyBase,
          weekly: { ...weeklyBase.weekly, startDate: '2026-06-01', endDate: '2026-12-31' },
        });
        expect(errors).toHaveLength(0);
      });

      it('accepts only a startDate', () => {
        expect(
          validate({ ...weeklyBase, weekly: { ...weeklyBase.weekly, startDate: '2026-06-01' } }),
        ).toHaveLength(0);
      });

      it('accepts only an endDate', () => {
        expect(
          validate({ ...weeklyBase, weekly: { ...weeklyBase.weekly, endDate: '2026-12-31' } }),
        ).toHaveLength(0);
      });

      it.each(['2026-13-01', '01/06/2026', '2026-06-01T00:00:00.000Z', 'not-a-date'])(
        'rejects a malformed startDate (%s)',
        (startDate) => {
          const errors = validate({ ...weeklyBase, weekly: { ...weeklyBase.weekly, startDate } });
          expect(errors.some((e) => e.property === 'weekly')).toBe(true);
        },
      );

      it.each(['2026-13-01', '31/12/2026', 'not-a-date'])('rejects a malformed endDate (%s)', (endDate) => {
        const errors = validate({ ...weeklyBase, weekly: { ...weeklyBase.weekly, endDate } });
        expect(errors.some((e) => e.property === 'weekly')).toBe(true);
      });
    });
  });
});
