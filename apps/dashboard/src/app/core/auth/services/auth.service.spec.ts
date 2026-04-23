import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { UserRole, ClientType } from '@muixer/shared';
import { AuthService } from './auth.service';
import { AuthResponse, UserProfile } from '../models/auth.models';

const mockProfile: UserProfile = {
  id: 'u1',
  email: 'user@test.cat',
  role: UserRole.TECHNICAL,
  isActive: true,
  person: null,
};

const mockAuthResponse: AuthResponse = {
  accessToken: 'access-jwt',
  user: mockProfile,
};

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      providers: [AuthService],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => http.verify());

  describe('init (silent refresh)', () => {
    it('authenticates silently when valid cookie exists', async () => {
      const ready = service.init();

      http.expectOne((r) => r.url.includes('/auth/refresh')).flush(mockAuthResponse);
      await ready;

      expect(service.isReady()).toBe(true);
      expect(service.isAuthenticated()).toBe(true);
      expect(service.currentUser()?.role).toBe(UserRole.TECHNICAL);
      expect(service.getAccessToken()).toBe('access-jwt');
    });

    it('stays unauthenticated and marks ready when refresh fails', async () => {
      const ready = service.init();

      http
        .expectOne((r) => r.url.includes('/auth/refresh'))
        .flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
      await ready;

      expect(service.isReady()).toBe(true);
      expect(service.isAuthenticated()).toBe(false);
    });

    it('whenReady resolves after init completes', async () => {
      service.init();
      const readyPromise = service.whenReady();

      http.expectOne((r) => r.url.includes('/auth/refresh')).flush(mockAuthResponse);
      await readyPromise;

      expect(service.isAuthenticated()).toBe(true);
    });
  });

  describe('login', () => {
    it('sets currentUser signal and stores access token in memory', () => {
      expect(service.isAuthenticated()).toBe(false);

      service.login({ email: 'user@test.cat', password: 'pass' }).subscribe();

      const req = http.expectOne((r) => r.url.includes('/auth/login'));
      expect(req.request.body).toEqual({
        email: 'user@test.cat',
        password: 'pass',
        clientType: ClientType.DASHBOARD,
      });
      req.flush(mockAuthResponse);

      expect(service.isAuthenticated()).toBe(true);
      expect(service.currentUser()?.email).toBe('user@test.cat');
      expect(service.getAccessToken()).toBe('access-jwt');
    });
  });

  describe('logout', () => {
    it('clears currentUser signal on success', () => {
      (service as unknown as { _currentUser: { set: (v: unknown) => void } })._currentUser.set(
        mockProfile,
      );
      (service as unknown as { _accessToken: { set: (v: unknown) => void } })._accessToken.set(
        'token',
      );

      service.logout().subscribe();
      http.expectOne((r) => r.url.includes('/auth/logout')).flush({});

      expect(service.isAuthenticated()).toBe(false);
      expect(service.getAccessToken()).toBeNull();
    });
  });

  describe('refresh deduplication', () => {
    it('shares a single HTTP call for concurrent refresh requests', () => {
      let call1Done = false;
      let call2Done = false;

      service.refresh().subscribe({ complete: () => (call1Done = true) });
      service.refresh().subscribe({ complete: () => (call2Done = true) });

      http.expectOne((r) => r.url.includes('/auth/refresh')).flush(mockAuthResponse);

      expect(call1Done).toBe(true);
      expect(call2Done).toBe(true);
      expect(service.isAuthenticated()).toBe(true);
    });

    it('allows a new refresh after the previous one completes', () => {
      service.refresh().subscribe();
      http.expectOne((r) => r.url.includes('/auth/refresh')).flush(mockAuthResponse);

      service.refresh().subscribe();
      http.expectOne((r) => r.url.includes('/auth/refresh')).flush({
        ...mockAuthResponse,
        accessToken: 'new-access-jwt',
      });

      expect(service.getAccessToken()).toBe('new-access-jwt');
    });
  });

  describe('computed signals', () => {
    it('isAtLeastTechnical returns true for ADMIN', () => {
      const adminProfile: UserProfile = { ...mockProfile, role: UserRole.ADMIN };
      (service as unknown as { _currentUser: { set: (v: unknown) => void } })._currentUser.set(
        adminProfile,
      );
      expect(service.isAtLeastTechnical()).toBe(true);
    });

    it('isAtLeastTechnical returns false for MEMBER', () => {
      const memberProfile: UserProfile = { ...mockProfile, role: UserRole.MEMBER };
      (service as unknown as { _currentUser: { set: (v: unknown) => void } })._currentUser.set(
        memberProfile,
      );
      expect(service.isAtLeastTechnical()).toBe(false);
    });
  });
});
