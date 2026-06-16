import { getInviteCooldownMs } from './invite.constants';

describe('invite.constants', () => {
  const env = process.env;

  afterEach(() => {
    process.env = env;
  });

  it('defaults to 2 minutes', () => {
    delete process.env['INVITE_COOLDOWN_MINUTES'];
    expect(getInviteCooldownMs()).toBe(2 * 60 * 1000);
  });

  it('reads INVITE_COOLDOWN_MINUTES from env', () => {
    process.env['INVITE_COOLDOWN_MINUTES'] = '5';
    expect(getInviteCooldownMs()).toBe(5 * 60 * 1000);
  });
});
