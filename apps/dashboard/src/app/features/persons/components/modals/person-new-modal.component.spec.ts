import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { AccessStatus, CollaSettings, DEFAULT_COLLA_SETTINGS, DelegateType } from '@muixer/shared';
import { ToastService } from '@muixer/ui';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { PersonNewModalComponent } from './person-new-modal.component';
import { PersonService } from '../../services/person.service';
import { PersonDelegateService } from '../../services/person-delegate.service';
import { CollaSettingsService } from '../../../../core/services/colla-settings.service';
import { Person } from '../../models/person.model';
import { ResponsiblePickerComponent } from '../responsible-picker/responsible-picker.component';

const LINK = { inviteUrl: 'https://pwa.test/activate?token=abc', expiresAt: '2099-10-27T17:42:00.000Z' };
const PEPA = { id: 'new-1', alias: '~Pepa', accessStatus: AccessStatus.NONE } as Person;
const joan = (accessStatus: AccessStatus) => ({ id: 'adult-1', alias: '~Joan', accessStatus }) as Person;

describe('PersonNewModalComponent', () => {
  let fixture: ComponentFixture<PersonNewModalComponent>;
  let component: PersonNewModalComponent;
  let personService: {
    createProvisional: ReturnType<typeof vi.fn>;
    createInviteLink: ReturnType<typeof vi.fn>;
    getAll: ReturnType<typeof vi.fn>;
  };
  let delegateService: { createDelegate: ReturnType<typeof vi.fn> };
  const settings = signal<CollaSettings>({ ...DEFAULT_COLLA_SETTINGS, majorityAge: 18 });

  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent?.replace(/\s+/g, ' ') ?? '';
  const button = (label: string) =>
    Array.from(el().querySelectorAll('button')).find((b) => b.textContent?.trim() === label) as
      | HTMLButtonElement
      | undefined;
  const click = (label: string) => {
    button(label)!.click();
    fixture.detectChanges();
  };
  const createPerson = (alias: string, xicalla: boolean) => {
    component.alias.set(alias);
    component.isXicalla.set(xicalla);
    fixture.detectChanges();
    click('Crea');
  };
  const pickResponsible = (person: Person) => {
    const picker = fixture.debugElement.query(By.directive(ResponsiblePickerComponent))
      .componentInstance as ResponsiblePickerComponent;
    picker.selectionChange.emit({ person, delegateType: DelegateType.PARENT });
    fixture.detectChanges();
  };

  beforeEach(async () => {
    personService = {
      createProvisional: vi.fn().mockReturnValue(of(PEPA)),
      createInviteLink: vi.fn().mockReturnValue(of(LINK)),
      getAll: vi.fn().mockReturnValue(of({ data: [], meta: { total: 0, page: 1, limit: 10 } })),
    };
    delegateService = { createDelegate: vi.fn().mockReturnValue(of({ id: 'del-1' })) };

    await TestBed.configureTestingModule({
      imports: [PersonNewModalComponent],
      providers: [
        { provide: PersonService, useValue: personService },
        { provide: PersonDelegateService, useValue: delegateService },
        { provide: CollaSettingsService, useValue: { settings } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
        allLucideIconsProvider,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PersonNewModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('step 1: alias', () => {
    it('asks for the alias and whether the person is xicalla, with the colla\'s age of majority', () => {
      expect(el().querySelector('input[type="text"], input:not([type])')).toBeTruthy();
      expect(text()).toContain('Xicalla');
      expect(text()).toContain(
        "Menor de 18 anys.",
      );
    });

    it('disables «Crea» while the alias is empty', () => {
      expect(button('Crea')!.disabled).toBe(true);
    });

    it('«Cancel·la» closes without creating anyone', () => {
      const closed = vi.fn();
      component.closed.subscribe(closed);

      click('Cancel·la');

      expect(closed).toHaveBeenCalled();
      expect(personService.createProvisional).not.toHaveBeenCalled();
    });

    it('creates the provisional person with the xicalla flag and reports it straight away', () => {
      const created = vi.fn();
      component.created.subscribe(created);

      createPerson('Pepa', true);

      expect(personService.createProvisional).toHaveBeenCalledWith('Pepa', true);
      expect(created).toHaveBeenCalledWith(PEPA);
    });

    it('stays on the step and shows the API message when creation fails', () => {
      personService.createProvisional.mockReturnValue(throwError(() => ({ error: { message: 'Àlies duplicat' } })));

      createPerson('Pepa', false);

      expect(text()).toContain('Àlies duplicat');
      expect(button('Crea')).toBeTruthy();
    });
  });

  describe('adult: the invite', () => {
    beforeEach(() => createPerson('Pepa', false));

    it('explains what the link is for, without the provisional prefix', () => {
      expect(text()).toContain("Accés a l'app");
      expect(text()).toContain('S\'ha creat la persona Pepa.');
      expect(text()).toContain(
        "Per a donar-li accés a l'app, creeu un enllaç d'invitació i envieu-lo a Pepa. En obrir-lo, completarà les seues dades i triarà una contrasenya.",
      );
      expect(text()).not.toContain('~Pepa');
    });

    it('«Omet» closes without a link', () => {
      const closed = vi.fn();
      component.closed.subscribe(closed);

      click('Omet');

      expect(closed).toHaveBeenCalled();
      expect(personService.createInviteLink).not.toHaveBeenCalled();
    });

    it('creates the link from the footer, then offers «Fet»', () => {
      click("Crea l'enllaç d'invitació");

      expect(personService.createInviteLink).toHaveBeenCalledWith('new-1');
      expect(text()).toContain('Envieu este enllaç a Pepa');
      expect(button('Omet')).toBeUndefined();

      const closed = vi.fn();
      component.closed.subscribe(closed);
      click('Fet');
      expect(closed).toHaveBeenCalled();
    });
  });

  describe('xicalla: the responsible person', () => {
    beforeEach(() => createPerson('Pepa', true));

    it('explains who manages a xicalla, and never offers an invite for them', () => {
      expect(text()).toContain('Persona responsable');
      expect(text()).toContain(
        "S'ha creat Pepa. Com que és xicalla, la seua assistència i les seues dades les gestiona una persona adulta responsable des del seu compte.",
      );
      expect(button("Crea l'enllaç d'invitació")).toBeUndefined();
    });

    it('keeps «Vincula» disabled until an adult is picked', () => {
      expect(button('Vincula')!.disabled).toBe(true);
      pickResponsible(joan(AccessStatus.NONE));
      expect(button('Vincula')!.disabled).toBe(false);
    });

    it('links the adult as primary, by person', () => {
      pickResponsible(joan(AccessStatus.NONE));
      click('Vincula');

      expect(delegateService.createDelegate).toHaveBeenCalledWith('new-1', {
        responsiblePersonId: 'adult-1',
        delegateType: DelegateType.PARENT,
        isPrimary: true,
      });
    });

    it('shows the API message when the link is refused', () => {
      delegateService.createDelegate.mockReturnValue(
        throwError(() => ({ error: { message: 'La persona responsable ha de ser adulta.' } })),
      );
      pickResponsible(joan(AccessStatus.NONE));
      click('Vincula');

      expect(text()).toContain('La persona responsable ha de ser adulta.');
    });

    it.each([AccessStatus.ACTIVE, AccessStatus.INVITED])(
      'finishes once linked when the adult is %s: they can already get in, or have a live link',
      (status) => {
        const closed = vi.fn();
        component.closed.subscribe(closed);
        pickResponsible(joan(status));

        click('Vincula');

        expect(closed).toHaveBeenCalled();
      },
    );

    it.each([AccessStatus.NONE, AccessStatus.INVITE_EXPIRED])(
      'goes on to the adult\'s own invite when they are %s',
      (status) => {
        pickResponsible(joan(status));
        click('Vincula');

        expect(text()).toContain('Accés de la persona responsable');
        expect(text()).toContain(
          "Joan (pare/mare) és ara la persona responsable de Pepa. Joan encara no té accés a l'app: envieu-li este enllaç. En activar el compte, també podrà completar les dades de Pepa.",
        );

        click("Crea l'enllaç d'invitació");
        expect(personService.createInviteLink).toHaveBeenCalledWith('adult-1');
        expect(button('Fet')).toBeTruthy();
      },
    );

    it('«Omet» leaves the xicalla without a responsible', () => {
      const closed = vi.fn();
      component.closed.subscribe(closed);

      click('Omet');

      expect(closed).toHaveBeenCalled();
      expect(delegateService.createDelegate).not.toHaveBeenCalled();
    });
  });
});
