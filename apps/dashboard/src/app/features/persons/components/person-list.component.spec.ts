import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';
import { of } from 'rxjs';
import { allLucideIconsProvider } from '../../../../testing/lucide-test-provider';
import { PersonListComponent } from './person-list.component';
import { Position } from '../models/person.model';
import { PersonService } from '../services/person.service';
import { AvailabilityStatus, OnboardingStatus } from '@muixer/shared';
import { SHOULDER_HEIGHT_BASELINE_CM } from '../../../shared/utils/person.util';

describe('PersonListComponent', () => {
  let fixture: ComponentFixture<PersonListComponent>;
  let personService: {
    getAll: ReturnType<typeof vi.fn>;
    getPositions: ReturnType<typeof vi.fn>;
  };
  let router: { navigate: ReturnType<typeof vi.fn> };

  const mockPerson = {
    id: 'p1',
    name: 'Test',
    firstSurname: 'User',
    secondSurname: null,
    alias: 'tester',
    phone: null,
    birthDate: null,
    shoulderHeight: SHOULDER_HEIGHT_BASELINE_CM,
    isXicalla: false,
    isMember: false,
    availability: AvailabilityStatus.AVAILABLE,
    onboardingStatus: OnboardingStatus.NOT_APPLICABLE,
    shirtDate: null,
    notes: null,
    isActive: true,
    positions: [],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-02',
  };

  beforeEach(async () => {
    personService = {
      getAll: vi.fn().mockReturnValue(
        of({
          data: [mockPerson],
          meta: { total: 1, page: 1, limit: 50 },
        }),
      ),
      getPositions: vi.fn().mockReturnValue(of([])),
    };
    router = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [PersonListComponent],
      providers: [
        { provide: PersonService, useValue: personService },
        { provide: Router, useValue: router },
        allLucideIconsProvider,
      ],
    }).compileComponents();

    localStorage.clear();
    fixture = TestBed.createComponent(PersonListComponent);
    fixture.detectChanges();
  });

  it('should create and load persons and positions', () => {
    expect(fixture.componentInstance).toBeTruthy();
    expect(personService.getAll).toHaveBeenCalled();
    expect(personService.getPositions).toHaveBeenCalled();
  });

  it('onSortColumn toggles sort and calls getAll with sort params', () => {
    const col = { key: 'alias', label: 'Alies', defaultVisible: true, sortField: 'alias' };
    fixture.componentInstance.onSortColumn(col);
    fixture.detectChanges();
    expect(personService.getAll).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: 'alias', sortOrder: 'ASC' }),
    );

    fixture.componentInstance.onSortColumn(col);
    fixture.detectChanges();
    expect(personService.getAll).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: 'alias', sortOrder: 'DESC' }),
    );
  });

  it('shoulderHeightRelative toggles display mode without extra API call', () => {
    const callsBefore = personService.getAll.mock.calls.length;
    fixture.componentInstance.shoulderHeightRelative.set(true);
    fixture.detectChanges();
    expect(personService.getAll.mock.calls.length).toBe(callsBefore);
    expect(fixture.componentInstance.formatShoulderHeightDisplay(150)).toBe('+10');
  });

  it('labels the tags column "Etiquetes" instead of "Posicions"', () => {
    const positionsColumn = fixture.componentInstance.allColumns.find(c => c.key === 'positions');
    expect(positionsColumn?.label).toBe('Etiquetes');
  });

  it('renders each tag as a color badge in the table', () => {
    fixture.componentInstance.persons.set([
      { ...mockPerson, positions: [{ id: 'pos1', name: 'Pinya', slug: 'pinya', zone: null, color: '#ff0000' }] } as never,
    ]);
    fixture.detectChanges();

    const badges = fixture.nativeElement.querySelectorAll('.badge');
    const tagBadge = Array.from(badges as NodeListOf<HTMLElement>).find(b => b.textContent?.trim() === 'Pinya');
    expect(tagBadge).toBeTruthy();
    expect(tagBadge?.style.backgroundColor).toBe('rgb(255, 0, 0)');
  });

  it('does not render a "Tots" option', () => {
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLElement[];
    expect(buttons.some(b => b.textContent?.trim() === 'Tots')).toBe(false);
  });

  it('defaults to the "Cens" selector and excludes provisional persons', () => {
    expect(personService.getAll).toHaveBeenCalledWith(
      expect.objectContaining({ isProvisional: false }),
    );
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLElement[];
    const censButton = buttons.find(b => b.textContent?.trim() === 'Cens');
    expect(censButton?.className).toContain('btn-active');
  });

  it('switching the selector to "Provisionals" filters by provisional persons', () => {
    fixture.componentInstance.setProvisionalTab('provisionals');
    fixture.detectChanges();

    expect(personService.getAll).toHaveBeenCalledWith(
      expect.objectContaining({ isProvisional: true }),
    );
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLElement[];
    const provisionalsButton = buttons.find(b => b.textContent?.trim() === 'Provisionals');
    expect(provisionalsButton?.className).toContain('btn-active');
  });

  describe('tap targets >=24px (WI-03, PE-L1)', () => {
    it('gives the position filter checkbox label a >=24px tap target', () => {
      const position: Position = { id: 'pos-1', name: 'Novatos', slug: 'novatos', zone: null, color: '#888' };
      fixture.componentInstance.positions.set([position]);
      fixture.detectChanges();

      const checkbox = fixture.nativeElement.querySelector('input[type="checkbox"].checkbox-xs') as HTMLElement;
      expect(checkbox).toBeTruthy();
      expect(checkbox.closest('label')?.className).toContain('min-h-6');
    });

    it('gives the search input a >=24px tap target (WI-22)', () => {
      const search = fixture.nativeElement.querySelector('input[type="text"]') as HTMLElement;
      expect(search).toBeTruthy();
      expect(search.className).toContain('h-6');
    });
  });

  describe('onPersonCreated (activation tutorial)', () => {
    it('closes the new-person modal and opens the activation tutorial instead of navigating immediately', () => {
      fixture.componentInstance.newPersonModalOpen.set(true);

      fixture.componentInstance.onPersonCreated(mockPerson as never);
      fixture.detectChanges();

      expect(fixture.componentInstance.newPersonModalOpen()).toBe(false);
      expect(router.navigate).not.toHaveBeenCalled();
      const dialog = fixture.nativeElement.querySelector('dialog.modal-open');
      expect(dialog).toBeTruthy();
    });

    it('navigates to the created person\'s detail page once the activation tutorial is closed', () => {
      fixture.componentInstance.onPersonCreated(mockPerson as never);
      fixture.detectChanges();

      fixture.componentInstance.onActivationTutorialClosed();

      expect(router.navigate).toHaveBeenCalledWith(['/persons', mockPerson.id]);
    });
  });
});
