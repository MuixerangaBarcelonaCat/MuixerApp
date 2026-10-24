import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { AlertComponent, ButtonComponent, ModalComponent } from '@muixer/ui';
import { PersonDelegateItem, PersonDelegateService } from '../../../services/person-delegate.service';
import {
  ResponsiblePickerComponent,
  ResponsibleSelection,
} from '../../responsible-picker/responsible-picker.component';

/** Links a person's responsible (their primary delegate), chosen by person rather than by account. */
@Component({
  selector: 'app-responsible-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AlertComponent, ButtonComponent, ModalComponent, ResponsiblePickerComponent],
  template: `
    <lib-modal [open]="true" title="Defineix la persona responsable" (closed)="close()">
      @if (error()) {
        <div class="mb-4">
          <lib-alert variant="error" dense>{{ error() }}</lib-alert>
        </div>
      }

      <app-responsible-picker
        [personId]="personId()"
        [isXicalla]="isXicalla()"
        (selectionChange)="selection.set($event)"
      />

      <div modalFooter>
        <lib-button variant="ghost" size="sm" [disabled]="saving()" (clicked)="close()">Cancel·la</lib-button>
        <lib-button variant="primary" size="sm" [disabled]="!selection()" [loading]="saving()" (clicked)="save()">
          Vincula
        </lib-button>
      </div>
    </lib-modal>
  `,
})
export class ResponsibleModalComponent {
  private readonly delegateService = inject(PersonDelegateService);

  personId = input.required<string>();
  isXicalla = input.required<boolean>();

  closed = output<void>();
  saved = output<PersonDelegateItem>();

  protected readonly selection = signal<ResponsibleSelection | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  close(): void {
    if (this.saving()) return;
    this.closed.emit();
  }

  save(): void {
    const selection = this.selection();
    if (!selection || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    this.delegateService
      .createDelegate(this.personId(), {
        responsiblePersonId: selection.person.id,
        delegateType: selection.delegateType,
        isPrimary: true,
      })
      .subscribe({
        next: (delegate) => {
          this.saving.set(false);
          this.saved.emit(delegate);
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err?.error?.message ?? "No s'ha pogut vincular la persona responsable.");
        },
      });
  }
}
