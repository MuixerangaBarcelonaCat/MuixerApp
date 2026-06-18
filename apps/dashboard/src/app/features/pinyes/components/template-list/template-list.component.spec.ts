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

  // ── F2: hasPinya filter ──────────────────────────────────────────────

  describe('hasPinya filter', () => {
    it('defaults to undefined (Totes)', () => {
      expect(component.hasPinyaFilter()).toBeUndefined();
    });

    it('setHasPinyaFilter(false) triggers API call with hasPinya: false', () => {
      figureService.getAll.mockClear();
      component.setHasPinyaFilter(false);
      expect(figureService.getAll).toHaveBeenCalledWith(
        expect.objectContaining({ hasPinya: false }),
      );
    });

    it('setHasPinyaFilter(true) triggers API call with hasPinya: true', () => {
      figureService.getAll.mockClear();
      component.setHasPinyaFilter(true);
      expect(figureService.getAll).toHaveBeenCalledWith(
        expect.objectContaining({ hasPinya: true }),
      );
    });

    it('setHasPinyaFilter(undefined) triggers API call without hasPinya', () => {
      component.setHasPinyaFilter(false);
      figureService.getAll.mockClear();
      component.setHasPinyaFilter(undefined);
      expect(figureService.getAll).toHaveBeenCalledWith(
        expect.objectContaining({ hasPinya: undefined }),
      );
    });

    it('resets page to 1 when filter changes', () => {
      component.page.set(3);
      component.setHasPinyaFilter(false);
      expect(component.page()).toBe(1);
    });
  });

  // ── F2: "Figura neta" navigation ──────────────────────────────────────

  describe('navigateToCreateFiguraNeta', () => {
    it('navigates with ?hasPinya=false query param', () => {
      component.navigateToCreateFiguraNeta();
      expect(router.navigate).toHaveBeenCalledWith(
        ['/pinyes/templates/new'],
        { queryParams: { hasPinya: 'false' } },
      );
    });
  });

  // ── F2: Pagination fix ─────────────────────────────────────────────────

  describe('pagination total', () => {
    it('uses meta.total instead of data.length', () => {
      figureService.getAll.mockReturnValue(
        of({ data: [makeTemplate()], meta: { total: 50, page: 1, limit: 25 } }),
      );
      component.setHasPinyaFilter(undefined);
      expect(component.total()).toBe(50);
      expect(component.totalPages()).toBe(2);
    });
  });

  // ── F2: Badge "Tronc" rendering ────────────────────────────────────────

  describe('badge Tronc', () => {
    it('renders badge-info "Figura neta" for figures with hasPinya=false', () => {
      figureService.getAll.mockReturnValue(
        of({
          data: [makeTemplate({ id: 'neta-1', name: 'Piló', hasPinya: false })],
          meta: { total: 1, page: 1, limit: 25 },
        }),
      );
      component.setHasPinyaFilter(false);
      fixture.detectChanges();
      const badges = fixture.nativeElement.querySelectorAll('.badge-info');
      expect(badges.length).toBe(1);
      expect(badges[0].textContent.trim()).toBe('Figura neta');
    });

    it('does NOT render badge-info for figures with hasPinya=true', () => {
      fixture.detectChanges();
      const badges = fixture.nativeElement.querySelectorAll('.badge-info');
      expect(badges.length).toBe(0);
    });
  });

  // ── F2: Toggle filter rendering ────────────────────────────────────────

  describe('toggle filter buttons', () => {
    it('renders 3 join-item buttons', () => {
      fixture.detectChanges();
      const buttons = fixture.nativeElement.querySelectorAll('.join-item');
      expect(buttons.length).toBe(3);
    });

    it('Totes button is active by default', () => {
      fixture.detectChanges();
      const buttons = fixture.nativeElement.querySelectorAll('.join-item');
      expect(buttons[0].classList.contains('btn-active')).toBe(true);
      expect(buttons[1].classList.contains('btn-active')).toBe(false);
      expect(buttons[2].classList.contains('btn-active')).toBe(false);
    });

    it('clicking "Figures netes" activates the third button', () => {
      component.setHasPinyaFilter(false);
      fixture.detectChanges();
      const buttons = fixture.nativeElement.querySelectorAll('.join-item');
      expect(buttons[0].classList.contains('btn-active')).toBe(false);
      expect(buttons[2].classList.contains('btn-active')).toBe(true);
    });
  });
});
