import { Component, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PersonService } from '../services/person.service';
import { Person, Position, PersonFilterParams, PersonSortOrder } from '../models/person.model';
import {
  getFullName,
  getAvailabilityLabel,
  getOnboardingLabel,
  getContrastColor,
  formatDate,
  formatShoulderHeightCm,
  formatShoulderHeightRelative,
  shoulderHeightRelativeTone,
  SHOULDER_HEIGHT_BASELINE_CM,
  type ShoulderHeightTone,
} from '../../../shared/utils';

export interface ColumnDef {
  key: string;
  label: string;
  defaultVisible: boolean;
  /** API `sortBy` field name; omit if not sortable */
  sortField?: string;
}

const STORAGE_KEY = 'person-list-visible-columns';

export const ALL_COLUMNS: ColumnDef[] = [
  { key: 'alias', label: 'Alies', defaultVisible: true, sortField: 'alias' },
  { key: 'fullName', label: 'Nom complet', defaultVisible: true, sortField: 'name' },
  { key: 'email', label: 'Correu', defaultVisible: false, sortField: 'email' },
  { key: 'phone', label: 'Telèfon', defaultVisible: false, sortField: 'phone' },
  { key: 'birthDate', label: 'Data naixement', defaultVisible: false, sortField: 'birthDate' },
  { key: 'shoulderHeight', label: 'Alçada', defaultVisible: false, sortField: 'shoulderHeight' },
  { key: 'positions', label: 'Posicions', defaultVisible: true },
  { key: 'availability', label: 'Disponibilitat', defaultVisible: false, sortField: 'availability' },
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
  imports: [CommonModule, FormsModule],
  templateUrl: './person-list.component.html',
  styleUrls: ['./person-list.component.scss'],
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
  activeFilters = signal<Partial<PersonFilterParams>>({});
  page = signal(1);
  limit = signal(50);

  sortBy = signal<string | undefined>(undefined);
  sortOrder = signal<PersonSortOrder | undefined>(undefined);

  shoulderHeightRelative = signal(true);

  visibleColumnKeys = signal<string[]>(this.loadVisibleColumns());

  visibleColumns = computed(() => {
    const keys = this.visibleColumnKeys();
    return ALL_COLUMNS.filter((c) => keys.includes(c.key));
  });

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

  pageNumbers = computed(() => {
    const total = this.totalPages();
    const current = this.page();

    if (total <= 12) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const pages: (number | 'ellipsis')[] = [];

    pages.push(1);

    const rangeStart = Math.max(2, current - 2);
    const rangeEnd = Math.min(total - 1, current + 2);

    if (rangeStart > 2) {
      pages.push('ellipsis');
    }

    for (let i = rangeStart; i <= rangeEnd; i++) {
      pages.push(i);
    }

    if (rangeEnd < total - 1) {
      pages.push('ellipsis');
    }

    if (total > 1) {
      pages.push(total);
    }

    return pages;
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

  previousPage() {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
      this.loadPersons();
    }
  }

  nextPage() {
    if (this.page() < this.totalPages()) {
      this.page.update((p) => p + 1);
      this.loadPersons();
    }
  }

  goToPage(pageNumber: number) {
    if (pageNumber >= 1 && pageNumber <= this.totalPages() && pageNumber !== this.page()) {
      this.page.set(pageNumber);
      this.loadPersons();
    }
  }

  onPersonClick(id: string) {
    this.router.navigate(['/persons', id]);
  }

  onSyncClick() {
    this.router.navigate(['/persons/sync']);
  }

  onSortColumn(col: ColumnDef) {
    if (!col.sortField) {
      return;
    }
    const field = col.sortField;
    const currentField = this.sortBy();
    const currentOrder = this.sortOrder();

    if (currentField !== field) {
      this.sortBy.set(field);
      this.sortOrder.set('ASC');
    } else if (currentOrder === 'ASC') {
      this.sortOrder.set('DESC');
    } else {
      this.sortBy.set(undefined);
      this.sortOrder.set(undefined);
    }
    this.page.set(1);
    this.loadPersons();
  }

  sortStateForColumn(col: ColumnDef): 'none' | 'asc' | 'desc' {
    if (!col.sortField || this.sortBy() !== col.sortField) {
      return 'none';
    }
    return this.sortOrder() === 'DESC' ? 'desc' : 'asc';
  }

  columnHeaderLabel(col: ColumnDef): string {
    if (col.key === 'shoulderHeight') {
      return 'Alçada';
      // return this.shoulderHeightRelative()
      //   ? `Alçada espatlles (+/- ${this.shoulderBaselineCm})`
      //   : 'Alçada espatlles (cm)';
    }
    return col.label;
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

  shoulderHeightTone(value: number | null): ShoulderHeightTone {
    if (!this.shoulderHeightRelative()) {
      return 'empty';
    }
    return shoulderHeightRelativeTone(value, this.shoulderBaselineCm);
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

  isColumnVisible(key: string): boolean {
    return this.visibleColumnKeys().includes(key);
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

  readonly getFullName = getFullName;
  readonly getAvailabilityLabel = getAvailabilityLabel;
  readonly getOnboardingLabel = getOnboardingLabel;
  readonly getContrastColor = getContrastColor;
  readonly formatDate = formatDate;
}
