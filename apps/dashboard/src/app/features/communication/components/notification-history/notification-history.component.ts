import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { NotificationLogEntry, NotificationSource, NotificationTargetType } from '@muixer/shared';
import { AlertComponent, BadgeComponent, ButtonComponent, EmptyStateComponent } from '@muixer/ui';
import { NotificationService } from '../../services/notification.service';
import { PageHeaderComponent } from '../../../../shared/components/data/page-header/page-header.component';
import { PaginationComponent } from '../../../../shared/components/data/pagination/pagination.component';
import { DOMAIN_ICONS } from '../../../../shared/constants/domain-icons';

const SOURCE_LABELS: Record<NotificationSource, string> = {
  [NotificationSource.MANUAL]: 'Manual',
  [NotificationSource.SCHEDULED_ONE_OFF]: 'Programada',
  [NotificationSource.SCHEDULED_WEEKLY]: 'Setmanal',
  [NotificationSource.SCHEDULED_BEFORE_EVENT]: 'Abans de l’esdeveniment',
};

@Component({
  selector: 'app-notification-history',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    RouterLink,
    LucideAngularModule,
    PageHeaderComponent,
    PaginationComponent,
    AlertComponent,
    BadgeComponent,
    ButtonComponent,
    EmptyStateComponent,
  ],
  templateUrl: './notification-history.component.html',
})
export class NotificationHistoryComponent implements OnInit {
  readonly ICON_BELL = DOMAIN_ICONS.BELL;
  readonly sourceLabels = SOURCE_LABELS;
  readonly sourceOptions = Object.values(NotificationSource);

  private readonly notificationService = inject(NotificationService);

  readonly items = signal<NotificationLogEntry[]>([]);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly page = signal(1);
  readonly limit = signal(25);
  readonly total = signal(0);
  readonly sourceFilter = signal<NotificationSource | ''>('');

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.limit())));

  ngOnInit(): void {
    this.reload();
  }

  onPageChange(page: number): void {
    this.page.set(page);
    this.reload();
  }

  onLimitChange(limit: number): void {
    this.limit.set(limit);
    this.page.set(1);
    this.reload();
  }

  onSourceChange(source: NotificationSource | ''): void {
    this.sourceFilter.set(source);
    this.page.set(1);
    this.reload();
  }

  targetSummary(target: NotificationLogEntry['target']): string {
    switch (target.type) {
      case NotificationTargetType.ALL:
        return 'Tothom';
      case NotificationTargetType.PERSON:
        return `${target.personIds?.length ?? 0} persones`;
      case NotificationTargetType.EVENT_ATTENDANCE:
        return 'Esdeveniment';
      default:
        return '—';
    }
  }

  private reload(): void {
    this.loading.set(true);
    this.error.set(false);
    this.notificationService
      .getHistory({ source: this.sourceFilter() || undefined, page: this.page(), limit: this.limit() })
      .subscribe({
        next: (response) => {
          this.items.set(response.data);
          this.total.set(response.meta.total);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }
}
