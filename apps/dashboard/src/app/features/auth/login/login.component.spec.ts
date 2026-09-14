import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { allLucideIconsProvider } from '../../../../testing/lucide-test-provider';
import { LoginComponent } from './login.component';
import { AuthService } from '../../../core/auth/services/auth.service';

const mockAuthService = {
  login: vi.fn(),
};

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authService: typeof mockAuthService;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent, ReactiveFormsModule, RouterTestingModule],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        allLucideIconsProvider,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    authService = TestBed.inject(AuthService) as unknown as typeof mockAuthService;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  afterEach(() => vi.clearAllMocks());

  it('form is invalid when empty', () => {
    component.form.reset({ email: '', password: '' });
    expect(component.form.invalid).toBe(true);
  });

  it('tags the credentials so the browser password manager can save and refill them', () => {
    const el = fixture.nativeElement;
    const emailInput = el.querySelector('input[type="email"]') as HTMLInputElement;
    const passwordInput = el.querySelector('input[type="password"]') as HTMLInputElement;

    // `username`, no `email`: `email` és el token d'un camp d'adreça de contacte. El gestor de
    // contrasenyes emparella `username` amb `current-password`, i usa el `name` com a reserva.
    expect(emailInput.getAttribute('autocomplete')).toBe('username');
    expect(emailInput.getAttribute('name')).toBe('username');
    expect(passwordInput.getAttribute('autocomplete')).toBe('current-password');
    expect(passwordInput.getAttribute('name')).toBe('password');
  });

  it('form is valid with correct data', () => {
    component.form.setValue({ email: 'user@test.cat', password: 'password123' });
    expect(component.form.valid).toBe(true);
  });

  it('navigates to / on successful login', async () => {
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    authService.login.mockReturnValue(of(void 0));

    component.form.setValue({ email: 'user@test.cat', password: 'pass123' });
    component.onSubmit();

    expect(authService.login).toHaveBeenCalledWith({
      email: 'user@test.cat',
      password: 'pass123',
    });
    expect(navigateSpy).toHaveBeenCalledWith(['/']);
  });

  it('shows Catalan error message on failed login', () => {
    authService.login.mockReturnValue(throwError(() => new Error('401')));

    component.form.setValue({ email: 'bad@test.cat', password: 'wrong123' });
    component.onSubmit();

    expect(component.errorMessage()).toContain('incorrectes');
    expect(component.isLoading()).toBe(false);
  });

  it('does not submit when form is invalid', () => {
    component.form.reset({ email: '', password: '' });
    component.onSubmit();
    expect(authService.login).not.toHaveBeenCalled();
  });

  describe('tap targets >=24px (WI-03, PE-L1/PW-L3 parity)', () => {
    it('gives the email and password inputs their own >=24px height instead of just the wrapper', () => {
      const emailInput = fixture.nativeElement.querySelector('input[type="email"]') as HTMLElement;
      const passwordInput = fixture.nativeElement.querySelector('input[type="password"]') as HTMLElement;
      expect(emailInput.className).toContain('h-6');
      expect(passwordInput.className).toContain('h-6');
    });
  });
});
