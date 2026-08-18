import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { News, NewsStatus } from '@muixer/shared';
import { BadgeComponent, ButtonComponent, CardComponent, ToastService } from '@muixer/ui';
import { NewsService } from './services/news.service';
import { DOMAIN_ICONS } from '../../shared/constants/domain-icons';
import { getNewsStatus, formatDate } from '../../shared/utils';

const NEWS_PREVIEW_LIMIT = 3;

@Component({
  selector: 'app-communication',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, RouterLink, BadgeComponent, ButtonComponent, CardComponent],
  templateUrl: './communication.component.html',
})
export class CommunicationComponent {
  readonly ICON_NOTICIA = DOMAIN_ICONS.NOTICIA;
  readonly ICON_BELL = DOMAIN_ICONS.BELL;
  protected readonly formatDate = formatDate;

  private readonly newsService = inject(NewsService);
  private readonly toast = inject(ToastService);

  readonly newsLoading = signal(false);
  private readonly newsItems = signal<News[]>([]);

  readonly newsCounts = computed(() => {
    const statuses = this.newsItems().map(getNewsStatus);
    return {
      published: statuses.filter((status) => status === NewsStatus.PUBLISHED).length,
      scheduled: statuses.filter((status) => status === NewsStatus.SCHEDULED).length,
      draft: statuses.filter((status) => status === NewsStatus.DRAFT).length,
    };
  });

  readonly recentPublished = computed(() =>
    this.newsItems()
      .filter((news) => getNewsStatus(news) === NewsStatus.PUBLISHED)
      .sort((a, b) => new Date(b.publishedAt as string).getTime() - new Date(a.publishedAt as string).getTime())
      .slice(0, NEWS_PREVIEW_LIMIT),
  );

  readonly upcomingScheduled = computed(() =>
    this.newsItems()
      .filter((news) => getNewsStatus(news) === NewsStatus.SCHEDULED)
      .sort((a, b) => new Date(a.publishedAt as string).getTime() - new Date(b.publishedAt as string).getTime())
      .slice(0, NEWS_PREVIEW_LIMIT),
  );

  constructor() {
    this.newsLoading.set(true);
    this.newsService.getAll().subscribe({
      next: (items) => {
        this.newsItems.set(items);
        this.newsLoading.set(false);
      },
      error: () => {
        this.newsLoading.set(false);
        this.toast.error('Error en carregar les notícies.');
      },
    });
  }
}
