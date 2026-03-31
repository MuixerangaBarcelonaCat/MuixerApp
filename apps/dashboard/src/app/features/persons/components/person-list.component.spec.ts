import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';
import { of } from 'rxjs';
import { PersonListComponent } from './person-list.component';
import { PersonService } from '../services/person.service';
import { AvailabilityStatus, OnboardingStatus } from '@muixer/shared';

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
    email: null,
    phone: null,
    birthDate: null,
    shoulderHeight: 140,
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
});
