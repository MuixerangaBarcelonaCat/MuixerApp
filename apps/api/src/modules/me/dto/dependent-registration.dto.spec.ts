import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Gender } from '@muixer/shared';
import { DependentRegistrationDto } from './dependent-registration.dto';
import { RegisterViaInviteDto } from '../../auth/dto/register-via-invite.dto';

const PERSONAL_DATA = {
  name: 'Joan',
  firstSurname: 'Garcia',
  gender: Gender.MALE,
  birthDate: '2015-01-15',
};

async function errorsFor<T extends object>(cls: new () => T, plain: object): Promise<string[]> {
  const errors = await validate(plainToInstance(cls, plain));
  return errors.map((e) => e.property);
}

describe('DependentRegistrationDto — phone', () => {
  const base = { ...PERSONAL_DATA, personId: '3f1b7c3e-6f0e-4a3b-9a55-0f6f2a7b9c11' };

  it('does not require a phone (xicalla have none)', async () => {
    expect(await errorsFor(DependentRegistrationDto, base)).toEqual([]);
  });
});

describe('RegisterViaInviteDto — phone', () => {
  const base = {
    ...PERSONAL_DATA,
    token: 't',
    email: 'a@b.cat',
    password: 'password1',
    legalAccepted: true,
  };

  it('still requires a phone for the normal invitation form', async () => {
    expect(await errorsFor(RegisterViaInviteDto, base)).toContain('phone');
  });

  it('accepts a valid phone', async () => {
    expect(await errorsFor(RegisterViaInviteDto, { ...base, phone: '+34612345678' })).toEqual([]);
  });
});
