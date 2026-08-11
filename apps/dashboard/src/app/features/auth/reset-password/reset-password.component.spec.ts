import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { allLucideIconsProvider } from '../../../../testing/lucide-test-provider';
import { ResetPasswordComponent } from './reset-password.component';
import { AuthService } from '../../../core/auth/services/auth.service';
import { ToastService } from '../../../shared/components/feedback/toast/toast.service';

const mockAuthService = {
  resetPassword: vi.fn(),
};

const mockToastService = {
  success: vi.fn(),
};

const makeRoute = (token: string | null) => ({
  snapshot: { queryParamMap: convertToParamMap(token ? { token } : {}) },
});

async function setup(token: string | null = 'raw-token') {
  await TestBed.configureTestingModule({
    imports: [ResetPasswordComponent, ReactiveFormsModule, RouterTestingModule],
    providers: [
      { provide: AuthService, useValue: mockAuthService },
      { provide: ToastService, useValue: mockToastService },
      { provide: ActivatedRoute, useValue: makeRoute(token) },
      allLucideIconsProvider,
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(ResetPasswordComponent);
  const component = fixture.componentInstance;
  fixture.detectChanges();
  return { fixture, component };
}

describe('ResetPasswordComponent', () => {
  afterEach(() => vi.clearAllMocks());

  it('shows an error state immediately when there is no token in the URL', async () => {
    const { component } = await setup(null);
    expect(component.missingToken()).toBe(true);
  });

  it('form is invalid when the password is too short', async () => {
    const { component } = await setup();
    component.form.setValue({ password: 'short', confirmPassword: 'short' });
    expect(component.form.invalid).toBe(true);
  });

  it('form is invalid when the passwords do not match', async () => {
    const { component } = await setup();
    component.form.setValue({ password: 'newpass123', confirmPassword: 'different123' });
    expect(component.form.invalid).toBe(true);
  });

  it('form is valid when both passwords match and meet the minimum length', async () => {
    const { component } = await setup();
    component.form.setValue({ password: 'newpass123', confirmPassword: 'newpass123' });
    expect(component.form.valid).toBe(true);
  });

  it('does not submit when the form is invalid', async () => {
    const { component } = await setup();
    component.form.setValue({ password: 'short', confirmPassword: 'short' });
    component.onSubmit();
    expect(mockAuthService.resetPassword).not.toHaveBeenCalled();
  });

  it('submits the token and new password, navigates to /login and shows a toast on success', async () => {
    const { component, fixture } = await setup();
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    mockAuthService.resetPassword.mockReturnValue(of(void 0));

    component.form.setValue({ password: 'newpass123', confirmPassword: 'newpass123' });
    component.onSubmit();
    fixture.detectChanges();

    expect(mockAuthService.resetPassword).toHaveBeenCalledWith('raw-token', 'newpass123');
    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
    expect(mockToastService.success).toHaveBeenCalled();
  });

  it('shows an inline error and stops loading when the token is invalid or expired', async () => {
    const { component } = await setup();
    mockAuthService.resetPassword.mockReturnValue(throwError(() => new Error('401')));

    component.form.setValue({ password: 'newpass123', confirmPassword: 'newpass123' });
    component.onSubmit();

    expect(component.errorMessage()).toBeTruthy();
    expect(component.isLoading()).toBe(false);
  });
});
