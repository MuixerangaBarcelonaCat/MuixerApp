import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { DelegateType } from '@muixer/shared';
import { environment } from '../../../../environments/environment';
import { ProfileService } from './profile.service';

describe('ProfileService', () => {
  let service: ProfileService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ProfileService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('listSwitchablePersons() GETs /me/persons with primaryOnly=true', () => {
    let result: unknown;
    service.listSwitchablePersons().subscribe((res) => (result = res));

    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiUrl}/me/persons` && r.params.get('primaryOnly') === 'true',
    );
    expect(req.request.method).toBe('GET');
    req.flush([{ personId: 'p1', displayName: 'MartaP', isSelf: true, delegateType: null }]);

    expect(result).toEqual([{ personId: 'p1', displayName: 'MartaP', isSelf: true, delegateType: null }]);
  });

  it('getPersonSummary() GETs /me/persons/:id', () => {
    let result: unknown;
    service.getPersonSummary('p1').subscribe((res) => (result = res));

    const req = httpMock.expectOne(`${environment.apiUrl}/me/persons/p1`);
    expect(req.request.method).toBe('GET');
    const summary = { personId: 'p1', alias: 'MartaP', name: 'Marta', firstSurname: 'Puig', delegationCount: 1 };
    req.flush(summary);

    expect(result).toEqual(summary);
  });

  it('listDelegates() GETs /me/persons/:id/delegates', () => {
    let result: unknown;
    service.listDelegates('p1').subscribe((res) => (result = res));

    const req = httpMock.expectOne(`${environment.apiUrl}/me/persons/p1/delegates`);
    expect(req.request.method).toBe('GET');
    req.flush([]);

    expect(result).toEqual([]);
  });

  it('addDelegate() POSTs the alias and delegateType to /me/persons/:id/delegates', () => {
    let result: unknown;
    const payload = { alias: 'JoanP', delegateType: DelegateType.PARTNER };
    service.addDelegate('p1', payload).subscribe((res) => (result = res));

    const req = httpMock.expectOne(`${environment.apiUrl}/me/persons/p1/delegates`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    const created = { id: 'del-1', delegateType: DelegateType.PARTNER, isActive: true, isPrimary: false };
    req.flush(created);

    expect(result).toEqual(created);
  });

  it('removeDelegate() DELETEs /me/persons/:id/delegates/:delegateId', () => {
    let completed = false;
    service.removeDelegate('p1', 'del-1').subscribe(() => (completed = true));

    const req = httpMock.expectOne(`${environment.apiUrl}/me/persons/p1/delegates/del-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    expect(completed).toBe(true);
  });

  it('changePassword() POSTs to /auth/change-password with credentials', () => {
    let completed = false;
    const payload = { currentPassword: 'old', newPassword: 'newpass123' };
    service.changePassword(payload).subscribe(() => (completed = true));

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/change-password`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    expect(req.request.withCredentials).toBe(true);
    req.flush(null);

    expect(completed).toBe(true);
  });

  it('changeEmail() POSTs to /auth/change-email with credentials and returns the updated profile', () => {
    let result: unknown;
    const payload = { newEmail: 'new@test.cat', currentPassword: 'old' };
    service.changeEmail(payload).subscribe((res) => (result = res));

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/change-email`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    expect(req.request.withCredentials).toBe(true);
    const profile = { id: 'user-1', email: 'new@test.cat' };
    req.flush(profile);

    expect(result).toEqual(profile);
  });
});
