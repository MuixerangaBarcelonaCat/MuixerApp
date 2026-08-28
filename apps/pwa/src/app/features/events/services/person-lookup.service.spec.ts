import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { PersonLookupService } from './person-lookup.service';
import { environment } from '../../../../environments/environment';

describe('PersonLookupService', () => {
  let service: PersonLookupService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), PersonLookupService],
    });
    service = TestBed.inject(PersonLookupService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('searches active persons by term with a small result limit', () => {
    service.search('ann').subscribe((results) => {
      expect(results).toEqual([
        { id: 'person-1', alias: 'Anna', name: 'Anna', firstSurname: 'Puig' },
      ]);
    });

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${environment.apiUrl}/persons` &&
        r.params.get('search') === 'ann' &&
        r.params.get('limit') === '10' &&
        r.params.get('isActive') === 'true',
    );
    expect(req.request.method).toBe('GET');
    req.flush({
      data: [{ id: 'person-1', alias: 'Anna', name: 'Anna', firstSurname: 'Puig' }],
      meta: { total: 1, page: 1, limit: 10 },
    });
  });
});
