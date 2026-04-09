import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { signal } from '@angular/core';
import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

const mockAuthService = (authenticated: boolean) => ({
  isAuthenticated: signal(authenticated),
});

const runGuard = (authenticated: boolean) => {
  const authService = mockAuthService(authenticated);
  TestBed.configureTestingModule({
    imports: [RouterTestingModule],
    providers: [{ provide: AuthService, useValue: authService }],
  });
  const router = TestBed.inject(Router);
  return TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));
};

describe('authGuard', () => {
  it('returns true when user is authenticated', () => {
    const result = runGuard(true);
    expect(result).toBe(true);
  });

  it('redirects to /login when not authenticated', () => {
    const result = runGuard(false);
    expect(result).toBeTruthy();
    expect((result as ReturnType<Router['createUrlTree']>).toString()).toBe('/login');
  });
});
