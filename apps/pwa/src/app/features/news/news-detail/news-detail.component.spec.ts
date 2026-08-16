import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ApplicationRef, Component } from '@angular/core';
import { of, throwError } from 'rxjs';
import { provideRouter } from '@angular/router';
import { MeNewsItem } from '@muixer/shared';
import { NewsDetailComponent } from './news-detail.component';
import { NewsService } from '../services/news.service';

const MOCK_DETAIL: MeNewsItem = {
  id: 'n-1',
  title: 'Nova temporada',
  publishedAt: '2026-01-10T00:00:00.000Z',
  body: '**Benvinguts** a la nova temporada! [Més info](https://muixeranga.cat)',
};

@Component({
  standalone: true,
  imports: [NewsDetailComponent],
  template: `<app-news-detail [id]="'n-1'" />`,
})
class TestHostComponent {}

describe('NewsDetailComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let newsService: { findOne: ReturnType<typeof vi.fn> };

  async function setup(findOneReturn = of(MOCK_DETAIL)) {
    newsService = { findOne: vi.fn().mockReturnValue(findOneReturn) };

    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [
        provideRouter([]),
        { provide: NewsService, useValue: newsService },
      ],
    }).compileComponents();

    const f = TestBed.createComponent(TestHostComponent);
    f.detectChanges();
    await TestBed.inject(ApplicationRef).whenStable();
    f.detectChanges();
    return f;
  }

  it('should load the news by id', async () => {
    fixture = await setup();
    expect(newsService.findOne).toHaveBeenCalledWith('n-1');
  });

  it('should display the news title', async () => {
    fixture = await setup();
    expect(fixture.nativeElement.textContent).toContain('Nova temporada');
  });

  it('should render the markdown body as sanitized HTML', async () => {
    fixture = await setup();
    const body = fixture.nativeElement.querySelector('[data-testid="news-detail-body"]');
    expect(body.innerHTML).toContain('<strong>Benvinguts</strong>');
  });

  it('should open links in the body in a new tab', async () => {
    fixture = await setup();
    const link = fixture.nativeElement.querySelector('[data-testid="news-detail-body"] a');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('should show an error state when loading fails', async () => {
    fixture = await setup(throwError(() => new Error('fail')));
    expect(fixture.nativeElement.textContent).toContain("No s'ha pogut carregar");
  });
});
