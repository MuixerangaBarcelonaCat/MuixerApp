import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { Gender } from '@muixer/shared';
import { environment } from '../../../environments/environment';
import { DependentsService } from './dependents.service';

describe('DependentsService', () => {
  let service: DependentsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DependentsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getPending() GETs /me/pending-dependents', () => {
    let result: unknown;
    service.getPending().subscribe((res) => (result = res));

    const req = httpMock.expectOne(`${environment.apiUrl}/me/pending-dependents`);
    expect(req.request.method).toBe('GET');
    req.flush([{ personId: 'p1', alias: 'xicalla' }]);

    expect(result).toEqual([{ personId: 'p1', alias: 'xicalla' }]);
  });

  it('completePending() POSTs the payload to /me/pending-dependents', () => {
    let completed = false;
    const payload = {
      personId: 'p1',
      name: 'Joan',
      firstSurname: 'Garcia',
      gender: Gender.MALE,
      phone: '+34612345678',
      birthDate: '2015-01-15',
    };

    service.completePending(payload).subscribe(() => (completed = true));

    const req = httpMock.expectOne(`${environment.apiUrl}/me/pending-dependents`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(null);

    expect(completed).toBe(true);
  });
});
