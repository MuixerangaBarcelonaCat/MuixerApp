import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { NotificationScheduleEntry, NotificationTarget, NotificationTargetType } from '@muixer/shared';
import { AlertComponent, BadgeComponent, ButtonComponent, EmptyStateComponent, ModalComponent, ToastService } from '@muixer/ui';
import { NotificationService } from '../../services/notification.service';
import { PageHeaderComponent } from '../../../../shared/components/data/page-header/page-header.component';
import { PaginationComponent } from '../../../../shared/components/data/pagination/pagination.component';
import { DOMAIN_ICONS } from '../../../../shared/constants/domain-icons';

type ActiveFilter = 'pending' | 'all';

@Component({
  selector: 'app-notification-schedule-list',
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
    ModalComponent,
  ],
  templateUrl: './notification-schedule-list.component.html',
})
export class NotificationScheduleListComponent implements OnInit {
  readonly ICON_BELL = DOMAIN_ICONS.BELL;

  private readonly notificationService = inject(NotificationService);
  private readonly toast = inject(ToastService);

  readonly items = signal<NotificationScheduleEntry[]>([]);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly page = signal(1);
  readonly limit = signal(25);
  readonly total = signal(0);
  readonly activeFilter = signal<ActiveFilter>('pending');
  readonly cancelTarget = signal<NotificationScheduleEntry | null>(null);
  readonly cancelling = signal(false);

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

  onActiveFilterChange(filter: ActiveFilter): void {
    this.activeFilter.set(filter);
    this.page.set(1);
    this.reload();
  }

  targetSummary(target: NotificationTarget): string {
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

  scheduledFor(entry: NotificationScheduleEntry): string {
    return 'scheduledFor' in entry.ruleConfig ? entry.ruleConfig.scheduledFor : '';
  }

  confirmCancel(entry: NotificationScheduleEntry): void {
    this.cancelTarget.set(entry);
  }

  closeCancel(): void {
    this.cancelTarget.set(null);
  }

  executeCancel(): void {
    const target = this.cancelTarget();
    if (!target || this.cancelling()) return;

    this.cancelling.set(true);
    this.notificationService.cancelSchedule(target.id).subscribe({
      next: () => {
        this.cancelling.set(false);
        this.cancelTarget.set(null);
        this.toast.success('Notificació programada cancel·lada.');
        this.reload();
      },
      error: (err) => {
        this.cancelling.set(false);
        this.cancelTarget.set(null);
        this.toast.error(err?.error?.message ?? 'Error en cancel·lar la notificació.');
      },
    });
  }

  private reload(): void {
    this.loading.set(true);
    this.error.set(false);
    this.notificationService
      .getSchedules({
        isActive: this.activeFilter() === 'pending' ? true : undefined,
        page: this.page(),
        limit: this.limit(),
      })
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
