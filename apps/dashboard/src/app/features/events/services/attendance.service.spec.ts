import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { AttendanceService } from './attendance.service';
import { AttendanceStatus } from '@muixer/shared';

describe('AttendanceService', () => {
  let service: AttendanceService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AttendanceService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AttendanceService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getByEvent requests /events/:id/attendance', () => {
    const eventId = 'ev-uuid';
    service.getByEvent(eventId, {}).subscribe();
    const req = httpMock.expectOne((r) => r.url === `${environment.apiUrl}/events/${eventId}/attendance`);
    expect(req.request.method).toBe('GET');
    req.flush({ data: [], meta: { total: 0, page: 1, limit: 100 } });
  });

  it('getByEvent sends status filter', () => {
    const eventId = 'ev-uuid';
    service.getByEvent(eventId, { status: AttendanceStatus.ASSISTIT }).subscribe();
    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiUrl}/events/${eventId}/attendance`,
    );
    expect(req.request.params.get('status')).toBe(AttendanceStatus.ASSISTIT);
    req.flush({ data: [], meta: { total: 0, page: 1, limit: 100 } });
  });
});
