import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { EventSegmentService } from './event-segment.service';

const BASE = environment.apiUrl;
const EVENT_ID = 'event-uuid-1';
const SEGMENT_ID = 'segment-uuid-1';

describe('EventSegmentService', () => {
  let service: EventSegmentService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [EventSegmentService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(EventSegmentService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getByEvent sends GET to /events/:eventId/segments', () => {
    service.getByEvent(EVENT_ID).subscribe();
    const req = httpMock.expectOne(`${BASE}/events/${EVENT_ID}/segments`);
    expect(req.request.method).toBe('GET');
    req.flush({ data: [] });
  });

  it('create sends POST to /events/:eventId/segments with payload', () => {
    const payload = { name: 'Bloc 1' };
    service.create(EVENT_ID, payload).subscribe();
    const req = httpMock.expectOne(`${BASE}/events/${EVENT_ID}/segments`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({});
  });

  it('update sends PUT to /events/:eventId/segments/:segmentId with payload', () => {
    const payload = { isVisible: true };
    service.update(EVENT_ID, SEGMENT_ID, payload).subscribe();
    const req = httpMock.expectOne(`${BASE}/events/${EVENT_ID}/segments/${SEGMENT_ID}`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(payload);
    req.flush({});
  });

  it('remove sends DELETE to /events/:eventId/segments/:segmentId', () => {
    service.remove(EVENT_ID, SEGMENT_ID).subscribe();
    const req = httpMock.expectOne(`${BASE}/events/${EVENT_ID}/segments/${SEGMENT_ID}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('reorder sends PATCH to /events/:eventId/segments/reorder with segmentIds', () => {
    service.reorder(EVENT_ID, [SEGMENT_ID]).subscribe();
    const req = httpMock.expectOne(`${BASE}/events/${EVENT_ID}/segments/reorder`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ segmentIds: [SEGMENT_ID] });
    req.flush(null);
  });
});
