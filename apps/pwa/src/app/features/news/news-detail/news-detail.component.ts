import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
  input,
  SecurityContext,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { DomSanitizer } from '@angular/platform-browser';
import { marked } from 'marked';
import { MeNewsItem } from '@muixer/shared';
import { MobileHeaderComponent } from '../../../shared/components/mobile-header/mobile-header.component';
import { SkeletonCardComponent } from '../../../shared/components/skeleton-card/skeleton-card.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { formatEventDate } from '../../../shared/pipes/format-event-date.pipe';
import { NewsService } from '../services/news.service';

marked.setOptions({ async: false });

// Opens body links in a new tab so clicking one keeps the installed PWA on the news
// instead of navigating the whole app shell away. `this.parser` is wired up by marked at
// call time, so this must stay a regular function (not an arrow function bound early).
const renderer = new marked.Renderer();
renderer.link = function ({ href, title, tokens }) {
  const text = this.parser.parseInline(tokens);
  const titleAttr = title ? ` title="${title}"` : '';
  return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer" class="underline">${text}</a>`;
};
marked.use({ renderer });

@Component({
  selector: 'app-news-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MobileHeaderComponent, SkeletonCardComponent, EmptyStateComponent],
  templateUrl: './news-detail.component.html',
})
export class NewsDetailComponent {
  readonly id = input.required<string>();

  private readonly newsService = inject(NewsService);
  private readonly sanitizer = inject(DomSanitizer);

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

  protected readonly bodyHtml = computed(() => {
    const body = this.news()?.body;
    if (!body) return '';
    return this.sanitizer.sanitize(SecurityContext.HTML, marked.parse(body) as string) ?? '';
  });

  protected onBodyClick(event: MouseEvent): void {
    const anchor = (event.target as HTMLElement).closest('a');
    if (anchor?.href) {
      event.preventDefault();
      event.stopPropagation();
      window.open(anchor.href, '_blank', 'noopener,noreferrer');
    }
  }
}
