import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AttendanceStatus, EventType } from '@muixer/shared';
import { EventService } from './event.service';

describe('EventService', () => {
  let service: EventService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(EventService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should fetch events without filters', () => {
    service.findAll().subscribe((res) => {
      expect(res.data).toEqual([]);
    });

    const req = httpMock.expectOne('/api/me/events');
    expect(req.request.method).toBe('GET');
    req.flush({ data: [], meta: { total: 0, page: 1, limit: 20 } });
  });

  it('should pass filter params', () => {
    service
      .findAll({ type: EventType.ASSAIG, timeFilter: 'past', page: 2, limit: 10 })
      .subscribe();

    const req = httpMock.expectOne(
      (r) => r.url === '/api/me/events' && r.params.get('type') === 'ASSAIG',
    );
    expect(req.request.params.get('timeFilter')).toBe('past');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('limit')).toBe('10');
    req.flush({ data: [], meta: { total: 0, page: 2, limit: 10 } });
  });

  it('should fetch single event', () => {
    service.findOne('ev-1').subscribe((res) => {
      expect(res.id).toBe('ev-1');
    });

    const req = httpMock.expectOne('/api/me/events/ev-1');
    expect(req.request.method).toBe('GET');
    req.flush({ id: 'ev-1', title: 'Test' });
  });

  it('should update attendance', () => {
    service
      .updateAttendance('ev-1', AttendanceStatus.ANIRE)
      .subscribe((res) => {
        expect(res.status).toBe(AttendanceStatus.ANIRE);
      });

    const req = httpMock.expectOne('/api/me/events/ev-1/attendance');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ status: AttendanceStatus.ANIRE });
    req.flush({ id: 'att-1', status: AttendanceStatus.ANIRE, respondedAt: new Date().toISOString() });
  });

  it('should include personId in the attendance body when given', () => {
    service
      .updateAttendance('ev-1', AttendanceStatus.ANIRE, 'person-2')
      .subscribe();

    const req = httpMock.expectOne('/api/me/events/ev-1/attendance');
    expect(req.request.body).toEqual({ status: AttendanceStatus.ANIRE, personId: 'person-2' });
    req.flush({ id: 'att-1', status: AttendanceStatus.ANIRE, respondedAt: new Date().toISOString() });
  });

  it('should fetch published segments for an event', () => {
    service.findSegments('ev-1').subscribe((res) => {
      expect(res).toEqual([{ id: 'seg-1', name: 'Bloc 1', sortOrder: 0, instances: [], myPlacements: [] }]);
    });

    const req = httpMock.expectOne('/api/me/events/ev-1/segments');
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 'seg-1', name: 'Bloc 1', sortOrder: 0, instances: [], myPlacements: [] }]);
  });

  it('should carry the caller\'s own placements through unchanged', () => {
    const placement = { nodeLabel: 'Vent', cordon: 1, figureName: 'Roscana', figureMode: 'COMPLETA' };
    service.findSegments('ev-1').subscribe((res) => {
      expect(res[0].myPlacements).toEqual([placement]);
    });

    const req = httpMock.expectOne('/api/me/events/ev-1/segments');
    req.flush([{ id: 'seg-1', name: 'Bloc 1', sortOrder: 0, instances: [], myPlacements: [placement] }]);
  });
});
