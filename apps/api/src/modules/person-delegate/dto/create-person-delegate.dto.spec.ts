import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DelegateType } from '@muixer/shared';
import { CreatePersonDelegateDto } from './create-person-delegate.dto';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const PERSON_ID = '22222222-2222-4222-8222-222222222222';

async function validateDto(plain: object): Promise<string[]> {
  const dto = plainToInstance(CreatePersonDelegateDto, plain);
  const errors = await validate(dto);
  return errors.flatMap((e) => Object.values(e.constraints ?? {}));
}

describe('CreatePersonDelegateDto — who becomes the delegate', () => {
  it('accepts a user id', async () => {
    expect(await validateDto({ userId: USER_ID, delegateType: DelegateType.PARENT })).toHaveLength(0);
  });

  it('accepts a responsible person id instead', async () => {
    expect(
      await validateDto({ responsiblePersonId: PERSON_ID, delegateType: DelegateType.PARENT, isPrimary: true }),
    ).toHaveLength(0);
  });

  it('rejects neither', async () => {
    expect(await validateDto({ delegateType: DelegateType.PARENT })).not.toHaveLength(0);
  });

  it('rejects both at once', async () => {
    expect(
      await validateDto({ userId: USER_ID, responsiblePersonId: PERSON_ID, delegateType: DelegateType.PARENT }),
    ).not.toHaveLength(0);
  });

  it('rejects a responsible person id that is not a UUID', async () => {
    expect(
      await validateDto({ responsiblePersonId: 'nope', delegateType: DelegateType.PARENT }),
    ).not.toHaveLength(0);
  });
});
