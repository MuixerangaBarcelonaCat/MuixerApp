import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ForgotPasswordComponent } from './forgot-password.component';
import { AuthService } from '../../../core/auth/services/auth.service';

@Component({ standalone: true, template: '' })
class StubComponent {}

const mockAuthService = {
  requestPasswordReset: vi.fn(),
};

describe('ForgotPasswordComponent', () => {
  let component: ForgotPasswordComponent;
  let fixture: ComponentFixture<ForgotPasswordComponent>;
  let authService: typeof mockAuthService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [
        provideRouter([{ path: 'login', component: StubComponent }]),
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ForgotPasswordComponent);
    component = fixture.componentInstance;
    authService = TestBed.inject(AuthService) as unknown as typeof mockAuthService;
    fixture.detectChanges();
  });

  afterEach(() => vi.clearAllMocks());

  it('renders the email field', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('input[type="email"]')).toBeTruthy();
  });

  it('does not submit when the form is invalid', () => {
    component.form.reset({ email: '' });
    component.onSubmit();
    expect(authService.requestPasswordReset).not.toHaveBeenCalled();
  });

  it('calls the service and shows the generic success state', () => {
    authService.requestPasswordReset.mockReturnValue(of(void 0));

    component.form.setValue({ email: 'user@test.cat' });
    component.onSubmit();

    expect(authService.requestPasswordReset).toHaveBeenCalledWith('user@test.cat');
    expect(component.submitted()).toBe(true);
    expect(component.isLoading()).toBe(false);
  });

  it('shows an error message when the request fails (network/server error)', () => {
    authService.requestPasswordReset.mockReturnValue(throwError(() => new Error('500')));

    component.form.setValue({ email: 'user@test.cat' });
    component.onSubmit();

    expect(component.submitted()).toBe(false);
    expect(component.errorMessage()).toBeTruthy();
    expect(component.isLoading()).toBe(false);
  });

  it('links back to /login', () => {
    const link = fixture.nativeElement.querySelector('a[routerLink="/login"]');
    expect(link).toBeTruthy();
  });
});
