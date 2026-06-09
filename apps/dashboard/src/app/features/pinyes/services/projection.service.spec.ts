import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { environment } from '../../../../environments/environment';
import { ProjectionService } from './projection.service';

const BASE = environment.apiUrl;
const EVENT_ID = 'event-uuid-1';
const SEGMENT_ID = 'seg-uuid-1';

describe('ProjectionService', () => {
  let service: ProjectionService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ProjectionService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ProjectionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getProjection sends GET to /events/:eventId/segments/:segmentId/projection', () => {
    service.getProjection(EVENT_ID, SEGMENT_ID).subscribe();
    const req = httpMock.expectOne(
      `${BASE}/events/${EVENT_ID}/segments/${SEGMENT_ID}/projection`,
    );
    expect(req.request.method).toBe('GET');
    req.flush({
      segment: { id: SEGMENT_ID, name: 'Test', sortOrder: 0, prevSegmentId: null, nextSegmentId: null },
      instances: [],
    });
  });

});
