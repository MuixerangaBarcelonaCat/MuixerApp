import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AccessStatus } from '@muixer/shared';
import { PersonFilterDto } from './person-filter.dto';

async function validateDto(plain: object): Promise<PersonFilterDto> {
  const dto = plainToInstance(PersonFilterDto, plain);
  const errors = await validate(dto);
  if (errors.length > 0) {
    throw errors;
  }
  return dto;
}

describe('PersonFilterDto', () => {
  it('accepts valid sortBy and sortOrder', async () => {
    const dto = await validateDto({ sortBy: 'alias', sortOrder: 'DESC' });
    expect(dto.sortBy).toBe('alias');
    expect(dto.sortOrder).toBe('DESC');
  });

  it('rejects invalid sortBy', async () => {
    await expect(validateDto({ sortBy: 'invalidColumn', sortOrder: 'ASC' })).rejects.toBeDefined();
  });

  it('rejects sortBy=email — Person has no email column', async () => {
    await expect(validateDto({ sortBy: 'email', sortOrder: 'ASC' })).rejects.toBeDefined();
  });

  it('rejects invalid sortOrder', async () => {
    await expect(validateDto({ sortBy: 'alias', sortOrder: 'down' })).rejects.toBeDefined();
  });

  it('allows optional sort fields to be omitted', async () => {
    const dto = await validateDto({ page: 1, limit: 25 });
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(25);
    expect(dto.sortBy).toBeUndefined();
  });

  it('accepts an access status to filter by', async () => {
    const dto = await validateDto({ accessStatus: AccessStatus.INVITE_EXPIRED });
    expect(dto.accessStatus).toBe(AccessStatus.INVITE_EXPIRED);
  });

  it('rejects an unknown access status', async () => {
    await expect(validateDto({ accessStatus: 'BANNED' })).rejects.toBeDefined();
  });

  it('never sorts by access status', async () => {
    await expect(validateDto({ sortBy: 'accessStatus', sortOrder: 'ASC' })).rejects.toBeDefined();
  });
});
