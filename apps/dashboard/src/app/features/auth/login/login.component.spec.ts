import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { LoginComponent } from './login.component';
import { AuthService } from '../../../core/auth/services/auth.service';

const mockAuthService = {
  login: jest.fn(),
};

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authService: typeof mockAuthService;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent, ReactiveFormsModule, RouterTestingModule],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    authService = TestBed.inject(AuthService) as unknown as typeof mockAuthService;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  afterEach(() => jest.clearAllMocks());

  it('form is invalid when empty', () => {
    expect(component.form.invalid).toBe(true);
  });

  it('form is valid with correct data', () => {
    component.form.setValue({ email: 'user@test.cat', password: 'password123' });
    expect(component.form.valid).toBe(true);
  });

  it('navigates to / on successful login', async () => {
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
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

    component.form.setValue({ email: 'bad@test.cat', password: 'wrong' });
    component.onSubmit();

    expect(component.errorMessage()).toContain('incorrectes');
    expect(component.isLoading()).toBe(false);
  });

  it('does not submit when form is invalid', () => {
    component.onSubmit();
    expect(authService.login).not.toHaveBeenCalled();
  });
});
