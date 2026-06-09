import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { signal } from '@angular/core';
import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

describe('authGuard', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('returns true when user is authenticated', async () => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [
        {
          provide: AuthService,
          useValue: { isAuthenticated: signal(true), whenReady: () => Promise.resolve() },
        },
      ],
    });

    const result = await (TestBed.runInInjectionContext(() =>
      authGuard({} as never, {} as never),
    ) as Promise<boolean | ReturnType<Router['createUrlTree']>>);

    expect(result).toBe(true);
  });

  it('redirects to /login when not authenticated', async () => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [
        {
          provide: AuthService,
          useValue: { isAuthenticated: signal(false), whenReady: () => Promise.resolve() },
        },
      ],
    });

    const result = await (TestBed.runInInjectionContext(() =>
      authGuard({} as never, {} as never),
    ) as Promise<boolean | ReturnType<Router['createUrlTree']>>);

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
          useValue: { isAuthenticated: signal(true), whenReady: () => readyPromise },
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
