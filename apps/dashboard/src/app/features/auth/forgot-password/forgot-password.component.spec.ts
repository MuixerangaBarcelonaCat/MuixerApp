import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { allLucideIconsProvider } from '../../../../testing/lucide-test-provider';
import { ForgotPasswordComponent } from './forgot-password.component';
import { AuthService } from '../../../core/auth/services/auth.service';

const mockAuthService = {
  requestPasswordReset: vi.fn(),
};

describe('ForgotPasswordComponent', () => {
  let component: ForgotPasswordComponent;
  let fixture: ComponentFixture<ForgotPasswordComponent>;
  let authService: typeof mockAuthService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent, ReactiveFormsModule, RouterTestingModule],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        allLucideIconsProvider,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ForgotPasswordComponent);
    component = fixture.componentInstance;
    authService = TestBed.inject(AuthService) as unknown as typeof mockAuthService;
    fixture.detectChanges();
  });

  afterEach(() => vi.clearAllMocks());

  it('form is invalid when empty', () => {
    component.form.reset({ email: '' });
    expect(component.form.invalid).toBe(true);
  });

  it('form is invalid with a malformed email', () => {
    component.form.setValue({ email: 'not-an-email' });
    expect(component.form.invalid).toBe(true);
  });

  it('does not submit when the form is invalid', () => {
    component.form.reset({ email: '' });
    component.onSubmit();
    expect(authService.requestPasswordReset).not.toHaveBeenCalled();
  });

  it('calls the service with the entered email and shows the generic success state', () => {
    authService.requestPasswordReset.mockReturnValue(of(void 0));

    component.form.setValue({ email: 'user@test.cat' });
    component.onSubmit();

    expect(authService.requestPasswordReset).toHaveBeenCalledWith('user@test.cat');
    expect(component.submitted()).toBe(true);
    expect(component.isLoading()).toBe(false);
  });

  it('shows an error message when the request itself fails (network/server error)', () => {
    authService.requestPasswordReset.mockReturnValue(throwError(() => new Error('500')));

    component.form.setValue({ email: 'user@test.cat' });
    component.onSubmit();

    expect(component.submitted()).toBe(false);
    expect(component.errorMessage()).toBeTruthy();
    expect(component.isLoading()).toBe(false);
  });
});
