import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { RegisterSubscriptionDto } from './register-subscription.dto';

const validate = (payload: Record<string, unknown>) =>
  validateSync(plainToInstance(RegisterSubscriptionDto, payload), { whitelist: true });

describe('RegisterSubscriptionDto', () => {
  it('rejects a payload without keys instead of reaching the database', () => {
    const errors = validate({ endpoint: 'https://fcm.googleapis.com/push/1' });
    expect(errors.some((e) => e.property === 'keys')).toBe(true);
  });

  it('accepts a complete payload', () => {
    expect(
      validate({
        endpoint: 'https://fcm.googleapis.com/push/1',
        keys: { p256dh: 'abc', auth: 'def' },
      }),
    ).toHaveLength(0);
  });
});