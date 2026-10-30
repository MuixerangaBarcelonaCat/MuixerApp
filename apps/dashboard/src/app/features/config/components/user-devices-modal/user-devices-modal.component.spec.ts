import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { ClientType } from '@muixer/shared';
import { ToastService } from '@muixer/ui';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { environment } from '../../../../../environments/environment';
import { UserDevicesModalComponent, describeUserAgent } from './user-devices-modal.component';

const base = `${environment.apiUrl}/users/u1`;
const session = { family: 'f1', clientType: ClientType.PWA, userAgent: null, startedAt: '2026-01-01T10:00:00Z', lastRefreshAt: '2026-01-02T10:00:00Z', expiresAt: '2026-01-08T10:00:00Z' };
const device = { id: 's1', userAgent: null, createdAt: '2026-01-01T10:00:00Z', lastUsedAt: null };

describe('UserDevicesModalComponent', () => {
  let http: HttpTestingController;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };

  const setup = (sessions: unknown[] = [session], devices: unknown[] = [device]) => {
    toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
    TestBed.configureTestingModule({
      imports: [UserDevicesModalComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: toast }, allLucideIconsProvider],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(UserDevicesModalComponent);
    fixture.componentRef.setInput('userId', 'u1');
    fixture.detectChanges();
    http.expectOne(`${base}/sessions`).flush(sessions);
    http.expectOne(`${base}/push-subscriptions`).flush(devices);
    fixture.detectChanges();
    return fixture;
  };

  afterEach(() => http.verify());

  it('loads sessions and devices on open', () => {
    const f = setup();
    expect(f.componentInstance.sessions()).toHaveLength(1);
    expect(f.componentInstance.devices()).toHaveLength(1);
  });

  it('shows two empty states and no error for a user with nothing', () => {
    const f = setup([], []);
    const text = (f.nativeElement as HTMLElement).textContent;
    expect(text).toContain('Cap sessió oberta.');
    expect(text).toContain('Cap dispositiu rep notificacions.');
    expect(f.componentInstance.error()).toBe(false);
  });

  it('"Fes expirar" revokes the family and removes the row', () => {
    const f = setup();
    f.componentInstance.revokeSession(session);
    http.expectOne({ method: 'DELETE', url: `${base}/sessions/f1` }).flush(null);
    expect(f.componentInstance.sessions()).toHaveLength(0);
  });

  it('"Fes expirar totes" clears every session', () => {
    const f = setup();
    f.componentInstance.revokeAll();
    http.expectOne({ method: 'DELETE', url: `${base}/sessions` }).flush(null);
    expect(f.componentInstance.sessions()).toHaveLength(0);
  });

  it('a test answered with gone removes the row', () => {
    const f = setup();
    f.componentInstance.testDevice(device);
    http.expectOne({ method: 'POST', url: `${base}/push-subscriptions/s1/test` }).flush({ success: false, gone: true });
    expect(f.componentInstance.devices()).toHaveLength(0);
    expect(toast.info).toHaveBeenCalledWith('El dispositiu ja no existeix i s\'ha eliminat.');
  });

  it('a successful test keeps the row and says so', () => {
    const f = setup();
    f.componentInstance.testDevice(device);
    http.expectOne({ method: 'POST', url: `${base}/push-subscriptions/s1/test` }).flush({ success: true, gone: false });
    expect(f.componentInstance.devices()).toHaveLength(1);
    expect(toast.success).toHaveBeenCalledWith('S\'ha enviat la notificació de prova.');
  });

  it('removes a subscription', () => {
    const f = setup();
    f.componentInstance.removeDevice(device);
    http.expectOne({ method: 'DELETE', url: `${base}/push-subscriptions/s1` }).flush(null);
    expect(f.componentInstance.devices()).toHaveLength(0);
  });

  describe('describeUserAgent', () => {
    it('summarises Chrome on Android', () => {
      const ua = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';
      expect(describeUserAgent(ua)).toBe('Chrome · Android');
    });
    it('tells Safari on iPhone from macOS', () => {
      const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
      expect(describeUserAgent(ua)).toBe('Safari · iOS');
    });
    it('falls back for null or unknown', () => {
      expect(describeUserAgent(null)).toBe('Dispositiu desconegut');
      expect(describeUserAgent('curl/8')).toBe('Dispositiu desconegut');
    });
  });
});
