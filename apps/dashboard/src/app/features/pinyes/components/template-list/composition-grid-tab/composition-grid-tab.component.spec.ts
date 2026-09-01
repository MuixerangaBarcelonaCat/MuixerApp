import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, ActivatedRoute } from '@angular/router';
import { vi } from 'vitest';
import { of, Subject } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { allLucideIconsProvider } from '../../../../../../testing/lucide-test-provider';
import { CompositionGridTabComponent } from './composition-grid-tab.component';
import { CompositionService } from '../../../services/composition.service';
import { CompositionListItem } from '../../../models/composition.model';
import { TemplatePreviewDrawingComponent } from '../../template-preview-drawing/template-preview-drawing.component';
import { ModalComponent, InputComponent, CardComponent, BadgeComponent } from '@muixer/ui';

const makeComposition = (overrides: Partial<CompositionListItem> = {}): CompositionListItem => ({
  id: 'comp-uuid-1',
  name: 'Pilars de plaça',
  description: null,
  entryCount: 3,
  figureProfiles: [],
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  ...overrides,
});

describe('CompositionGridTabComponent', () => {
  let fixture: ComponentFixture<CompositionGridTabComponent>;
  let component: CompositionGridTabComponent;
  let compositionService: {
    getAll: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    duplicate: ReturnType<typeof vi.fn>;
  };
  let routerMock: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    compositionService = {
      getAll: vi.fn().mockReturnValue(of({ data: [makeComposition()], meta: { total: 1, page: 1, limit: 25 } })),
      remove: vi.fn().mockReturnValue(of(undefined)),
      duplicate: vi.fn(),
    };
    routerMock = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [CompositionGridTabComponent],
      providers: [
        { provide: CompositionService, useValue: compositionService },
        { provide: Router, useValue: routerMock },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: vi.fn().mockReturnValue(null) } } },
        },
        allLucideIconsProvider,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CompositionGridTabComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads compositions on init', () => {
    expect(compositionService.getAll).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1 }),
    );
    expect(component.compositions()).toHaveLength(1);
    expect(component.compositions()[0].name).toBe('Pilars de plaça');
  });

  it('shows empty state when there are no compositions', () => {
    compositionService.getAll.mockReturnValue(of({ data: [], meta: { total: 0, page: 1, limit: 25 } }));
    component.ngOnInit();
    expect(component.compositions()).toHaveLength(0);
  });

  it('navigateToCreate navigates to /pinyes/compositions/new', () => {
    component.navigateToCreate();
    expect(routerMock.navigate).toHaveBeenCalledWith(['/pinyes/compositions/new']);
  });

  it('makes the whole card a link to the composition editor, with no separate Edita button', () => {
    const card = fixture.debugElement.query(By.directive(CardComponent))
      ?.componentInstance as CardComponent;
    expect(card.routerLink()).toEqual(['/pinyes/compositions', 'comp-uuid-1', 'edit']);
    expect(fixture.nativeElement.querySelector('button[aria-label^="Edita"]')).toBeFalsy();
  });

  it('does not render an "Actualitzat" timestamp on the card', () => {
    expect(fixture.nativeElement.textContent).not.toContain('Actualitzat');
  });

  describe('delete flow', () => {
    it('requestDelete sets confirmDeleteId', () => {
      component.requestDelete('comp-uuid-1');
      expect(component.confirmDeleteId()).toBe('comp-uuid-1');
    });

    it('cancelDelete clears confirmDeleteId', () => {
      component.requestDelete('comp-uuid-1');
      component.cancelDelete();
      expect(component.confirmDeleteId()).toBeNull();
    });

    it('confirmDelete calls the service and reloads the list', () => {
      component.requestDelete('comp-uuid-1');
      component.confirmDelete('comp-uuid-1');

      expect(compositionService.remove).toHaveBeenCalledWith('comp-uuid-1');
      expect(compositionService.getAll).toHaveBeenCalledTimes(2);
      expect(component.confirmDeleteId()).toBeNull();
    });
  });

  describe('duplicate', () => {
    it('calls the service and navigates to the new composition edit URL', () => {
      compositionService.duplicate.mockReturnValue(of(makeComposition({ id: 'comp-copy-1' })));

      component.duplicate('comp-uuid-1');

      expect(compositionService.duplicate).toHaveBeenCalledWith('comp-uuid-1');
      expect(routerMock.navigate).toHaveBeenCalledWith(['/pinyes/compositions', 'comp-copy-1', 'edit']);
    });
  });

  describe('search', () => {
    it('debounces search input and reloads with the search filter', () => {
      vi.useFakeTimers();
      component.onSearchChange('plaça');

      expect(compositionService.getAll).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(300);

      expect(compositionService.getAll).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'plaça', page: 1 }),
      );
    });
  });

  describe('preview drawing', () => {
    it('draws each entry\'s troncProfile, seeded by the composition name', () => {
      compositionService.getAll.mockReturnValue(
        of({
          data: [
            makeComposition({
              name: 'Tanda d\'obertura',
              figureProfiles: [[4, 2], [2, 2], [1]],
            }),
          ],
          meta: { total: 1, page: 1, limit: 25 },
        }),
      );
      component.ngOnInit();
      fixture.detectChanges();

      const drawing = fixture.debugElement.query(By.directive(TemplatePreviewDrawingComponent))
        ?.componentInstance as TemplatePreviewDrawingComponent;
      expect(drawing).toBeTruthy();
      expect(drawing.profiles()).toEqual([[4, 2], [2, 2], [1]]);
      expect(drawing.seedKey()).toBe('Tanda d\'obertura');
    });
  });

  describe('design-system primitives', () => {
    it('the search field is a lib-input', () => {
      const input = fixture.debugElement.query(By.directive(InputComponent));
      expect(input).toBeTruthy();
    });

    it('opens a lib-modal (not an inline row swap) when requestDelete is called', () => {
      component.requestDelete('comp-uuid-1');
      fixture.detectChanges();
      const modal = fixture.debugElement.query(By.directive(ModalComponent))
        ?.componentInstance as ModalComponent;
      expect(modal.open()).toBe(true);
    });

    it('closes the modal on cancelDelete', () => {
      component.requestDelete('comp-uuid-1');
      component.cancelDelete();
      fixture.detectChanges();
      const modal = fixture.debugElement.query(By.directive(ModalComponent))
        ?.componentInstance as ModalComponent;
      expect(modal.open()).toBe(false);
    });

    it('keeps the confirm modal open (with a loading confirm button) while the delete request is in flight', () => {
      const subject = new Subject<void>();
      compositionService.remove.mockReturnValue(subject);

      component.requestDelete('comp-uuid-1');
      component.confirmDelete('comp-uuid-1');
      expect(component.confirmDeleteId()).toBe('comp-uuid-1');
      expect(component.deletingId()).toBe('comp-uuid-1');

      subject.next();
      subject.complete();
      expect(component.confirmDeleteId()).toBeNull();
      expect(component.deletingId()).toBeNull();
    });

    it('renders each composition inside a lib-card with a title sash bearing its name', () => {
      const card = fixture.debugElement.query(By.directive(CardComponent))
        ?.componentInstance as CardComponent;
      expect(card).toBeTruthy();
      expect(card.sash()).toBe('title');
      expect(card.title()).toBe('Pilars de plaça');
      expect(card.icon()).toBeUndefined();
    });

    it('gives the preview drawing the same background as the rest of the card', () => {
      const preview: HTMLElement = fixture.nativeElement.querySelector('.h-36');
      expect(preview.className).not.toContain('bg-base-200');
    });

    it('no longer darkens the preview drawing on hover, independent of the rest of the card', () => {
      const preview: HTMLElement | null = fixture.nativeElement.querySelector('.h-36');
      expect(preview?.className).not.toContain('brightness');
    });

    it('gives the entry-count badge the primary color', () => {
      const badge = fixture.debugElement.query(By.directive(BadgeComponent))
        ?.componentInstance as BadgeComponent;
      expect(badge).toBeTruthy();
      expect(badge.variant()).toBe('primary');
    });

    it('gives the search field real, visible room instead of shrinking to fit content', () => {
      const wrapper: HTMLElement | null = fixture.nativeElement.querySelector('lib-input')?.parentElement;
      expect(wrapper?.className).toContain('flex-1');
    });

    it('starts the grid at the same vertical offset as the figures tab (no extra top margin)', () => {
      const root: HTMLElement = fixture.nativeElement.querySelector(':scope > div');
      expect(root.className).not.toContain('mt-4');
    });

    it('keeps Duplica/Elimina icon-only (no visible label) so the actions always fit the card', () => {
      const duplica: HTMLElement = fixture.nativeElement.querySelector(
        'button[aria-label^="Duplica"]',
      );
      const elimina: HTMLElement = fixture.nativeElement.querySelector(
        'button[aria-label^="Elimina"]',
      );
      expect(duplica.textContent?.trim()).toBe('');
      expect(elimina.textContent?.trim()).toBe('');
    });
  });
});
