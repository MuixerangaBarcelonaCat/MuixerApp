import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateAdHocNodeDto } from './update-ad-hoc-node.dto';

async function validateDto(plain: object): Promise<string[]> {
  const dto = plainToInstance(UpdateAdHocNodeDto, plain);
  const errors = await validate(dto);
  return errors.flatMap((e) => Object.values(e.constraints ?? {}));
}

describe('UpdateAdHocNodeDto — label constraints', () => {
  it('accepts a label up to 500 characters', async () => {
    const label = 'B'.repeat(500);
    const errors = await validateDto({ label });
    expect(errors).toHaveLength(0);
  });

  it('rejects a label longer than 500 characters', async () => {
    const label = 'B'.repeat(501);
    const errors = await validateDto({ label });
    expect(errors.some((e) => e.includes('500'))).toBe(true);
  });

  it('accepts a label with internal newlines', async () => {
    const errors = await validateDto({ label: 'Línia 1\nLínia 2\nLínia 3' });
    expect(errors).toHaveLength(0);
  });
});
