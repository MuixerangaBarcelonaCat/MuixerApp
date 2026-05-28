import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of } from 'rxjs';
import {
  LUCIDE_ICONS, LucideIconProvider,
  Hexagon, LayoutGrid, Search, X, FolderOpen, Layers,
} from 'lucide-angular';
import { FigurePickerModalComponent } from './figure-picker-modal.component';
import { FigureTemplateService } from '../../services/figure-template.service';
import { FigureFamilyService } from '../../services/figure-family.service';
import { CompositionTemplateService } from '../../services/composition-template.service';
import { FigureTemplateListItem } from '../../models/figure-template.model';
import { FigureFamilyDetail } from '../../models/figure-family.model';
import { CompositionTemplateListItem } from '../../models/composition.model';

const makeFigure = (overrides: Partial<FigureTemplateListItem> = {}): FigureTemplateListItem => ({
  id: 'fig-uuid-1',
  name: 'pd4',
  slug: 'pd4',
  description: null,
  hasPinya: true,
  direction: 0,
  variantOrder: 1,
  familyId: 'fam-uuid-1',
  familyName: 'Pilar de 4',
  nodeCount: 5,
  renglaCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const makeFamily = (overrides: Partial<FigureFamilyDetail> = {}): FigureFamilyDetail => ({
  id: 'fam-uuid-1',
  name: 'Pilar de 4',
  slug: 'pilar-de-4',
  description: null,
  variantCount: 1,
  metadata: {},
  variants: [{ id: 'fig-uuid-1', name: 'pd4', slug: 'pd4', variantOrder: 1, nodeCount: 5 }],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const makeComposition = (overrides: Partial<CompositionTemplateListItem> = {}): CompositionTemplateListItem => ({
  id: 'comp-uuid-1',
  name: 'Altar',
  slug: 'altar',
  description: null,
  slotCount: 3,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('FigurePickerModalComponent', () => {
  let fixture: ComponentFixture<FigurePickerModalComponent>;
  let component: FigurePickerModalComponent;
  let figureService: { getAll: ReturnType<typeof vi.fn> };
  let familyService: { getAll: ReturnType<typeof vi.fn>; getOne: ReturnType<typeof vi.fn> };
  let compositionService: { getAll: ReturnType<typeof vi.fn> };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let selectedSpy: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let closedSpy: any;

  beforeEach(async () => {
    figureService = {
      getAll: vi.fn().mockReturnValue(of({ data: [makeFigure()], meta: { total: 1, page: 1, limit: 200 } })),
    };
    familyService = {
      getAll: vi.fn().mockReturnValue(of({ data: [makeFamily()], meta: { total: 1, page: 1, limit: 100 } })),
      getOne: vi.fn().mockReturnValue(of(makeFamily())),
    };
    compositionService = {
      getAll: vi.fn().mockReturnValue(of({ data: [makeComposition()], meta: { total: 1, page: 1, limit: 200 } })),
    };

    await TestBed.configureTestingModule({
      imports: [FigurePickerModalComponent],
      providers: [
        { provide: FigureTemplateService, useValue: figureService },
        { provide: FigureFamilyService, useValue: familyService },
        { provide: CompositionTemplateService, useValue: compositionService },
        {
          provide: LUCIDE_ICONS, multi: true,
          useFactory: () => new LucideIconProvider({ Hexagon, LayoutGrid, Search, X, FolderOpen, Layers }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FigurePickerModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('segmentId', 'seg-uuid-1');

    selectedSpy = vi.fn();
    closedSpy = vi.fn();
    component.selected.subscribe((val) => selectedSpy(val));
    component.closed.subscribe(() => closedSpy());

    fixture.detectChanges();
  });

  it('creates successfully', () => {
    expect(component).toBeTruthy();
  });

  it('loads figures and compositions on init', () => {
    expect(figureService.getAll).toHaveBeenCalledWith({ limit: 200 });
    expect(compositionService.getAll).toHaveBeenCalledWith({ limit: 200 });
  });

  it('shows figures tab by default', () => {
    expect(component.activeTab()).toBe('figures');
  });

  it('displays figures from service', () => {
    expect(component.figures()).toHaveLength(1);
    expect(component.figures()[0].name).toBe('pd4');
  });

  it('groups figures by family', () => {
    expect(component.familyGroups()).toHaveLength(1);
    expect(component.familyGroups()[0].familyName).toBe('Pilar de 4');
    expect(component.familyGroups()[0].variants).toHaveLength(1);
  });

  it('shows legacy figures without family in legacyFigures()', () => {
    component.figures.set([
      makeFigure({ id: 'fig-1', familyId: 'fam-uuid-1', familyName: 'Pilar de 4' }),
      makeFigure({ id: 'fig-2', name: 'Legacy', familyId: null, familyName: null }),
    ]);
    expect(component.legacyFigures()).toHaveLength(1);
    expect(component.legacyFigures()[0].name).toBe('Legacy');
  });

  it('filters familyGroups by search query on family name', () => {
    component.families.set([
      makeFamily({ id: 'f1', name: 'Pilar de 4', variants: [{ id: 'v1', name: 'pd4 1C', slug: 'pd4-1c', variantOrder: 1, nodeCount: 5 }] }),
      makeFamily({ id: 'f2', name: 'Morera', variants: [{ id: 'v2', name: 'morera 1C', slug: 'morera-1c', variantOrder: 1, nodeCount: 3 }] }),
    ]);
    component.figures.set([
      makeFigure({ id: 'v1', name: 'pd4 1C', familyId: 'f1', familyName: 'Pilar de 4' }),
      makeFigure({ id: 'v2', name: 'morera 1C', familyId: 'f2', familyName: 'Morera' }),
    ]);
    component.search.set('morera');
    expect(component.familyGroups()).toHaveLength(1);
    expect(component.familyGroups()[0].familyName).toBe('Morera');
  });

  it('switches to composicions tab', () => {
    component.setTab('composicions');
    expect(component.activeTab()).toBe('composicions');
  });

  it('emits selected event with figureTemplateId when figure is clicked', () => {
    const figure = makeFigure();
    component.selectFigure(figure);
    expect(selectedSpy).toHaveBeenCalledWith({ figureTemplateId: 'fig-uuid-1' });
  });

  it('emits selected event with compositionTemplateId when composition is clicked', () => {
    const composition = makeComposition();
    component.selectComposition(composition);
    expect(selectedSpy).toHaveBeenCalledWith({ compositionTemplateId: 'comp-uuid-1' });
  });

  it('emits closed event when close() is called', () => {
    component.close();
    expect(closedSpy).toHaveBeenCalled();
  });

  it('clears search when switching tabs', () => {
    component.search.set('something');
    component.setTab('composicions');
    expect(component.search()).toBe('');
  });
});
