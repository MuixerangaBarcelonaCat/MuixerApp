import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../core/auth/services/auth.service';

function passwordsMatchValidator(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirmPassword = group.get('confirmPassword')?.value;
  return password === confirmPassword ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-reset-password',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, LucideAngularModule],
  templateUrl: './reset-password.component.html',
})
export class ResetPasswordComponent {
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  private readonly token = this.route.snapshot.queryParamMap.get('token');

  readonly missingToken = signal(!this.token);

  readonly form = this.fb.nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required, Validators.minLength(8)]],
    },
    { validators: passwordsMatchValidator },
  );

  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  /**
   * Stays on this page instead of redirecting to /login: this page is served from the
   * Dashboard, but the same reset-password link is sent to PWA members too — auto-navigating
   * to the Dashboard login would silently strand them on the wrong app.
   */
  readonly resetSuccess = signal(false);

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
        this.errorMessage.set('L\'enllaç de recuperació no és vàlid o ha caducat.');
      },
    });
  }
}
