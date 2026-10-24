import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { PersonService } from '../../../../features/persons/services/person.service';
import { Person } from '../../../../features/persons/models/person.model';
import { PersonSearchInputComponent } from './person-search-input.component';

describe('PersonSearchInputComponent', () => {
  let fixture: ComponentFixture<PersonSearchInputComponent>;
  let personService: { getAll: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    personService = { getAll: vi.fn().mockReturnValue(of({ data: [], meta: { total: 0, page: 1, limit: 10 } })) };
    await TestBed.configureTestingModule({
      imports: [PersonSearchInputComponent],
      providers: [{ provide: PersonService, useValue: personService }, allLucideIconsProvider],
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

  describe('isXicalla filter', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('does not filter by xicalla unless asked', () => {
      fixture.componentInstance.onInput('mar');
      vi.advanceTimersByTime(300);

      expect(personService.getAll.mock.calls[0][0].isXicalla).toBeUndefined();
    });

    it('passes the xicalla filter to the search when set', () => {
      fixture.componentRef.setInput('isXicalla', false);
      fixture.componentInstance.onInput('mar');
      vi.advanceTimersByTime(300);

      expect(personService.getAll).toHaveBeenCalledWith({ search: 'mar', limit: 10, isActive: true, isXicalla: false });
    });
  });

  describe('inline', () => {
    const list = () => fixture.nativeElement.querySelector('ul') as HTMLElement;
    const showResults = () => {
      fixture.componentInstance.results.set([{ id: 'p1', alias: 'PEP', name: 'Pep', firstSurname: 'Puig' } as Person]);
      fixture.componentInstance.open.set(true);
      fixture.detectChanges();
    };

    it('floats the results over the page by default', () => {
      showResults();
      expect(list().classList).toContain('absolute');
    });

    it('lays the results out in the flow when inline, so a scrolling container (a modal) does not clip them', () => {
      fixture.componentRef.setInput('inline', true);
      showResults();
      expect(list().classList).not.toContain('absolute');
    });
  });
});
