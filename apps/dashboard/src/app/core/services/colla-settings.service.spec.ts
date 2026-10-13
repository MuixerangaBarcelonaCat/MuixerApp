import { TestBed } from '@angular/core/testing';
import { ApplicationRef, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CollaSettings, DEFAULT_COLLA_SETTINGS } from '@muixer/shared';
import { AuthService } from '../auth/services/auth.service';
import { CollaSettingsService } from './colla-settings.service';

describe('CollaSettingsService', () => {
  let service: CollaSettingsService;
  let http: HttpTestingController;
  const isAuthenticated = signal(false);
  const stored: CollaSettings = { ...DEFAULT_COLLA_SETTINGS, collaName: 'Muixeranga de Prova', shoulderHeightBaselineCm: 150 };

  const settingsRequest = () => http.expectOne((r) => r.url.endsWith('/colla-settings') && r.method === 'GET');
  // The resource applies the response a microtask after it arrives.
  const respond = async (body: string | object, opts?: { status: number; statusText: string }) => {
    settingsRequest().flush(body, opts);
    await TestBed.inject(ApplicationRef).whenStable();
  };

  beforeEach(() => {
    isAuthenticated.set(false);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { isAuthenticated } },
      ],
    });
    service = TestBed.inject(CollaSettingsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('serves the defaults, without asking, while nobody is signed in', () => {
    TestBed.tick();

    http.expectNone((r) => r.url.endsWith('/colla-settings'));
    expect(service.settings()).toEqual(DEFAULT_COLLA_SETTINGS);
  });

  it('loads the stored settings once signed in', async () => {
    isAuthenticated.set(true);
    TestBed.tick();
    await respond(stored);

    expect(service.settings()).toEqual(stored);
  });

  it('keeps the defaults when the settings cannot be read', async () => {
    isAuthenticated.set(true);
    TestBed.tick();
    await respond('error', { status: 500, statusText: 'Server Error' });

    expect(service.settings()).toEqual(DEFAULT_COLLA_SETTINGS);
  });

  it('says when the stored settings have arrived', async () => {
    isAuthenticated.set(true);
    TestBed.tick();
    expect(service.loaded()).toBe(false);

    await respond(stored);

    expect(service.loaded()).toBe(true);
    expect(service.loadFailed()).toBe(false);
  });

  it('says when the settings could not be read', async () => {
    isAuthenticated.set(true);
    TestBed.tick();
    await respond('error', { status: 500, statusText: 'Server Error' });

    expect(service.loaded()).toBe(false);
    expect(service.loadFailed()).toBe(true);
  });

  it('exposes what figure rendering reads', async () => {
    isAuthenticated.set(true);
    TestBed.tick();
    await respond(stored);

    expect(service.renderSettings()).toEqual({
      shoulderHeightBaselineCm: 150,
      troncHeightThresholds: DEFAULT_COLLA_SETTINGS.troncHeightThresholds,
    });
  });

  it('saves a change and serves the saved settings', async () => {
    isAuthenticated.set(true);
    TestBed.tick();
    await respond(stored);
    const saved = { ...stored, majorityAge: 18 };

    let result: CollaSettings | undefined;
    service.update({ majorityAge: 18 }).subscribe((s) => (result = s));
    const req = http.expectOne((r) => r.url.endsWith('/colla-settings') && r.method === 'PATCH');
    expect(req.request.body).toEqual({ majorityAge: 18 });
    req.flush(saved);

    expect(result).toEqual(saved);
    expect(service.settings()).toEqual(saved);
  });
});
