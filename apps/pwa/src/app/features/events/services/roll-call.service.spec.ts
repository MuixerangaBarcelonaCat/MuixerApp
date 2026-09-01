import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AttendanceStatus } from '@muixer/shared';
import { RollCallService } from './roll-call.service';
import { environment } from '../../../../environments/environment';

describe('RollCallService', () => {
  let service: RollCallService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), RollCallService],
    });
    service = TestBed.inject(RollCallService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('GETs attendance for an event with an optional search term', () => {
    service.getAttendance('event-1', 'anna').subscribe();
    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiUrl}/events/event-1/attendance` && r.params.get('search') === 'anna',
    );
    expect(req.request.method).toBe('GET');
    req.flush({ data: [], meta: { total: 0, page: 1, limit: 100 } });
  });

  it('PUTs an attendance status update', () => {
    service.updateAttendance('event-1', 'att-1', { status: AttendanceStatus.NO_VAIG }).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/events/event-1/attendance/att-1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ status: AttendanceStatus.NO_VAIG });
    req.flush({ attendance: { id: 'att-1', status: AttendanceStatus.NO_VAIG }, summary: {} });
  });
});
