import { TestBed } from '@angular/core/testing';
import { convertToParamMap, provideRouter, UrlTree } from '@angular/router';
import { UserRole } from '@muixer/shared';
import { AuthService } from '../services/auth.service';
import { rolesGuard } from './roles.guard';

describe('rolesGuard', () => {
  let clearState: ReturnType<typeof vi.fn>;

  const setup = (role: UserRole | null) => {
    clearState = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            whenReady: () => Promise.resolve(),
            userRole: () => role,
            clearState,
          },
        },
      ],
    });
  };

  const routeWithId = (id: string) =>
    ({ paramMap: convertToParamMap({ id }) }) as any;

  it('allows MEMBER role', async () => {
    setup(UserRole.MEMBER);
    const guard = rolesGuard([UserRole.MEMBER, UserRole.TECHNICAL, UserRole.ADMIN]);
    const result = await TestBed.runInInjectionContext(() => guard({} as any, {} as any));
    expect(result).toBe(true);
  });

  it('allows TECHNICAL role', async () => {
    setup(UserRole.TECHNICAL);
    const guard = rolesGuard([UserRole.MEMBER, UserRole.TECHNICAL, UserRole.ADMIN]);
    const result = await TestBed.runInInjectionContext(() => guard({} as any, {} as any));
    expect(result).toBe(true);
  });

  it('allows ADMIN role', async () => {
    setup(UserRole.ADMIN);
    const guard = rolesGuard([UserRole.MEMBER, UserRole.TECHNICAL, UserRole.ADMIN]);
    const result = await TestBed.runInInjectionContext(() => guard({} as any, {} as any));
    expect(result).toBe(true);
  });

  it('rejects null role and does not clear state (nothing to clear)', async () => {
    setup(null);
    const guard = rolesGuard([UserRole.MEMBER, UserRole.TECHNICAL, UserRole.ADMIN]);
    const result = await TestBed.runInInjectionContext(() => guard({} as any, {} as any));
    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/login');
  });

  it('signs out and redirects to /login on a role mismatch by default (AppShell usage)', async () => {
    setup(UserRole.MEMBER);
    const guard = rolesGuard([UserRole.TECHNICAL, UserRole.ADMIN]);
    const result = await TestBed.runInInjectionContext(() => guard({} as any, {} as any));
    expect(clearState).toHaveBeenCalled();
    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/login');
  });

  it('does not sign out and instead redirects within the app when signOutOnDeny is false', async () => {
    setup(UserRole.MEMBER);
    const guard = rolesGuard([UserRole.TECHNICAL, UserRole.ADMIN], false);
    const result = await TestBed.runInInjectionContext(() =>
      guard(routeWithId('event-1'), {} as any),
    );
    expect(clearState).not.toHaveBeenCalled();
    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/events/event-1');
  });
});
