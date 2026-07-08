import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { provideRouter } from '@angular/router';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';
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
    handleSessionExpired: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    authService = {
      getAccessToken: vi.fn().mockReturnValue('test-token'),
      refresh: vi.fn(),
      clearState: vi.fn(),
      handleSessionExpired: vi.fn(),
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

  it('skips Bearer for /auth/login and /auth/refresh URLs', () => {
    http.post('/api/auth/refresh', {}).subscribe();

    const req = httpTesting.expectOne('/api/auth/refresh');
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(req.request.withCredentials).toBe(true);
    req.flush({});
  });

  it('adds Bearer for /auth/logout URL', () => {
    http.post('/api/auth/logout', {}).subscribe();

    const req = httpTesting.expectOne('/api/auth/logout');
    expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
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

  it('calls handleSessionExpired on refresh failure', () => {
    authService.refresh.mockReturnValue(
      throwError(() => new Error('refresh failed')),
    );

    http.get('/api/events').subscribe({ error: () => void 0 });

    httpTesting
      .expectOne('/api/events')
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(authService.handleSessionExpired).toHaveBeenCalled();
  });
});
