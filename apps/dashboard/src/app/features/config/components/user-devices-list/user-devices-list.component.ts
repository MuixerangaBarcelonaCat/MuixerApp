import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { formatDate } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Search } from 'lucide-angular';
import { UserDevicesSummary } from '@muixer/shared';
import { DOMAIN_ICONS, EmptyStateComponent, InputComponent } from '@muixer/ui';
import { PageHeaderComponent } from '../../../../shared/components/data/page-header/page-header.component';
import { PaginationComponent } from '../../../../shared/components/data/pagination/pagination.component';
import { DataTableComponent } from '../../../../shared/components/data/data-table/data-table.component';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { UserDevicesService } from '../../services/user-devices.service';
import { DEVICE_DATE_FORMAT, UserDevicesModalComponent } from '../user-devices-modal/user-devices-modal.component';

/** «Pendent fins al dd/MM», «Caducada» or empty when the account has no invite. */
export function inviteLabel(invite: UserDevicesSummary['invite']): string {
  if (!invite) return '';
  if (invite.status === 'EXPIRED') return 'Caducada';
  const d = new Date(invite.expiresAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `Pendent fins al ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

/** Same format as the devices modal, so a timestamp reads the same in the list and the modal. */
function formatDateTime(value: string | null): string {
  return value ? formatDate(value, DEVICE_DATE_FORMAT, 'en-US') : '—';
}

const PWA_RECENT_MS = 30 * 24 * 60 * 60 * 1000;

/** The install timestamp refreshes daily while the app is opened installed, so an old date likely means uninstalled. */
function pwaState(r: UserDevicesSummary): 'recent' | 'stale' | 'never' {
  if (!r.pwaInstalledAt) return 'never';
  return Date.now() - Date.parse(r.pwaInstalledAt) <= PWA_RECENT_MS ? 'recent' : 'stale';
}

const COLUMNS: ColumnDef<UserDevicesSummary>[] = [
  { key: 'alias', label: 'Àlies', defaultVisible: true, sortField: 'alias', primary: true, value: (r) => r.person?.alias ?? '—' },
  {
    key: 'user',
    label: 'Usuari',
    defaultVisible: true,
    sortField: 'email',
    value: (r) => [r.person ? `${r.person.name} ${r.person.firstSurname}` : null, r.email].filter(Boolean).join(' · ') || '—',
  },
  {
    key: 'push',
    label: 'Notificacions',
    type: 'badge',
    defaultVisible: true,
    // On = at least one active push subscription; sorting by device count groups on/off.
    sortField: 'activeDevices',
    value: (r) => (r.activeDevices > 0 ? 'Activades' : 'Desactivades'),
    badgeClass: (r) => (r.activeDevices > 0 ? 'badge-success' : 'badge-ghost'),
  },
  {
    key: 'pwa',
    label: 'App instal·lada',
    type: 'badge',
    defaultVisible: true,
    sortField: 'pwaInstalledAt',
    value: (r) => {
      const state = pwaState(r);
      if (state === 'never') return 'No';
      return state === 'recent' ? 'Sí' : `Fa temps (${formatDateTime(r.pwaInstalledAt)})`;
    },
    badgeClass: (r) => {
      const state = pwaState(r);
      if (state === 'never') return 'badge-ghost';
      return state === 'recent' ? 'badge-success' : 'badge-warning';
    },
  },
  { key: 'activeSessions', label: 'Sessions', defaultVisible: true, sortField: 'activeSessions', value: (r) => r.activeSessions },
  { key: 'activeDevices', label: 'Dispositius', defaultVisible: true, sortField: 'activeDevices', value: (r) => r.activeDevices },
  { key: 'lastAccessAt', label: 'Darrer accés', defaultVisible: true, sortField: 'lastAccessAt', value: (r) => formatDateTime(r.lastAccessAt) },
  { key: 'lastPushAt', label: 'Darrera notificació', defaultVisible: true, sortField: 'lastPushAt', value: (r) => formatDateTime(r.lastPushAt) },
  { key: 'invite', label: 'Invitació', defaultVisible: true, value: (r) => inviteLabel(r.invite) },
];

@Component({
  selector: 'app-user-devices-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    PageHeaderComponent,
    PaginationComponent,
    DataTableComponent,
    EmptyStateComponent,
    InputComponent,
    UserDevicesModalComponent,
  ],
  templateUrl: './user-devices-list.component.html',
})
export class UserDevicesListComponent {
  private readonly api = inject(UserDevicesService);

  readonly columns = COLUMNS;
  readonly visibleColumns = COLUMNS.map((c) => c.key);
  readonly SearchIcon = Search;
  readonly ICON_EMPTY = DOMAIN_ICONS.PERSONA;

  searchInput = '';
  readonly search = signal('');
  readonly page = signal(1);
  readonly limit = signal(25);
  readonly sortBy = signal<string | undefined>(undefined);
  readonly sortOrder = signal<'ASC' | 'DESC' | undefined>(undefined);

  readonly rows = signal<UserDevicesSummary[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly totalPages = computed(() => Math.ceil(this.total() / this.limit()));

  readonly selected = signal<UserDevicesSummary | null>(null);

  private searchTimeout: ReturnType<typeof setTimeout> | undefined;
  /** The in-flight summary request: a newer load cancels it, so an older answer never lands last. */
  private loadSub?: Subscription;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.searchTimeout);
      this.loadSub?.unsubscribe();
    });
    this.load();
  }

  onSearchChange(value: string): void {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.search.set(value);
      this.page.set(1);
      this.load();
    }, 300);
  }

  onSortChange(event: { field: string; order: 'ASC' | 'DESC' | undefined }): void {
    this.sortBy.set(event.order ? event.field : undefined);
    this.sortOrder.set(event.order);
    this.page.set(1);
    this.load();
  }

  goToPage(page: number): void {
    this.page.set(page);
    this.load();
  }

  onLimitChange(raw: string | number): void {
    this.limit.set(Number(raw));
    this.page.set(1);
    this.load();
  }

  modalLabel(row: UserDevicesSummary): string {
    return row.person?.alias ?? row.email ?? '';
  }

  /** The modal may have revoked sessions or removed devices: refresh the counts. */
  closeModal(): void {
    this.selected.set(null);
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(false);
    const sortBy = this.sortBy();
    const sortOrder = this.sortOrder();
    this.loadSub?.unsubscribe();
    this.loadSub = this.api
      .summary({
        search: this.search() || undefined,
        page: this.page(),
        limit: this.limit(),
        ...(sortBy && sortOrder ? { sortBy, sortOrder } : {}),
      })
      .subscribe({
        next: (res) => {
          this.rows.set(res.data);
          this.total.set(res.meta.total);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }
}
