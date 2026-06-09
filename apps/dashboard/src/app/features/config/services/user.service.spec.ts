import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { UserService } from './user.service';
import { UserRole } from '@muixer/shared';

describe('UserService', () => {
  let service: UserService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [UserService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(UserService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getAll requests /users with query params', () => {
    service
      .getAll({
        search: 'jo',
        page: 1,
        limit: 25,
        sortBy: 'email',
        sortOrder: 'ASC',
      })
      .subscribe((res) => {
        expect(res.total).toBe(0);
      });

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${environment.apiUrl}/users` &&
        r.params.get('search') === 'jo' &&
        r.params.get('sortBy') === 'email' &&
        r.params.get('sortOrder') === 'ASC',
    );
    expect(req.request.method).toBe('GET');
    req.flush({ data: [], total: 0 });
  });

  it('getAll sends role filter as query param', () => {
    service.getAll({ role: [UserRole.ADMIN] }).subscribe();

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${environment.apiUrl}/users` &&
        r.params.get('role') === UserRole.ADMIN,
    );
    expect(req.request.method).toBe('GET');
    req.flush({ data: [], total: 0 });
  });

  it('getAll sends isActive filter', () => {
    service.getAll({ isActive: true }).subscribe();

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${environment.apiUrl}/users` &&
        r.params.get('isActive') === 'true',
    );
    expect(req.request.method).toBe('GET');
    req.flush({ data: [], total: 0 });
  });

  it('grantRole sends PATCH to /users/grant-role with userId in body', () => {
    service.grantRole('user-uuid', UserRole.ADMIN).subscribe();

    const req = httpMock.expectOne(
      `${environment.apiUrl}/users/grant-role`,
    );
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ userId: 'user-uuid', role: UserRole.ADMIN });
    req.flush({ id: 'user-uuid', role: UserRole.ADMIN });
  });
});
