import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, ActivatedRoute } from '@angular/router';
import { vi } from 'vitest';
import { of } from 'rxjs';
import {
  LUCIDE_ICONS, LucideIconProvider,
  Plus, Search, ChevronDown, ChevronRight, FolderOpen, Layers, LayoutGrid,
  GitBranch, Pencil, Trash2, Copy, X, Info, ChevronLeft, HelpCircle, AlertTriangle,
  BookOpen, RotateCcw, ArrowUpDown, History, Plus as PlusIcon,
} from 'lucide-angular';
import { TemplateListComponent } from './template-list.component';
import { FigureTemplateService } from '../../services/figure-template.service';
import { FigureFamilyService } from '../../services/figure-family.service';
import { CompositionTemplateService } from '../../services/composition-template.service';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';
import { FigureFamilyDetail } from '../../models/figure-family.model';

const makeFamilyDetail = (overrides: Partial<FigureFamilyDetail> = {}): FigureFamilyDetail => ({
  id: 'fam-1',
  name: 'Pilar de 4',
  slug: 'pilar-de-4',
  description: null,
  variantCount: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  metadata: {},
  variants: [{ id: 'tmpl-1', name: 'pd4 1C', slug: 'pd4-1c', variantOrder: 1, nodeCount: 10, renglaCount: 4 }],
  ...overrides,
});

describe('TemplateListComponent (shell)', () => {
  let fixture: ComponentFixture<TemplateListComponent>;
  let component: TemplateListComponent;
  let queryParamGet: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    queryParamGet = vi.fn().mockReturnValue(null);

    const familyService = {
      getAll: vi.fn().mockReturnValue(of({ data: [makeFamilyDetail()], meta: { total: 1, page: 1, limit: 50 } })),
      getOne: vi.fn().mockReturnValue(of({ id: 'tmpl-1', nodes: [] })),
      create: vi.fn().mockReturnValue(of(makeFamilyDetail())),
      update: vi.fn().mockReturnValue(of(makeFamilyDetail())),
      remove: vi.fn().mockReturnValue(of(undefined)),
    };
    const figureService = {
      getAll: vi.fn().mockReturnValue(of({ data: [], meta: { total: 0, page: 1, limit: 25 } })),
      getOne: vi.fn().mockReturnValue(of({ id: 'tmpl-1', nodes: [] })),
      remove: vi.fn().mockReturnValue(of(undefined)),
      duplicate: vi.fn().mockReturnValue(of({})),
    };
    const compositionService = {
      getAll: vi.fn().mockReturnValue(of({ data: [], meta: { total: 0, page: 1, limit: 25 } })),
      remove: vi.fn().mockReturnValue(of(undefined)),
      duplicate: vi.fn().mockReturnValue(of({})),
    };
    const toastService = { error: vi.fn(), success: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [TemplateListComponent],
      providers: [
        { provide: Router, useValue: { navigate: vi.fn() } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: queryParamGet } } },
        },
        { provide: FigureTemplateService, useValue: figureService },
        { provide: FigureFamilyService, useValue: familyService },
        { provide: CompositionTemplateService, useValue: compositionService },
        { provide: ToastService, useValue: toastService },
        {
          provide: LUCIDE_ICONS, multi: true,
          useFactory: () => new LucideIconProvider({
            Plus: PlusIcon, Search, ChevronDown, ChevronRight, FolderOpen, Layers, LayoutGrid,
            GitBranch, Pencil, Trash2, Copy, X, Info, ChevronLeft, HelpCircle, AlertTriangle,
            BookOpen, RotateCcw, ArrowUpDown, History,
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

  it('defaults to families tab', () => {
    expect(component.activeTab()).toBe('families');
  });

  it('setTab updates the active tab signal', () => {
    component.setTab('figures');
    expect(component.activeTab()).toBe('figures');

    component.setTab('compositions');
    expect(component.activeTab()).toBe('compositions');

    component.setTab('families');
    expect(component.activeTab()).toBe('families');
  });

  it('reads "tab" query param on init (figures)', async () => {
    queryParamGet.mockReturnValue('figures');

    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [TemplateListComponent],
      providers: [
        { provide: Router, useValue: { navigate: vi.fn() } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: queryParamGet } } },
        },
        {
          provide: FigureTemplateService,
          useValue: { getAll: vi.fn().mockReturnValue(of({ data: [], meta: { total: 0, page: 1, limit: 25 } })), getOne: vi.fn().mockReturnValue(of({})) },
        },
        {
          provide: FigureFamilyService,
          useValue: { getAll: vi.fn().mockReturnValue(of({ data: [], meta: { total: 0, page: 1, limit: 50 } })), getOne: vi.fn().mockReturnValue(of({ nodes: [] })), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
        },
        {
          provide: CompositionTemplateService,
          useValue: { getAll: vi.fn().mockReturnValue(of({ data: [], meta: { total: 0, page: 1, limit: 25 } })), remove: vi.fn(), duplicate: vi.fn() },
        },
        { provide: ToastService, useValue: { error: vi.fn(), success: vi.fn() } },
        {
          provide: LUCIDE_ICONS, multi: true,
          useFactory: () => new LucideIconProvider({
            Plus: PlusIcon, Search, ChevronDown, ChevronRight, FolderOpen, Layers, LayoutGrid,
            GitBranch, Pencil, Trash2, Copy, X, Info, ChevronLeft, HelpCircle, AlertTriangle,
            BookOpen, RotateCcw, ArrowUpDown, History,
          }),
        },
      ],
    }).compileComponents();

    const f2 = TestBed.createComponent(TemplateListComponent);
    f2.detectChanges();
    expect(f2.componentInstance.activeTab()).toBe('figures');
  });
});
