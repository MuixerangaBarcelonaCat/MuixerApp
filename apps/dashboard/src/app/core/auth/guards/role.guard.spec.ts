import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import { UserRole } from '@muixer/shared';
import { rolesGuard } from './role.guard';
import { AuthService } from '../services/auth.service';

const runRolesGuard = (userRole: UserRole | null, ...allowedRoles: UserRole[]) => {
  TestBed.configureTestingModule({
    imports: [RouterTestingModule],
    providers: [
      {
        provide: AuthService,
        useValue: {
          userRole: signal(userRole),
          whenReady: () => Promise.resolve(),
        },
      },
    ],
  });
  return TestBed.runInInjectionContext(() =>
    rolesGuard(...allowedRoles)({} as never, {} as never),
  ) as Promise<boolean | ReturnType<Router['createUrlTree']>>;
};

describe('rolesGuard', () => {
  it('returns true when role is in the allowed list', async () => {
    expect(await runRolesGuard(UserRole.TECHNICAL, UserRole.TECHNICAL, UserRole.ADMIN)).toBe(true);
  });

  it('returns true for ADMIN when explicitly allowed', async () => {
    expect(await runRolesGuard(UserRole.ADMIN, UserRole.TECHNICAL, UserRole.ADMIN)).toBe(true);
  });

  it('redirects when role is not in the allowed list (MEMBER)', async () => {
    const result = await runRolesGuard(UserRole.MEMBER, UserRole.TECHNICAL, UserRole.ADMIN);
    expect((result as ReturnType<Router['createUrlTree']>).toString()).toBe('/login');
  });

  it('redirects when role is not in the allowed list even if higher (no implicit hierarchy)', async () => {
    const result = await runRolesGuard(UserRole.ADMIN, UserRole.TECHNICAL);
    expect((result as ReturnType<Router['createUrlTree']>).toString()).toBe('/login');
  });

  it('redirects when user is not authenticated (null role)', async () => {
    const result = await runRolesGuard(null, UserRole.TECHNICAL, UserRole.ADMIN);
    expect((result as ReturnType<Router['createUrlTree']>).toString()).toBe('/login');
  });
});
