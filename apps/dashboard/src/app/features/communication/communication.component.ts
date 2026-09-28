import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { News, NewsStatus, NotificationScheduleEntry } from '@muixer/shared';
import { ButtonComponent, CardComponent, ToastService } from '@muixer/ui';
import { NewsService } from './services/news.service';
import { NotificationService } from './services/notification.service';
import { DOMAIN_ICONS } from '../../shared/constants/domain-icons';
import { getNewsStatus, formatDate } from '../../shared/utils';

const NEWS_PREVIEW_LIMIT = 3;
const DISPATCH_PREVIEW_LIMIT = 3;
/** Enough to sort every realistic set of active schedules by next run in the browser — the API
 *  paginates by creation date, which is not the order this card needs. */
const SCHEDULE_FETCH_LIMIT = 50;

@Component({
  selector: 'app-communication',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, RouterLink, ButtonComponent, CardComponent],
  templateUrl: './communication.component.html',
})
export class CommunicationComponent {
  readonly ICON_NOTICIA = DOMAIN_ICONS.NOTICIA;
  readonly ICON_BELL = DOMAIN_ICONS.BELL;
  protected readonly formatDate = formatDate;

  private readonly newsService = inject(NewsService);
  private readonly notificationService = inject(NotificationService);
  private readonly toast = inject(ToastService);

  readonly newsLoading = signal(false);
  private readonly newsItems = signal<News[]>([]);

  readonly schedulesLoading = signal(false);
  readonly activeScheduleCount = signal(0);
  private readonly activeSchedules = signal<NotificationScheduleEntry[]>([]);

  /** The soonest sends that will actually happen — a schedule with no `nextRunAt` has nothing
   *  left to fire, so it never belongs on a "what's coming" list. */
  readonly upcomingDispatches = computed(() =>
    this.activeSchedules()
      .filter((schedule) => schedule.nextRunAt !== null)
      .sort((a, b) => new Date(a.nextRunAt as string).getTime() - new Date(b.nextRunAt as string).getTime())
      .slice(0, DISPATCH_PREVIEW_LIMIT),
  );

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

  /** Compact weekday + date + time, e.g. «dl., 8 de juny, 09:00» — short enough to sit beside a
   *  title in the card without wrapping, unlike the app's long `formatDateTime`. */
  dispatchLabel(nextRunAt: string): string {
    return new Date(nextRunAt).toLocaleString('ca-ES', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

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

    this.schedulesLoading.set(true);
    this.notificationService.getSchedules({ isActive: true, page: 1, limit: SCHEDULE_FETCH_LIMIT }).subscribe({
      next: (response) => {
        this.activeSchedules.set(response.data);
        this.activeScheduleCount.set(response.meta.total);
        this.schedulesLoading.set(false);
      },
      error: () => {
        this.schedulesLoading.set(false);
        this.toast.error('Error en carregar les notificacions programades.');
      },
    });
  }
}
