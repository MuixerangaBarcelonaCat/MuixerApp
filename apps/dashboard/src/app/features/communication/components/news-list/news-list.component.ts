import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { News } from '@muixer/shared';
import { NewsService } from '../../services/news.service';
import { ToastService } from '@muixer/ui';
import { PageHeaderComponent } from '../../../../shared/components/data/page-header/page-header.component';
import { EmptyStateComponent } from '../../../../shared/components/data/empty-state/empty-state.component';
import { ICON_NOTICIA } from '../../../../shared/constants/domain-icons';
import { getNewsStatus, getNewsStatusLabel, formatDateTime } from '../../../../shared/utils';

@Component({
  selector: 'app-news-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageHeaderComponent, EmptyStateComponent],
  templateUrl: './news-list.component.html',
})
export class NewsListComponent {
  readonly ICON_NOTICIA = ICON_NOTICIA;

  private readonly newsService = inject(NewsService);
  private readonly toast = inject(ToastService);

  readonly newsItems = signal<News[]>([]);
  readonly loading = signal(false);
  readonly confirmDeleteTarget = signal<News | null>(null);
  readonly deleting = signal(false);

  readonly formattedNewsItems = computed(() =>
    this.newsItems().map((news) => {
      const status = getNewsStatus(news);
      return {
        ...news,
        statusLabel: getNewsStatusLabel(status),
        publishedAtFormatted: news.publishedAt ? formatDateTime(news.publishedAt) : '—',
      };
    }),
  );

  constructor() {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.newsService.getAll().subscribe({
      next: (newsItems) => {
        this.newsItems.set(newsItems);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Error en carregar les notícies.');
      },
    });
  }

  confirmDelete(news: News): void {
    this.confirmDeleteTarget.set(news);
  }

  cancelDelete(): void {
    this.confirmDeleteTarget.set(null);
  }

  executeDelete(): void {
    const target = this.confirmDeleteTarget();
    if (!target || this.deleting()) return;

    this.deleting.set(true);
    this.newsService.remove(target.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.confirmDeleteTarget.set(null);
        this.toast.success(`Notícia "${target.title}" eliminada.`);
        this.reload();
      },
      error: (err) => {
        this.deleting.set(false);
        this.confirmDeleteTarget.set(null);
        const msg = err?.error?.message ?? 'Error en eliminar la notícia.';
        this.toast.error(msg);
      },
    });
  }
}
