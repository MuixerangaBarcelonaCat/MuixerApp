import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { AccessStatus, DelegateType } from '@muixer/shared';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { PersonService } from '../../services/person.service';
import { Person } from '../../models/person.model';
import { PersonSearchInputComponent } from '../../../../shared/components/forms/person-search-input/person-search-input.component';
import { ResponsiblePickerComponent, ResponsibleSelection } from './responsible-picker.component';

const MARTA = { id: 'adult-1', alias: 'Marta', name: 'Marta', firstSurname: 'Puig', accessStatus: AccessStatus.ACTIVE } as Person;

describe('ResponsiblePickerComponent', () => {
  let fixture: ComponentFixture<ResponsiblePickerComponent>;
  let personService: { getAll: ReturnType<typeof vi.fn>; createProvisional: ReturnType<typeof vi.fn> };
  let emitted: (ResponsibleSelection | null)[];

  const el = () => fixture.nativeElement as HTMLElement;
  const button = (label: string) =>
    Array.from(el().querySelectorAll('button')).find((b) => b.textContent?.includes(label));
  const search = () => fixture.debugElement.query(By.directive(PersonSearchInputComponent));
  const relationOptions = () => Array.from(el().querySelectorAll('select option')).map((o) => o.textContent?.trim());

  const create = (isXicalla: boolean) => {
    fixture = TestBed.createComponent(ResponsiblePickerComponent);
    fixture.componentRef.setInput('personId', 'child-1');
    fixture.componentRef.setInput('isXicalla', isXicalla);
    emitted = [];
    fixture.componentInstance.selectionChange.subscribe((s) => emitted.push(s));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    personService = {
      getAll: vi.fn().mockReturnValue(of({ data: [], meta: { total: 0, page: 1, limit: 10 } })),
      createProvisional: vi.fn(),
    };
    await TestBed.configureTestingModule({
      imports: [ResponsiblePickerComponent],
      providers: [{ provide: PersonService, useValue: personService }, allLucideIconsProvider],
    }).compileComponents();
  });

  it('offers only Pare/mare and Tutor/a for a xicalla', () => {
    create(true);
    expect(relationOptions()).toEqual(['Pare/mare', 'Tutor/a']);
  });

  it('also offers Altres for an adult', () => {
    create(false);
    expect(relationOptions()).toEqual(['Pare/mare', 'Tutor/a', 'Altres']);
  });

  it('searches adults only, never the person themselves', () => {
    create(true);
    const input = search().componentInstance as PersonSearchInputComponent;
    expect(input.isXicalla()).toBe(false);
    expect(input.excludeIds()).toEqual(['child-1']);
    // The picker lives in modals, whose scrolling body would clip a floating list.
    expect(input.inline()).toBe(true);
  });

  it('emits the picked adult with the relation, and shows them with their access', () => {
    create(true);
    (search().componentInstance as PersonSearchInputComponent).selected.emit(MARTA);
    fixture.detectChanges();

    expect(emitted.at(-1)).toEqual({ person: MARTA, delegateType: DelegateType.PARENT });
    expect(el().textContent).toContain('Marta');
    expect(el().textContent).toContain('Compte actiu');
  });

  it('re-emits when the relation changes', () => {
    create(true);
    (search().componentInstance as PersonSearchInputComponent).selected.emit(MARTA);
    fixture.componentInstance.onTypeChange(DelegateType.GUARDIAN);

    expect(emitted.at(-1)).toEqual({ person: MARTA, delegateType: DelegateType.GUARDIAN });
  });

  it('«Canvia» clears the choice', () => {
    create(true);
    (search().componentInstance as PersonSearchInputComponent).selected.emit(MARTA);
    fixture.detectChanges();

    button('Canvia')!.click();
    fixture.detectChanges();

    expect(emitted.at(-1)).toBeNull();
    expect(search()).toBeTruthy();
  });

  describe('«Crea la persona adulta»', () => {
    const openForm = async () => {
      button('Crea la persona adulta')!.click();
      fixture.detectChanges();
      const input: HTMLInputElement = el().querySelector('fieldset input')!;
      input.value = 'Joan';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      await fixture.whenStable();
    };

    it('creates a provisional adult and picks them', async () => {
      const joan = { id: 'adult-2', alias: '~Joan', accessStatus: AccessStatus.NONE } as Person;
      personService.createProvisional.mockReturnValue(of(joan));
      create(true);
      await openForm();

      button('Crea i selecciona')!.click();
      fixture.detectChanges();

      expect(personService.createProvisional).toHaveBeenCalledWith('Joan', false);
      expect(emitted.at(-1)).toEqual({ person: joan, delegateType: DelegateType.PARENT });
      expect(el().querySelector('fieldset')).toBeNull();
    });

    it('explains that the adult is created as provisional', async () => {
      create(true);
      await openForm();

      expect(el().textContent).toContain(
        "Es crearà com a persona provisional. Després podreu enviar-li l'enllaç d'invitació.",
      );
    });

    it('shows the API message when the adult cannot be created', async () => {
      personService.createProvisional.mockReturnValue(
        throwError(() => ({ error: { message: 'Ja existeix una persona provisional amb l\'àlies "Joan".' } })),
      );
      create(true);
      await openForm();

      button('Crea i selecciona')!.click();
      fixture.detectChanges();

      expect(el().textContent).toContain('Ja existeix una persona provisional');
      expect(emitted.at(-1)).not.toEqual(expect.objectContaining({ person: expect.anything() }));
    });
  });
});
