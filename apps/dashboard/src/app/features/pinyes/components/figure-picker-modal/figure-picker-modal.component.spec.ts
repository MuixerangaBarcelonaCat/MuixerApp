import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of } from 'rxjs';
import {
  LUCIDE_ICONS, LucideIconProvider,
  Hexagon, LayoutGrid, Search, X, Plus, Trash2,
} from 'lucide-angular';
import { FigurePickerModalComponent, InstanceSelection } from './figure-picker-modal.component';
import { FigureTemplateService } from '../../services/figure-template.service';
import { CompositionTemplateService } from '../../services/composition-template.service';
import { FigureTemplateListItem } from '../../models/figure-template.model';
import { CompositionTemplateListItem } from '../../models/composition.model';

const makeFigure = (overrides: Partial<FigureTemplateListItem> = {}): FigureTemplateListItem => ({
  id: 'fig-uuid-1',
  name: 'pd4',
  slug: 'pd4',
  description: null,
  hasPinya: true,
  direction: 0,
  nodeCount: 5,
  renglaCount: 0,
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
  let compositionService: { getAll: ReturnType<typeof vi.fn> };
  let confirmedSpy: (...args: unknown[]) => void;
  let closedSpy: (...args: unknown[]) => void;

  beforeEach(async () => {
    figureService = {
      getAll: vi.fn().mockReturnValue(of({ data: [makeFigure()], meta: { total: 1, page: 1, limit: 200 } })),
    };
    compositionService = {
      getAll: vi.fn().mockReturnValue(of({ data: [makeComposition()], meta: { total: 1, page: 1, limit: 200 } })),
    };

    await TestBed.configureTestingModule({
      imports: [FigurePickerModalComponent],
      providers: [
        { provide: FigureTemplateService, useValue: figureService },
        { provide: CompositionTemplateService, useValue: compositionService },
        {
          provide: LUCIDE_ICONS, multi: true,
          useFactory: () => new LucideIconProvider({ Hexagon, LayoutGrid, Search, X, Plus, Trash2 }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FigurePickerModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('segmentId', 'seg-uuid-1');

    confirmedSpy = vi.fn();
    closedSpy = vi.fn();
    component.confirmed.subscribe((val: InstanceSelection[]) => confirmedSpy(val));
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

  it('filters figures by search query on name', () => {
    component.figures.set([
      makeFigure({ id: 'fig-1', name: 'pd4 1C' }),
      makeFigure({ id: 'fig-2', name: 'Morera' }),
    ]);
    component.search.set('morera');
    expect(component.filteredFigures()).toHaveLength(1);
    expect(component.filteredFigures()[0].name).toBe('Morera');
  });

  it('switches to composicions tab and clears search', () => {
    component.search.set('something');
    component.setTab('composicions');
    expect(component.activeTab()).toBe('composicions');
    expect(component.search()).toBe('');
  });

  describe('multi-select', () => {
    it('addFigure appends to selections', () => {
      const figure = makeFigure();
      component.addFigure(figure);

      expect(component.selections()).toHaveLength(1);
      expect(component.selections()[0]).toEqual({
        selection: { figureTemplateId: 'fig-uuid-1' },
        name: 'pd4',
        hasPinya: true,
      });
    });

    it('addComposition appends to selections with hasPinya=true', () => {
      const composition = makeComposition();
      component.addComposition(composition);

      expect(component.selections()).toHaveLength(1);
      expect(component.selections()[0]).toEqual({
        selection: { compositionTemplateId: 'comp-uuid-1' },
        name: 'Altar',
        hasPinya: true,
      });
    });

    it('allows adding the same figure twice (duplicate valid)', () => {
      const figure = makeFigure();
      component.addFigure(figure);
      component.addFigure(figure);

      expect(component.selections()).toHaveLength(2);
      expect(component.selectionCount()).toBe(2);
    });

    it('allows mixing figures and compositions', () => {
      component.addFigure(makeFigure());
      component.addComposition(makeComposition());

      expect(component.selections()).toHaveLength(2);
      expect(component.selections()[0].selection.figureTemplateId).toBe('fig-uuid-1');
      expect(component.selections()[1].selection.compositionTemplateId).toBe('comp-uuid-1');
    });

    it('removeSelection removes item by index', () => {
      component.addFigure(makeFigure({ id: 'fig-1', name: 'First' }));
      component.addFigure(makeFigure({ id: 'fig-2', name: 'Second' }));
      component.addFigure(makeFigure({ id: 'fig-3', name: 'Third' }));

      component.removeSelection(1);

      expect(component.selections()).toHaveLength(2);
      expect(component.selections()[0].name).toBe('First');
      expect(component.selections()[1].name).toBe('Third');
    });

    it('tracks hasPinya=false for net figures', () => {
      component.addFigure(makeFigure({ hasPinya: false, name: 'Piló' }));

      expect(component.selections()[0].hasPinya).toBe(false);
    });
  });

  describe('computed helpers', () => {
    it('selectionCount reflects selections length', () => {
      expect(component.selectionCount()).toBe(0);
      component.addFigure(makeFigure());
      expect(component.selectionCount()).toBe(1);
    });

    it('canConfirm is false when empty, true when populated', () => {
      expect(component.canConfirm()).toBe(false);
      component.addFigure(makeFigure());
      expect(component.canConfirm()).toBe(true);
    });
  });

  describe('confirm', () => {
    it('emits confirmed with array of InstanceSelection (parent handles close)', () => {
      component.addFigure(makeFigure({ id: 'fig-1' }));
      component.addComposition(makeComposition({ id: 'comp-1' }));

      component.confirm();

      expect(confirmedSpy).toHaveBeenCalledWith([
        { figureTemplateId: 'fig-1' },
        { compositionTemplateId: 'comp-1' },
      ]);
      expect(closedSpy).not.toHaveBeenCalled();
    });

    it('resets selections after confirm', () => {
      component.addFigure(makeFigure());
      component.confirm();

      expect(component.selections()).toEqual([]);
      expect(component.selectionCount()).toBe(0);
    });
  });

  describe('close', () => {
    it('emits closed and resets all state', () => {
      component.addFigure(makeFigure());
      component.search.set('test');
      component.setTab('composicions');

      component.close();

      expect(closedSpy).toHaveBeenCalled();
      expect(component.selections()).toEqual([]);
      expect(component.search()).toBe('');
      expect(component.activeTab()).toBe('figures');
    });

    it('does not emit confirmed when closing without confirm', () => {
      component.addFigure(makeFigure());
      component.close();

      expect(confirmedSpy).not.toHaveBeenCalled();
    });
  });

  describe('template rendering', () => {
    it('shows "Tronc" badge for hasPinya=false figures', () => {
      component.figures.set([
        makeFigure({ id: 'fig-net', name: 'Piló', hasPinya: false }),
        makeFigure({ id: 'fig-full', name: 'pd4', hasPinya: true }),
      ]);
      fixture.detectChanges();

      const badges = fixture.nativeElement.querySelectorAll('.badge-info');
      expect(badges.length).toBe(1);
      expect(badges[0].textContent.trim()).toBe('Tronc');
    });

    it('shows "Afegir" button per figure row', () => {
      fixture.detectChanges();
      const addButtons = fixture.nativeElement.querySelectorAll('ul[aria-label="Figures disponibles"] button');
      expect(addButtons.length).toBeGreaterThan(0);
      expect(addButtons[0].textContent.trim()).toContain('Afegir');
    });

    it('shows selected section with count when items added', () => {
      component.addFigure(makeFigure({ name: 'pd4' }));
      component.addFigure(makeFigure({ id: 'fig-2', name: 'Piló', hasPinya: false }));
      fixture.detectChanges();

      const divider = fixture.nativeElement.querySelector('.divider');
      expect(divider?.textContent).toContain('Seleccionades (2)');

      const selectedList = fixture.nativeElement.querySelector('ul[aria-label="Figures seleccionades"]');
      expect(selectedList).toBeTruthy();
      const items = selectedList.querySelectorAll('li');
      expect(items.length).toBe(2);
    });

    it('shows empty message when no selections', () => {
      fixture.detectChanges();
      const emptyMsg = fixture.nativeElement.querySelector('.text-base-content\\/40.mt-3');
      expect(emptyMsg?.textContent).toContain('Cap figura seleccionada');
    });

    it('confirm button is disabled when no selections', () => {
      fixture.detectChanges();
      const confirmBtn = fixture.nativeElement.querySelector('button.btn-primary');
      expect(confirmBtn?.disabled).toBe(true);
      expect(confirmBtn?.textContent).toContain('Confirma (0)');
    });

    it('confirm button is enabled with selections and shows count', () => {
      component.addFigure(makeFigure());
      component.addComposition(makeComposition());
      fixture.detectChanges();

      const confirmBtn = fixture.nativeElement.querySelector('button.btn-primary');
      expect(confirmBtn?.disabled).toBe(false);
      expect(confirmBtn?.textContent).toContain('Confirma (2)');
    });

    it('shows "Tronc" badge in selected section for net figures', () => {
      component.addFigure(makeFigure({ name: 'Piló', hasPinya: false }));
      fixture.detectChanges();

      const selectedList = fixture.nativeElement.querySelector('ul[aria-label="Figures seleccionades"]');
      const badge = selectedList?.querySelector('.badge-info');
      expect(badge?.textContent.trim()).toBe('Tronc');
    });
  });
});
