import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { EventService } from './event.service';
import { EventType } from '@muixer/shared';

describe('EventService', () => {
  let service: EventService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [EventService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(EventService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getAll requests /events with correct params', () => {
    service
      .getAll({ eventType: EventType.ASSAIG, page: 1, limit: 25, sortOrder: 'DESC' })
      .subscribe();

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${environment.apiUrl}/events` &&
        r.params.get('eventType') === 'ASSAIG' &&
        r.params.get('sortOrder') === 'DESC',
    );
    expect(req.request.method).toBe('GET');
    req.flush({ data: [], meta: { total: 0, page: 1, limit: 25 } });
  });

  it('getAll omits undefined filters', () => {
    service.getAll({ eventType: EventType.ACTUACIO }).subscribe();
    const req = httpMock.expectOne((r) => r.url === `${environment.apiUrl}/events`);
    expect(req.request.params.has('search')).toBe(false);
    req.flush({ data: [], meta: { total: 0, page: 1, limit: 25 } });
  });

  it('getOne requests /events/:id', () => {
    const id = 'event-uuid-123';
    service.getOne(id).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/events/${id}`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('update sends PATCH to /events/:id', () => {
    const id = 'event-uuid-123';
    service.update(id, { countsForStatistics: false }).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/events/${id}`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ countsForStatistics: false });
    req.flush({});
  });
});
