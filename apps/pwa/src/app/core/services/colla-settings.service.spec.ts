import { TestBed } from '@angular/core/testing';
import { ApplicationRef, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CollaSettings, DEFAULT_COLLA_SETTINGS } from '@muixer/shared';
import { AuthService } from '../auth/services/auth.service';
import { COLLA_NAME_STORAGE_KEY, CollaSettingsService } from './colla-settings.service';

describe('CollaSettingsService', () => {
  let http: HttpTestingController;
  const isAuthenticated = signal(false);
  const stored: CollaSettings = { ...DEFAULT_COLLA_SETTINGS, shoulderHeightBaselineCm: 150 };

  const isSettings = (r: { url: string }) => r.url.endsWith('/colla-settings');
  const isPublic = (r: { url: string }) => r.url.endsWith('/colla-settings/public');
  // The resources apply a response a microtask after it arrives.
  const settle = () => TestBed.inject(ApplicationRef).whenStable();

  const create = () => {
    const service = TestBed.inject(CollaSettingsService);
    TestBed.tick();
    return service;
  };

  beforeEach(() => {
    localStorage.clear();
    isAuthenticated.set(false);
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: AuthService, useValue: { isAuthenticated } }],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.match(isPublic).forEach((r) => r.flush({ collaName: 'x' }));
    http.verify();
    localStorage.clear();
  });

  describe('settings', () => {
    // The public name is asked for at once; answering it lets the app settle.
    const createAndAnswerName = () => {
      const service = create();
      http.expectOne(isPublic).flush({ collaName: 'Muixeranga de Prova' });
      return service;
    };

    it('serves the defaults, without asking, while nobody is signed in', () => {
      const service = create();

      http.expectNone(isSettings);
      expect(service.settings()).toEqual(DEFAULT_COLLA_SETTINGS);
    });

    it('loads the stored settings once signed in, for figure rendering too', async () => {
      const service = createAndAnswerName();
      isAuthenticated.set(true);
      TestBed.tick();
      http.expectOne(isSettings).flush(stored);
      await settle();

      expect(service.settings()).toEqual(stored);
      expect(service.renderSettings().shoulderHeightBaselineCm).toBe(150);
    });

    it('keeps the defaults when the settings cannot be read', async () => {
      const service = createAndAnswerName();
      isAuthenticated.set(true);
      TestBed.tick();
      http.expectOne(isSettings).flush('error', { status: 500, statusText: 'Server Error' });
      await settle();

      expect(service.settings()).toEqual(DEFAULT_COLLA_SETTINGS);
    });
  });

  describe('collaName', () => {
    it('is unknown until the public name arrives, and is then remembered', async () => {
      const service = create();
      expect(service.collaName()).toBeNull();

      http.expectOne(isPublic).flush({ collaName: 'Muixeranga de Prova' });
      await settle();

      expect(service.collaName()).toBe('Muixeranga de Prova');
      expect(localStorage.getItem(COLLA_NAME_STORAGE_KEY)).toBe('Muixeranga de Prova');
    });

    it('starts from the remembered name, and keeps it when the public name cannot be read (offline)', async () => {
      localStorage.setItem(COLLA_NAME_STORAGE_KEY, 'Muixeranga Recordada');
      const service = create();
      expect(service.collaName()).toBe('Muixeranga Recordada');

      http.expectOne(isPublic).flush('error', { status: 0, statusText: 'Offline' });
      await settle();

      expect(service.collaName()).toBe('Muixeranga Recordada');
    });
  });
});
