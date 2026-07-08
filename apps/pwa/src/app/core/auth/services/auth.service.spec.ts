import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthResponse, ClientType, UserProfile, UserRole } from '@muixer/shared';
import { AuthService } from './auth.service';

const mockUser: UserProfile = {
  id: 'u1',
  email: 'test@test.cat',
  role: UserRole.MEMBER,
  isActive: true,
  person: { id: 'p1', name: 'Test', firstSurname: 'User', alias: 'TU', email: null },
};

const mockUserNoPerson: UserProfile = {
  ...mockUser,
  person: null,
};

const mockAuthResponse: AuthResponse = {
  accessToken: 'jwt-token',
  user: mockUser,
};

describe('AuthService', () => {
  let service: AuthService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });

    service = TestBed.inject(AuthService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('login() sends clientType PWA', () => {
    service.login({ email: 'a@b.cat', password: 'pass' }).subscribe();

    const req = httpTesting.expectOne('/api/auth/login');
    expect(req.request.body.clientType).toBe(ClientType.PWA);
    req.flush(mockAuthResponse);
  });

  it('login() stores access token and user', () => {
    service.login({ email: 'a@b.cat', password: 'pass' }).subscribe();

    httpTesting.expectOne('/api/auth/login').flush(mockAuthResponse);

    expect(service.getAccessToken()).toBe('jwt-token');
    expect(service.isAuthenticated()).toBe(true);
    expect(service.currentUser()?.email).toBe('test@test.cat');
  });

  it('refresh() updates tokens on success', () => {
    service.refresh().subscribe();

    httpTesting.expectOne('/api/auth/refresh').flush(mockAuthResponse);

    expect(service.getAccessToken()).toBe('jwt-token');
    expect(service.isAuthenticated()).toBe(true);
  });

  it('refresh() deduplicates concurrent calls', () => {
    service.refresh().subscribe();
    service.refresh().subscribe();

    const reqs = httpTesting.match('/api/auth/refresh');
    expect(reqs.length).toBe(1);
    reqs[0].flush(mockAuthResponse);
  });

  it('clearState() resets signals', () => {
    service.login({ email: 'a@b.cat', password: 'pass' }).subscribe();
    httpTesting.expectOne('/api/auth/login').flush(mockAuthResponse);

    service.clearState();

    expect(service.isAuthenticated()).toBe(false);
    expect(service.getAccessToken()).toBeNull();
  });

  it('init() calls silentRefresh and resolves whenReady', async () => {
    const initPromise = service.init();

    httpTesting.expectOne('/api/auth/refresh').flush(mockAuthResponse);

    await initPromise;

    expect(service.isReady()).toBe(true);
    expect(service.isAuthenticated()).toBe(true);
  });

  it('silentRefresh failure marks ready', async () => {
    const initPromise = service.init();

    httpTesting
      .expectOne('/api/auth/refresh')
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    await initPromise;

    expect(service.isReady()).toBe(true);
    expect(service.isAuthenticated()).toBe(false);
  });

  it('logout() clears state even on error', () => {
    service.login({ email: 'a@b.cat', password: 'pass' }).subscribe();
    httpTesting.expectOne('/api/auth/login').flush(mockAuthResponse);

    service.logout().subscribe();
    httpTesting
      .expectOne('/api/auth/logout')
      .flush(null, { status: 500, statusText: 'Error' });

    expect(service.isAuthenticated()).toBe(false);
  });

  it('hasLinkedPerson() returns false when person is null', () => {
    service
      .login({ email: 'a@b.cat', password: 'pass' })
      .subscribe();

    httpTesting
      .expectOne('/api/auth/login')
      .flush({ accessToken: 'tok', user: mockUserNoPerson });

    expect(service.hasLinkedPerson()).toBe(false);
  });
});
