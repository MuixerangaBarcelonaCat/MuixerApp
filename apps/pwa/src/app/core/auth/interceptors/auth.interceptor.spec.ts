import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../../../shared/services/toast.service';
import { of, throwError } from 'rxjs';

@Component({ standalone: true, template: '' })
class StubComponent {}

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let authService: {
    getAccessToken: ReturnType<typeof vi.fn>;
    refresh: ReturnType<typeof vi.fn>;
    clearState: ReturnType<typeof vi.fn>;
  };
  let router: Router;
  let toast: ToastService;

  beforeEach(() => {
    authService = {
      getAccessToken: vi.fn().mockReturnValue('test-token'),
      refresh: vi.fn(),
      clearState: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'login', component: StubComponent },
        ]),
        { provide: AuthService, useValue: authService },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    toast = TestBed.inject(ToastService);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('adds Bearer header for non-auth requests', () => {
    http.get('/api/events').subscribe();

    const req = httpTesting.expectOne('/api/events');
    expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
    req.flush([]);
  });

  it('skips Bearer for /auth/ URLs', () => {
    http.post('/api/auth/refresh', {}).subscribe();

    const req = httpTesting.expectOne('/api/auth/refresh');
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(req.request.withCredentials).toBe(true);
    req.flush({});
  });

  it('retries on 401 after successful refresh', () => {
    authService.refresh.mockReturnValue(of(void 0));
    authService.getAccessToken
      .mockReturnValueOnce('old-token')
      .mockReturnValue('new-token');

    http.get('/api/events').subscribe();

    const req = httpTesting.expectOne('/api/events');
    req.flush(null, { status: 401, statusText: 'Unauthorized' });

    const retryReq = httpTesting.expectOne('/api/events');
    expect(retryReq.request.headers.get('Authorization')).toBe('Bearer new-token');
    retryReq.flush([]);
  });

  it('redirects to /login on refresh failure', () => {
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    authService.refresh.mockReturnValue(
      throwError(() => new Error('refresh failed')),
    );

    http.get('/api/events').subscribe({ error: () => void 0 });

    httpTesting
      .expectOne('/api/events')
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(authService.clearState).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
  });

  it('shows toast on session expiry', () => {
    const toastSpy = vi.spyOn(toast, 'error');
    authService.refresh.mockReturnValue(
      throwError(() => new Error('refresh failed')),
    );

    http.get('/api/events').subscribe({ error: () => void 0 });

    httpTesting
      .expectOne('/api/events')
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(toastSpy).toHaveBeenCalledWith(
      'La sessió ha expirat. Torna a entrar.',
    );
  });
});
