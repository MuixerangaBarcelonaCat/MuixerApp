import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { NodeAssignmentService } from './node-assignment.service';

const BASE = environment.apiUrl;
const INSTANCE_ID = 'instance-uuid-1';
const ASSIGNMENT_ID = 'assignment-uuid-1';
const TEMPLATE_ID = 'template-uuid-1';
const EVENT_ID = 'event-uuid-1';
const SEGMENT_ID = 'segment-uuid-1';

describe('NodeAssignmentService', () => {
  let service: NodeAssignmentService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [NodeAssignmentService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(NodeAssignmentService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getByInstance sends GET to /figure-instances/:id/assignments', () => {
    service.getByInstance(INSTANCE_ID).subscribe();
    const req = httpMock.expectOne(`${BASE}/figure-instances/${INSTANCE_ID}/assignments`);
    expect(req.request.method).toBe('GET');
    req.flush({ data: [] });
  });

  it('assign sends POST with { nodeId, personId } to /figure-instances/:id/assignments', () => {
    const payload = { nodeId: 'node-uuid-1', personId: 'person-uuid-1' };
    service.assign(INSTANCE_ID, payload).subscribe();
    const req = httpMock.expectOne(`${BASE}/figure-instances/${INSTANCE_ID}/assignments`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({});
  });

  it('assign sends POST with compositionSlotId when provided', () => {
    const payload = { nodeId: 'node-uuid-1', personId: 'person-uuid-1', compositionSlotId: 'slot-uuid-1' };
    service.assign(INSTANCE_ID, payload).subscribe();
    const req = httpMock.expectOne(`${BASE}/figure-instances/${INSTANCE_ID}/assignments`);
    expect(req.request.body).toEqual(payload);
    req.flush({});
  });

  it('unassign sends DELETE to /figure-instances/:id/assignments/:assignmentId', () => {
    service.unassign(INSTANCE_ID, ASSIGNMENT_ID).subscribe();
    const req = httpMock.expectOne(
      `${BASE}/figure-instances/${INSTANCE_ID}/assignments/${ASSIGNMENT_ID}`,
    );
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('bulkImport sends POST to /figure-instances/:id/assignments/bulk', () => {
    const payload = { sourceInstanceId: 'source-uuid' };
    service.bulkImport(INSTANCE_ID, payload).subscribe();
    const req = httpMock.expectOne(`${BASE}/figure-instances/${INSTANCE_ID}/assignments/bulk`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ created: [], conflicts: [] });
  });

  it('getAvailablePersons sends GET with query params to /events/:id/segments/:id/available-persons', () => {
    service
      .getAvailablePersons(EVENT_ID, SEGMENT_ID, { search: 'pere', height: 140, excludeAssigned: true })
      .subscribe();
    const req = httpMock.expectOne((r) =>
      r.url === `${BASE}/events/${EVENT_ID}/segments/${SEGMENT_ID}/available-persons`,
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('search')).toBe('pere');
    expect(req.request.params.get('height')).toBe('140');
    expect(req.request.params.get('excludeAssigned')).toBe('true');
    req.flush({ data: [] });
  });

  it('getHistory sends GET to /figure-templates/:id/history', () => {
    service.getHistory(TEMPLATE_ID).subscribe();
    const req = httpMock.expectOne(`${BASE}/figure-templates/${TEMPLATE_ID}/history`);
    expect(req.request.method).toBe('GET');
    req.flush({ data: [] });
  });

  it('getNextPerformance sends GET to /events/:id/next-performance', () => {
    service.getNextPerformance(EVENT_ID).subscribe();
    const req = httpMock.expectOne(`${BASE}/events/${EVENT_ID}/next-performance`);
    expect(req.request.method).toBe('GET');
    req.flush(null);
  });
});
