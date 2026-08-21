import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { LucideAngularModule, Search } from 'lucide-angular';
import { DeviceSummary } from '@muixer/shared';
import { BadgeComponent, ButtonComponent, ButtonGroupComponent, EmptyStateComponent, InputComponent } from '@muixer/ui';
import { NotificationService } from '../../services/notification.service';
import { PageHeaderComponent } from '../../../../shared/components/data/page-header/page-header.component';
import { DOMAIN_ICONS } from '../../../../shared/constants/domain-icons';

@Component({
  selector: 'app-device-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    DatePipe,
    LucideAngularModule,
    PageHeaderComponent,
    BadgeComponent,
    ButtonComponent,
    ButtonGroupComponent,
    EmptyStateComponent,
    InputComponent,
  ],
  templateUrl: './device-list.component.html',
})
export class DeviceListComponent implements OnInit {
  readonly ICON_SEARCH = Search;
  readonly ICON_SMARTPHONE = DOMAIN_ICONS.SMARTPHONE;

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
