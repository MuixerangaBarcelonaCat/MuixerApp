import { TestBed } from '@angular/core/testing';
import { provideRouter, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  const setup = (isAuthenticated: boolean) => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            whenReady: () => Promise.resolve(),
            isAuthenticated: () => isAuthenticated,
          },
        },
      ],
    });
  };

  it('allows authenticated users', async () => {
    setup(true);
    const result = await TestBed.runInInjectionContext(() => authGuard({} as any, {} as any));
    expect(result).toBe(true);
  });

  it('redirects unauthenticated to /login', async () => {
    setup(false);
    const result = await TestBed.runInInjectionContext(() => authGuard({} as any, {} as any));
    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/login');
  });

  it('waits for whenReady() before deciding', async () => {
    let resolve!: () => void;
    const readyPromise = new Promise<void>((r) => (resolve = r));

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            whenReady: () => readyPromise,
            isAuthenticated: () => true,
          },
        },
      ],
    });

    let resolved = false;
    const guardPromise = (
      TestBed.runInInjectionContext(() =>
        authGuard({} as any, {} as any),
      ) as Promise<boolean | UrlTree>
    ).then((r: boolean | UrlTree) => {
      resolved = true;
      return r;
    });

    expect(resolved).toBe(false);
    resolve();
    const result = await guardPromise;
    expect(resolved).toBe(true);
    expect(result).toBe(true);
  });
});
