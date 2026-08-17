import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideAngularModule, AlertCircle } from 'lucide-angular';
import { InviteRegistrationContext, RegisterViaInviteRequest } from '@muixer/shared';
import { AuthService } from '../../../core/auth/services/auth.service';
import { PersonDataFieldsComponent } from '../../../shared/components/person-data-fields/person-data-fields.component';
import { buildPersonDataFormGroup, combinePhoneNumber } from '../../../shared/utils/person-data-form.util';

function passwordsMatchValidator(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirmPassword = group.get('confirmPassword')?.value;
  return password === confirmPassword ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-activate',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, LucideAngularModule, PersonDataFieldsComponent],
  templateUrl: './activate.component.html',
})
export class ActivateComponent {
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly AlertCircle = AlertCircle;

  private readonly token = this.route.snapshot.queryParamMap.get('token');

  readonly invalidLink = signal(!this.token);
  readonly loading = signal(!!this.token);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly context = signal<InviteRegistrationContext | null>(null);

  readonly form = this.fb.nonNullable.group(
    {
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required, Validators.minLength(8)]],
      personalData: buildPersonDataFormGroup(this.fb.nonNullable),
      legalAccepted: [false, Validators.requiredTrue],
    },
    { validators: passwordsMatchValidator },
  );

  constructor() {
    if (!this.token) return;

    this.authService.getInviteContext(this.token).subscribe({
      next: (context) => {
        this.context.set(context);
        this.form.controls.personalData.patchValue({
          name: context.person.name,
          firstSurname: context.person.firstSurname,
          secondSurname: context.person.secondSurname ?? '',
          gender: context.person.gender ?? '',
        });
        this.loading.set(false);
      },
      error: () => {
        this.invalidLink.set(true);
        this.loading.set(false);
      },
    });
  }

  onSubmit(): void {
    if (this.form.invalid || this.isSubmitting() || !this.token) return;

    const { email, password, personalData, legalAccepted } = this.form.getRawValue();
    const phone = combinePhoneNumber(personalData.country, personalData.phoneNumber);
    if (!phone) {
      this.errorMessage.set('El telèfon introduït no és vàlid.');
      return;
    }

    const payload: RegisterViaInviteRequest = {
      token: this.token,
      email,
      password,
      legalAccepted,
      name: personalData.name,
      firstSurname: personalData.firstSurname,
      secondSurname: personalData.secondSurname || undefined,
      gender: personalData.gender as RegisterViaInviteRequest['gender'],
      phone,
      birthDate: personalData.birthDate,
    };

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    this.authService.registerViaInvite(payload).subscribe({
      next: () => this.router.navigate(['/home']),
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(
          err?.error?.message ?? 'No s\'ha pogut completar el registre. Torneu-ho a provar.',
        );
      },
    });
  }
}
