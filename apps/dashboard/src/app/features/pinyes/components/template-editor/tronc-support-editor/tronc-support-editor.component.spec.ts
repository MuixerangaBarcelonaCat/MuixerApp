import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import { EmptyStateComponent } from '@muixer/ui';
import { FigureNodeItem } from '@muixer/pinyes-render';
import { FigureZone, NodeShape } from '@muixer/shared';
import { allLucideIconsProvider } from '../../../../../../testing/lucide-test-provider';
import { SupportLink } from './tronc-support-editor.model';
import {
  FLOOR_GAP_REM,
  ROW_HEIGHT_REM,
  TroncSupportEditorComponent,
} from './tronc-support-editor.component';

const node = (
  id: string,
  zone: FigureZone,
  z: number,
  overrides: Partial<FigureNodeItem> = {},
): FigureNodeItem => ({
  id,
  label: id.toUpperCase(),
  zone,
  positionType: zone === FigureZone.BASE ? 'base' : 'segona',
  x: 0,
  y: 0,
  z,
  width: 1,
  height: 40,
  rotation: 0,
  color: null,
  shape: NodeShape.RECTANGLE,
  sortOrder: 0,
  climbIndicator: null,
  ringLevel: null,
  originNodeId: null,
  renglaId: null,
  renglaPosition: null,
  standsOnNodeIds: [],
  metadata: {},
  ...overrides,
});

// P3: T1 (x0 w2) · P2: S1 (x0) S2 (x1) · P1: B1 B2
const B1 = node('b1', FigureZone.BASE, 0, { sortOrder: 0 });
const B2 = node('b2', FigureZone.BASE, 0, { sortOrder: 1 });
const S1 = node('s1', FigureZone.TRONC, 1, { x: 0, standsOnNodeIds: ['b1'] });
const S2 = node('s2', FigureZone.TRONC, 1, { x: 1, sortOrder: 1, standsOnNodeIds: ['b2', 'gone'] });
const T1 = node('t1', FigureZone.TRONC, 2, { width: 2, positionType: 'terça', standsOnNodeIds: ['s1', 'b1'] });

/** Fake pointer event, as in tronc-view's drag tests: the handlers only read these fields. */
const pointer = (overrides: Partial<PointerEvent> = {}): PointerEvent =>
  ({
    pointerId: 1,
    clientX: 0,
    clientY: 0,
    button: 0,
    preventDefault: () => undefined,
    stopPropagation: () => undefined,
    currentTarget: { setPointerCapture: () => undefined } as unknown as EventTarget,
    ...overrides,
  }) as unknown as PointerEvent;

const click = (): MouseEvent => ({ stopPropagation: () => undefined }) as unknown as MouseEvent;

describe('TroncSupportEditorComponent', () => {
  let fixture: ComponentFixture<TroncSupportEditorComponent>;
  let component: TroncSupportEditorComponent;
  let added: SupportLink[];
  let removed: SupportLink[];
  let selected: string[];

  function render(troncNodes: FigureNodeItem[] = [S1, S2, T1], baseNodes: FigureNodeItem[] = [B1, B2]): void {
    fixture.componentRef.setInput('troncNodes', troncNodes);
    fixture.componentRef.setInput('baseNodes', baseNodes);
    fixture.detectChanges();
  }

  const q = (selector: string): HTMLElement | null => fixture.nativeElement.querySelector(selector);
  const qa = (selector: string): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll(selector));
  const nodeEl = (id: string) => q(`[data-support-node-id="${id}"]`);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TroncSupportEditorComponent],
      providers: [allLucideIconsProvider],
    }).compileComponents();

    fixture = TestBed.createComponent(TroncSupportEditorComponent);
    component = fixture.componentInstance;
    added = [];
    removed = [];
    selected = [];
    component.linkAdded.subscribe((l) => added.push(l));
    component.linkRemoved.subscribe((l) => removed.push(l));
    component.nodeSelected.subscribe((id) => selected.push(id));

    if (!('elementFromPoint' in document)) {
      Object.defineProperty(document, 'elementFromPoint', { value: () => null, writable: true, configurable: true });
    }
  });

  afterEach(() => vi.restoreAllMocks());

  describe('rendering', () => {
    it('shows one row per floor, top floor first', () => {
      render();

      expect(qa('.pis-code').map((el) => el.textContent?.trim())).toEqual(['P3', 'P2', 'P1']);
    });

    it('draws one line per valid link, ignoring stale ids and links that skip a floor', () => {
      render();

      const drawn = qa('line.link').map((l) => `${l.dataset['upper']}>${l.dataset['lower']}`);
      expect(drawn.sort()).toEqual(['s1>b1', 's2>b2', 't1>s1']);
    });

    it('runs each line from the bottom centre of the upper node to the top centre of the lower one', () => {
      render();

      const rowTop = (i: number) => i * (ROW_HEIGHT_REM + FLOOR_GAP_REM);
      // 4 half-columns: S1 spans [0,2) → centre 25%; B1 is base #0 → [0,2) → 25%.
      expect(component.links().find((l) => l.upperId === 's1')).toEqual({
        upperId: 's1',
        lowerId: 'b1',
        x1: 25,
        y1: rowTop(1) + ROW_HEIGHT_REM,
        x2: 25,
        y2: rowTop(2),
      });
      // T1 spans [0,4) → 50%; S1 → 25%.
      expect(component.links().find((l) => l.upperId === 't1')).toMatchObject({ x1: 50, x2: 25 });
    });

    it('highlights the links of the selected node', () => {
      fixture.componentRef.setInput('selectedNodeId', 's1');
      render();

      const active = qa('line.link.active').map((l) => `${l.dataset['upper']}>${l.dataset['lower']}`);
      expect(active.sort()).toEqual(['s1>b1', 't1>s1']);
      expect(nodeEl('s1')?.classList).toContain('selected');
    });

    it('shows an empty state when the tronc has no floors yet', () => {
      render([], [B1]);

      expect(fixture.debugElement.query(By.directive(EmptyStateComponent))).toBeTruthy();
      expect(q('.board')).toBeNull();
    });

    it('gives TRONC nodes a handle and BASE nodes none', () => {
      render();

      expect(q('[data-handle-for="s1"]')).toBeTruthy();
      expect(q('[data-handle-for="b1"]')).toBeNull();
    });
  });

  describe('floor gaps', () => {
    it('disables the handles above an empty floor and says which floor is empty', () => {
      const q1 = node('q1', FigureZone.TRONC, 3);
      render([S1, q1]);

      expect((q('[data-handle-for="q1"]') as HTMLButtonElement).disabled).toBe(true);
      expect((q('[data-handle-for="s1"]') as HTMLButtonElement).disabled).toBe(false);
      expect(fixture.nativeElement.textContent).toContain(
        'El P3 està buit: afegiu-hi nodes per a indicar damunt de qui va el P4.',
      );
    });

    it('disables the P2 handles when there are no bases', () => {
      render([S1], []);

      expect((q('[data-handle-for="s1"]') as HTMLButtonElement).disabled).toBe(true);
      expect(fixture.nativeElement.textContent).toContain(
        'No hi ha bases: afegiu-ne per a indicar damunt de qui va el P2.',
      );
    });
  });

  describe('click-click connecting', () => {
    beforeEach(() => render());

    it('a click on a handle starts connecting: the floor below is the target, the rest is dimmed', () => {
      component.onHandleClick(S2, click());
      fixture.detectChanges();

      expect(component.connectFrom()).toBe('s2');
      expect(nodeEl('b1')?.classList).toContain('target');
      expect(nodeEl('b2')?.classList).toContain('target');
      expect(nodeEl('t1')?.classList).toContain('dimmed');
      expect(nodeEl('s1')?.classList).toContain('dimmed');
      expect(nodeEl('s2')?.classList).toContain('source');
    });

    it('a click on a target adds the link and keeps connecting, so more can be added', () => {
      component.onHandleClick(S2, click());
      component.onNodeClick(B1, click());

      expect(added).toEqual([{ upperId: 's2', lowerId: 'b1' }]);
      expect(component.connectFrom()).toBe('s2');
    });

    it('does not add a link that already exists', () => {
      component.onHandleClick(S1, click());
      component.onNodeClick(B1, click());

      expect(added).toEqual([]);
    });

    it('a click on a node that is not a target stops connecting and selects it', () => {
      component.onHandleClick(S2, click());
      component.onNodeClick(T1, click());

      expect(added).toEqual([]);
      expect(component.connectFrom()).toBeNull();
      expect(selected).toEqual(['t1']);
    });

    it('a second click on the same handle stops connecting', () => {
      component.onHandleClick(S2, click());
      component.onHandleClick(S2, click());

      expect(component.connectFrom()).toBeNull();
    });

    it('Escape stops connecting', () => {
      component.onHandleClick(S2, click());
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(component.connectFrom()).toBeNull();
    });

    it('a click on a node while not connecting selects it', () => {
      component.onNodeClick(S1, click());

      expect(selected).toEqual(['s1']);
    });
  });

  describe('drag connecting', () => {
    const elementFor = (id: string): HTMLElement => {
      const el = document.createElement('button');
      el.dataset['supportNodeId'] = id;
      return el;
    };

    beforeEach(() => render());

    it('does not start a drag before the pointer moves past the threshold', () => {
      component.onHandlePointerDown(S2, pointer());
      component.onHandlePointerMove(pointer({ clientX: 2 }));

      expect(component.rubberBand()).toBeNull();
    });

    it('drags a rubber band from the handle and adds the link when released on a target', () => {
      component.onHandlePointerDown(S2, pointer());
      component.onHandlePointerMove(pointer({ clientX: 20 }));
      fixture.detectChanges();

      expect(component.rubberBand()).not.toBeNull();
      expect(q('line.rubber-band')).toBeTruthy();

      vi.spyOn(document, 'elementFromPoint').mockReturnValue(elementFor('b1'));
      component.onHandlePointerUp(pointer({ clientX: 20, clientY: 80 }));
      fixture.detectChanges();

      expect(added).toEqual([{ upperId: 's2', lowerId: 'b1' }]);
      expect(component.connectFrom()).toBeNull();
      expect(q('line.rubber-band')).toBeNull();
    });

    it('swallows the click the browser fires after the drag, so it does not start click-connecting', () => {
      component.onHandlePointerDown(S2, pointer());
      component.onHandlePointerMove(pointer({ clientX: 20 }));
      component.onHandlePointerUp(pointer({ clientX: 20 }));
      component.onHandleClick(S2, click());

      expect(component.connectFrom()).toBeNull();
    });

    it('adds nothing when released over a node that is not a target', () => {
      component.onHandlePointerDown(S2, pointer());
      component.onHandlePointerMove(pointer({ clientX: 20 }));
      vi.spyOn(document, 'elementFromPoint').mockReturnValue(elementFor('t1'));
      component.onHandlePointerUp(pointer({ clientX: 20 }));

      expect(added).toEqual([]);
      expect(component.connectFrom()).toBeNull();
    });

    it('adds nothing when released over an existing link target', () => {
      component.onHandlePointerDown(S1, pointer());
      component.onHandlePointerMove(pointer({ clientX: 20 }));
      vi.spyOn(document, 'elementFromPoint').mockReturnValue(elementFor('b1'));
      component.onHandlePointerUp(pointer({ clientX: 20 }));

      expect(added).toEqual([]);
    });

    it('Escape cancels a drag in progress', () => {
      component.onHandlePointerDown(S2, pointer());
      component.onHandlePointerMove(pointer({ clientX: 20 }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      vi.spyOn(document, 'elementFromPoint').mockReturnValue(elementFor('b1'));
      component.onHandlePointerUp(pointer({ clientX: 20 }));

      expect(added).toEqual([]);
      expect(component.rubberBand()).toBeNull();
    });
  });

  describe('removing links', () => {
    beforeEach(() => render());

    it('a click on a link removes it', () => {
      (q('line.link-hit[data-upper="s1"][data-lower="b1"]') as unknown as SVGElement).dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      );

      expect(removed).toEqual([{ upperId: 's1', lowerId: 'b1' }]);
    });

    it.each(['Enter', 'Delete'])('%s on a focused link removes it', (key) => {
      (q('line.link-hit[data-upper="t1"][data-lower="s1"]') as unknown as SVGElement).dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true }),
      );

      expect(removed).toEqual([{ upperId: 't1', lowerId: 's1' }]);
    });

    it('labels each link for screen readers', () => {
      expect(q('line.link-hit[data-upper="s1"]')?.getAttribute('aria-label')).toBe("Elimina l'enllaç: S1 damunt de B1");
    });
  });
});
