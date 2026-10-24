import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AccessStatus, DelegateType } from '@muixer/shared';
import { ToastService } from '@muixer/ui';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { PersonService } from '../../services/person.service';
import { PersonDelegateItem } from '../../services/person-delegate.service';
import { Person } from '../../models/person.model';
import { InviteLinkPanelComponent } from '../invite-link-panel/invite-link-panel.component';
import { PersonAccessCardComponent } from './person-access-card.component';

// 18:42 in Valencia (CET, UTC+1).
const LATER = '2099-10-27T17:42:00.000Z';
const EARLIER = '2026-10-21T08:00:00.000Z';

const makePerson = (overrides: Partial<Person> = {}): Person =>
  ({
    id: 'p1',
    alias: 'Pepa',
    isXicalla: false,
    user: null,
    accessStatus: AccessStatus.NONE,
    ...overrides,
  }) as Person;

const makeResponsible = (user: Partial<PersonDelegateItem['user']> = {}): PersonDelegateItem => ({
  id: 'del-1',
  delegateType: DelegateType.PARENT,
  isActive: true,
  isPrimary: true,
  createdAt: '2026-10-01T00:00:00Z',
  user: {
    id: 'u-joan',
    email: null,
    isActive: false,
    inviteExpiresAt: null,
    person: { id: 'joan', alias: 'Joan', phone: null },
    ...user,
  },
  person: { id: 'p1', alias: 'Pepa' },
});

describe('PersonAccessCardComponent', () => {
  let fixture: ComponentFixture<PersonAccessCardComponent>;
  let personService: { createInviteLink: ReturnType<typeof vi.fn> };

  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent?.replace(/\s+/g, ' ') ?? '';
  const button = (label: string) =>
    Array.from(el().querySelectorAll('button')).find((b) => b.textContent?.trim() === label);
  const panel = () => fixture.debugElement.query((d) => d.componentInstance instanceof InviteLinkPanelComponent);

  const render = (person: Person, inputs: { responsible?: PersonDelegateItem | null; editing?: boolean } = {}) => {
    fixture.componentRef.setInput('person', person);
    fixture.componentRef.setInput('responsible', inputs.responsible ?? null);
    fixture.componentRef.setInput('editing', inputs.editing ?? false);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    personService = { createInviteLink: vi.fn().mockReturnValue(of({ inviteUrl: 'https://x', expiresAt: LATER })) };
    await TestBed.configureTestingModule({
      imports: [PersonAccessCardComponent],
      providers: [
        provideRouter([]),
        { provide: PersonService, useValue: personService },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
        allLucideIconsProvider,
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PersonAccessCardComponent);
  });

  it('ACTIVE: shows the account email and no action', () => {
    render(
      makePerson({
        accessStatus: AccessStatus.ACTIVE,
        user: { id: 'u', email: 'pepa@exemple.cat', isActive: true, inviteExpiresAt: null },
      }),
    );

    expect(text()).toContain('Compte actiu');
    expect(text()).toContain('Correu: pepa@exemple.cat');
    expect(el().querySelector('lib-button')).toBeNull();
  });

  it('INVITED: shows when the link expires, and asks before creating another', () => {
    render(
      makePerson({
        accessStatus: AccessStatus.INVITED,
        user: { id: 'u', email: null, isActive: false, inviteExpiresAt: LATER },
      }),
    );

    expect(text()).toContain('Invitació enviada');
    expect(text()).toContain("L'enllaç venç el 27/10/2099 a les 18:42.");

    button("Torna a crear l'enllaç")!.click();
    fixture.detectChanges();

    expect(text()).toContain("L'enllaç que ja heu enviat a Pepa deixarà de funcionar. Voleu crear-ne un de nou?");
    expect(personService.createInviteLink).not.toHaveBeenCalled();

    button('Crea un enllaç nou')!.click();
    fixture.detectChanges();

    expect(personService.createInviteLink).toHaveBeenCalledWith('p1');
  });

  it('INVITE_EXPIRED: offers a new link without asking', () => {
    render(
      makePerson({
        accessStatus: AccessStatus.INVITE_EXPIRED,
        user: { id: 'u', email: null, isActive: false, inviteExpiresAt: EARLIER },
      }),
    );

    expect(text()).toContain('Invitació vençuda');
    expect(text()).toContain("L'enllaç va vèncer el 21/10/2026 sense que s'activara el compte.");

    button('Crea un enllaç nou')!.click();
    fixture.detectChanges();

    expect(personService.createInviteLink).toHaveBeenCalledWith('p1');
  });

  it('NONE, adult: invite first, a responsible as the alternative', () => {
    render(makePerson());

    expect(text()).toContain('Sense accés');
    expect(text()).toContain("Esta persona encara no pot entrar a l'app.");
    expect(button("Crea l'enllaç d'invitació")).toBeTruthy();
    expect(button('Defineix una persona responsable')).toBeTruthy();
  });

  it('NONE, xicalla: only a responsible, never an invite', () => {
    render(makePerson({ isXicalla: true }));

    expect(text()).toContain("La xicalla accedeix a l'app a través d'una persona adulta responsable.");
    expect(button("Crea l'enllaç d'invitació")).toBeUndefined();

    const asked = vi.fn();
    fixture.componentInstance.defineResponsible.subscribe(asked);
    button('Defineix la persona responsable')!.click();
    expect(asked).toHaveBeenCalled();
  });

  it('creating a link opens it in a modal and reports the change', () => {
    render(makePerson());
    const changed = vi.fn();
    fixture.componentInstance.changed.subscribe(changed);

    button("Crea l'enllaç d'invitació")!.click();
    fixture.detectChanges();

    expect(panel()).toBeTruthy();
    expect(personService.createInviteLink).toHaveBeenCalledWith('p1');
    expect(changed).toHaveBeenCalled();
  });

  describe('MANAGED', () => {
    const managed = () => makePerson({ isXicalla: true, accessStatus: AccessStatus.MANAGED });

    it('names the responsible, links to them, and shows their own access', () => {
      render(managed(), { responsible: makeResponsible() });

      expect(text()).toContain('Amb responsable');
      expect(text()).toContain('A través de Joan (pare/mare).');
      expect(el().querySelector('a[href="/persons/joan"]')).toBeTruthy();
      expect(text()).toContain('Accés de Joan');
      expect(text()).toContain('Sense accés');
    });

    it('offers the responsible their own link while they cannot get in', () => {
      render(managed(), { responsible: makeResponsible() });

      button("Crea l'enllaç per a Joan")!.click();
      fixture.detectChanges();

      expect(personService.createInviteLink).toHaveBeenCalledWith('joan');
    });

    it('asks before replacing a link the responsible already has', () => {
      render(managed(), { responsible: makeResponsible({ inviteExpiresAt: LATER }) });

      expect(text()).toContain('Invitació enviada');
      button("Torna a crear l'enllaç per a Joan")!.click();
      fixture.detectChanges();

      expect(text()).toContain("L'enllaç que ja heu enviat a Joan deixarà de funcionar.");
    });

    it('offers nothing once the responsible is active', () => {
      render(managed(), { responsible: makeResponsible({ isActive: true, email: 'joan@exemple.cat' }) });

      expect(text()).toContain('Compte actiu');
      expect(button("Crea l'enllaç per a Joan")).toBeUndefined();
    });

    it('unlinks the responsible from edit mode only', () => {
      render(managed(), { responsible: makeResponsible() });
      expect(button('Desvincula la persona responsable')).toBeUndefined();

      const removed = vi.fn();
      fixture.componentInstance.removeResponsible.subscribe(removed);
      render(managed(), { responsible: makeResponsible(), editing: true });
      button('Desvincula la persona responsable')!.click();

      expect(removed).toHaveBeenCalledWith(expect.objectContaining({ id: 'del-1' }));
    });
  });
});
