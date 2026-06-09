import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import {
  LUCIDE_ICONS, LucideIconProvider,
  Plus, Search, ChevronDown, ChevronRight, FolderOpen,
  Pencil, Trash2, History, AlertTriangle, X,
} from 'lucide-angular';
import { FamilyListTabComponent } from './family-list-tab.component';
import { FigureTemplateService } from '../../../services/figure-template.service';
import { FigureFamilyService } from '../../../services/figure-family.service';
import { ToastService } from '../../../../../shared/components/feedback/toast/toast.service';
import { FigureFamilyDetail, FigureFamilyListItem } from '../../../models/figure-family.model';

const makeFamilyListItem = (overrides: Partial<FigureFamilyListItem> = {}): FigureFamilyListItem => ({
  id: 'fam-1',
  name: 'Pilar de 4',
  slug: 'pilar-de-4',
  description: null,
  variantCount: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const makeFamilyDetail = (overrides: Partial<FigureFamilyDetail> = {}): FigureFamilyDetail => ({
  ...makeFamilyListItem(),
  metadata: {},
  variants: [{ id: 'tmpl-1', name: 'pd4 1C', slug: 'pd4-1c', variantOrder: 1, nodeCount: 10, renglaCount: 4 }],
  ...overrides,
});

describe('FamilyListTabComponent', () => {
  let fixture: ComponentFixture<FamilyListTabComponent>;
  let component: FamilyListTabComponent;
  let router: { navigate: ReturnType<typeof vi.fn> };
  let familyService: {
    getAll: ReturnType<typeof vi.fn>;
    getOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let figureService: {
    getAll: ReturnType<typeof vi.fn>;
    getOne: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let toastService: { error: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    router = { navigate: vi.fn() };
    familyService = {
      getAll: vi.fn().mockReturnValue(of({ data: [makeFamilyDetail()], meta: { total: 1, page: 1, limit: 50 } })),
      getOne: vi.fn().mockReturnValue(of(makeFamilyDetail())),
      create: vi.fn().mockReturnValue(of(makeFamilyDetail())),
      update: vi.fn().mockReturnValue(of(makeFamilyDetail())),
      remove: vi.fn().mockReturnValue(of(undefined)),
    };
    figureService = {
      getAll: vi.fn().mockReturnValue(of({ data: [], meta: { total: 0, page: 1, limit: 25 } })),
      getOne: vi.fn().mockReturnValue(of({ id: 'tmpl-1', nodes: [] })),
      remove: vi.fn().mockReturnValue(of(undefined)),
    };
    toastService = { error: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [FamilyListTabComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: FigureFamilyService, useValue: familyService },
        { provide: FigureTemplateService, useValue: figureService },
        { provide: ToastService, useValue: toastService },
        {
          provide: LUCIDE_ICONS, multi: true,
          useFactory: () => new LucideIconProvider({
            Plus, Search, ChevronDown, ChevronRight, FolderOpen,
            Pencil, Trash2, History, AlertTriangle, X,
          }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FamilyListTabComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates successfully', () => {
    expect(component).toBeTruthy();
  });

  it('loads families on init', () => {
    expect(familyService.getAll).toHaveBeenCalledWith(
      expect.objectContaining({ includeVariants: true }),
    );
    expect(component.families()).toHaveLength(1);
    expect(component.families()[0].name).toBe('Pilar de 4');
  });

  it('toggleFamily expands a collapsed family', () => {
    expect(component.isFamilyExpanded('fam-1')).toBe(false);
    component.toggleFamily('fam-1');
    expect(component.isFamilyExpanded('fam-1')).toBe(true);
  });

  it('toggleFamily collapses an already-expanded family', () => {
    component.toggleFamily('fam-1');
    component.toggleFamily('fam-1');
    expect(component.isFamilyExpanded('fam-1')).toBe(false);
  });

  it('openCreateFamilyModal sets modal to create mode', () => {
    component.openCreateFamilyModal();
    expect(component.familyModal()?.mode).toBe('create');
    expect(component.familyModal()?.name).toBe('');
  });

  it('onFamilyNameChange auto-generates slug when creating', () => {
    component.openCreateFamilyModal();
    component.onFamilyNameChange('Pilar de 4');
    expect(component.familyModal()?.slug).toBe('pilar-de-4');
  });

  it('submitFamilyModal calls familyService.create', () => {
    component.openCreateFamilyModal();
    component.onFamilyNameChange('Pilar de 4');
    component.submitFamilyModal();
    expect(familyService.create).toHaveBeenCalledWith({
      name: 'Pilar de 4',
      slug: 'pilar-de-4',
      description: undefined,
    });
  });

  it('submitFamilyModal shows error toast on 409 slug conflict', () => {
    const err = new HttpErrorResponse({ status: 409, error: { message: 'slug already in use' } });
    familyService.create = vi.fn().mockReturnValue(throwError(() => err));
    component.openCreateFamilyModal();
    component.onFamilyNameChange('Test');
    component.submitFamilyModal();
    expect(toastService.error).toHaveBeenCalled();
    const call = (toastService.error as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(call).toContain("L'identificador");
  });

  it('openEditFamilyModal sets modal to edit mode with pre-filled data', () => {
    const family = makeFamilyListItem();
    component.openEditFamilyModal(family);
    expect(component.familyModal()?.mode).toBe('edit');
    expect(component.familyModal()?.name).toBe('Pilar de 4');
    expect(component.familyModal()?.slug).toBe('pilar-de-4');
  });

  it('closeFamilyModal clears the modal', () => {
    component.openCreateFamilyModal();
    component.closeFamilyModal();
    expect(component.familyModal()).toBeNull();
  });

  it('confirmDeleteFamily calls familyService.remove and reloads', () => {
    component.confirmDeleteFamily('fam-1');
    expect(familyService.remove).toHaveBeenCalledWith('fam-1');
    expect(familyService.getAll).toHaveBeenCalledTimes(2); // init + reload
  });

  it('confirmDeleteFamily shows error toast on 409', () => {
    const err = new HttpErrorResponse({
      status: 409,
      error: { message: 'No es pot esborrar: la família té variants associades.' },
    });
    familyService.remove = vi.fn().mockReturnValue(throwError(() => err));
    component.confirmDeleteFamily('fam-1');
    expect(toastService.error).toHaveBeenCalled();
  });

  it('openNewVariant navigates to editor with family params', () => {
    const family = makeFamilyDetail();
    component.openNewVariant(family);
    expect(router.navigate).toHaveBeenCalledWith(['/pinyes/templates/new'], {
      queryParams: { familyId: 'fam-1', familyName: 'Pilar de 4' },
    });
  });
});
