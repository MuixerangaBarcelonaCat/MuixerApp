import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { DeviceSummary } from '@muixer/shared';
import { NotificationService } from '../../services/notification.service';
import { PageHeaderComponent } from '../../../../shared/components/data/page-header/page-header.component';
import { EmptyStateComponent } from '../../../../shared/components/data/empty-state/empty-state.component';

@Component({
  selector: 'app-device-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, DatePipe, LucideAngularModule, PageHeaderComponent, EmptyStateComponent],
  templateUrl: './device-list.component.html',
})
export class DeviceListComponent implements OnInit {
  private readonly notificationService = inject(NotificationService);

  summary = signal<DeviceSummary[]>([]);
  loading = signal(true);
  error = signal(false);
  search = signal('');
  sortBy = signal<'devices' | 'lastUse'>('devices');

  readonly filtered = computed(() => {
    const q = this.search().toLowerCase().trim();
    let list = this.summary();
    if (q) {
      list = list.filter((d) => {
        const name = `${d.person.firstName} ${d.person.lastName}`.toLowerCase();
        return name.includes(q);
      });
    }
    if (this.sortBy() === 'devices') {
      list = [...list].sort((a, b) => b.activeDevices - a.activeDevices);
    } else {
      list = [...list].sort((a, b) => {
        if (!a.lastPushAt) return 1;
        if (!b.lastPushAt) return -1;
        return b.lastPushAt.localeCompare(a.lastPushAt);
      });
    }
    return list;
  });

  readonly totalDevices = computed(() =>
    this.summary().reduce((sum, d) => sum + d.activeDevices, 0),
  );

  ngOnInit(): void {
    this.notificationService.getDeviceSummary().subscribe({
      next: (data) => {
        this.summary.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }
}
