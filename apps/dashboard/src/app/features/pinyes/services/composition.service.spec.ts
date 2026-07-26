import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { environment } from '../../../../environments/environment';
import { CompositionService } from './composition.service';
import { CompositionDetail, CompositionListItem, PaginatedCompositions } from '../models/composition.model';
import { SegmentDetail } from '../models/segment.model';

const BASE = environment.apiUrl;
const EVENT_ID = 'event-uuid-1';
const SEGMENT_ID = 'seg-uuid-1';
const COMPOSITION_ID = 'comp-uuid-1';

const mockListItem: CompositionListItem = {
  id: COMPOSITION_ID,
  name: 'Pilars de plaça',
  description: null,
  entryCount: 2,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};

const mockPaginated: PaginatedCompositions = {
  data: [mockListItem],
  meta: { total: 1, page: 1, limit: 20 },
};

const mockDetail: CompositionDetail = {
  id: COMPOSITION_ID,
  name: 'Pilars de plaça',
  description: null,
  entries: [],
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};

const mockSegment: SegmentDetail = {
  id: SEGMENT_ID,
  name: 'Pilars de plaça',
  sortOrder: 0,
  startTime: null,
  endTime: null,
  notes: null,
  isVisible: true,
  instances: [],
};

describe('CompositionService', () => {
  let service: CompositionService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CompositionService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CompositionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getAll sends GET to /compositions with query params', () => {
    service.getAll({ search: 'pilar', page: 1, limit: 20 }).subscribe();
    const req = httpMock.expectOne(
      (r) => r.url === `${BASE}/compositions` && r.method === 'GET',
    );
    expect(req.request.params.get('search')).toBe('pilar');
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('limit')).toBe('20');
    req.flush(mockPaginated);
  });

  it('getAll returns the paginated compositions', () => {
    let result: PaginatedCompositions | undefined;
    service.getAll().subscribe((r) => (result = r));
    const req = httpMock.expectOne(`${BASE}/compositions`);
    req.flush(mockPaginated);
    expect(result).toEqual(mockPaginated);
  });

  it('getOne sends GET to /compositions/:id', () => {
    let result: CompositionDetail | undefined;
    service.getOne(COMPOSITION_ID).subscribe((r) => (result = r));
    const req = httpMock.expectOne(`${BASE}/compositions/${COMPOSITION_ID}`);
    expect(req.request.method).toBe('GET');
    req.flush(mockDetail);
    expect(result).toEqual(mockDetail);
  });

  it('create sends POST to /compositions with payload', () => {
    const payload = { name: 'Nova composició' };
    service.create(payload).subscribe();
    const req = httpMock.expectOne(`${BASE}/compositions`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(mockDetail);
  });

  it('update sends PUT to /compositions/:id with payload', () => {
    const payload = { name: 'Nom actualitzat' };
    service.update(COMPOSITION_ID, payload).subscribe();
    const req = httpMock.expectOne(`${BASE}/compositions/${COMPOSITION_ID}`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(payload);
    req.flush(mockDetail);
  });

  it('remove sends DELETE to /compositions/:id', () => {
    service.remove(COMPOSITION_ID).subscribe();
    const req = httpMock.expectOne(`${BASE}/compositions/${COMPOSITION_ID}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('duplicate sends POST to /compositions/:id/duplicate', () => {
    service.duplicate(COMPOSITION_ID).subscribe();
    const req = httpMock.expectOne(`${BASE}/compositions/${COMPOSITION_ID}/duplicate`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(mockDetail);
  });

  it('applyToSegment sends POST to /events/:eventId/segments/:segmentId/apply-composition with compositionId', () => {
    let result: SegmentDetail | undefined;
    service.applyToSegment(EVENT_ID, SEGMENT_ID, COMPOSITION_ID).subscribe((r) => (result = r));
    const req = httpMock.expectOne(
      `${BASE}/events/${EVENT_ID}/segments/${SEGMENT_ID}/apply-composition`,
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ compositionId: COMPOSITION_ID });
    req.flush(mockSegment);
    expect(result).toEqual(mockSegment);
  });
});
