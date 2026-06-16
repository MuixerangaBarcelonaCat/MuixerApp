import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError, NEVER } from 'rxjs';
import { vi } from 'vitest';
import { OnboardingStatus, AvailabilityStatus } from '@muixer/shared';
import { PersonService } from '../../../services/person.service';
import { ToastService } from '../../../../../shared/components/feedback/toast/toast.service';
import { PersonInvitationModalComponent } from './person-invitation-modal.component';

import { Person } from '../../../models/person.model';

const person: Person = {
  id: 'person-1',
  name: 'Anna',
  firstSurname: 'Garcia',
  secondSurname: null,
  alias: 'anna',
  email: null,
  phone: null,
  birthDate: null,
  shoulderHeight: null,
  notes: null,
  isActive: true,
  isMember: true,
  isXicalla: false,
  availability: AvailabilityStatus.AVAILABLE,
  onboardingStatus: OnboardingStatus.NOT_APPLICABLE,
  shirtDate: null,
  managedBy: null,
  positions: [],
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

describe('PersonInvitationModalComponent', () => {
  let component: PersonInvitationModalComponent;
  let fixture: ComponentFixture<PersonInvitationModalComponent>;
  let personService: { sendInvitation: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    personService = { sendInvitation: vi.fn() };
    toast = { success: vi.fn(), error: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [PersonInvitationModalComponent],
      providers: [
        { provide: PersonService, useValue: personService },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PersonInvitationModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('person', person);
    fixture.detectChanges();
  });

  it('shows loading state while sending', () => {
    personService.sendInvitation.mockReturnValue(NEVER);
    component.email.set('anna@example.com');

    component.send();

    expect(component.sending()).toBe(true);
  });

  it('shows success toast and emits success on send', () => {
    personService.sendInvitation.mockReturnValue(of(person));
    component.email.set('anna@example.com');
    const successSpy = vi.fn();
    component.success.subscribe(successSpy);

    component.send();

    expect(toast.success).toHaveBeenCalledWith(
      "S'ha enviat la invitació per correu electrònic",
    );
    expect(successSpy).toHaveBeenCalled();
    expect(component.sending()).toBe(false);
  });

  it('shows cooldown message when API returns 429', () => {
    personService.sendInvitation.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 429,
            error: {
              message: 'Cal esperar abans de tornar a enviar la invitació',
              retryAfterSeconds: 90,
            },
          }),
      ),
    );
    component.email.set('anna@example.com');

    component.send();

    expect(component.error()).toBe(
      'Cal esperar 2 min abans de tornar a enviar la invitació',
    );
    expect(toast.error).toHaveBeenCalledWith(
      'Cal esperar 2 min abans de tornar a enviar la invitació',
    );
    expect(component.sending()).toBe(false);
  });
});
