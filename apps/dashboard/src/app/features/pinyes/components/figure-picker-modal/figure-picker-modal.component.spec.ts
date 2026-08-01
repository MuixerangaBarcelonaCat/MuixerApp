import { FigureTemplateListItem } from '@muixer/pinyes-render';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of } from 'rxjs';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { FigurePickerModalComponent, InstanceSelection } from './figure-picker-modal.component';
import { FigureTemplateService } from '../../services/figure-template.service';
import { CompositionService } from '../../services/composition.service';
import { CompositionListItem } from '../../models/composition.model';

const makeFigure = (overrides: Partial<FigureTemplateListItem> = {}): FigureTemplateListItem => ({
  id: 'fig-uuid-1',
  name: 'pd4',
  slug: 'pd4',
  description: null,
  hasPinya: true,
  direction: 0,
  nodeCount: 5,
  renglaCount: 0,
  troncProfile: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const makeComposition = (overrides: Partial<CompositionListItem> = {}): CompositionListItem => ({
  id: 'comp-uuid-1',
  name: 'Pilars de plaça',
  description: null,
  entryCount: 3,
  figureProfiles: [],
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
  let compositionSelectedSpy: (...args: unknown[]) => void;

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
        { provide: CompositionService, useValue: compositionService },
        allLucideIconsProvider,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FigurePickerModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('segmentId', 'seg-uuid-1');

    confirmedSpy = vi.fn();
    closedSpy = vi.fn();
    compositionSelectedSpy = vi.fn();
    component.confirmed.subscribe((val: InstanceSelection[]) => confirmedSpy(val));
    component.closed.subscribe(() => closedSpy());
    component.compositionSelected.subscribe((val) => compositionSelectedSpy(val));

    fixture.detectChanges();
  });

  it('creates successfully', () => {
    expect(component).toBeTruthy();
  });

  it('loads figures on init', () => {
    expect(figureService.getAll).toHaveBeenCalledWith({ limit: 200 });
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

    it('allows adding the same figure twice (duplicate valid)', () => {
      const figure = makeFigure();
      component.addFigure(figure);
      component.addFigure(figure);

      expect(component.selections()).toHaveLength(2);
      expect(component.selectionCount()).toBe(2);
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
    it('emits confirmed with array of InstanceSelection', () => {
      component.addFigure(makeFigure({ id: 'fig-1' }));
      component.addFigure(makeFigure({ id: 'fig-2' }));

      component.confirm();

      expect(confirmedSpy).toHaveBeenCalledWith([
        { figureTemplateId: 'fig-1' },
        { figureTemplateId: 'fig-2' },
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
      component.addFigure(makeFigure({ id: 'fig-2' }));
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

  describe('composicions tab', () => {
    it('loads compositions on init', () => {
      expect(compositionService.getAll).toHaveBeenCalledWith({ limit: 200 });
    });

    it('displays compositions from service', () => {
      expect(component.compositions()).toHaveLength(1);
      expect(component.compositions()[0].name).toBe('Pilars de plaça');
    });

    it('filters compositions by search query on name', () => {
      component.compositions.set([
        makeComposition({ id: 'c1', name: 'Pilars de plaça' }),
        makeComposition({ id: 'c2', name: 'Torres altes' }),
      ]);
      component.search.set('torres');
      expect(component.filteredCompositions()).toHaveLength(1);
      expect(component.filteredCompositions()[0].name).toBe('Torres altes');
    });

    it('has no composition selected by default', () => {
      expect(component.selectedComposition()).toBeNull();
      expect(component.canApplyComposition()).toBe(false);
    });

    it('selectComposition sets the selected composition', () => {
      const composition = makeComposition();
      component.selectComposition(composition);

      expect(component.selectedComposition()).toEqual(composition);
      expect(component.canApplyComposition()).toBe(true);
    });

    it('switching tabs clears the selected composition', () => {
      component.selectComposition(makeComposition());
      component.setTab('figures');

      expect(component.selectedComposition()).toBeNull();
    });

    it('applyComposition does nothing when no composition is selected', () => {
      component.applyComposition();

      expect(compositionSelectedSpy).not.toHaveBeenCalled();
    });

    it('applyComposition emits compositionSelected and closes the modal', () => {
      component.selectComposition(makeComposition({ id: 'comp-1', name: 'Pilars de plaça' }));

      component.applyComposition();

      expect(compositionSelectedSpy).toHaveBeenCalledWith({
        compositionId: 'comp-1',
        compositionName: 'Pilars de plaça',
      });
      expect(closedSpy).toHaveBeenCalled();
      expect(component.selectedComposition()).toBeNull();
    });

    describe('template rendering', () => {
      beforeEach(() => {
        component.setTab('composicions');
        fixture.detectChanges();
      });

      it('shows compositions in a list', () => {
        const list = fixture.nativeElement.querySelector('ul[aria-label="Composicions disponibles"]');
        expect(list).toBeTruthy();
        expect(list.querySelectorAll('li').length).toBe(1);
      });

      it('shows entry count for each composition', () => {
        const list = fixture.nativeElement.querySelector('ul[aria-label="Composicions disponibles"]');
        expect(list.textContent).toContain('3 figures');
      });

      it('"Aplica" button is disabled until a composition is selected', () => {
        const applyBtn = fixture.nativeElement.querySelector('button.btn-primary');
        expect(applyBtn?.disabled).toBe(true);
      });

      it('clicking a composition card selects it and enables "Aplica"', () => {
        const card = fixture.nativeElement.querySelector('ul[aria-label="Composicions disponibles"] li button');
        card.click();
        fixture.detectChanges();

        const applyBtn = fixture.nativeElement.querySelector('button.btn-primary');
        expect(applyBtn?.disabled).toBe(false);
        expect(applyBtn?.textContent).toContain('Pilars de plaça');
      });
    });
  });

  describe('tap targets >=24px (WI-22)', () => {
    it('gives the search input a >=24px tap target', () => {
      const search = fixture.nativeElement.querySelector('input[type="search"]') as HTMLElement;
      expect(search).toBeTruthy();
      expect(search.className).toContain('h-6');
    });
  });
});
