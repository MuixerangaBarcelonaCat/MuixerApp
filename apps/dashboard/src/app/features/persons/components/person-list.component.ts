import { Component, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PersonService } from '../services/person.service';
import { Person, Position, PersonFilterParams } from '../models/person.model';
import {
  getFullName,
  getAvailabilityLabel,
  getContrastColor,
} from '../../../shared/utils';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
  ],
  templateUrl: './person-list.component.html',
  styleUrls: ['./person-list.component.scss'],
})
export class PersonListComponent {
  private readonly personService = inject(PersonService);
  private readonly router = inject(Router);

  Math = Math;

  searchInput = '';
  positionFilter = '';

  search = signal('');
  activeFilters = signal<Partial<PersonFilterParams>>({});
  page = signal(1);
  limit = signal(50);

  persons = signal<Person[]>([]);
  totalPersons = signal(0);
  positions = signal<Position[]>([]);
  loading = signal(false);

  totalPages = computed(() => Math.ceil(this.totalPersons() / this.limit()));

  pageNumbers = computed(() => {
    const total = this.totalPages();
    const current = this.page();
    
    if (total <= 12) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const pages: (number | 'ellipsis')[] = [];
    
    // Always show first page
    pages.push(1);
    
    // Calculate range around current page
    const rangeStart = Math.max(2, current - 2);
    const rangeEnd = Math.min(total - 1, current + 2);
    
    // Add ellipsis after first page if needed
    if (rangeStart > 2) {
      pages.push('ellipsis');
    }
    
    // Add pages around current
    for (let i = rangeStart; i <= rangeEnd; i++) {
      pages.push(i);
    }
    
    // Add ellipsis before last page if needed
    if (rangeEnd < total - 1) {
      pages.push('ellipsis');
    }
    
    // Always show last page
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

  onFilterChange() {
    this.page.set(1);
    this.loadPersons();
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
    this.positionFilter = '';
    this.search.set('');
    this.activeFilters.set({});
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

  private loadPersons() {
    this.loading.set(true);

    const filters: PersonFilterParams = {
      search: this.search() || undefined,
      positionId: this.positionFilter || undefined,
      page: this.page(),
      limit: this.limit(),
      ...this.activeFilters(),
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

  // Expose utility functions for template
  readonly getFullName = getFullName;
  readonly getAvailabilityLabel = getAvailabilityLabel;
  readonly getContrastColor = getContrastColor;
}
