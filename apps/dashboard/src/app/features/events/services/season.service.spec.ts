import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { SeasonService } from './season.service';

describe('SeasonService', () => {
  let service: SeasonService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SeasonService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SeasonService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('update sends no allowUncovered param by default', () => {
    service.update('s1', { name: 'X' }).subscribe();
    const req = httpMock.expectOne((r) => r.url === `${environment.apiUrl}/seasons/s1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.params.has('allowUncovered')).toBe(false);
    req.flush({});
  });

  it('update sends allowUncovered=true once the user has confirmed', () => {
    service.update('s1', { startDate: '2026-09-10' }, { allowUncovered: true }).subscribe();
    const req = httpMock.expectOne((r) => r.url === `${environment.apiUrl}/seasons/s1`);
    expect(req.request.params.get('allowUncovered')).toBe('true');
    expect(req.request.body).toEqual({ startDate: '2026-09-10' });
    req.flush({});
  });

  it('remove sends allowUncovered=true when asked', () => {
    service.remove('s1', { allowUncovered: true }).subscribe();
    const req = httpMock.expectOne((r) => r.url === `${environment.apiUrl}/seasons/s1`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.params.get('allowUncovered')).toBe('true');
    req.flush(null);
  });

  it('remove sends no param by default', () => {
    service.remove('s1').subscribe();
    const req = httpMock.expectOne((r) => r.url === `${environment.apiUrl}/seasons/s1`);
    expect(req.request.params.has('allowUncovered')).toBe(false);
    req.flush(null);
  });

  it('getUncoveredEventCount requests /seasons/uncovered-events', () => {
    let count: number | undefined;
    service.getUncoveredEventCount().subscribe((r) => (count = r.count));
    httpMock.expectOne(`${environment.apiUrl}/seasons/uncovered-events`).flush({ count: 4 });
    expect(count).toBe(4);
  });
});
