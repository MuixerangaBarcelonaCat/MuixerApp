import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  output,
  signal,
  effect,
  computed,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { UserRole } from '@muixer/shared';
import { UserService } from '../../services/user.service';
import { UserDto } from '../../models/user.model';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';
import { PersonSearchInputComponent } from '../../../../shared/components/forms/person-search-input/person-search-input.component';
import { Person } from '../../../../features/persons/models/person.model';

@Component({
  selector: 'app-user-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, PersonSearchInputComponent],
  templateUrl: './user-form-modal.component.html',
})
export class UserFormModalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly userService = inject(UserService);
  private readonly toast = inject(ToastService);

  readonly user = input<UserDto | null>(null);
  readonly saved = output<UserDto>();
  readonly cancelled = output<void>();

  readonly saving = signal(false);
  readonly linkedPerson = signal<Person | null>(null);
  readonly personWarning = signal<string | null>(null);

  readonly roleOptions: UserRole[] = [UserRole.TECHNICAL, UserRole.ADMIN];
  readonly roleLabels: Record<string, string> = {
    [UserRole.TECHNICAL]: 'Tècnica',
    [UserRole.ADMIN]: 'Administrador',
  };

  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    role: [UserRole.TECHNICAL as UserRole, Validators.required],
  });

  readonly isEditMode = computed(() => !!this.user());

  constructor() {
    effect(() => {
      const editUser = this.user();
      if (editUser) {
        this.form.patchValue({
          email: editUser.email,
          role: editUser.role,
        });
        this.form.get('password')!.clearValidators();
        this.form.get('password')!.updateValueAndValidity();
        if (editUser.person) {
          this.linkedPerson.set({
            id: editUser.person.id,
            alias: editUser.person.alias,
            name: editUser.person.name,
            firstSurname: editUser.person.firstSurname,
            secondSurname: editUser.person.secondSurname,
          } as Person);
        }
      } else {
        this.form.reset({ role: UserRole.TECHNICAL });
        this.form.get('password')!.setValidators([
          Validators.required,
          Validators.minLength(8),
        ]);
        this.form.get('password')!.updateValueAndValidity();
        this.linkedPerson.set(null);
      }
    });
  }

  onPersonSelected(person: Person): void {
    this.linkedPerson.set(person);
    this.personWarning.set(null);

    if (person.managedBy) {
      this.personWarning.set(
        'Aquesta persona ja està vinculada a un altre usuari.',
      );
      return;
    }

    if (person.email && !this.form.get('email')!.value) {
      this.form.get('email')!.setValue(person.email);
    }
  }

  clearLinkedPerson(): void {
    this.linkedPerson.set(null);
    this.personWarning.set(null);
  }

  onSave(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);

    const raw = this.form.getRawValue();
    const person = this.linkedPerson();

    if (this.isEditMode()) {
      const editUser = this.user()!;
      this.userService
        .update(editUser.id, {
          email: raw.email !== editUser.email ? raw.email! : undefined,
          role: raw.role !== editUser.role ? raw.role! : undefined,
          personId: person ? person.id : (editUser.person ? null : undefined),
        })
        .subscribe({
          next: (updated) => {
            this.saving.set(false);
            this.toast.success('Usuari actualitzat correctament.');
            this.saved.emit(updated);
          },
          error: (err) => {
            this.saving.set(false);
            const msg =
              err?.error?.message ?? "Error en actualitzar l'usuari.";
            this.toast.error(msg);
          },
        });
    } else {
      this.userService
        .create({
          email: raw.email!,
          password: raw.password!,
          role: raw.role!,
          personId: person?.id,
        })
        .subscribe({
          next: (created) => {
            this.saving.set(false);
            this.toast.success('Usuari creat correctament.');
            this.saved.emit(created);
          },
          error: (err) => {
            this.saving.set(false);
            const msg = err?.error?.message ?? "Error en crear l'usuari.";
            this.toast.error(msg);
          },
        });
    }
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}
