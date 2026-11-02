import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Search } from 'lucide-angular';
import { UserDevicesSummary } from '@muixer/shared';
import { DOMAIN_ICONS, EmptyStateComponent, InputComponent } from '@muixer/ui';
import { PageHeaderComponent } from '../../../../shared/components/data/page-header/page-header.component';
import { PaginationComponent } from '../../../../shared/components/data/pagination/pagination.component';
import { DataTableComponent } from '../../../../shared/components/data/data-table/data-table.component';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { UserDevicesService } from '../../services/user-devices.service';
import { UserDevicesModalComponent } from '../user-devices-modal/user-devices-modal.component';

/** «Pendent fins al dd/MM», «Caducada» or empty when the account has no invite. */
export function inviteLabel(invite: UserDevicesSummary['invite']): string {
  if (!invite) return '';
  if (invite.status === 'EXPIRED') return 'Caducada';
  const d = new Date(invite.expiresAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `Pendent fins al ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('ca-ES', { dateStyle: 'short', timeStyle: 'short' });
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

  constructor() {
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
    this.api
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
