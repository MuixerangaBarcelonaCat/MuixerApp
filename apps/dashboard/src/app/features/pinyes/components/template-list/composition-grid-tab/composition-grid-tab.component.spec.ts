import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { allLucideIconsProvider } from '../../../../../../testing/lucide-test-provider';
import { CompositionGridTabComponent } from './composition-grid-tab.component';
import { CompositionService } from '../../../services/composition.service';
import { CompositionListItem } from '../../../models/composition.model';

const makeComposition = (overrides: Partial<CompositionListItem> = {}): CompositionListItem => ({
  id: 'comp-uuid-1',
  name: 'Pilars de plaça',
  description: null,
  entryCount: 3,
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

  it('navigateToEdit navigates to /pinyes/compositions/:id/edit', () => {
    component.navigateToEdit('comp-uuid-1');
    expect(routerMock.navigate).toHaveBeenCalledWith(['/pinyes/compositions', 'comp-uuid-1', 'edit']);
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
});
