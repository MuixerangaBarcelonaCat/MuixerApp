import { TestBed } from '@angular/core/testing';
import { provideRouter, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { alreadyAuthGuard } from './already-auth.guard';

describe('alreadyAuthGuard', () => {
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

  it('redirects to /home if authenticated', async () => {
    setup(true);
    const result = await TestBed.runInInjectionContext(() =>
      alreadyAuthGuard({} as any, {} as any),
    );
    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/home');
  });

  it('allows access if not authenticated', async () => {
    setup(false);
    const result = await TestBed.runInInjectionContext(() =>
      alreadyAuthGuard({} as any, {} as any),
    );
    expect(result).toBe(true);
  });
});
