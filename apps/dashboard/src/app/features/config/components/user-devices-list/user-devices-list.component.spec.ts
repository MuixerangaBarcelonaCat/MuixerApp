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

  it('loads the summary and shows alias, counts and the person', () => {
    const f = setup();
    const text = (f.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Anneta');
    expect(text).toContain('Anna Ferrer');
    expect(f.componentInstance.total()).toBe(1);
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
