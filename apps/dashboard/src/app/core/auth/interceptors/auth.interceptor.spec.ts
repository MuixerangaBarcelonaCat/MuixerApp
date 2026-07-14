import { HttpErrorResponse, HttpRequest } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  function setup(authServiceOverrides: Partial<AuthService> = {}) {
    const authService = {
      getAccessToken: vi.fn().mockReturnValue('token-1'),
      refresh: vi.fn().mockReturnValue(of(undefined)),
      clearState: vi.fn(),
      ...authServiceOverrides,
    } as unknown as AuthService;

    const router = { navigate: vi.fn() } as unknown as Router;

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
      ],
    });

    return { authService, router };
  }

  function run(next: (req: HttpRequest<unknown>) => unknown) {
    const req = new HttpRequest('GET', '/api/persons');
    return TestBed.runInInjectionContext(() =>
      authInterceptor(req, next as never),
    );
  }

  it('does not clear session state when the retried request fails after a successful refresh', async () => {
    const { authService, router } = setup();
    let call = 0;
    const next = vi.fn().mockImplementation(() => {
      call++;
      if (call === 1) {
        return throwError(() => new HttpErrorResponse({ status: 401 }));
      }
      // Retry fails with an unrelated transient error (e.g. 500)
      return throwError(() => new HttpErrorResponse({ status: 500 }));
    });

    await expect(new Promise((resolve, reject) => {
      (run(next) as ReturnType<typeof of>).subscribe({
        next: resolve,
        error: reject,
      });
    })).rejects.toMatchObject({ status: 500 });

    expect(authService.refresh).toHaveBeenCalled();
    expect(authService.clearState).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('clears session state and redirects to login when refresh itself fails', async () => {
    const { authService, router } = setup({
      refresh: vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 }))),
    });
    const next = vi.fn().mockImplementation(() => throwError(() => new HttpErrorResponse({ status: 401 })));

    await expect(new Promise((resolve, reject) => {
      (run(next) as ReturnType<typeof of>).subscribe({
        next: resolve,
        error: reject,
      });
    })).rejects.toMatchObject({ status: 401 });

    expect(authService.clearState).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});
