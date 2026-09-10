import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Gender, InviteRegistrationContext } from '@muixer/shared';
import { ActivateComponent } from './activate.component';
import { AuthService } from '../../../core/auth/services/auth.service';

const mockContext: InviteRegistrationContext = {
  email: null,
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

  const setup = async (token: string | null, context: InviteRegistrationContext = mockContext) => {
    authService = {
      getInviteContext: vi.fn().mockReturnValue(of(context)),
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

  it('prefills every personal-data field the invite context carries, phone and birth date included', async () => {
    await setup('raw-token');

    const personalData = component.form.controls.personalData.controls;
    expect(personalData.name.value).toBe('Joan');
    expect(personalData.firstSurname.value).toBe('Garcia');
    expect(personalData.gender.value).toBe(Gender.MALE);
    expect(personalData.country.value).toBe('ES');
    expect(personalData.phoneNumber.value).toBe('612345678');
    expect(personalData.birthDate.value).toBe('2000-01-15');
  });

  it('prefills and locks the email when the colla already has one on file', async () => {
    await setup('raw-token', { ...mockContext, email: 'legacy@test.cat' });

    expect(component.form.controls.email.value).toBe('legacy@test.cat');
    // Readonly, no disabled: un camp disabled no s'envia amb el formulari i el gestor de
    // contrasenyes del navegador l'ignora, així que guardaria la contrasenya nova sense usuari
    // associat — justament al moment en què l'usuari tria la seua primera contrasenya.
    expect(component.form.controls.email.disabled).toBe(false);
    const emailInput = fixture.nativeElement.querySelector('input[type="email"]');
    expect(emailInput.readOnly).toBe(true);
    expect(emailInput.disabled).toBe(false);
  });

  it('marks the email as the username so the browser can save it with the new password', async () => {
    await setup('raw-token', { ...mockContext, email: 'legacy@test.cat' });

    const emailInput = fixture.nativeElement.querySelector('input[type="email"]');
    expect(emailInput.getAttribute('autocomplete')).toBe('username');
    expect(emailInput.getAttribute('name')).toBe('username');
  });

  it('leaves the email empty and editable when the account has none yet', async () => {
    await setup('raw-token');

    expect(component.form.controls.email.value).toBe('');
    expect(component.form.controls.email.disabled).toBe(false);
  });

  it('still submits the locked email, which the backend ignores in favour of its own', async () => {
    await setup('raw-token', { ...mockContext, email: 'legacy@test.cat' });

    component.form.patchValue({
      password: 'newpass123',
      confirmPassword: 'newpass123',
      legalAccepted: true,
    });

    component.onSubmit();

    expect(authService.registerViaInvite).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'legacy@test.cat' }),
    );
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
