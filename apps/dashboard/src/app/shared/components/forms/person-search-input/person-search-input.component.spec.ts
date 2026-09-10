import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PersonService } from '../../../../features/persons/services/person.service';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { PersonSearchInputComponent } from './person-search-input.component';

describe('PersonSearchInputComponent', () => {
  let fixture: ComponentFixture<PersonSearchInputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PersonSearchInputComponent],
      providers: [
        allLucideIconsProvider,
        {
          provide: PersonService,
          useValue: {
            getAll: () =>
              of({ data: [], meta: { total: 0, page: 1, limit: 10 } }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PersonSearchInputComponent);
  });

  it('renders candidate identity as alias and name without surname', () => {
    fixture.componentInstance.results.set([
      {
        id: 'person-1',
        alias: 'ANNA',
        name: 'Anna',
        positions: [],
        isProvisional: true,
        isXicalla: true,
      } as unknown as Parameters<typeof fixture.componentInstance.results.set>[0][number],
    ]);
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('ANNA');
    expect(fixture.nativeElement.textContent).toContain('Anna');
    expect(fixture.nativeElement.textContent).not.toContain('Provisional');
    expect(fixture.nativeElement.textContent).not.toContain('Xicalla');
  });
});
