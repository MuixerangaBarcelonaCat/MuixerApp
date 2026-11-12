import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { UserDevicesSummary, UserRole } from '@muixer/shared';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { environment } from '../../../../../environments/environment';
import { UserDevicesListComponent, inviteLabel } from './user-devices-list.component';

const url = `${environment.apiUrl}/users/devices-summary`;

const row = (over: Partial<UserDevicesSummary> = {}): UserDevicesSummary => ({
  userId: 'u1',
  email: 'anna@test.cat',
  role: UserRole.MEMBER,
  isActive: true,
  person: { id: 'p1', alias: 'Anneta', name: 'Anna', firstSurname: 'Ferrer' },
  activeSessions: 2,
  activeDevices: 1,
  lastAccessAt: '2026-10-30T10:00:00.000Z',
  lastPushAt: null,
  pwaInstalledAt: null,
  invite: null,
  ...over,
});

describe('UserDevicesListComponent', () => {
  let http: HttpTestingController;

  const setup = (rows: UserDevicesSummary[] = [row()]) => {
    TestBed.configureTestingModule({
      imports: [UserDevicesListComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), allLucideIconsProvider],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(UserDevicesListComponent);
    fixture.detectChanges();
    http
      .expectOne((r) => r.url === url && r.params.get('page') === '1')
      .flush({ data: rows, meta: { total: rows.length, page: 1, limit: 25 } });
    fixture.detectChanges();
    return fixture;
  };

  afterEach(() => http.verify());

  it('cancels the previous request so a slow, older answer cannot overwrite a newer one', () => {
    const f = setup();
    f.componentInstance.goToPage(2);
    const older = http.expectOne((r) => r.url === url && r.params.get('page') === '2');
    f.componentInstance.goToPage(3);
    expect(older.cancelled).toBe(true);
    http.expectOne((r) => r.url === url && r.params.get('page') === '3').flush({ data: [], meta: { total: 0, page: 3, limit: 25 } });
  });

  it('drops a pending search when the page is left before the debounce fires', () => {
    vi.useFakeTimers();
    try {
      const f = setup();
      f.componentInstance.onSearchChange('anna');
      f.destroy();
      vi.advanceTimersByTime(1000);
      http.expectNone((r) => r.url === url);
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows timestamps in the same dd/MM/yyyy HH:mm format as the modal', () => {
    const text = (setup().nativeElement as HTMLElement).textContent ?? '';
    expect(text).toMatch(/30\/10\/2026 \d{2}:00/);
  });

  it('loads the summary and shows alias, counts and the person', () => {
    const f = setup();
    const text = (f.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Anneta');
    expect(text).toContain('Anna Ferrer');
    expect(f.componentInstance.total()).toBe(1);
  });

  it('says per account whether push notifications are on (any active device) or off', () => {
    const f = setup([row({ userId: 'on', activeDevices: 2 }), row({ userId: 'off', activeDevices: 0 })]);
    const push = f.componentInstance.columns.find((c) => c.key === 'push')!;
    expect(push.value!(row({ activeDevices: 2 }))).toBe('Activades');
    expect(push.value!(row({ activeDevices: 0 }))).toBe('Desactivades');
    expect(push.badgeClass!(row({ activeDevices: 2 }))).toBe('badge-success');
    expect(push.badgeClass!(row({ activeDevices: 0 }))).toBe('badge-ghost');
    const text = (f.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Activades');
    expect(text).toContain('Desactivades');
  });

  it('says per account whether the app was seen installed, and flags stale installs', () => {
    const f = setup();
    const pwa = f.componentInstance.columns.find((c) => c.key === 'pwa')!;
    const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

    expect(pwa.value!(row({ pwaInstalledAt: null }))).toBe('No');
    expect(pwa.badgeClass!(row({ pwaInstalledAt: null }))).toBe('badge-ghost');

    expect(pwa.value!(row({ pwaInstalledAt: new Date().toISOString() }))).toBe('Sí');
    expect(pwa.badgeClass!(row({ pwaInstalledAt: new Date().toISOString() }))).toBe('badge-success');

    expect(pwa.value!(row({ pwaInstalledAt: daysAgo(60) }))).toMatch(/^Fa temps/);
    expect(pwa.badgeClass!(row({ pwaInstalledAt: daysAgo(60) }))).toBe('badge-warning');
  });

  it('opens the devices modal on row click and reloads the list when it closes', () => {
    const f = setup();
    f.componentInstance.selected.set(row());
    f.detectChanges();
    // The modal loads its own data.
    http.expectOne(`${environment.apiUrl}/users/u1/sessions`).flush([]);
    http.expectOne(`${environment.apiUrl}/users/u1/push-subscriptions`).flush([]);

    f.componentInstance.closeModal();
    expect(f.componentInstance.selected()).toBeNull();
    http.expectOne((r) => r.url === url).flush({ data: [], meta: { total: 0, page: 1, limit: 25 } });
  });

  it('sends the sort to the API', () => {
    const f = setup();
    f.componentInstance.onSortChange({ field: 'activeDevices', order: 'DESC' });
    const req = http.expectOne((r) => r.url === url);
    expect(req.request.params.get('sortBy')).toBe('activeDevices');
    expect(req.request.params.get('sortOrder')).toBe('DESC');
    req.flush({ data: [], meta: { total: 0, page: 1, limit: 25 } });
  });
});

describe('inviteLabel', () => {
  it('describes a pending, an expired and a missing invite', () => {
    expect(inviteLabel({ status: 'PENDING', expiresAt: '2026-11-05T10:00:00.000Z' })).toBe('Pendent fins al 05/11');
    expect(inviteLabel({ status: 'EXPIRED', expiresAt: '2026-10-01T10:00:00.000Z' })).toBe('Caducada');
    expect(inviteLabel(null)).toBe('');
  });
});
