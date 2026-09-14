import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ResetPasswordComponent } from './reset-password.component';
import { AuthService } from '../../../core/auth/services/auth.service';

describe('ResetPasswordComponent', () => {
  let fixture: ComponentFixture<ResetPasswordComponent>;
  let component: ResetPasswordComponent;
  let authService: { resetPassword: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  const setup = async (token: string | null) => {
    authService = { resetPassword: vi.fn().mockReturnValue(of(void 0)) };
    router = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [ResetPasswordComponent],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(token ? { token } : {}) } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ResetPasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  const fill = (password: string, confirmPassword = password) =>
    component.form.patchValue({ password, confirmPassword });

  it('shows an invalid-link state and no form when the token is missing', async () => {
    await setup(null);

    expect(component.missingToken()).toBe(true);
    expect(fixture.nativeElement.querySelector('form')).toBeFalsy();
  });

  it('renders two password fields, each with its reveal toggle', async () => {
    await setup('raw-token');

    expect(fixture.nativeElement.querySelectorAll('input[type="password"]').length).toBe(2);
    expect(fixture.nativeElement.querySelectorAll('[data-testid="lib-input-reveal"]').length).toBe(2);
  });

  it('is invalid while the two passwords do not match', async () => {
    await setup('raw-token');

    fill('newpassword1', 'different1');
    expect(component.form.hasError('passwordMismatch')).toBe(true);
  });

  it('does not submit while the form is invalid', async () => {
    await setup('raw-token');

    component.onSubmit();

    expect(authService.resetPassword).not.toHaveBeenCalled();
  });

  it('posts the token with the new password and confirms success', async () => {
    await setup('raw-token');

    fill('newpassword1');
    component.onSubmit();

    expect(authService.resetPassword).toHaveBeenCalledWith('raw-token', 'newpassword1');
    expect(component.resetSuccess()).toBe(true);
  });

  it('sends the member straight to the login screen once the password is set', async () => {
    await setup('raw-token');

    fill('newpassword1');
    component.onSubmit();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('a[routerLink="/login"]')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Ja tens la contrasenya nova');
  });

  it('shows an expired-link error without claiming success', async () => {
    await setup('raw-token');
    authService.resetPassword.mockReturnValue(throwError(() => ({ status: 401 })));

    fill('newpassword1');
    component.onSubmit();

    expect(component.resetSuccess()).toBe(false);
    expect(component.errorMessage()).toContain('caducat');
  });
});
