import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { NewsService } from './news.service';

describe('NewsService', () => {
  let service: NewsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(NewsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should fetch published news', () => {
    service.findAll().subscribe((news) => {
      expect(news).toEqual([{ id: 'n-1', title: 'Nova temporada', publishedAt: '2026-01-01T00:00:00.000Z', body: 'Cos' }]);
    });

    const req = httpMock.expectOne('/api/me/news');
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 'n-1', title: 'Nova temporada', publishedAt: '2026-01-01T00:00:00.000Z', body: 'Cos' }]);
  });

  it('should fetch a single news detail', () => {
    service.findOne('n-1').subscribe((news) => {
      expect(news.id).toBe('n-1');
      expect(news.body).toBe('Cos **markdown**');
    });

    const req = httpMock.expectOne('/api/me/news/n-1');
    expect(req.request.method).toBe('GET');
    req.flush({ id: 'n-1', title: 'Nova temporada', publishedAt: '2026-01-01T00:00:00.000Z', body: 'Cos **markdown**' });
  });
});
