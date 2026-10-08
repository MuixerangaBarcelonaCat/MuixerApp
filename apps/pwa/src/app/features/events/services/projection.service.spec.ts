import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { PROJECTION_TIMEOUT_MS, ProjectionService } from './projection.service';

describe('ProjectionService', () => {
  let service: ProjectionService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ProjectionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should fetch projection data for a segment', () => {
    service.getProjection('ev-1', 'seg-1').subscribe((res) => {
      expect(res.segment.id).toBe('seg-1');
    });

    const req = httpMock.expectOne('/api/me/events/ev-1/segments/seg-1/projection');
    expect(req.request.method).toBe('GET');
    req.flush({
      segment: { id: 'seg-1', name: null, sortOrder: 0, prevSegmentId: null, nextSegmentId: null },
      instances: [],
      personAttendance: {},
      hasDistribution: false,
      conflicts: [],
    });
  });

  it('should error out instead of spinning forever when the server never answers', () => {
    vi.useFakeTimers();
    try {
      let error: unknown;
      service.getProjection('ev-1', 'seg-1').subscribe({ error: (e) => (error = e) });
      httpMock.expectOne('/api/me/events/ev-1/segments/seg-1/projection');

      vi.advanceTimersByTime(PROJECTION_TIMEOUT_MS + 1);

      expect(error).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });
});
