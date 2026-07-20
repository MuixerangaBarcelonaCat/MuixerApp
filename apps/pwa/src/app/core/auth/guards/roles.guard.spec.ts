import { TestBed } from '@angular/core/testing';
import { provideRouter, UrlTree } from '@angular/router';
import { UserRole } from '@muixer/shared';
import { AuthService } from '../services/auth.service';
import { rolesGuard } from './roles.guard';

describe('rolesGuard', () => {
  const setup = (role: UserRole | null) => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            whenReady: () => Promise.resolve(),
            userRole: () => role,
          },
        },
      ],
    });
  };

  it('allows MEMBER role', async () => {
    setup(UserRole.MEMBER);
    const guard = rolesGuard(UserRole.MEMBER, UserRole.TECHNICAL, UserRole.ADMIN);
    const result = await TestBed.runInInjectionContext(() => guard({} as any, {} as any));
    expect(result).toBe(true);
  });

  it('allows TECHNICAL role', async () => {
    setup(UserRole.TECHNICAL);
    const guard = rolesGuard(UserRole.MEMBER, UserRole.TECHNICAL, UserRole.ADMIN);
    const result = await TestBed.runInInjectionContext(() => guard({} as any, {} as any));
    expect(result).toBe(true);
  });

  it('allows ADMIN role', async () => {
    setup(UserRole.ADMIN);
    const guard = rolesGuard(UserRole.MEMBER, UserRole.TECHNICAL, UserRole.ADMIN);
    const result = await TestBed.runInInjectionContext(() => guard({} as any, {} as any));
    expect(result).toBe(true);
  });

  it('rejects null role', async () => {
    setup(null);
    const guard = rolesGuard(UserRole.MEMBER, UserRole.TECHNICAL, UserRole.ADMIN);
    const result = await TestBed.runInInjectionContext(() => guard({} as any, {} as any));
    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/login');
  });
});
