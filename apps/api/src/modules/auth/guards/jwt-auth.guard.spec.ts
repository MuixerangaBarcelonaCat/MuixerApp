import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from './jwt-auth.guard';
import { IS_PUBLIC_KEY, IS_SSE_KEY } from '../constants/auth.constants';

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

  const mockMetadata = (values: Partial<Record<string, boolean>>) => {
    reflector.getAllAndOverride.mockImplementation((key: string) => values[key] ?? false);
  };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new JwtAuthGuard(reflector as unknown as Reflector);
  });

  it('allows the request through when the handler is marked @Public()', () => {
    mockMetadata({ [IS_PUBLIC_KEY]: true });
    const context = mockContext();

    expect(guard.canActivate(context)).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [handler, controllerClass]);
  });

  it('delegates to the default Passport JWT strategy when neither public nor SSE', () => {
    mockMetadata({ [IS_PUBLIC_KEY]: false, [IS_SSE_KEY]: false });
    const superCanActivate = jest
      .spyOn(AuthGuard('jwt').prototype, 'canActivate')
      .mockReturnValue(true as never);

    const context = mockContext();
    expect(guard.canActivate(context)).toBe(true);
    expect(superCanActivate).toHaveBeenCalledWith(context);

    superCanActivate.mockRestore();
  });

  it('delegates to the SSE-scoped JWT strategy when marked @SseAuth() (accepts ?token=)', () => {
    mockMetadata({ [IS_PUBLIC_KEY]: false, [IS_SSE_KEY]: true });
    const sseCanActivate = jest
      .spyOn(AuthGuard('jwt-sse').prototype, 'canActivate')
      .mockReturnValue(true as never);
    const defaultCanActivate = jest.spyOn(AuthGuard('jwt').prototype, 'canActivate');

    const context = mockContext();
    expect(guard.canActivate(context)).toBe(true);
    expect(sseCanActivate).toHaveBeenCalledWith(context);
    expect(defaultCanActivate).not.toHaveBeenCalled();

    sseCanActivate.mockRestore();
    defaultCanActivate.mockRestore();
  });
});
