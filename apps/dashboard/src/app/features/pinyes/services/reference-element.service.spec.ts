import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { environment } from '../../../../environments/environment';
import { ReferenceElementService } from './reference-element.service';
import { ReferenceElementType } from '@muixer/shared';

const BASE = environment.apiUrl;
const EVENT_ID = 'event-uuid-1';
const ELEMENT_ID = 'elem-uuid-1';
const SEGMENT_ID = 'seg-uuid-1';

describe('ReferenceElementService', () => {
  let service: ReferenceElementService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ReferenceElementService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ReferenceElementService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getByEvent sends GET to /events/:id/reference-elements', () => {
    service.getByEvent(EVENT_ID).subscribe();
    const req = httpMock.expectOne(`${BASE}/events/${EVENT_ID}/reference-elements`);
    expect(req.request.method).toBe('GET');
    req.flush({ data: [] });
  });

  it('create sends POST with payload', () => {
    const payload = {
      type: ReferenceElementType.RECTANGLE,
      x: 0,
      y: 0,
      width: 200,
      height: 100,
    };
    service.create(EVENT_ID, payload).subscribe();
    const req = httpMock.expectOne(`${BASE}/events/${EVENT_ID}/reference-elements`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({});
  });

  it('update sends PUT to /events/:eventId/reference-elements/:id', () => {
    service.update(EVENT_ID, ELEMENT_ID, { label: 'Test' }).subscribe();
    const req = httpMock.expectOne(`${BASE}/events/${EVENT_ID}/reference-elements/${ELEMENT_ID}`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ label: 'Test' });
    req.flush({});
  });

  it('batchUpdate sends PUT to .../batch with { elements }', () => {
    const elements = [{ id: ELEMENT_ID, x: 0, y: 0, width: 100, height: 50, rotation: 0 }];
    service.batchUpdate(EVENT_ID, elements).subscribe();
    const req = httpMock.expectOne(`${BASE}/events/${EVENT_ID}/reference-elements/batch`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ elements });
    req.flush(null);
  });

  it('toggleVisibility sends PUT to .../visibility with { segmentId, hidden }', () => {
    service.toggleVisibility(EVENT_ID, ELEMENT_ID, SEGMENT_ID, true).subscribe();
    const req = httpMock.expectOne(
      `${BASE}/events/${EVENT_ID}/reference-elements/${ELEMENT_ID}/visibility`,
    );
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ segmentId: SEGMENT_ID, hidden: true });
    req.flush({});
  });

  it('remove sends DELETE to /events/:eventId/reference-elements/:id', () => {
    service.remove(EVENT_ID, ELEMENT_ID).subscribe();
    const req = httpMock.expectOne(`${BASE}/events/${EVENT_ID}/reference-elements/${ELEMENT_ID}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
