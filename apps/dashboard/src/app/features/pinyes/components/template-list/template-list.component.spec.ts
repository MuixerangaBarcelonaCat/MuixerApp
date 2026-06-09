import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, ActivatedRoute } from '@angular/router';
import { vi } from 'vitest';
import { of } from 'rxjs';
import {
  LUCIDE_ICONS, LucideIconProvider,
  Plus, Search, ChevronDown, ChevronRight, FolderOpen, Layers, LayoutGrid,
  GitBranch, Pencil, Trash2, Copy, X, Info, ChevronLeft, HelpCircle, AlertTriangle,
  BookOpen, RotateCcw, ArrowUpDown, History, AlignJustify,
} from 'lucide-angular';
import { TemplateListComponent } from './template-list.component';
import { FigureTemplateService } from '../../services/figure-template.service';
import { CompositionTemplateService } from '../../services/composition-template.service';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';
import { FigureTemplateListItem } from '../../models/figure-template.model';

const makeTemplate = (overrides: Partial<FigureTemplateListItem> = {}): FigureTemplateListItem => ({
  id: 'tmpl-1',
  name: 'pd4 1C',
  slug: 'pd4-1c',
  description: null,
  hasPinya: true,
  direction: 0,
  nodeCount: 10,
  renglaCount: 0,
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
    getOne: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    duplicate: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  let compositionService: { getAll: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn>; duplicate: ReturnType<typeof vi.fn> };
  let toastService: { error: ReturnType<typeof vi.fn>; success: ReturnType<typeof vi.fn> };

  const paginatedTemplates = { data: [makeTemplate()], meta: { total: 1, page: 1, limit: 25 } };

  beforeEach(async () => {
    router = { navigate: vi.fn() };
    figureService = {
      getAll: vi.fn().mockReturnValue(of(paginatedTemplates)),
      getOne: vi.fn().mockReturnValue(of({ ...makeTemplate(), nodes: [] })),
      remove: vi.fn().mockReturnValue(of(undefined)),
      duplicate: vi.fn().mockReturnValue(of(makeTemplate({ id: 'dup-1' }))),
      create: vi.fn().mockReturnValue(of(makeTemplate({ id: 'new-1' }))),
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
        { provide: CompositionTemplateService, useValue: compositionService },
        { provide: ToastService, useValue: toastService },
        {
          provide: LUCIDE_ICONS, multi: true,
          useFactory: () => new LucideIconProvider({
            Plus, Search, ChevronDown, ChevronRight, FolderOpen, Layers, LayoutGrid,
            GitBranch, Pencil, Trash2, Copy, X, Info, ChevronLeft, HelpCircle, AlertTriangle,
            BookOpen, RotateCcw, ArrowUpDown, History, AlignJustify,
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

  it('defaults to figures tab and loads templates on init', () => {
    expect(component.activeTab()).toBe('figures');
    expect(figureService.getAll).toHaveBeenCalled();
  });

  it('populates templates after load', () => {
    expect(component.templates()).toHaveLength(1);
    expect(component.templates()[0].name).toBe('pd4 1C');
  });

  it('navigateToCreate navigates to new template editor', () => {
    component.navigateToCreate();
    expect(router.navigate).toHaveBeenCalledWith(['/pinyes/templates/new']);
  });

  it('setTab("compositions") loads compositions', () => {
    component.setTab('compositions');
    expect(compositionService.getAll).toHaveBeenCalled();
  });
});
