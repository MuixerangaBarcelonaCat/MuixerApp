import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, ActivatedRoute } from '@angular/router';
import { vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import {
  LUCIDE_ICONS, LucideIconProvider,
  Plus, Search, ChevronDown, ChevronRight, FolderOpen, Layers, LayoutGrid,
  GitBranch, Pencil, Trash2, Copy, X, Info, ChevronLeft, HelpCircle,
} from 'lucide-angular';
import { TemplateListComponent } from './template-list.component';
import { FigureTemplateService } from '../../services/figure-template.service';
import { FigureFamilyService } from '../../services/figure-family.service';
import { CompositionTemplateService } from '../../services/composition-template.service';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';
import { FigureFamilyDetail, FigureFamilyListItem } from '../../models/figure-family.model';
import { FigureTemplateListItem } from '../../models/figure-template.model';

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
  variants: [{ id: 'tmpl-1', name: 'pd4 1C', slug: 'pd4-1c', variantOrder: 1, nodeCount: 10 }],
  ...overrides,
});

const makeTemplate = (overrides: Partial<FigureTemplateListItem> = {}): FigureTemplateListItem => ({
  id: 'tmpl-1',
  name: 'pd4 1C',
  slug: 'pd4-1c',
  description: null,
  hasPinya: true,
  direction: 0,
  variantOrder: 1,
  familyId: 'fam-1',
  familyName: 'Pilar de 4',
  nodeCount: 10,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('TemplateListComponent', () => {
  let fixture: ComponentFixture<TemplateListComponent>;
  let component: TemplateListComponent;
  let router: { navigate: ReturnType<typeof vi.fn> };
  let figureService: {
    getAll: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    duplicate: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  let familyService: {
    getAll: ReturnType<typeof vi.fn>;
    getOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let compositionService: { getAll: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn>; duplicate: ReturnType<typeof vi.fn> };
  let toastService: { error: ReturnType<typeof vi.fn>; success: ReturnType<typeof vi.fn> };

  const paginatedFamilies = { data: [makeFamilyListItem()], meta: { total: 1, page: 1, limit: 50 } };
  const paginatedTemplates = { data: [makeTemplate()], meta: { total: 1, page: 1, limit: 25 } };

  beforeEach(async () => {
    router = { navigate: vi.fn() };
    figureService = {
      getAll: vi.fn().mockReturnValue(of(paginatedTemplates)),
      remove: vi.fn().mockReturnValue(of(undefined)),
      duplicate: vi.fn().mockReturnValue(of(makeTemplate({ id: 'dup-1' }))),
      create: vi.fn().mockReturnValue(of(makeTemplate({ id: 'new-1' }))),
    };
    familyService = {
      getAll: vi.fn().mockReturnValue(of(paginatedFamilies)),
      getOne: vi.fn().mockReturnValue(of(makeFamilyDetail())),
      create: vi.fn().mockReturnValue(of(makeFamilyDetail())),
      update: vi.fn().mockReturnValue(of(makeFamilyDetail())),
      remove: vi.fn().mockReturnValue(of(undefined)),
    };
    compositionService = {
      getAll: vi.fn().mockReturnValue(of({ data: [], meta: { total: 0, page: 1, limit: 25 } })),
      remove: vi.fn().mockReturnValue(of(undefined)),
      duplicate: vi.fn().mockReturnValue(of({})),
    };
    toastService = { error: vi.fn(), success: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [TemplateListComponent],
      providers: [
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: vi.fn().mockReturnValue(null) } } },
        },
        { provide: FigureTemplateService, useValue: figureService },
        { provide: FigureFamilyService, useValue: familyService },
        { provide: CompositionTemplateService, useValue: compositionService },
        { provide: ToastService, useValue: toastService },
        {
          provide: LUCIDE_ICONS, multi: true,
          useFactory: () => new LucideIconProvider({
            Plus, Search, ChevronDown, ChevronRight, FolderOpen, Layers, LayoutGrid,
            GitBranch, Pencil, Trash2, Copy, X, Info, ChevronLeft, HelpCircle,
          }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TemplateListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates successfully', () => {
    expect(component).toBeTruthy();
  });

  it('defaults to families tab and loads families on init', () => {
    expect(component.activeTab()).toBe('families');
    expect(familyService.getAll).toHaveBeenCalled();
    expect(familyService.getOne).toHaveBeenCalledWith('fam-1');
  });

  it('populates families with details after load', () => {
    expect(component.families()).toHaveLength(1);
    expect(component.families()[0].name).toBe('Pilar de 4');
    expect(component.families()[0].variants).toHaveLength(1);
  });

  // ── Family expand/collapse ────────────────────────────────────────────────

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

  // ── Family modal ──────────────────────────────────────────────────────────

  it('openCreateFamilyModal sets modal to create mode', () => {
    component.openCreateFamilyModal();
    expect(component.familyModal()?.mode).toBe('create');
    expect(component.familyModal()?.name).toBe('');
  });

  it('onFamilyNameChange auto-generates slug when modal is new', () => {
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

  // ── Family delete ──────────────────────────────────────────────────────────

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

  // ── "Nova Variant" derivation ──────────────────────────────────────────────

  it('openNewVariant navigates directly to editor when no variants', () => {
    const emptyFamily = makeFamilyDetail({ variants: [] });
    component.openNewVariant(emptyFamily);
    expect(router.navigate).toHaveBeenCalledWith(['/pinyes/templates/new'], {
      queryParams: { familyId: 'fam-1', familyName: 'Pilar de 4' },
    });
  });

  it('openNewVariant opens derive modal when variants exist', () => {
    const family = makeFamilyDetail();
    component.openNewVariant(family);
    expect(component.deriveModal()).not.toBeNull();
    expect(component.deriveModal()?.familyId).toBe('fam-1');
  });

  it('confirmDeriveVariant calls figureService.create with deriveFromTemplateId', () => {
    const family = makeFamilyDetail();
    component.openNewVariant(family);
    component.confirmDeriveVariant();
    expect(figureService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        familyId: 'fam-1',
        deriveFromTemplateId: 'tmpl-1',
        variantOrder: 2,
      }),
    );
  });

  // ── Tabs ──────────────────────────────────────────────────────────────────

  it('setTab("figures") loads legacy templates', () => {
    component.setTab('figures');
    expect(figureService.getAll).toHaveBeenCalled();
  });

  it('setTab("compositions") loads compositions', () => {
    component.setTab('compositions');
    expect(compositionService.getAll).toHaveBeenCalled();
  });

  // ── Slug helper ───────────────────────────────────────────────────────────

  it('slugify produces kebab-case from name with accents', () => {
    expect(component.slugify('Pilar de 4')).toBe('pilar-de-4');
    expect(component.slugify('Família Muixeranga')).toBe('familia-muixeranga');
  });
});
