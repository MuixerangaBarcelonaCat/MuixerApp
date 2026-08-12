import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DependentRegistrationRequest, PendingDependent, PersonRegistrationData } from '@muixer/shared';
import { DependentsService } from '../../../core/services/dependents.service';
import { PersonDataFieldsComponent } from '../../../shared/components/person-data-fields/person-data-fields.component';
import { buildPersonDataFormGroup, combinePhoneNumber } from '../../../shared/utils/person-data-form.util';

/** A provisional Xicalla may not have its personal-data fields set yet — treat nulls as blank prefill. */
function toPrefill(dependent: PendingDependent): Partial<PersonRegistrationData> {
  return {
    name: dependent.name,
    firstSurname: dependent.firstSurname,
    secondSurname: dependent.secondSurname ?? undefined,
    gender: dependent.gender ?? undefined,
    phone: dependent.phone ?? undefined,
    birthDate: dependent.birthDate ?? undefined,
  };
}

@Component({
  selector: 'app-pending-dependents',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, PersonDataFieldsComponent],
  templateUrl: './pending-dependents.component.html',
})
export class PendingDependentsComponent {
  private readonly dependentsService = inject(DependentsService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  private readonly pending = signal<PendingDependent[]>([]);
  readonly initialTotal = signal(0);
  readonly loading = signal(true);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly current = signal<PendingDependent | null>(null);
  /** 1-indexed position of `current` within the original pending set, for "X de Y" copy. */
  readonly position = computed(() => this.initialTotal() - this.pending().length + 1);
  form = buildPersonDataFormGroup(this.fb.nonNullable);

  constructor() {
    this.load(true);
  }

  onSubmit(): void {
    const dependent = this.current();
    if (this.form.invalid || this.isSubmitting() || !dependent) return;

    const { name, firstSurname, secondSurname, gender, country, phoneNumber, birthDate } =
      this.form.getRawValue();
    const phone = combinePhoneNumber(country, phoneNumber);
    if (!phone) {
      this.errorMessage.set('El telèfon introduït no és vàlid.');
      return;
    }

    const payload: DependentRegistrationRequest = {
      personId: dependent.personId,
      name,
      firstSurname,
      secondSurname: secondSurname || undefined,
      gender: gender as DependentRegistrationRequest['gender'],
      phone,
      birthDate,
    };

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    this.dependentsService.completePending(payload).subscribe({
      next: () => this.load(false),
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(
          err?.error?.message ?? 'No s\'ha pogut desar. Torneu-ho a provar.',
        );
      },
    });
  }

  private load(isFirstLoad: boolean): void {
    this.loading.set(true);
    this.dependentsService.getPending().subscribe({
      next: (pending) => {
        this.pending.set(pending);
        if (isFirstLoad) this.initialTotal.set(pending.length);
        const next = pending[0] ?? null;
        this.current.set(next);
        this.form = buildPersonDataFormGroup(this.fb.nonNullable, next ? toPrefill(next) : undefined);
        this.loading.set(false);
        this.isSubmitting.set(false);
        if (!next) this.router.navigate(['/home']);
      },
      error: () => {
        this.loading.set(false);
        this.isSubmitting.set(false);
        this.errorMessage.set('No s\'han pogut carregar els dependents pendents.');
      },
    });
  }
}
