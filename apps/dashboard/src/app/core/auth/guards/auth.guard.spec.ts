import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { signal } from '@angular/core';
import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

const mockAuthService = (authenticated: boolean) => ({
  isAuthenticated: signal(authenticated),
  whenReady: () => Promise.resolve(),
});

const runGuard = (authenticated: boolean) => {
  const authService = mockAuthService(authenticated);
  TestBed.configureTestingModule({
    imports: [RouterTestingModule],
    providers: [{ provide: AuthService, useValue: authService }],
  });
  return TestBed.runInInjectionContext(() =>
    authGuard({} as never, {} as never),
  ) as Promise<boolean | ReturnType<Router['createUrlTree']>>;
};

describe('authGuard', () => {
  it('returns true when user is authenticated', async () => {
    const result = await runGuard(true);
    expect(result).toBe(true);
  });

  it('redirects to /login when not authenticated', async () => {
    const result = await runGuard(false);
    expect(result).toBeTruthy();
    expect((result as ReturnType<Router['createUrlTree']>).toString()).toBe('/login');
  });

  it('waits for whenReady before deciding', async () => {
    let resolveReady!: () => void;
    const readyPromise = new Promise<void>((r) => (resolveReady = r));

    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [
        {
          provide: AuthService,
          useValue: {
            isAuthenticated: signal(true),
            whenReady: () => readyPromise,
          },
        },
      ],
    });

    const resultPromise = TestBed.runInInjectionContext(() =>
      authGuard({} as never, {} as never),
    ) as Promise<boolean | ReturnType<Router['createUrlTree']>>;

    resolveReady();
    const result = await resultPromise;
    expect(result).toBe(true);
  });
});
