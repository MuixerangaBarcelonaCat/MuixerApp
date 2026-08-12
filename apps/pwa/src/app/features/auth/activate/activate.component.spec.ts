import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Gender, InviteRegistrationContext } from '@muixer/shared';
import { ActivateComponent } from './activate.component';
import { AuthService } from '../../../core/auth/services/auth.service';

const mockContext: InviteRegistrationContext = {
  person: {
    name: 'Joan',
    firstSurname: 'Garcia',
    secondSurname: null,
    gender: Gender.MALE,
    phone: '+34612345678',
    birthDate: '2000-01-15',
  },
  expiresAt: '2099-01-01T00:00:00Z',
  legalDocument: { content: 'Text de la política de privacitat', version: 1 },
};

describe('ActivateComponent', () => {
  let fixture: ComponentFixture<ActivateComponent>;
  let component: ActivateComponent;
  let authService: {
    getInviteContext: ReturnType<typeof vi.fn>;
    registerViaInvite: ReturnType<typeof vi.fn>;
  };
  let router: { navigate: ReturnType<typeof vi.fn> };

  const setup = async (token: string | null) => {
    authService = {
      getInviteContext: vi.fn().mockReturnValue(of(mockContext)),
      registerViaInvite: vi.fn().mockReturnValue(of(void 0)),
    };
    router = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [ActivateComponent],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(token ? { token } : {}) } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ActivateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  it('shows an invalid-link state and does not render the form when there is no token', async () => {
    await setup(null);

    expect(authService.getInviteContext).not.toHaveBeenCalled();
    expect(component.invalidLink()).toBe(true);
    expect(fixture.nativeElement.querySelector('form')).toBeFalsy();
  });

  it('shows an invalid-link state when the token lookup fails (expired/invalid)', async () => {
    authService = {
      getInviteContext: vi.fn().mockReturnValue(throwError(() => ({ status: 401 }))),
      registerViaInvite: vi.fn(),
    };
    router = { navigate: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [ActivateComponent],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({ token: 'bad-token' }) } },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ActivateComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.invalidLink()).toBe(true);
    expect(fixture.nativeElement.querySelector('form')).toBeFalsy();
  });

  it('prefills the personal-data form group from the invite context', async () => {
    await setup('raw-token');

    expect(component.form.controls.personalData.controls.name.value).toBe('Joan');
    expect(component.form.controls.personalData.controls.firstSurname.value).toBe('Garcia');
  });

  it('renders the legal document content and requires the acceptance checkbox', async () => {
    await setup('raw-token');

    expect(fixture.nativeElement.textContent).toContain('Text de la política de privacitat');
    expect(component.form.controls.legalAccepted.valid).toBe(false);
  });

  it('is invalid while password and confirmPassword do not match', async () => {
    await setup('raw-token');

    component.form.patchValue({ password: 'password123', confirmPassword: 'different123' });
    expect(component.form.hasError('passwordMismatch')).toBe(true);
  });

  it('submits the combined payload and navigates to /home on success', async () => {
    await setup('raw-token');

    component.form.patchValue({
      email: 'new@test.cat',
      password: 'newpass123',
      confirmPassword: 'newpass123',
      legalAccepted: true,
    });
    component.form.controls.personalData.patchValue({
      name: 'Joan',
      firstSurname: 'Garcia',
      gender: Gender.MALE,
      country: 'ES',
      phoneNumber: '612345678',
      birthDate: '2000-01-15',
    });

    component.onSubmit();

    expect(authService.registerViaInvite).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'raw-token',
        email: 'new@test.cat',
        password: 'newpass123',
        legalAccepted: true,
        name: 'Joan',
        firstSurname: 'Garcia',
        phone: '+34612345678',
      }),
    );
    expect(router.navigate).toHaveBeenCalledWith(['/home']);
  });

  it('does not submit while the form is invalid', async () => {
    await setup('raw-token');

    component.onSubmit();

    expect(authService.registerViaInvite).not.toHaveBeenCalled();
  });

  it('shows a server error as an alert without navigating', async () => {
    await setup('raw-token');
    authService.registerViaInvite.mockReturnValue(
      throwError(() => ({ error: { message: 'Ja existeix un compte amb aquest email' } })),
    );

    component.form.patchValue({
      email: 'taken@test.cat',
      password: 'newpass123',
      confirmPassword: 'newpass123',
      legalAccepted: true,
    });
    component.form.controls.personalData.patchValue({
      name: 'Joan',
      firstSurname: 'Garcia',
      gender: Gender.MALE,
      country: 'ES',
      phoneNumber: '612345678',
      birthDate: '2000-01-15',
    });

    component.onSubmit();
    fixture.detectChanges();

    expect(component.errorMessage()).toBe('Ja existeix un compte amb aquest email');
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
