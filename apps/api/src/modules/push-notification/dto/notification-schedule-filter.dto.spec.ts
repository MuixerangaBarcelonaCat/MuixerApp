import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { NotificationScheduleFilterDto } from './notification-schedule-filter.dto';

const transform = (payload: Record<string, unknown>) =>
  plainToInstance(NotificationScheduleFilterDto, payload, { enableImplicitConversion: false });

describe('NotificationScheduleFilterDto', () => {
  it('reads ?isActive=true as true', () => {
    const dto = transform({ isActive: 'true' });
    expect(dto.isActive).toBe(true);
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('reads ?isActive=false as false — a query string is never truthy-cast', () => {
    const dto = transform({ isActive: 'false' });
    expect(dto.isActive).toBe(false);
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('leaves isActive undefined when the param is absent', () => {
    const dto = transform({});
    expect(dto.isActive).toBeUndefined();
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('leaves isActive undefined for an unrecognised value rather than filtering by it', () => {
    const dto = transform({ isActive: 'maybe' });
    expect(dto.isActive).toBeUndefined();
  });
});
