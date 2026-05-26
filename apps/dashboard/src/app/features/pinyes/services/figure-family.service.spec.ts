import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { FigureFamilyService } from './figure-family.service';

const BASE = environment.apiUrl;
const FAMILY_ID = 'family-uuid-1';

describe('FigureFamilyService', () => {
  let service: FigureFamilyService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [FigureFamilyService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(FigureFamilyService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getAll sends GET to /figure-families', () => {
    service.getAll().subscribe();
    const req = httpMock.expectOne(`${BASE}/figure-families`);
    expect(req.request.method).toBe('GET');
    req.flush({ data: [], meta: { total: 0, page: 1, limit: 25 } });
  });

  it('getAll passes search param', () => {
    service.getAll({ search: 'pilar' }).subscribe();
    const req = httpMock.expectOne((r) => r.url === `${BASE}/figure-families`);
    expect(req.request.params.get('search')).toBe('pilar');
    req.flush({ data: [], meta: { total: 0, page: 1, limit: 25 } });
  });

  it('getOne sends GET to /figure-families/:id', () => {
    service.getOne(FAMILY_ID).subscribe();
    const req = httpMock.expectOne(`${BASE}/figure-families/${FAMILY_ID}`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('create sends POST to /figure-families with payload', () => {
    const payload = { name: 'Pilar de 4', slug: 'pilar-de-4' };
    service.create(payload).subscribe();
    const req = httpMock.expectOne(`${BASE}/figure-families`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({});
  });

  it('update sends PUT to /figure-families/:id with payload', () => {
    const payload = { name: 'Pilar de 4 Updated' };
    service.update(FAMILY_ID, payload).subscribe();
    const req = httpMock.expectOne(`${BASE}/figure-families/${FAMILY_ID}`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(payload);
    req.flush({});
  });

  it('remove sends DELETE to /figure-families/:id', () => {
    service.remove(FAMILY_ID).subscribe();
    const req = httpMock.expectOne(`${BASE}/figure-families/${FAMILY_ID}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
