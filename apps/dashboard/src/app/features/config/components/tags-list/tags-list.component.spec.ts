import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of } from 'rxjs';
import { Router, provideRouter } from '@angular/router';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { TagsListComponent } from './tags-list.component';
import { TagService } from '../../services/tag.service';
import { PersonService } from '../../../persons/services/person.service';
import { ToastService } from '@muixer/ui';
import { TagWithCount } from '../../models/tag.model';
import { TagCategory } from '@muixer/shared';

const mockTag = (overrides: Partial<TagWithCount> = {}): TagWithCount => ({
  id: 't1',
  name: 'Vent',
  slug: 'vent',
  shortDescription: null,
  longDescription: null,
  color: '#6366f1',
  category: TagCategory.PINYA,
  positionTypes: [],
  personCount: 3,
  ...overrides,
});

describe('TagsListComponent', () => {
  let component: TagsListComponent;
  let fixture: ComponentFixture<TagsListComponent>;
  let tagService: { getAll: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let router: Router;
  let personService: { getAll: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    tagService = {
      getAll: vi.fn().mockReturnValue(of([mockTag()])),
      remove: vi.fn().mockReturnValue(of(undefined)),
    };
    toast = { success: vi.fn(), error: vi.fn() };
    personService = { getAll: vi.fn().mockReturnValue(of({ data: [], meta: { total: 4, page: 1, limit: 1 } })) };

    await TestBed.configureTestingModule({
      imports: [TagsListComponent],
      providers: [
        { provide: TagService, useValue: tagService },
        { provide: ToastService, useValue: toast },
        { provide: PersonService, useValue: personService },
        allLucideIconsProvider,
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TagsListComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
  });

  it('loads tags on init', () => {
    expect(tagService.getAll).toHaveBeenCalledTimes(1);
    expect(component.tags().length).toBe(1);
  });

  it('navigates to the tag detail page on row click', () => {
    component.onRowClick(mockTag());
    expect(router.navigate).toHaveBeenCalledWith(['/config/tags', 't1']);
  });

  it('ordena els grups pinya, tronc, xicalla i altres', () => {
    const ordered = component.sortedTags([
      mockTag({ category: TagCategory.ALTRES, name: 'Acompanyant' }),
      mockTag({ category: TagCategory.XICALLA, name: 'Xicalla' }),
      mockTag({ category: TagCategory.TRONC, name: 'Segona' }),
      mockTag({ category: TagCategory.PINYA, name: 'Mans' }),
    ]);

    expect(ordered.map((tag) => tag.category)).toEqual([
      TagCategory.PINYA,
      TagCategory.TRONC,
      TagCategory.XICALLA,
      TagCategory.ALTRES,
    ]);
  });


  it('loads the pending count on init', () => {
    expect(personService.getAll).toHaveBeenCalledWith({ isActive: true, tagRuleOk: false, limit: 1 });
    expect(component.pendingCount()).toBe(4);
  });

  it('shows the pending banner with the count', () => {
    expect(fixture.nativeElement.textContent).toContain("4 persones pendents d'etiquetar");
  });

  it('hides the banner when nobody is pending', () => {
    personService.getAll.mockReturnValue(of({ data: [], meta: { total: 0, page: 1, limit: 1 } }));
    component.onWizardClosed();
    fixture.detectChanges();
    expect(component.pendingCount()).toBe(0);
    expect(fixture.nativeElement.textContent).not.toContain("pendents d'etiquetar");
  });

  it('opens the wizard and refreshes the count when it closes', () => {
    component.openWizard();
    expect(component.wizardOpen()).toBe(true);
    personService.getAll.mockClear();
    component.onWizardClosed();
    expect(component.wizardOpen()).toBe(false);
    expect(personService.getAll).toHaveBeenCalledTimes(1);
  });
});
