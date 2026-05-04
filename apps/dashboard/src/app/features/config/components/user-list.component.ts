import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { UserService } from '../services/user.service';
import { UserDto, UserFilterParams, UserSortOrder } from '../models/user.model';
import { UserRole } from '@muixer/shared';
import { PageHeaderComponent } from '../../../shared/components/data/page-header/page-header.component';
import { FilterBarComponent } from '../../../shared/components/data/filter-bar/filter-bar.component';
import {
  ActiveFiltersComponent,
  ActiveFilter,
} from '../../../shared/components/data/active-filters/active-filters.component';
import { ColumnToggleComponent } from '../../../shared/components/data/column-toggle/column-toggle.component';
import { PaginationComponent } from '../../../shared/components/data/pagination/pagination.component';
import { EmptyStateComponent } from '../../../shared/components/data/empty-state/empty-state.component';
import {
  DataTableComponent,
  RowAction,
} from '../../../shared/components/data/data-table/data-table.component';
import { ColumnDef } from '../../../shared/models/column-def.model';
import { EventListItem } from '@app/features/events/models/event.model';

const STORAGE_KEY = 'user-list-visible-columns';

export const ALL_COLUMNS: ColumnDef[] = [
  { key: 'email', label: 'Correu', defaultVisible: true, sortField: 'email' },
  { key: 'person', label: 'Persona', defaultVisible: true },
  { key: 'role', label: 'Rol', defaultVisible: true, sortField: 'role' },
  {
    key: 'isActive',
    label: 'Actiu',
    defaultVisible: true,
    sortField: 'isActive',
  },
  { key: 'inviteExpiresAt', label: 'Invitació expira', defaultVisible: false },
  {
    key: 'createdAt',
    label: 'Creat',
    defaultVisible: false,
    sortField: 'createdAt',
  },
  {
    key: 'updatedAt',
    label: 'Actualitzat',
    defaultVisible: false,
    sortField: 'updatedAt',
  },
];

const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Administrador',
  [UserRole.TECHNICAL]: 'Tècnica',
  [UserRole.MEMBER]: 'Membre',
};

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('ca-ES');
}

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    LucideAngularModule,
    PageHeaderComponent,
    FilterBarComponent,
    ActiveFiltersComponent,
    ColumnToggleComponent,
    PaginationComponent,
    EmptyStateComponent,
    DataTableComponent,
  ],
  templateUrl: './user-list.component.html',
})
export class UserListComponent {
  private readonly userService = inject(UserService);

  readonly allColumns = ALL_COLUMNS;
  readonly UserRole = UserRole;
  readonly roleOptions = Object.values(UserRole);
  readonly roleLabels = ROLE_LABELS;

  searchInput = '';

  search = signal('');
  activeFilters = signal<Partial<UserFilterParams>>({});
  page = signal(1);
  limit = signal(25);

  sortBy = signal<string | undefined>(undefined);
  sortOrder = signal<UserSortOrder | undefined>(undefined);

  visibleColumnKeys = signal<string[]>(this.loadVisibleColumns());

  users = signal<UserDto[]>([]);
  totalUsers = signal(0);
  loading = signal(false);

  // Grant role modal state
  grantRoleUser = signal<UserDto | null>(null);
  grantRoleSelected = signal<UserRole | null>(null);
  grantRoleLoading = signal(false);

  totalPages = computed(() => Math.ceil(this.totalUsers() / this.limit()));

  hasFilterChips = computed(() => {
    const s = this.search().trim();
    const role = this.activeFilters().role;
    const isActive = this.activeFilters().isActive === true;
    return Boolean(s || role || isActive);
  });

  private searchTimeout: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.loadUsers();
  }

  onSearchChange(value: string) {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.search.set(value);
      this.page.set(1);
      this.loadUsers();
    }, 300);
  }

  toggleRoleFilter(role: UserRole) {
    const current = this.activeFilters();
    if (current.role === role) {
      const { role: _r, ...rest } = current;
      this.activeFilters.set(rest);
    } else {
      this.activeFilters.set({ ...current, role });
    }
    this.page.set(1);
    this.loadUsers();
  }

  toggleActiusFilter() {
    const current = this.activeFilters();
    if (current.isActive === true) {
      const { isActive: _a, ...rest } = current;
      this.activeFilters.set(rest);
    } else {
      this.activeFilters.set({ ...current, isActive: true });
    }
    this.page.set(1);
    this.loadUsers();
  }

  clearFilters() {
    this.searchInput = '';
    this.search.set('');
    this.activeFilters.set({});
    this.page.set(1);
    this.loadUsers();
  }

  clearSearchChip() {
    this.searchInput = '';
    this.search.set('');
    this.page.set(1);
    this.loadUsers();
  }

  clearRoleChip() {
    const { role: _r, ...rest } = this.activeFilters();
    this.activeFilters.set(rest);
    this.page.set(1);
    this.loadUsers();
  }

  clearActiusChip() {
    const { isActive: _a, ...rest } = this.activeFilters();
    this.activeFilters.set(rest);
    this.page.set(1);
    this.loadUsers();
  }

  onLimitChange(raw: string | number) {
    const n = typeof raw === 'string' ? Number(raw) : raw;
    if (![25, 50, 100].includes(n)) return;
    this.limit.set(n);
    this.page.set(1);
    this.loadUsers();
  }

  goToPage(pageNumber: number) {
    if (
      pageNumber >= 1 &&
      pageNumber <= this.totalPages() &&
      pageNumber !== this.page()
    ) {
      this.page.set(pageNumber);
      this.loadUsers();
    }
  }

  onSortChangeFromTable(event: {
    field: string;
    order: 'ASC' | 'DESC' | undefined;
  }): void {
    this.sortBy.set(event.order ? event.field : undefined);
    this.sortOrder.set(event.order);
    this.page.set(1);
    this.loadUsers();
  }

  onSortColumn(col: { key: string; sortField?: string }): void {
    if (!col.sortField) return;
    if (this.sortBy() !== col.sortField) {
      this.sortBy.set(col.sortField);
      this.sortOrder.set('ASC');
    } else if (this.sortOrder() === 'ASC') {
      this.sortOrder.set('DESC');
    } else {
      this.sortBy.set(undefined);
      this.sortOrder.set(undefined);
    }
    this.page.set(1);
    this.loadUsers();
  }

  toggleColumn(key: string) {
    const current = this.visibleColumnKeys();
    const updated = current.includes(key)
      ? current.filter((k) => k !== key)
      : [...current, key];
    this.visibleColumnKeys.set(updated);
    this.saveVisibleColumns(updated);
  }

  // Grant role modal
  openGrantRole(user: UserDto) {
    this.grantRoleUser.set(user);
    this.grantRoleSelected.set(user.role);
    this.grantRoleLoading.set(false);
  }

  closeGrantRole() {
    this.grantRoleUser.set(null);
    this.grantRoleSelected.set(null);
  }

  confirmGrantRole() {
    const user = this.grantRoleUser();
    const role = this.grantRoleSelected();
    if (!user || !role || role === user.role) {
      this.closeGrantRole();
      return;
    }
    this.grantRoleLoading.set(true);
    this.userService.grantRole(user.id, role).subscribe({
      next: (updated) => {
        this.users.update((list) =>
          list.map((u) => (u.id === updated.id ? updated : u)),
        );
        this.grantRoleLoading.set(false);
        this.closeGrantRole();
      },
      error: () => {
        this.grantRoleLoading.set(false);
      },
    });
  }

  getCellValue(user: UserDto, key: string): string {
    switch (key) {
      case 'email':
        return user.email;
      case 'person':
        return user.person
          ? `${user.person.alias} · ${user.person.name} ${user.person.firstSurname}`
          : '—';
      case 'role':
        return ROLE_LABELS[user.role] ?? user.role;
      case 'isActive':
        return user.isActive ? 'Actiu' : 'Inactiu';
      case 'inviteExpiresAt':
        return formatDate(user.inviteExpiresAt);
      case 'createdAt':
        return formatDate(user.createdAt);
      case 'updatedAt':
        return formatDate(user.updatedAt);
      default:
        return (
          ((user as unknown as Record<string, unknown>)[key] as string) ?? '—'
        );
    }
  }

  readonly tableColumns = computed<ColumnDef<UserDto>[]>(() =>
    ALL_COLUMNS.map((col) => ({
      ...col,
      value: (user: UserDto) => this.getCellValue(user, col.key),
    })),
  );

  readonly tableRowActions = computed<RowAction<UserDto>[]>(() => [
    {
      label: 'Assignar rol',
      // icon: 'Shield',
      action: (u: UserDto) => this.openGrantRole(u),
    },
  ]);

  readonly activeFilterChips = computed<ActiveFilter[]>(() => {
    const chips: ActiveFilter[] = [];
    if (this.search().trim())
      chips.push({ key: 'search', label: `Cerca: "${this.search()}"` });
    const role = this.activeFilters().role;
    if (role) chips.push({ key: 'role', label: `Rol: ${ROLE_LABELS[role]}` });
    if (this.activeFilters().isActive === true)
      chips.push({ key: 'isActive', label: 'Sols actius' });
    return chips;
  });

  onRemoveFilterChip(key: string): void {
    if (key === 'search') this.clearSearchChip();
    else if (key === 'role') this.clearRoleChip();
    else if (key === 'isActive') this.clearActiusChip();
  }

  private loadUsers() {
    this.loading.set(true);
    const sortBy = this.sortBy();
    const sortOrder = this.sortOrder();
    const filters: UserFilterParams = {
      search: this.search() || undefined,
      page: this.page(),
      limit: this.limit(),
      ...this.activeFilters(),
      ...(sortBy && sortOrder ? { sortBy, sortOrder } : {}),
    };
    this.userService.getAll(filters).subscribe({
      next: (response) => {
        this.users.set(response.data);
        this.totalUsers.set(response.total);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading users', err);
        this.loading.set(false);
      },
    });
  }

  private loadVisibleColumns(): string[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored) as string[];
    } catch {
      /* noop */
    }
    return ALL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key);
  }

  private saveVisibleColumns(keys: string[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  }
}
