import { Component, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { PersonService } from '../services/person.service';
import { Person, Position, PersonFilterParams, PersonSortOrder } from '../models/person.model';
import {
  getFullName,
  getAvailabilityLabel,
  getOnboardingLabel,
  formatDate,
  formatShoulderHeightCm,
  formatShoulderHeightRelative,
  SHOULDER_HEIGHT_BASELINE_CM,
} from '../../../shared/utils';
import { PageHeaderComponent } from '../../../shared/components/data/page-header/page-header.component';
import { FilterBarComponent } from '../../../shared/components/data/filter-bar/filter-bar.component';
import { ActiveFiltersComponent } from '../../../shared/components/data/active-filters/active-filters.component';
import { ColumnToggleComponent } from '../../../shared/components/data/column-toggle/column-toggle.component';
import { PaginationComponent } from '../../../shared/components/data/pagination/pagination.component';
import { EmptyStateComponent } from '../../../shared/components/data/empty-state/empty-state.component';
import { DataTableComponent, RowAction } from '../../../shared/components/data/data-table/data-table.component';
import { ActiveFilter } from '../../../shared/components/data/active-filters/active-filters.component';
import { ColumnDef } from '../../../shared/models/column-def.model';

const STORAGE_KEY = 'person-list-visible-columns';

export const ALL_COLUMNS: ColumnDef[] = [
  { key: 'alias', label: 'Alies', defaultVisible: true, sortField: 'alias' },
  { key: 'fullName', label: 'Nom complet', defaultVisible: true, sortField: 'name' },
  { key: 'email', label: 'Correu', defaultVisible: false, sortField: 'email' },
  { key: 'phone', label: 'Telèfon', defaultVisible: false, sortField: 'phone' },
  { key: 'birthDate', label: 'Data naixement', defaultVisible: false, sortField: 'birthDate' },
  { key: 'shoulderHeight', label: 'Alçada', defaultVisible: false, sortField: 'shoulderHeight' },
  { key: 'positions', label: 'Posicions', defaultVisible: true },
  { key: 'availability', label: 'Pot participar', defaultVisible: false, sortField: 'availability' },
  { key: 'onboardingStatus', label: 'Acollida', defaultVisible: false, sortField: 'onboardingStatus' },
  { key: 'isActive', label: 'Actiu', defaultVisible: true, sortField: 'isActive' },
  { key: 'isMember', label: 'Membre', defaultVisible: false, sortField: 'isMember' },
  { key: 'isXicalla', label: 'Xicalla', defaultVisible: false, sortField: 'isXicalla' },
  { key: 'shirtDate', label: 'Data samarreta', defaultVisible: false, sortField: 'shirtDate' },
  { key: 'notes', label: 'Notes', defaultVisible: false },
  { key: 'createdAt', label: 'Creat', defaultVisible: false, sortField: 'createdAt' },
  { key: 'updatedAt', label: 'Actualitzat', defaultVisible: false, sortField: 'updatedAt' },
];

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
  templateUrl: './person-list.component.html',
})
export class PersonListComponent {
  private readonly personService = inject(PersonService);
  private readonly router = inject(Router);

  Math = Math;

  readonly allColumns = ALL_COLUMNS;
  readonly shoulderBaselineCm = SHOULDER_HEIGHT_BASELINE_CM;

  searchInput = '';

  search = signal('');
  selectedPositions = signal<string[]>([]);
  activeFilters = signal<Partial<PersonFilterParams>>({ isProvisional: false });
  provisionalTab = signal<'cens' | 'provisionals' | 'tots'>('cens');
  page = signal(1);
  limit = signal(50);

  sortBy = signal<string | undefined>(undefined);
  sortOrder = signal<PersonSortOrder | undefined>(undefined);

  shoulderHeightRelative = signal(true);

  visibleColumnKeys = signal<string[]>(this.loadVisibleColumns());

  persons = signal<Person[]>([]);
  totalPersons = signal(0);
  positions = signal<Position[]>([]);
  loading = signal(false);

  totalPages = computed(() => Math.ceil(this.totalPersons() / this.limit()));

  hasFilterChips = computed(() => {
    const s = this.search().trim();
    const pos = this.selectedPositions().length > 0;
    const actius = this.activeFilters().isActive === true;
    return Boolean(s || pos || actius);
  });

  private searchTimeout: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.loadPositions();
    this.loadPersons();
  }

  onSearchChange(value: string) {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.search.set(value);
      this.page.set(1);
      this.loadPersons();
    }, 300);
  }

  togglePosition(id: string) {
    const current = this.selectedPositions();
    const updated = current.includes(id) ? current.filter((pId) => pId !== id) : [...current, id];

    this.selectedPositions.set(updated);
    this.activeFilters.update((filters) => ({
      ...filters,
      positionIds: updated.length > 0 ? updated : undefined,
    }));
    this.page.set(1);
    this.loadPersons();
  }

  toggleActiusFilter() {
    this.toggleFilter('isActive', true);
  }

  toggleFilter(key: keyof PersonFilterParams, value: string | boolean | number) {
    const current = this.activeFilters();
    if (current[key] === value) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [key]: _removed, ...rest } = current;
      this.activeFilters.set(rest);
    } else {
      this.activeFilters.set({ ...current, [key]: value });
    }
    this.page.set(1);
    this.loadPersons();
  }

  clearFilters() {
    this.searchInput = '';
    this.selectedPositions.set([]);
    this.search.set('');
    this.activeFilters.set({});
    this.page.set(1);
    this.loadPersons();
  }

  clearSearchChip() {
    this.searchInput = '';
    this.search.set('');
    this.page.set(1);
    this.loadPersons();
  }

  clearPositionsChip() {
    this.selectedPositions.set([]);
    this.activeFilters.update((f) => ({ ...f, positionIds: undefined }));
    this.page.set(1);
    this.loadPersons();
  }

  clearActiusChip() {
    this.activeFilters.update((f) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { isActive: _a, ...rest } = f;
      return rest;
    });
    this.page.set(1);
    this.loadPersons();
  }

  onLimitChange(raw: string | number) {
    const n = typeof raw === 'string' ? Number(raw) : raw;
    if (![25, 50, 100].includes(n)) {
      return;
    }
    this.limit.set(n);
    this.page.set(1);
    this.loadPersons();
  }

  goToPage(pageNumber: number) {
    if (pageNumber >= 1 && pageNumber <= this.totalPages() && pageNumber !== this.page()) {
      this.page.set(pageNumber);
      this.loadPersons();
    }
  }

  setProvisionalTab(tab: 'cens' | 'provisionals' | 'tots') {
    this.provisionalTab.set(tab);
    const isProvisional: boolean | undefined =
      tab === 'cens' ? false : tab === 'provisionals' ? true : undefined;
    this.activeFilters.update((f) => {
      const { isProvisional: _, ...rest } = f;
      return isProvisional !== undefined ? { ...rest, isProvisional } : rest;
    });
    this.page.set(1);
    this.loadPersons();
  }

  onPersonClick(id: string) {
    this.router.navigate(['/persons', id]);
  }

  onSyncClick() {
    this.router.navigate(['/persons/sync-start']);
  }

  formatShoulderHeightDisplay(value: number | null): string {
    if (value === null || value === 0) {
      return '—';
    }
    if (this.shoulderHeightRelative()) {
      return formatShoulderHeightRelative(value, this.shoulderBaselineCm);
    }
    return formatShoulderHeightCm(value);
  }

  private loadPersons() {
    this.loading.set(true);

    const sortBy = this.sortBy();
    const sortOrder = this.sortOrder();

    const filters: PersonFilterParams = {
      search: this.search() || undefined,
      page: this.page(),
      limit: this.limit(),
      ...this.activeFilters(),
      ...(sortBy && sortOrder ? { sortBy, sortOrder } : {}),
    };

    this.personService.getAll(filters).subscribe({
      next: (response) => {
        this.persons.set(response.data);
        this.totalPersons.set(response.meta.total);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading persons', err);
        this.loading.set(false);
      },
    });
  }

  private loadPositions() {
    this.personService.getPositions().subscribe({
      next: (positions) => this.positions.set(positions),
      error: (err) => console.error('Error loading positions', err),
    });
  }

  toggleColumn(key: string) {
    const current = this.visibleColumnKeys();
    const updated = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
    this.visibleColumnKeys.set(updated);
    this.saveVisibleColumns(updated);
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

  /** Active filter chips for app-active-filters */
  readonly activeFilterChips = computed<ActiveFilter[]>(() => {
    const chips: ActiveFilter[] = [];
    if (this.search().trim()) chips.push({ key: 'search', label: `Cerca: "${this.search()}"` });
    if (this.selectedPositions().length > 0) chips.push({ key: 'positions', label: `Posicions (${this.selectedPositions().length})` });
    if (this.activeFilters().isActive === true) chips.push({ key: 'isActive', label: 'Actius' });
    return chips;
  });

  /** Row actions for the data table */
  readonly tableRowActions: RowAction<Person>[] = [
    { label: 'Veure detall', icon: 'Eye', action: (p) => this.router.navigate(['/persons', p.id]) },
  ];

  onRemoveFilterChip(key: string): void {
    if (key === 'search') this.clearSearchChip();
    else if (key === 'positions') this.clearPositionsChip();
    else if (key === 'isActive') this.clearActiusChip();
  }

  onSortChangeFromTable(event: { field: string; order: 'ASC' | 'DESC' | undefined }): void {
    this.sortBy.set(event.order ? event.field : undefined);
    this.sortOrder.set(event.order);
    this.page.set(1);
    this.loadPersons();
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
    this.loadPersons();
  }

  getCellValueForPerson(person: Person, key: string): string {
    switch (key) {
      case 'fullName': return getFullName(person);
      case 'alias': return person.alias || '—';
      case 'positions': return person.positions?.map(p => p.name).join(', ') || '—';
      case 'availability': return getAvailabilityLabel(person.availability);
      case 'onboardingStatus': return getOnboardingLabel(person.onboardingStatus);
      case 'shoulderHeight': return this.formatShoulderHeightDisplay(person.shoulderHeight);
      case 'isActive': return person.isActive ? 'Actiu' : 'Inactiu';
      case 'isMember': return person.isMember ? 'Sí' : 'No';
      case 'isXicalla': return person.isXicalla ? 'Sí' : 'No';
      case 'birthDate': return person.birthDate ? formatDate(person.birthDate) : '—';
      case 'shirtDate': return person.shirtDate ? formatDate(person.shirtDate) : '—';
      case 'createdAt': return formatDate(person.createdAt);
      case 'updatedAt': return formatDate(person.updatedAt);
      default: return (person as unknown as Record<string, unknown>)[key] as string ?? '—';
    }
  }

  /** All columns with value extractors — data-table handles visibility via visibleColumns input */
  readonly tableColumns = computed<ColumnDef<Person>[]>(() =>
    ALL_COLUMNS.map(col => ({
      ...col,
      value: (person: Person) => this.getCellValueForPerson(person, col.key),
    }))
  );
}
