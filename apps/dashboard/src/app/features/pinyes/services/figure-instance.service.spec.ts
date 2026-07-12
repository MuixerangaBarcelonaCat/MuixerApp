import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { FigureInstanceService } from './figure-instance.service';
import { SegmentMoveConflictResolution } from '@muixer/shared';

const BASE = environment.apiUrl;
const EVENT_ID = 'event-uuid-1';
const SEGMENT_ID = 'segment-uuid-1';
const INSTANCE_ID = 'instance-uuid-1';
const INSTANCES_BASE = `${BASE}/events/${EVENT_ID}/segments/${SEGMENT_ID}/instances`;

describe('FigureInstanceService', () => {
  let service: FigureInstanceService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [FigureInstanceService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(FigureInstanceService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('create sends POST to the correct nested URL with payload', () => {
    const payload = { figureTemplateId: 'fig-uuid' };
    service.create(EVENT_ID, SEGMENT_ID, payload).subscribe();
    const req = httpMock.expectOne(INSTANCES_BASE);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({});
  });

  it('update sends PUT to the correct nested URL with payload', () => {
    const payload = { label: 'Central' };
    service.update(EVENT_ID, SEGMENT_ID, INSTANCE_ID, payload).subscribe();
    const req = httpMock.expectOne(`${INSTANCES_BASE}/${INSTANCE_ID}`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(payload);
    req.flush({});
  });

  it('remove sends DELETE to the correct nested URL', () => {
    service.remove(EVENT_ID, SEGMENT_ID, INSTANCE_ID).subscribe();
    const req = httpMock.expectOne(`${INSTANCES_BASE}/${INSTANCE_ID}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('reorder sends PATCH to instances/reorder with instanceIds', () => {
    service.reorder(EVENT_ID, SEGMENT_ID, [INSTANCE_ID]).subscribe();
    const req = httpMock.expectOne(`${INSTANCES_BASE}/reorder`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ instanceIds: [INSTANCE_ID] });
    req.flush(null);
  });

  describe('move', () => {
    const TARGET_SEGMENT_ID = 'segment-uuid-2';

    it('sends PATCH to instances/:id/move with targetSegmentId and targetIndex, no query params', () => {
      service
        .move(EVENT_ID, SEGMENT_ID, INSTANCE_ID, { targetSegmentId: TARGET_SEGMENT_ID, targetIndex: 2 })
        .subscribe();

      const req = httpMock.expectOne(
        (r) => r.url === `${INSTANCES_BASE}/${INSTANCE_ID}/move`,
      );
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ targetSegmentId: TARGET_SEGMENT_ID, targetIndex: 2 });
      expect(req.request.params.has('conflictResolution')).toBe(false);
      req.flush({});
    });

    it('forwards conflictResolution as a query param when provided', () => {
      service
        .move(EVENT_ID, SEGMENT_ID, INSTANCE_ID, {
          targetSegmentId: TARGET_SEGMENT_ID,
          conflictResolution: SegmentMoveConflictResolution.KEEP_MOVED,
        })
        .subscribe();

      const req = httpMock.expectOne(
        (r) => r.url === `${INSTANCES_BASE}/${INSTANCE_ID}/move`,
      );
      expect(req.request.params.get('conflictResolution')).toBe(SegmentMoveConflictResolution.KEEP_MOVED);
      req.flush({});
    });
  });
});
