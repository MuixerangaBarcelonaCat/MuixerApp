import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of } from 'rxjs';
import { Router, provideRouter } from '@angular/router';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { TagsListComponent } from './tags-list.component';
import { TagService } from '../../services/tag.service';
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

  beforeEach(async () => {
    tagService = {
      getAll: vi.fn().mockReturnValue(of([mockTag()])),
      remove: vi.fn().mockReturnValue(of(undefined)),
    };
    toast = { success: vi.fn(), error: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [TagsListComponent],
      providers: [
        { provide: TagService, useValue: tagService },
        { provide: ToastService, useValue: toast },
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

  it('filtra el catàleg pels grups seleccionats', () => {
    component.tags.set([
      mockTag({ category: TagCategory.PINYA, name: 'Mans' }),
      mockTag({ category: TagCategory.TRONC, name: 'Segona' }),
    ]);

    component.selectedGroups.set([TagCategory.TRONC]);

    expect(component.visibleTags().map((tag) => tag.name)).toEqual(['Segona']);
  });
});
