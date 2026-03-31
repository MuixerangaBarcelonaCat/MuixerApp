import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { PersonService } from './person.service';

describe('PersonService', () => {
  let service: PersonService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PersonService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PersonService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getAll requests /persons with query params', () => {
    service
      .getAll({ search: 'jo', page: 1, limit: 50, sortBy: 'alias', sortOrder: 'ASC' })
      .subscribe((res) => {
        expect(res.meta.total).toBe(0);
      });

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${environment.apiUrl}/persons` &&
        r.params.get('search') === 'jo' &&
        r.params.get('sortBy') === 'alias' &&
        r.params.get('sortOrder') === 'ASC',
    );
    expect(req.request.method).toBe('GET');
    req.flush({ data: [], meta: { total: 0, page: 1, limit: 50 } });
  });

  it('getPositions requests /positions', () => {
    service.getPositions().subscribe((p) => expect(p).toEqual([]));
    const req = httpMock.expectOne(`${environment.apiUrl}/positions`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
