import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AvailablePersonsQueryDto } from './available-persons-query.dto';
import { TagCategory } from '@muixer/shared';

describe('AvailablePersonsQueryDto', () => {
  it('leaves isXicalla/excludeAssigned undefined when the query param is absent (SM-12)', () => {
    const dto = plainToInstance(AvailablePersonsQueryDto, {});
    expect(dto.isXicalla).toBeUndefined();
    expect(dto.excludeAssigned).toBeUndefined();
  });

  it('coerces the string "true"/"false" query params into real booleans', () => {
    const dto = plainToInstance(AvailablePersonsQueryDto, {
      isXicalla: 'true',
      excludeAssigned: 'false',
    });
    expect(dto.isXicalla).toBe(true);
    expect(dto.excludeAssigned).toBe(false);
  });

  it('passes positionId through untouched', () => {
    const dto = plainToInstance(AvailablePersonsQueryDto, { positionId: 'pos-agulla' });
    expect(dto.positionId).toBe('pos-agulla');
  });

  it('validates successfully with no query params', async () => {
    const dto = plainToInstance(AvailablePersonsQueryDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid positionCategory value', async () => {
    const dto = plainToInstance(AvailablePersonsQueryDto, { positionCategory: TagCategory.TRONC });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.positionCategory).toBe(TagCategory.TRONC);
  });

  it('rejects an invalid positionCategory value', async () => {
    const dto = plainToInstance(AvailablePersonsQueryDto, { positionCategory: 'NOT_A_CATEGORY' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('positionCategory');
  });
});
