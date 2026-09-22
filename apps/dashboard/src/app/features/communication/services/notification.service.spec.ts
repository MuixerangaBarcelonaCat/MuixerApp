import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { NotificationSource, NotificationTargetType } from '@muixer/shared';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [NotificationService],
    });
    service = TestBed.inject(NotificationService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('send POSTs the payload', () => {
    const payload = { title: 'Assaig', body: 'Dijous a les 20h', target: { type: NotificationTargetType.ALL } };
    service.send(payload).subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/notifications/send'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ accepted: true });
  });

  it('getDeviceSummary requests the device summary', () => {
    service.getDeviceSummary().subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/push-subscriptions/summary'));
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getHistory requests the notification history with query params', () => {
    service.getHistory({ source: NotificationSource.MANUAL, page: 2, limit: 25 }).subscribe();
    const req = http.expectOne(
      (r) => r.url.endsWith('/notifications/history') && r.params.get('source') === NotificationSource.MANUAL,
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('limit')).toBe('25');
    req.flush({ data: [], meta: { total: 0, page: 2, limit: 25 } });
  });

  it('getHistory omits unset filters', () => {
    service.getHistory({}).subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/notifications/history'));
    expect(req.request.params.keys()).toEqual([]);
    req.flush({ data: [], meta: { total: 0, page: 1, limit: 25 } });
  });
});
