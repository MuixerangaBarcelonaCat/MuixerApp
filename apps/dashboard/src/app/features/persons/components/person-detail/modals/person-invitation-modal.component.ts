import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  input,
  output,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { PersonService } from '../../../services/person.service';
import { Person } from '../../../models/person.model';
import { ToastService } from '../../../../../shared/components/feedback/toast/toast.service';

@Component({
  selector: 'app-person-invitation-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './person-invitation-modal.component.html',
})
export class PersonInvitationModalComponent {
  private readonly personService = inject(PersonService);
  private readonly toast = inject(ToastService);

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
        this.toast.success("S'ha enviat la invitació per correu electrònic");
        this.success.emit();
      },
      error: (err: HttpErrorResponse) => {
        this.sending.set(false);
        const message = this.formatInviteError(err);
        this.error.set(message);
        this.toast.error(message);
      },
    });
  }

  private formatInviteError(err: HttpErrorResponse): string {
    const body = err.error as { message?: string; retryAfterSeconds?: number } | null;

    if (err.status === 429 && body?.retryAfterSeconds) {
      const waitMinutes = Math.max(1, Math.ceil(body.retryAfterSeconds / 60));
      return `Cal esperar ${waitMinutes} min abans de tornar a enviar la invitació`;
    }

    return body?.message ?? 'Error en enviar la invitació';
  }
}
