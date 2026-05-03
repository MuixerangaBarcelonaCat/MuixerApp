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
  selector: 'app-person-invitation-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './person-invitation-modal.component.html',
})
export class PersonInvitationModalComponent {
  private readonly personService = inject(PersonService);

  person = input.required<Person>();

  closed = output<void>();
  success = output<void>();

  email = signal('');
  sending = signal(false);
  error = signal<string | null>(null);

  close() {
    this.closed.emit();
  }

  send() {
    const email = this.email().trim();
    if (!email || this.sending()) return;

    this.sending.set(true);
    this.error.set(null);

    this.personService.sendInvitation(this.person().id, email).subscribe({
      next: () => {
        this.sending.set(false);
        this.success.emit();
      },
      error: (err) => {
        this.sending.set(false);
        this.error.set(err?.error?.message ?? 'Error en enviar la invitació');
      },
    });
  }
}
