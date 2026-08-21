import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { LegalDocument, LegalDocumentType, UserRole } from '@muixer/shared';
import { SettingsComponent } from './settings.component';
import { ProfileService } from '../services/profile.service';
import { AuthService } from '../../../core/auth/services/auth.service';
import { LegalDocumentService } from '../../../core/services/legal-document.service';
import { ToastService } from '@muixer/ui';

const PRIVACY_POLICY: LegalDocument = {
  id: 'd-1',
  type: LegalDocumentType.PRIVACY_POLICY,
  version: 1,
  content: 'Contingut de la política de privacitat.',
  isActive: true,
  requiresConsent: true,
  publishedAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function setInputValue(el: HTMLInputElement, value: string): void {
  el.value = value;
  el.dispatchEvent(new Event('input'));
}

function createTestBed() {
  const profileService = {
    changePassword: vi.fn().mockReturnValue(of(undefined)),
    changeEmail: vi.fn(),
  };
  const authService = {
    currentUser: () => ({
      id: 'u-1',
      email: 'a@a.com',
      role: UserRole.MEMBER,
      isActive: true,
      person: null,
    }),
    logout: vi.fn().mockReturnValue(of(undefined)),
    setCurrentUser: vi.fn(),
  };
  const legalDocumentService = {
    getActive: vi.fn().mockReturnValue(of(PRIVACY_POLICY)),
  };
  const toastService = {
    success: vi.fn(),
    error: vi.fn(),
  };

  TestBed.configureTestingModule({
    imports: [SettingsComponent],
    providers: [
      provideRouter([]),
      { provide: ProfileService, useValue: profileService },
      { provide: AuthService, useValue: authService },
      { provide: LegalDocumentService, useValue: legalDocumentService },
      { provide: ToastService, useValue: toastService },
    ],
  });

  return { profileService, authService, legalDocumentService, toastService };
}

describe('SettingsComponent', () => {
  let fixture: ComponentFixture<SettingsComponent>;

  describe('layout', () => {
    beforeEach(async () => {
      createTestBed();
      await TestBed.compileComponents();
      fixture = TestBed.createComponent(SettingsComponent);
      fixture.detectChanges();
    });

    it('renders the header title', () => {
      expect(fixture.nativeElement.textContent).toContain('Configuració');
    });

    it('renders a back button', () => {
      expect(fixture.nativeElement.querySelector('button[aria-label="Torna enrere"]')).toBeTruthy();
    });

    it('renders all setting rows', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain('Contrasenya');
      expect(text).toContain('Correu electrònic');
      expect(text).toContain('Notificacions');
      expect(text).toContain("Sobre l'app");
      expect(text).toContain('Tancar sessió');
    });

    it('renders the notifications row showing push is unsupported in JSDOM', () => {
      const row = fixture.nativeElement.querySelector('[data-testid="notifications-row"]');
      expect(row).toBeTruthy();
      expect(row.textContent).toContain('Notificacions');
      expect(row.textContent).toContain('No disponibles en aquest dispositiu');
      expect(row.querySelector('[aria-disabled="true"]')).toBeTruthy();
    });
  });

  describe('password change', () => {
    let profileService: ReturnType<typeof createTestBed>['profileService'];
    let authService: ReturnType<typeof createTestBed>['authService'];
    let toastService: ReturnType<typeof createTestBed>['toastService'];

    beforeEach(async () => {
      ({ profileService, authService, toastService } = createTestBed());
      await TestBed.compileComponents();
      fixture = TestBed.createComponent(SettingsComponent);
      fixture.detectChanges();
    });

    function openSection(): void {
      (
        fixture.nativeElement.querySelector('[data-testid="password-row-toggle"]') as HTMLButtonElement
      ).click();
      fixture.detectChanges();
    }

    function fillForm(
      currentPassword: string,
      newPassword: string,
      confirmPassword: string = newPassword,
    ): void {
      openSection();
      setInputValue(
        fixture.nativeElement.querySelector('#password-current-password'),
        currentPassword,
      );
      setInputValue(fixture.nativeElement.querySelector('#password-new-password'), newPassword);
      const confirmInput = fixture.nativeElement.querySelector(
        '#password-confirm-password',
      ) as HTMLInputElement;
      setInputValue(confirmInput, confirmPassword);
      confirmInput.dispatchEvent(new Event('blur'));
      fixture.detectChanges();
    }

    function submit(): void {
      (fixture.nativeElement.querySelector('#password-form') as HTMLFormElement).requestSubmit();
      fixture.detectChanges();
    }

    it('does not render the form before the row is opened', () => {
      expect(fixture.nativeElement.querySelector('#password-form')).toBeFalsy();
    });

    it('disables submit while the new password is shorter than 8 characters', () => {
      fillForm('oldpass', 'short');

      const submitButton = fixture.nativeElement.querySelector(
        '#password-form button[type="submit"]',
      ) as HTMLButtonElement;
      expect(submitButton.disabled).toBe(true);
    });

    it('disables submit and shows an error when the confirmation does not match', () => {
      fillForm('oldpass', 'newpassword1', 'different1');

      const submitButton = fixture.nativeElement.querySelector(
        '#password-form button[type="submit"]',
      ) as HTMLButtonElement;
      expect(submitButton.disabled).toBe(true);
      expect(fixture.nativeElement.textContent).toContain('Les contrasenyes no coincideixen');
    });

    it('calls changePassword, toasts success, then logs out and redirects to /login', () => {
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      fillForm('oldpass', 'newpassword1');
      submit();

      expect(profileService.changePassword).toHaveBeenCalledWith({
        currentPassword: 'oldpass',
        newPassword: 'newpassword1',
      });
      expect(toastService.success).toHaveBeenCalledWith('Contrasenya actualitzada correctament.');
      expect(authService.logout).toHaveBeenCalled();
      expect(navigateSpy).toHaveBeenCalledWith(['/login']);
    });

    it('shows an inline error on an incorrect current password (401) and does not log out', () => {
      profileService.changePassword.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 401 })),
      );

      fillForm('wrongpass', 'newpassword1');
      submit();

      expect(fixture.nativeElement.textContent).toContain('Contrasenya actual incorrecta.');
      expect(authService.logout).not.toHaveBeenCalled();
      expect(toastService.success).not.toHaveBeenCalled();
    });
  });

  describe('email change', () => {
    let profileService: ReturnType<typeof createTestBed>['profileService'];
    let authService: ReturnType<typeof createTestBed>['authService'];
    let toastService: ReturnType<typeof createTestBed>['toastService'];

    const UPDATED_PROFILE = {
      id: 'u-1',
      email: 'new@a.com',
      role: UserRole.MEMBER,
      isActive: true,
      person: null,
    };

    beforeEach(async () => {
      ({ profileService, authService, toastService } = createTestBed());
      profileService.changeEmail.mockReturnValue(of(UPDATED_PROFILE));
      await TestBed.compileComponents();
      fixture = TestBed.createComponent(SettingsComponent);
      fixture.detectChanges();
    });

    function openSection(): void {
      (
        fixture.nativeElement.querySelector('[data-testid="email-row-toggle"]') as HTMLButtonElement
      ).click();
      fixture.detectChanges();
    }

    function fillForm(
      newEmail: string,
      currentPassword: string,
      confirmEmail: string = newEmail,
    ): void {
      openSection();
      setInputValue(fixture.nativeElement.querySelector('#email-new-email'), newEmail);
      const confirmInput = fixture.nativeElement.querySelector(
        '#email-confirm-email',
      ) as HTMLInputElement;
      setInputValue(confirmInput, confirmEmail);
      confirmInput.dispatchEvent(new Event('blur'));
      setInputValue(fixture.nativeElement.querySelector('#email-current-password'), currentPassword);
      fixture.detectChanges();
    }

    function submit(): void {
      (fixture.nativeElement.querySelector('#email-form') as HTMLFormElement).requestSubmit();
      fixture.detectChanges();
    }

    it('does not render the form before the row is opened', () => {
      expect(fixture.nativeElement.querySelector('#email-form')).toBeFalsy();
    });

    it('disables submit for an invalid email', () => {
      fillForm('not-an-email', 'pass');

      const submitButton = fixture.nativeElement.querySelector(
        '#email-form button[type="submit"]',
      ) as HTMLButtonElement;
      expect(submitButton.disabled).toBe(true);
    });

    it('disables submit and shows an error when the confirmation does not match', () => {
      fillForm('new@a.com', 'pass', 'different@a.com');

      const submitButton = fixture.nativeElement.querySelector(
        '#email-form button[type="submit"]',
      ) as HTMLButtonElement;
      expect(submitButton.disabled).toBe(true);
      expect(fixture.nativeElement.textContent).toContain('Els correus electrònics no coincideixen');
    });

    it('calls changeEmail and patches the cached user on success', () => {
      fillForm('new@a.com', 'pass');
      submit();

      expect(profileService.changeEmail).toHaveBeenCalledWith({
        newEmail: 'new@a.com',
        currentPassword: 'pass',
      });
      expect(authService.setCurrentUser).toHaveBeenCalledWith(UPDATED_PROFILE);
      expect(toastService.success).toHaveBeenCalledWith('Correu electrònic actualitzat correctament.');
    });

    it('shows an inline error when the email is already in use (409)', () => {
      profileService.changeEmail.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 409 })),
      );

      fillForm('taken@a.com', 'pass');
      submit();

      expect(fixture.nativeElement.textContent).toContain(
        'Ja existeix un compte amb aquest correu electrònic.',
      );
      expect(authService.setCurrentUser).not.toHaveBeenCalled();
    });

    it('shows an inline error on an incorrect current password (401)', () => {
      profileService.changeEmail.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 401 })),
      );

      fillForm('new@a.com', 'wrongpass');
      submit();

      expect(fixture.nativeElement.textContent).toContain('Contrasenya actual incorrecta.');
      expect(authService.setCurrentUser).not.toHaveBeenCalled();
    });
  });

  describe('accordion behavior', () => {
    beforeEach(async () => {
      createTestBed();
      await TestBed.compileComponents();
      fixture = TestBed.createComponent(SettingsComponent);
      fixture.detectChanges();
    });

    function click(testId: string): void {
      (fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) as HTMLButtonElement).click();
      fixture.detectChanges();
    }

    it('opening the email section closes an already-open password section', () => {
      click('password-row-toggle');
      expect(fixture.nativeElement.querySelector('#password-form')).toBeTruthy();

      click('email-row-toggle');
      expect(fixture.nativeElement.querySelector('#password-form')).toBeFalsy();
      expect(fixture.nativeElement.querySelector('#email-form')).toBeTruthy();
    });

    it('opening the about section closes an already-open email section', () => {
      click('email-row-toggle');
      expect(fixture.nativeElement.querySelector('#email-form')).toBeTruthy();

      click('about-row-toggle');
      expect(fixture.nativeElement.querySelector('#email-form')).toBeFalsy();
      expect(
        fixture.nativeElement.querySelector('[data-testid="privacy-policy-viewer"]'),
      ).toBeTruthy();
    });

    it('opening the password section closes an already-open about section', () => {
      click('about-row-toggle');
      expect(
        fixture.nativeElement.querySelector('[data-testid="privacy-policy-viewer"]'),
      ).toBeTruthy();

      click('password-row-toggle');
      expect(fixture.nativeElement.querySelector('[data-testid="privacy-policy-viewer"]')).toBeFalsy();
      expect(fixture.nativeElement.querySelector('#password-form')).toBeTruthy();
    });

    it('clicking an open section\'s own toggle again closes it', () => {
      click('password-row-toggle');
      expect(fixture.nativeElement.querySelector('#password-form')).toBeTruthy();

      click('password-row-toggle');
      expect(fixture.nativeElement.querySelector('#password-form')).toBeFalsy();
    });
  });

  describe('privacy policy viewer', () => {
    let legalDocumentService: ReturnType<typeof createTestBed>['legalDocumentService'];

    beforeEach(async () => {
      ({ legalDocumentService } = createTestBed());
      await TestBed.compileComponents();
      fixture = TestBed.createComponent(SettingsComponent);
      fixture.detectChanges();
    });

    it('does not show the policy content before the row is opened', () => {
      expect(legalDocumentService.getActive).not.toHaveBeenCalled();
      expect(fixture.nativeElement.querySelector('[data-testid="privacy-policy-viewer"]')).toBeFalsy();
    });

    it('fetches and shows the active privacy policy when the row is clicked', () => {
      (fixture.nativeElement.querySelector('[data-testid="about-row-toggle"]') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(legalDocumentService.getActive).toHaveBeenCalledWith(LegalDocumentType.PRIVACY_POLICY);
      expect(fixture.nativeElement.textContent).toContain(PRIVACY_POLICY.content);
    });

    it('collapses the viewer when the row is clicked again', () => {
      const toggle = fixture.nativeElement.querySelector(
        '[data-testid="about-row-toggle"]',
      ) as HTMLButtonElement;
      toggle.click();
      fixture.detectChanges();
      toggle.click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('[data-testid="privacy-policy-viewer"]')).toBeFalsy();
    });
  });

  describe('logout', () => {
    let authService: ReturnType<typeof createTestBed>['authService'];

    beforeEach(async () => {
      ({ authService } = createTestBed());
      await TestBed.compileComponents();
      fixture = TestBed.createComponent(SettingsComponent);
      fixture.detectChanges();
    });

    it('logs out and redirects to /login when the row is clicked', () => {
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      (fixture.nativeElement.querySelector('[data-testid="logout-button"]') as HTMLButtonElement).click();

      expect(authService.logout).toHaveBeenCalled();
      expect(navigateSpy).toHaveBeenCalledWith(['/login']);
    });
  });
});
