import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { LoginComponent } from './login.component';
import { AuthService } from '../../../core/auth/services/auth.service';
import { Component } from '@angular/core';

@Component({ standalone: true, template: '' })
class StubComponent {}

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authService: { login: ReturnType<typeof vi.fn> };
  let router: Router;

  beforeEach(async () => {
    authService = { login: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([
          { path: 'home', component: StubComponent },
          { path: 'login', component: StubComponent },
        ]),
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('renders email and password fields', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('input[type="email"]')).toBeTruthy();
    expect(el.querySelector('input[type="password"]')).toBeTruthy();
  });

  it('submit button disabled when form invalid', () => {
    const btn = fixture.nativeElement.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('calls login service with form values', () => {
    component.form.setValue({ email: 'a@b.cat', password: 'pass123' });
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    authService.login.mockReturnValue(of(void 0));

    component.onSubmit();

    expect(authService.login).toHaveBeenCalledWith({
      email: 'a@b.cat',
      password: 'pass123',
    });
  });

  it('navigates to /home on successful login', () => {
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    authService.login.mockReturnValue(of(void 0));

    component.form.setValue({ email: 'a@b.cat', password: 'pass123' });
    component.onSubmit();

    expect(navigateSpy).toHaveBeenCalledWith('/home');
  });

  it('shows loading state while login in progress', () => {
    const subject = new Subject<void>();
    authService.login.mockReturnValue(subject.asObservable());

    component.form.setValue({ email: 'a@b.cat', password: 'pass123' });
    component.onSubmit();

    expect(component.isLoading()).toBe(true);

    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    subject.next();
    subject.complete();
  });

  it('shows error message on failed login and clears on retry', () => {
    authService.login.mockReturnValueOnce(
      throwError(() => new Error('401')),
    );

    component.form.setValue({ email: 'a@b.cat', password: 'wrongpass' });
    component.onSubmit();

    expect(component.errorMessage()).toBe(
      'Correu electrònic o contrasenya incorrectes.',
    );
    expect(component.isLoading()).toBe(false);

    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    authService.login.mockReturnValue(of(void 0));
    component.onSubmit();
    expect(component.errorMessage()).toBeNull();
  });
});
