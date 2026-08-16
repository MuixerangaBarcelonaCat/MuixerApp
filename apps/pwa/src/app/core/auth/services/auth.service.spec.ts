import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthResponse, ClientType, Gender, InviteRegistrationContext, UserProfile, UserRole } from '@muixer/shared';
import { AuthService } from './auth.service';

const mockUser: UserProfile = {
  id: 'u1',
  email: 'test@test.cat',
  role: UserRole.MEMBER,
  isActive: true,
  privacyPolicyAcceptedAt: '2026-08-01T00:00:00.000Z',
  requiresPrivacyConsent: false,
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
    localStorage.clear();
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
    localStorage.clear();
  });

  // A prior session on this device is what triggers the bootstrap refresh.
  const seedSessionHint = () => localStorage.setItem('muixer_has_session', '1');

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
    seedSessionHint();
    const initPromise = service.init();

    httpTesting.expectOne('/api/auth/refresh').flush(mockAuthResponse);

    await initPromise;

    expect(service.isReady()).toBe(true);
    expect(service.isAuthenticated()).toBe(true);
  });

  it('init() skips refresh (no console 403) when there is no prior session', async () => {
    const initPromise = service.init();
    await initPromise;

    httpTesting.expectNone('/api/auth/refresh');
    expect(service.isReady()).toBe(true);
    expect(service.isAuthenticated()).toBe(false);
  });

  it('silentRefresh failure marks ready', async () => {
    seedSessionHint();
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

  it('requiresPrivacyConsent() reflects the current user profile', () => {
    service.login({ email: 'a@b.cat', password: 'pass' }).subscribe();
    httpTesting
      .expectOne('/api/auth/login')
      .flush({ accessToken: 'tok', user: { ...mockUser, requiresPrivacyConsent: true } });

    expect(service.requiresPrivacyConsent()).toBe(true);
  });

  it('acceptPrivacyConsent() POSTs to /consent/privacy-policy and refreshes the current user', () => {
    service.login({ email: 'a@b.cat', password: 'pass' }).subscribe();
    httpTesting
      .expectOne('/api/auth/login')
      .flush({ accessToken: 'tok', user: { ...mockUser, requiresPrivacyConsent: true } });

    expect(service.requiresPrivacyConsent()).toBe(true);

    service.acceptPrivacyConsent().subscribe();
    const req = httpTesting.expectOne('/api/consent/privacy-policy');
    expect(req.request.method).toBe('POST');
    req.flush({ ...mockUser, requiresPrivacyConsent: false });

    expect(service.requiresPrivacyConsent()).toBe(false);
  });

  it('setCurrentUser() updates the cached current user without an HTTP call', () => {
    service.login({ email: 'a@b.cat', password: 'pass' }).subscribe();
    httpTesting.expectOne('/api/auth/login').flush(mockAuthResponse);

    service.setCurrentUser({ ...mockUser, email: 'updated@test.cat' });

    expect(service.currentUser()?.email).toBe('updated@test.cat');
  });

  it('requestPasswordReset() POSTs the email to /auth/forgot-password', () => {
    let completed = false;
    service.requestPasswordReset('a@b.cat').subscribe(() => (completed = true));

    const req = httpTesting.expectOne('/api/auth/forgot-password');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'a@b.cat' });
    req.flush({ message: 'ok' });

    expect(completed).toBe(true);
  });

  it('getInviteContext() GETs /auth/invite/:token and does not touch auth state', () => {
    const context: InviteRegistrationContext = {
      person: { name: 'Joan', firstSurname: 'Garcia', secondSurname: null, gender: null, phone: null, birthDate: null },
      expiresAt: '2026-01-01T00:00:00Z',
      legalDocument: { content: 'Text legal', version: 1 },
    };
    let result: InviteRegistrationContext | undefined;
    service.getInviteContext('raw-token').subscribe((res) => (result = res));

    const req = httpTesting.expectOne('/api/auth/invite/raw-token');
    expect(req.request.method).toBe('GET');
    req.flush(context);

    expect(result).toEqual(context);
    expect(service.isAuthenticated()).toBe(false);
  });

  it('registerViaInvite() POSTs to /auth/invite/register and logs the user in', () => {
    service
      .registerViaInvite({
        token: 'raw-token',
        email: 'new@test.cat',
        password: 'newpass123',
        name: 'Joan',
        firstSurname: 'Garcia',
        gender: Gender.MALE,
        phone: '+34612345678',
        birthDate: '2000-01-15',
        legalAccepted: true,
      })
      .subscribe();

    const req = httpTesting.expectOne('/api/auth/invite/register');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.token).toBe('raw-token');
    req.flush(mockAuthResponse);

    expect(service.isAuthenticated()).toBe(true);
    expect(service.getAccessToken()).toBe('jwt-token');
  });
});
