import { Component, ChangeDetectionStrategy, inject, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { UserRole } from '@muixer/shared';
import { ThemePickerComponent } from '@muixer/ui';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { AboutAppModalComponent } from '../../about-app-modal/about-app-modal.component';

const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Admin',
  [UserRole.TECHNICAL]: 'Tècnica',
  [UserRole.MEMBER]: 'Membre',
};

const ROLE_BADGE_CLASS: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'badge-error',
  [UserRole.TECHNICAL]: 'badge-warning',
  [UserRole.MEMBER]: 'badge-info',
};

@Component({
  selector: 'app-user-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ThemePickerComponent, AboutAppModalComponent],
  templateUrl: './user-chip.component.html',
})
export class UserChipComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly user = this.auth.currentUser;

  readonly displayName = computed(() => {
    const u = this.user();
    if (!u) return null;
    return u.person?.alias || u.person?.name || u.email;
  });

  readonly roleLabel = computed(() => {
    const role = this.auth.userRole();
    return role ? ROLE_LABELS[role] : null;
  });

  readonly roleBadgeClass = computed(() => {
    const role = this.auth.userRole();
    return role ? ROLE_BADGE_CLASS[role] : 'badge-ghost';
  });

  readonly initials = computed(() => {
    const u = this.user();
    if (!u) return '?';
    if (u.person?.name) return u.person.name.charAt(0).toUpperCase();
    return u.email.charAt(0).toUpperCase();
  });

  readonly aboutOpen = signal(false);

  openAbout(): void {
    // Drop focus so the CSS-only dropdown closes behind the modal.
    (document.activeElement as HTMLElement | null)?.blur();
    this.aboutOpen.set(true);
  }

  logout(): void {
    this.auth.logout().subscribe({
      complete: () => this.router.navigate(['/login']),
    });
  }
}
