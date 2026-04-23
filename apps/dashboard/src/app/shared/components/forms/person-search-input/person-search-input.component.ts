import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  inject,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PersonService } from '../../../../features/persons/services/person.service';
import { Person } from '../../../../features/persons/models/person.model';

@Component({
  selector: 'app-person-search-input',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './person-search-input.component.html',
})
export class PersonSearchInputComponent implements OnDestroy {
  private readonly personService = inject(PersonService);

  placeholder = input('Cerca persona...');
  excludeIds = input<string[]>([]);

  selected = output<Person>();

  searchText = '';
  results = signal<Person[]>([]);
  open = signal(false);
  loading = signal(false);

  private debounceTimer: ReturnType<typeof setTimeout> | undefined;

  onInput(value: string) {
    this.searchText = value;
    clearTimeout(this.debounceTimer);

    if (!value.trim()) {
      this.results.set([]);
      this.open.set(false);
      return;
    }

    this.loading.set(true);
    this.debounceTimer = setTimeout(() => {
      this.personService.getAll({ search: value, limit: 10, isActive: true }).subscribe({
        next: (resp) => {
          const excludeSet = new Set(this.excludeIds());
          this.results.set(resp.data.filter((p) => !excludeSet.has(p.id)));
          this.open.set(true);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    }, 300);
  }

  selectPerson(person: Person) {
    this.searchText = '';
    this.results.set([]);
    this.open.set(false);
    this.selected.emit(person);
  }

  closeDropdown() {
    setTimeout(() => this.open.set(false), 150);
  }

  ngOnDestroy() {
    clearTimeout(this.debounceTimer);
  }
}
