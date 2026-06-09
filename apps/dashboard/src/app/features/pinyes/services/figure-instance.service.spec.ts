import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { FigureInstanceService } from './figure-instance.service';

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

  it('remove sends DELETE to the correct nested URL', () => {
    service.remove(EVENT_ID, SEGMENT_ID, INSTANCE_ID).subscribe();
    const req = httpMock.expectOne(`${INSTANCES_BASE}/${INSTANCE_ID}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

});
