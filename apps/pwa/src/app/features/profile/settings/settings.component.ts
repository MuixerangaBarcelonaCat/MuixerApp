import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { LegalDocumentType } from '@muixer/shared';
import { LucideAngularModule, Lock, Bell, FileText, LogOut, ChevronDown } from 'lucide-angular';
import { MobileHeaderComponent } from '../../../shared/components/mobile-header/mobile-header.component';
import { PushSettingsComponent } from '../components/push-settings/push-settings.component';
import { AuthService } from '../../../core/auth/services/auth.service';
import { ProfileService } from '../services/profile.service';
import { ToastService } from '@muixer/ui';
import { LegalDocumentService } from '../../../core/services/legal-document.service';

type SettingsSection = 'password' | 'about';

function passwordsMatchValidator(group: AbstractControl): ValidationErrors | null {
  const newPassword = group.get('newPassword')?.value;
  const confirmPassword = group.get('confirmPassword')?.value;
  return newPassword === confirmPassword ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, ReactiveFormsModule, MobileHeaderComponent, PushSettingsComponent],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
})
export class SettingsComponent {
  private readonly auth = inject(AuthService);
  private readonly profileService = inject(ProfileService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly legalDocumentService = inject(LegalDocumentService);

  protected readonly Lock = Lock;
  protected readonly Bell = Bell;
  protected readonly FileText = FileText;
  protected readonly LogOut = LogOut;
  protected readonly ChevronDown = ChevronDown;

  protected readonly passwordForm = this.fb.nonNullable.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatchValidator },
  );
  protected readonly passwordSubmitting = signal(false);
  protected readonly passwordError = signal<string | null>(null);

  protected submitPasswordChange(): void {
    if (this.passwordForm.invalid || this.passwordSubmitting()) return;

    this.passwordSubmitting.set(true);
    this.passwordError.set(null);

    const { currentPassword, newPassword } = this.passwordForm.getRawValue();
    this.profileService.changePassword({ currentPassword, newPassword }).subscribe({
      next: () => {
        this.passwordSubmitting.set(false);
        this.toast.success('Contrasenya actualitzada correctament.');
        this.auth.logout().subscribe({
          complete: () => this.router.navigate(['/login']),
        });
      },
      error: (err: HttpErrorResponse) => {
        this.passwordSubmitting.set(false);
        this.passwordError.set(
          err.status === 401
            ? 'Contrasenya actual incorrecta.'
            : "No s'ha pogut actualitzar la contrasenya. Torneu-ho a provar.",
        );
      },
    });
  }

  protected readonly openSection = signal<SettingsSection | null>(null);
  protected readonly privacyPolicyContent = signal<string | null>(null);
  protected readonly privacyPolicyLoading = signal(false);

  protected toggleSection(section: SettingsSection): void {
    const opening = this.openSection() !== section;
    this.openSection.set(opening ? section : null);
    if (!opening || section !== 'about' || this.privacyPolicyContent() !== null) return;

    this.privacyPolicyLoading.set(true);
    this.legalDocumentService.getActive(LegalDocumentType.PRIVACY_POLICY).subscribe({
      next: (doc) => {
        this.privacyPolicyContent.set(doc.content);
        this.privacyPolicyLoading.set(false);
      },
      error: () => this.privacyPolicyLoading.set(false),
    });
  }

  protected logout(): void {
    this.auth.logout().subscribe({
      complete: () => this.router.navigate(['/login']),
    });
  }
}
