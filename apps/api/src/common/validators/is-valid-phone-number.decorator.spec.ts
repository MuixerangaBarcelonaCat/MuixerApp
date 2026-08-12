import { validate } from 'class-validator';
import { IsValidPhoneNumber } from './is-valid-phone-number.decorator';

class PhoneHolder {
  @IsValidPhoneNumber()
  phone: string;
}

const holder = (phone: string): PhoneHolder => {
  const h = new PhoneHolder();
  h.phone = phone;
  return h;
};

describe('IsValidPhoneNumber', () => {
  it('accepts a valid E.164 Spanish mobile number', async () => {
    const errors = await validate(holder('+34612345678'));
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid E.164 number from another country', async () => {
    const errors = await validate(holder('+33612345678'));
    expect(errors).toHaveLength(0);
  });

  it('rejects a number without the country prefix', async () => {
    const errors = await validate(holder('612345678'));
    expect(errors).toHaveLength(1);
  });

  it('rejects an implausible number', async () => {
    const errors = await validate(holder('+34123'));
    expect(errors).toHaveLength(1);
  });

  it('rejects a non-numeric string', async () => {
    const errors = await validate(holder('not-a-phone'));
    expect(errors).toHaveLength(1);
  });
});
