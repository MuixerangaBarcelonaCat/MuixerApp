import { Component, ChangeDetectionStrategy, inject, signal, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponent, InputComponent, ModalComponent } from '@muixer/ui';
import { PersonService } from '../../services/person.service';
import { Person } from '../../models/person.model';

@Component({
  selector: 'app-person-new-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ButtonComponent, InputComponent, ModalComponent],
  templateUrl: './person-new-modal.component.html',
})
export class PersonNewModalComponent {
  private readonly personService = inject(PersonService);

  closed = output<void>();
  created = output<Person>();

  alias = signal('');
  creating = signal(false);
  error = signal<string | null>(null);

  close() {
    if (this.creating()) return;
    this.closed.emit();
  }

  create() {
    const alias = this.alias().trim();
    if (!alias || this.creating()) return;

    this.creating.set(true);
    this.error.set(null);

    this.personService.createProvisional(alias).subscribe({
      next: (person) => {
        this.creating.set(false);
        this.created.emit(person);
      },
      error: (err) => {
        this.creating.set(false);
        this.error.set(err?.error?.message ?? 'Error en crear la persona');
      },
    });
  }
}
