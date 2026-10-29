import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { provideRouter } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { vi } from 'vitest';
import { AuthService } from './core/auth/services/auth.service';

function stubAppHost(body: string): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 200 })));
}

function stubServiceWorker(subscription: { unsubscribe: () => Promise<boolean> } | null): void {
  vi.stubGlobal('navigator', {
    ...navigator,
    serviceWorker: { ready: Promise.resolve({ pushManager: { getSubscription: async () => subscription } }) },
  });
}

describe('AppComponent', () => {
  afterEach(() => vi.unstubAllGlobals());

  beforeEach(async () => {
    stubAppHost('');
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: SwUpdate, useValue: { isEnabled: false } },
        {
          provide: AuthService,
          useValue: {
            isReady: () => true,
          },
        },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should not show splash screen when auth is ready', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-splash-screen')).toBeNull();
  });

  it('should show splash screen when auth is not ready', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: SwUpdate, useValue: { isEnabled: false } },
        {
          provide: AuthService,
          useValue: {
            isReady: () => false,
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-splash-screen')).toBeTruthy();
  });

  it('keeps the app when /app-host.txt is empty', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(fetch).toHaveBeenCalledWith('/app-host.txt', { cache: 'no-store' });
    expect(compiled.querySelector('app-host-moved')).toBeNull();
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });

  it('replaces the app with the host-moved screen when the public URL is another host', async () => {
    stubAppHost('https://app-beta.muixerangabarcelona.cat\n');
    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-host-moved a')?.getAttribute('href')).toBe(
      'https://app-beta.muixerangabarcelona.cat/',
    );
    expect(compiled.querySelector('router-outlet')).toBeNull();
  });

  it('unsubscribes this origin from push when the host moved', async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true);
    stubServiceWorker({ unsubscribe });
    stubAppHost('https://app-beta.muixerangabarcelona.cat');
    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    await vi.waitFor(() => expect(unsubscribe).toHaveBeenCalled());
  });

  it('keeps push when the host did not move', async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true);
    stubServiceWorker({ unsubscribe });
    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 0));
    expect(unsubscribe).not.toHaveBeenCalled();
  });

  it('survives a browser without service worker', async () => {
    vi.stubGlobal('navigator', { ...navigator, serviceWorker: undefined });
    stubAppHost('https://app-beta.muixerangabarcelona.cat');
    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('app-host-moved')).toBeTruthy();
  });

  function setVisibility(state: DocumentVisibilityState): void {
    Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }

  it('shows the host-moved screen when the app comes back to the foreground', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    stubAppHost('https://app-beta.muixerangabarcelona.cat');
    setVisibility('visible');
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('app-host-moved')).toBeTruthy();
    });
  });

  it('does not refetch once the screen is shown', async () => {
    stubAppHost('https://app-beta.muixerangabarcelona.cat');
    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    await vi.waitFor(() => expect(fixture.componentInstance['movedTo']()).not.toBeNull());
    setVisibility('visible');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('ignores the app going to the background', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    setVisibility('hidden');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
