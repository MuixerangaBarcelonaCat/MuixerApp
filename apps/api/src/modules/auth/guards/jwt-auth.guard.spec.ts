import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from './jwt-auth.guard';
import { IS_PUBLIC_KEY } from '../constants/auth.constants';

const handler = () => undefined;
const controllerClass = class {};

const mockContext = (): ExecutionContext =>
  ({
    getHandler: () => handler,
    getClass: () => controllerClass,
  }) as unknown as ExecutionContext;

describe('JwtAuthGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let guard: JwtAuthGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new JwtAuthGuard(reflector as unknown as Reflector);
  });

  it('allows the request through when the handler is marked @Public()', () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const context = mockContext();

    expect(guard.canActivate(context)).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [handler, controllerClass]);
  });

  it('delegates to the Passport JWT strategy when the handler is not public', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const superCanActivate = jest
      .spyOn(AuthGuard('jwt').prototype, 'canActivate')
      .mockReturnValue(true as never);

    const context = mockContext();
    expect(guard.canActivate(context)).toBe(true);
    expect(superCanActivate).toHaveBeenCalledWith(context);

    superCanActivate.mockRestore();
  });
});
