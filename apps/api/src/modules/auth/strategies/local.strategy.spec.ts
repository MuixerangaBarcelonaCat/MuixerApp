import { UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@muixer/shared';
import { LocalStrategy } from './local.strategy';
import { AuthService } from '../auth.service';
import { User } from '../../user/user.entity';

const mockAuthService = () => ({ validateUser: jest.fn() });

describe('LocalStrategy', () => {
  let strategy: LocalStrategy;
  let authService: ReturnType<typeof mockAuthService>;

  beforeEach(() => {
    authService = mockAuthService();
    strategy = new LocalStrategy(authService as unknown as AuthService);
  });

  it('returns the user when the credentials are valid', async () => {
    const user = { id: 'user-1', email: 'a@b.cat', role: UserRole.TECHNICAL } as User;
    authService.validateUser.mockResolvedValue(user);

    await expect(strategy.validate('a@b.cat', 'correct-password')).resolves.toBe(user);
    expect(authService.validateUser).toHaveBeenCalledWith('a@b.cat', 'correct-password');
  });

  it('throws UnauthorizedException when the credentials are invalid', async () => {
    authService.validateUser.mockResolvedValue(null);

    await expect(strategy.validate('a@b.cat', 'wrong-password')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
