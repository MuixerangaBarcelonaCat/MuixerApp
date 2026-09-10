import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AlertCircle, CheckCircle, Lock, LucideAngularModule } from 'lucide-angular';
import { InputComponent } from '@muixer/ui';
import { AuthService } from '../../../core/auth/services/auth.service';

function passwordsMatchValidator(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirmPassword = group.get('confirmPassword')?.value;
  return password === confirmPassword ? null : { passwordMismatch: true };
}

/**
 * Pantalla de contrasenya nova dins la PWA. El dashboard té la seua pròpia bessona per al flux
 * per correu; esta existeix perquè l'enllaç de recuperació que genera un tècnic va dirigit a un
 * membre, i acabar al dashboard (una altra app, amb un altre login) és exactament la confusió
 * que el flux vol evitar.
 */
@Component({
  selector: 'app-reset-password',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, LucideAngularModule, InputComponent],
  templateUrl: './reset-password.component.html',
})
export class ResetPasswordComponent {
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  protected readonly AlertCircle = AlertCircle;
  protected readonly CheckCircle = CheckCircle;
  protected readonly Lock = Lock;

  private readonly token = this.route.snapshot.queryParamMap.get('token');

  readonly missingToken = signal(!this.token);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly resetSuccess = signal(false);
  protected readonly logoError = signal(false);

  readonly form = this.fb.nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required, Validators.minLength(8)]],
    },
    { validators: passwordsMatchValidator },
  );

  onSubmit(): void {
    if (this.form.invalid || this.isLoading() || !this.token) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const { password } = this.form.getRawValue();
    this.authService.resetPassword(this.token, password).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.resetSuccess.set(true);
      },
      error: () => {
        this.isLoading.set(false);
        this.errorMessage.set("L'enllaç no és vàlid o ha caducat. Demana'n un de nou a un tècnic.");
      },
    });
  }
}
