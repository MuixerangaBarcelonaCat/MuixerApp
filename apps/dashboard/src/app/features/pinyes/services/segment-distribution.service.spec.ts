import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { environment } from '../../../../environments/environment';
import { SegmentDistributionService } from './segment-distribution.service';
import { SegmentDistributionData } from '../models/distribution.model';

const BASE = environment.apiUrl;
const EVENT_ID = 'event-uuid-1';
const SEGMENT_ID = 'seg-uuid-1';
const INSTANCE_ID = 'inst-uuid-1';

const mockDistributionData: SegmentDistributionData = {
  segment: { id: SEGMENT_ID, name: 'Bloc 1' },
  items: [
    {
      instanceId: INSTANCE_ID,
      label: null,
      figureMode: 'COMPLETA',
      numberOfCordons: null,
      cordonsObertsEnabled: true,
      assignments: [],
      figureTemplate: { id: 'fig-uuid', name: 'pd4', nodes: [] },
      troncGridCols: 2,
      troncGridRows: 3,
      projectionX: 100,
      projectionY: 200,
      projectionAngle: 45,
      troncPanelX: null,
      troncPanelY: null,
      troncPanelWidth: null,
      troncPanelHeight: null,
    },
  ],
};

describe('SegmentDistributionService', () => {
  let service: SegmentDistributionService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SegmentDistributionService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SegmentDistributionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getDistribution sends GET to /events/:eventId/segments/:segmentId/distribution', () => {
    service.getDistribution(EVENT_ID, SEGMENT_ID).subscribe();
    const req = httpMock.expectOne(
      `${BASE}/events/${EVENT_ID}/segments/${SEGMENT_ID}/distribution`,
    );
    expect(req.request.method).toBe('GET');
    req.flush(mockDistributionData);
  });

  it('getDistribution returns the segment distribution data', () => {
    let result: SegmentDistributionData | undefined;
    service.getDistribution(EVENT_ID, SEGMENT_ID).subscribe((data) => (result = data));
    const req = httpMock.expectOne(
      `${BASE}/events/${EVENT_ID}/segments/${SEGMENT_ID}/distribution`,
    );
    req.flush(mockDistributionData);
    expect(result).toEqual(mockDistributionData);
  });

  it('saveDistribution sends PUT to /events/:eventId/segments/:segmentId/distribution with items', () => {
    const items = [{ instanceId: INSTANCE_ID, x: 100, y: 200, angle: 45, troncPanelX: null, troncPanelY: null, troncPanelWidth: null, troncPanelHeight: null }];
    service.saveDistribution(EVENT_ID, SEGMENT_ID, items).subscribe();
    const req = httpMock.expectOne(
      `${BASE}/events/${EVENT_ID}/segments/${SEGMENT_ID}/distribution`,
    );
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ items });
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('clearDistribution sends DELETE to /events/:eventId/segments/:segmentId/distribution', () => {
    service.clearDistribution(EVENT_ID, SEGMENT_ID).subscribe();
    const req = httpMock.expectOne(
      `${BASE}/events/${EVENT_ID}/segments/${SEGMENT_ID}/distribution`,
    );
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });
});
