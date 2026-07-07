import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@muixer/shared';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../constants/auth.constants';

const handler = () => undefined;
const controllerClass = class {};

const mockContext = (user?: { role: UserRole }): ExecutionContext =>
  ({
    getHandler: () => handler,
    getClass: () => controllerClass,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;

describe('RolesGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('allows access when the endpoint declares no @Roles()', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(mockContext())).toBe(true);
  });

  it('allows access when @Roles() is an empty list', () => {
    reflector.getAllAndOverride.mockReturnValue([]);
    expect(guard.canActivate(mockContext())).toBe(true);
  });

  it('denies access when there is no authenticated user on the request', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
    expect(guard.canActivate(mockContext(undefined))).toBe(false);
  });

  it('allows access when the user role is in the required list', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN, UserRole.TECHNICAL]);
    expect(guard.canActivate(mockContext({ role: UserRole.TECHNICAL }))).toBe(true);
  });

  it('denies access when the user role is not in the required list', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
    expect(guard.canActivate(mockContext({ role: UserRole.MEMBER }))).toBe(false);
  });

  it('reads the required roles from the ROLES_KEY metadata', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
    const context = mockContext({ role: UserRole.ADMIN });

    guard.canActivate(context);

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [handler, controllerClass]);
  });
});
