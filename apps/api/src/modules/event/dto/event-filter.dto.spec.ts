import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { EventFilterDto } from './event-filter.dto';
import { EventType } from '@muixer/shared';

describe('EventFilterDto', () => {
  const valid = (input: Partial<EventFilterDto>) =>
    plainToInstance(EventFilterDto, input);

  it('accepts empty input (all optional)', async () => {
    const dto = valid({});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts valid eventType enum value', async () => {
    const dto = valid({ eventType: EventType.ASSAIG });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid eventType', async () => {
    const dto = valid({ eventType: 'INVALID' as EventType });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'eventType')).toBe(true);
  });

  it('accepts valid sortBy fields', async () => {
    for (const field of ['date', 'title', 'location', 'startTime', 'createdAt', 'chronological']) {
      const dto = valid({ sortBy: field as never });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    }
  });

  it('rejects invalid sortBy field (SQL injection protection)', async () => {
    const dto = valid({ sortBy: 'date; DROP TABLE events; --' as never });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'sortBy')).toBe(true);
  });

  it('rejects invalid sortOrder', async () => {
    const dto = valid({ sortOrder: 'INVALID' as never });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'sortOrder')).toBe(true);
  });

  it('accepts valid date strings', async () => {
    const dto = valid({ dateFrom: '2026-01-01', dateTo: '2026-12-31' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid date string', async () => {
    const dto = valid({ dateFrom: 'not-a-date' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'dateFrom')).toBe(true);
  });

  it('rejects limit > 100', async () => {
    const dto = valid({ limit: 200 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('accepts valid timeFilter values', async () => {
    for (const tf of ['upcoming', 'past', 'all']) {
      const dto = valid({ timeFilter: tf as never });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    }
  });

  it('rejects invalid timeFilter value', async () => {
    const dto = valid({ timeFilter: 'invalid' as never });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'timeFilter')).toBe(true);
  });
});
