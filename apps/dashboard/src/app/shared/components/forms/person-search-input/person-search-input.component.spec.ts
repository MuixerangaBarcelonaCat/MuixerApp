import { ComponentFixture, TestBed } from '@angular/core/testing';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { PersonService } from '../../../../features/persons/services/person.service';
import { Person } from '../../../../features/persons/models/person.model';
import { PersonSearchInputComponent } from './person-search-input.component';

describe('PersonSearchInputComponent', () => {
  let fixture: ComponentFixture<PersonSearchInputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PersonSearchInputComponent],
      providers: [{ provide: PersonService, useValue: {} }, allLucideIconsProvider],
    }).compileComponents();
    fixture = TestBed.createComponent(PersonSearchInputComponent);
  });

  it('marks a xicalla result with the xicalla icon, not an emoji', () => {
    const person = { id: 'p1', alias: 'PEP', name: 'Pep', firstSurname: 'Puig', isXicalla: true, isProvisional: false } as Person;
    fixture.componentInstance.results.set([person]);
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();

    const mark: HTMLElement = fixture.nativeElement.querySelector('[aria-label="Xicalla"]');
    expect(mark.querySelector('svg')).toBeTruthy();
    expect(fixture.nativeElement.textContent).not.toContain('👶');
  });
});
