import { Component, ChangeDetectionStrategy, inject, computed, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MeNewsItem } from '@muixer/shared';
import { MobileHeaderComponent } from '../../../shared/components/mobile-header/mobile-header.component';
import { SkeletonCardComponent } from '../../../shared/components/skeleton-card/skeleton-card.component';
import { CardComponent, EmptyStateComponent } from '@muixer/ui';
import { MarkdownService } from '@muixer/ui/markdown';
import { formatEventDate } from '../../../shared/pipes/format-event-date.pipe';
import { NewsService } from '../services/news.service';

@Component({
  selector: 'app-news-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MobileHeaderComponent, SkeletonCardComponent, EmptyStateComponent, CardComponent],
  templateUrl: './news-detail.component.html',
})
export class NewsDetailComponent {
  readonly id = input.required<string>();

  private readonly newsService = inject(NewsService);
  private readonly markdown = inject(MarkdownService);

  protected readonly newsResource = rxResource<MeNewsItem, string>({
    params: () => this.id(),
    stream: ({ params: id }) => this.newsService.findOne(id),
  });

  protected readonly news = computed((): MeNewsItem | undefined =>
    this.newsResource.error() ? undefined : this.newsResource.value(),
  );
  protected readonly isLoading = this.newsResource.isLoading;
  protected readonly hasError = computed(() => !!this.newsResource.error());

  protected readonly publishedDate = computed(() => {
    const publishedAt = this.news()?.publishedAt;
    return publishedAt ? formatEventDate(publishedAt.slice(0, 10)) : '';
  });

  protected readonly bodyHtml = computed(() => this.markdown.render(this.news()?.body));

  protected onBodyClick(event: MouseEvent | KeyboardEvent): void {
    if (event instanceof KeyboardEvent && event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    const anchor = (event.target as HTMLElement).closest('a');
    if (anchor?.href) {
      event.preventDefault();
      event.stopPropagation();
      window.open(anchor.href, '_blank', 'noopener,noreferrer');
    }
  }
}
