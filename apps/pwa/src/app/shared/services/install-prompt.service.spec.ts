import { TestBed } from '@angular/core/testing';
import { InstallPromptService } from './install-prompt.service';

describe('InstallPromptService', () => {
  let originalUserAgent: string;

  beforeEach(() => {
    localStorage.clear();
    originalUserAgent = navigator.userAgent;
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    });
  });

  function setUserAgent(ua: string): void {
    Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
  }

  function create(): InstallPromptService {
    TestBed.resetTestingModule();
    return TestBed.inject(InstallPromptService);
  }

  it('does not show before any login on Android', () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 13) Chrome');
    const service = create();
    expect(service.shouldShow()).toBe(false);
  });

  it('shows after first login once beforeinstallprompt fired (Android)', () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 13) Chrome');
    const service = create();
    window.dispatchEvent(Object.assign(new Event('beforeinstallprompt'), { prompt: () => Promise.resolve() }));
    service.registerLogin();
    expect(service.shouldShow()).toBe(true);
  });

  it('shows after first login on iOS without beforeinstallprompt', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    const service = create();
    service.registerLogin();
    expect(service.shouldShow()).toBe(true);
    expect(service.isIos).toBe(true);
  });

  it('hides after dismiss and stays hidden until 10 more logins', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    const service = create();
    service.registerLogin();
    service.dismiss();
    expect(service.shouldShow()).toBe(false);

    for (let i = 0; i < 9; i++) service.registerLogin();
    expect(service.shouldShow()).toBe(false);

    service.registerLogin();
    expect(service.shouldShow()).toBe(true);
  });

  it('never shows once already installed', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    localStorage.setItem('muixer_install_done', '1');
    const service = create();
    service.registerLogin();
    expect(service.shouldShow()).toBe(false);
  });
});
