import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { AccessStatus, DelegateType } from '@muixer/shared';
import { allLucideIconsProvider } from '../../../../../../testing/lucide-test-provider';
import { PersonService } from '../../../services/person.service';
import { PersonDelegateService } from '../../../services/person-delegate.service';
import { Person } from '../../../models/person.model';
import { ResponsiblePickerComponent } from '../../responsible-picker/responsible-picker.component';
import { ResponsibleModalComponent } from './responsible-modal.component';

const MARTA = { id: 'adult-1', alias: 'Marta', accessStatus: AccessStatus.ACTIVE } as Person;

describe('ResponsibleModalComponent', () => {
  let fixture: ComponentFixture<ResponsibleModalComponent>;
  let delegateService: { createDelegate: ReturnType<typeof vi.fn> };

  const el = () => fixture.nativeElement as HTMLElement;
  const button = (label: string) =>
    Array.from(el().querySelectorAll('button')).find((b) => b.textContent?.trim() === label);
  const pick = () => {
    const picker = fixture.debugElement.query(By.directive(ResponsiblePickerComponent))
      .componentInstance as ResponsiblePickerComponent;
    picker.selectionChange.emit({ person: MARTA, delegateType: DelegateType.GUARDIAN });
    fixture.detectChanges();
  };

  beforeEach(async () => {
    delegateService = { createDelegate: vi.fn().mockReturnValue(of({ id: 'del-1' })) };
    await TestBed.configureTestingModule({
      imports: [ResponsibleModalComponent],
      providers: [
        { provide: PersonDelegateService, useValue: delegateService },
        { provide: PersonService, useValue: { getAll: vi.fn(), createProvisional: vi.fn() } },
        allLucideIconsProvider,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ResponsibleModalComponent);
    fixture.componentRef.setInput('personId', 'child-1');
    fixture.componentRef.setInput('isXicalla', true);
    fixture.detectChanges();
  });

  it('is titled «Defineix la persona responsable»', () => {
    expect(el().querySelector('h2')?.textContent).toContain('Defineix la persona responsable');
  });

  it('keeps «Vincula» disabled until someone is picked', () => {
    expect(button('Vincula')!.disabled).toBe(true);
    pick();
    expect(button('Vincula')!.disabled).toBe(false);
  });

  it('links the picked person as primary, by person, and reports it', () => {
    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);
    pick();

    button('Vincula')!.click();

    expect(delegateService.createDelegate).toHaveBeenCalledWith('child-1', {
      responsiblePersonId: 'adult-1',
      delegateType: DelegateType.GUARDIAN,
      isPrimary: true,
    });
    expect(saved).toHaveBeenCalledWith({ id: 'del-1' });
  });

  it('shows the API message when the link is refused', () => {
    delegateService.createDelegate.mockReturnValue(
      throwError(() => ({ error: { message: 'La persona responsable ha de ser adulta.' } })),
    );
    pick();

    button('Vincula')!.click();
    fixture.detectChanges();

    expect(el().textContent).toContain('La persona responsable ha de ser adulta.');
  });
});
