import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { NewsService } from './news.service';

describe('NewsService', () => {
  let service: NewsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [NewsService],
    });
    service = TestBed.inject(NewsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getAll requests the news items list', () => {
    service.getAll().subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/news'));
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getOne requests a single news by id', () => {
    service.getOne('news-1').subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/news/news-1'));
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('create POSTs the title, body and publishedAt', () => {
    service.create({ title: 'Nova', body: 'Cos', publishedAt: '2026-01-01T00:00:00.000Z' }).subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/news'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ title: 'Nova', body: 'Cos', publishedAt: '2026-01-01T00:00:00.000Z' });
    req.flush({});
  });

  it('update PATCHes only the provided fields', () => {
    service.update('news-1', { title: 'Updated' }).subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/news/news-1'));
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ title: 'Updated' });
    req.flush({});
  });

  it('update can explicitly clear publishedAt back to draft', () => {
    service.update('news-1', { publishedAt: null }).subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/news/news-1'));
    expect(req.request.body).toEqual({ publishedAt: null });
    req.flush({});
  });

  it('remove DELETEs the news', () => {
    service.remove('news-1').subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/news/news-1'));
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
