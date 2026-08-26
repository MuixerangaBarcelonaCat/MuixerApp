import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { TagDetailComponent } from './tag-detail.component';
import { TagService } from '../../services/tag.service';
import { PersonService } from '../../../persons/services/person.service';
import { ToastService } from '@muixer/ui';
import { TagWithCount } from '../../models/tag.model';
import { Person } from '../../../persons/models/person.model';
import { TagCategory, AvailabilityStatus, OnboardingStatus } from '@muixer/shared';

const mockTag = (overrides: Partial<TagWithCount> = {}): TagWithCount => ({
  id: 't1',
  name: 'Vent',
  slug: 'vent',
  shortDescription: null,
  longDescription: null,
  color: '#6366f1',
  category: TagCategory.PINYA,
  positionTypes: [],
  personCount: 1,
  ...overrides,
});

const mockPerson = (overrides: Partial<Person> = {}): Person => ({
  id: 'p1',
  name: 'Joan',
  firstSurname: 'Puig',
  secondSurname: null,
  alias: 'Joanet',
  phone: null,
  birthDate: null,
  shoulderHeight: null,
  isXicalla: false,
  isMember: true,
  availability: AvailabilityStatus.AVAILABLE,
  onboardingStatus: OnboardingStatus.COMPLETED,
  shirtDate: null,
  notes: null,
  notesEmoji: null,
  isActive: true,
  positions: [],
  user: null,
  tagCompliance: { ok: true, missing: [] },
  attendedCount: 0,
  createdAt: '2025-01-01',
  updatedAt: '2025-01-01',
  ...overrides,
});

const mockPersonsResponse = (data: Person[] = [mockPerson()], total = 1) => ({
  data,
  meta: { total, page: 1, limit: 25 },
});

describe('TagDetailComponent', () => {
  let component: TagDetailComponent;
  let fixture: ComponentFixture<TagDetailComponent>;
  let tagService: {
    getOne: ReturnType<typeof vi.fn>;
    assignPersons: ReturnType<typeof vi.fn>;
    unassignPerson: ReturnType<typeof vi.fn>;
  };
  let personService: { getAll: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    tagService = {
      getOne: vi.fn().mockReturnValue(of(mockTag())),
      assignPersons: vi.fn().mockReturnValue(of(undefined)),
      unassignPerson: vi.fn().mockReturnValue(of(undefined)),
    };
    personService = {
      getAll: vi.fn().mockReturnValue(of(mockPersonsResponse())),
    };
    toast = { success: vi.fn(), error: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [TagDetailComponent],
      providers: [
        { provide: TagService, useValue: tagService },
        { provide: PersonService, useValue: personService },
        { provide: ToastService, useValue: toast },
        allLucideIconsProvider,
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: 't1' }) } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TagDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads the tag and its persons on init', () => {
    expect(tagService.getOne).toHaveBeenCalledWith('t1');
    expect(personService.getAll).toHaveBeenCalledWith({ positionIds: ['t1'], page: 1, limit: 25 });
    expect(component.tag()?.name).toBe('Vent');
    expect(component.persons().length).toBe(1);
  });

  it('excludeIds reflects the persons already loaded on the current page', () => {
    expect(component.excludeIds()).toEqual(['p1']);
  });

  it('selecting a person via the search input assigns it and reloads the list', () => {
    const newPerson = mockPerson({ id: 'p2', alias: 'Neta' });
    component.onPersonSelected(newPerson);
    expect(tagService.assignPersons).toHaveBeenCalledWith('t1', ['p2']);
    expect(personService.getAll).toHaveBeenCalledTimes(2);
    expect(toast.success).toHaveBeenCalled();
  });

  it('removing a person asks for confirmation before calling unassignPerson', () => {
    const target = mockPerson();
    component.confirmRemove(target);
    expect(component.confirmRemoveTarget()).toBe(target);
    expect(tagService.unassignPerson).not.toHaveBeenCalled();

    component.executeRemove();
    expect(tagService.unassignPerson).toHaveBeenCalledWith('t1', 'p1');
    expect(component.confirmRemoveTarget()).toBeNull();
  });

  it('shows an error toast when assigning a person fails', () => {
    tagService.assignPersons.mockReturnValue(
      throwError(() => ({ error: { message: 'No es pot afegir' } })),
    );
    component.onPersonSelected(mockPerson({ id: 'p3' }));
    expect(toast.error).toHaveBeenCalledWith('No es pot afegir');
  });

  it('shows an error state and never requests persons when the tag fails to load', async () => {
    tagService.getOne.mockReturnValue(
      throwError(() => ({ error: { message: 'No trobat' } })),
    );
    personService.getAll.mockClear();

    const errorFixture = TestBed.createComponent(TagDetailComponent);
    errorFixture.detectChanges();

    expect(errorFixture.componentInstance.tagLoadError()).toBe(true);
    expect(errorFixture.componentInstance.tag()).toBeNull();
    expect(personService.getAll).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();

    const html = errorFixture.nativeElement.textContent as string;
    expect(html).toContain('Etiqueta no trobada');
  });

  it('opens the edit modal and updates the header on saved without navigating away', () => {
    component.openEditModal();
    expect(component.modalOpen()).toBe(true);

    const updated = mockTag({ name: 'Vent actualitzat' });
    component.onModalSaved(updated);
    expect(component.modalOpen()).toBe(false);
    expect(component.tag()?.name).toBe('Vent actualitzat');
    expect(tagService.getOne).toHaveBeenCalledTimes(1);
  });
});
