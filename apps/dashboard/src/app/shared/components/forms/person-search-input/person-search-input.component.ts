import {
  Component,
  ChangeDetectionStrategy,
  computed,
  input,
  output,
  signal,
  inject,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Search } from 'lucide-angular';
import { BadgeComponent, DOMAIN_ICONS } from '@muixer/ui';
import { PersonService } from '../../../../features/persons/services/person.service';
import { Person } from '../../../../features/persons/models/person.model';

const FLOATING_CLASS = 'absolute z-dropdown mt-1 shadow-overlay';
const INLINE_CLASS = 'mt-2';

@Component({
  selector: 'app-person-search-input',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, LucideAngularModule, BadgeComponent],
  templateUrl: './person-search-input.component.html',
})
export class PersonSearchInputComponent implements OnDestroy {
  private readonly personService = inject(PersonService);

  protected readonly SearchIcon = Search;
  protected readonly ICON_XICALLA = DOMAIN_ICONS.XICALLA;

  placeholder = input('Cerca persona...');
  excludeIds = input<string[]>([]);
  /** Restricts results to xicalla (`true`) or adults (`false`), by the effective value; unset = both. */
  isXicalla = input<boolean>();
  /**
   * Lay the results out in the flow instead of floating them. Needed inside a scrolling container
   * such as `lib-modal`'s body, which would clip a floating list; an overlay can't help there,
   * since the native <dialog> sits in the top layer above anything attached to the page.
   */
  inline = input(false);
  protected readonly dropdownClass = computed(() => (this.inline() ? INLINE_CLASS : FLOATING_CLASS));

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
      const isXicalla = this.isXicalla();
      this.personService
        .getAll({ search: value, limit: 10, isActive: true, ...(isXicalla === undefined ? {} : { isXicalla }) })
        .subscribe({
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
