import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { NotificationScheduleEntry, NotificationScheduleType, NotificationTarget, NotificationTargetType } from '@muixer/shared';
import { AlertComponent, BadgeComponent, ButtonComponent, EmptyStateComponent, ModalComponent, ToastService } from '@muixer/ui';
import { NotificationService } from '../../services/notification.service';
import { PageHeaderComponent } from '../../../../shared/components/data/page-header/page-header.component';
import { PaginationComponent } from '../../../../shared/components/data/pagination/pagination.component';
import { DOMAIN_ICONS } from '../../../../shared/constants/domain-icons';
import { WEEKDAY_NAMES } from '../../utils/weekday-names';

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
  readonly ScheduleType = NotificationScheduleType;

  private readonly notificationService = inject(NotificationService);
  private readonly toast = inject(ToastService);
  // Matches the app's default (unregistered) LOCALE_ID — the same one every other `| date` in
  // this app implicitly uses, since no locale data beyond en-US is registered.
  private readonly datePipe = new DatePipe('en-US');

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

  ruleSummary(entry: NotificationScheduleEntry): string {
    const rule = entry.ruleConfig;
    if ('scheduledFor' in rule) {
      return this.datePipe.transform(rule.scheduledFor, 'dd/MM/yyyy HH:mm') ?? '—';
    }
    if ('dayOfWeek' in rule) {
      let summary = `Cada ${WEEKDAY_NAMES[rule.dayOfWeek]} a les ${rule.timeOfDay}`;
      const bounds = [
        rule.startDate ? `des del ${this.datePipe.transform(rule.startDate, 'dd/MM/yyyy')}` : null,
        rule.endDate ? `fins al ${this.datePipe.transform(rule.endDate, 'dd/MM/yyyy')}` : null,
      ].filter((part): part is string => part !== null);
      if (bounds.length > 0) {
        summary += ` (${bounds.join(' ')})`;
      }
      return summary;
    }
    return '—';
  }

  statusLabel(entry: NotificationScheduleEntry): string {
    if (!entry.isActive) return 'Inactiva';
    return entry.scheduleType === NotificationScheduleType.WEEKLY ? 'Activa' : 'Pendent';
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
