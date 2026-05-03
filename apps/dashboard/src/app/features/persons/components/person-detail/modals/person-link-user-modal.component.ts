import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  input,
  output,
} from '@angular/core';
import { PersonService } from '../../../services/person.service';
import { Person } from '../../../models/person.model';

@Component({
  selector: 'app-person-link-user-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './person-link-user-modal.component.html',
})
export class PersonLinkUserModalComponent {
  private readonly personService = inject(PersonService);

  person = input.required<Person>();

  closed = output<void>();
  success = output<void>();

  search = signal('');
  results = signal<Person[]>([]);
  searching = signal(false);
  selected = signal<Person | null>(null);
  linking = signal(false);
  error = signal<string | null>(null);

  private searchTimeout: ReturnType<typeof setTimeout> | null = null;

  close() {
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
    this.closed.emit();
  }

  onSearchInput(value: string) {
    this.search.set(value);
    this.selected.set(null);
    if (this.searchTimeout) clearTimeout(this.searchTimeout);

    if (!value.trim()) {
      this.results.set([]);
      return;
    }

    this.searchTimeout = setTimeout(() => {
      this.searching.set(true);
      this.personService
        .getAll({ search: value.trim(), isActive: true })
        .subscribe({
          next: (res) => {
            this.results.set(res.data ?? res);
            this.searching.set(false);
          },
          error: () => {
            this.searching.set(false);
          },
        });
    }, 300);
  }

  selectPerson(p: Person) {
    this.selected.set(p);
    this.search.set(p.alias);
  }

  link() {
    const selected = this.selected();
    if (!selected || this.linking()) return;

    if (!selected.managedBy) {
      this.error.set('La persona seleccionada no té un usuari associat');
      return;
    }

    this.linking.set(true);
    this.error.set(null);

    this.personService
      .update(this.person().id, { managedById: selected.managedBy.id })
      .subscribe({
        next: () => {
          this.linking.set(false);
          this.success.emit();
        },
        error: (err) => {
          this.linking.set(false);
          this.error.set(
            err?.error?.message ?? "Error en enllaçar amb l'usuari",
          );
        },
      });
  }
}
