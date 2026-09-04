import { FigureNodeItem, FigureCanvasComponent, CanvasNode, TroncViewComponent, StageTransform } from '@muixer/pinyes-render';
import { Component, input, output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { Observable, of } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { FigureZone, NodeShape, PINYA_NODE_PRESETS } from '@muixer/shared';
import { TemplateEditorComponent, nodeToPayload } from './template-editor.component';
import { TemplateEditorHelpModalComponent } from '../template-editor-help-modal/template-editor-help-modal.component';
import { RenglaOverlayComponent } from '../rengla-overlay/rengla-overlay.component';
import { FigureTemplateService } from '../../services/figure-template.service';
import { CanvasStateService } from '../../services/canvas-state.service';
import { LayoutService } from '../../../../core/services/layout.service';
import { ToastService, ModalComponent, ButtonComponent } from '@muixer/ui';

@Component({ selector: 'app-figure-canvas', standalone: true, template: '' })
class StubFigureCanvas {
  readonly nodes = input<unknown[]>([]);
  readonly mode = input<string>('editor');
  readonly gridEnabled = input<boolean>(true);
  readonly gridSpacing = input<number>(40);
  readonly snapToGrid = input<boolean>(false);
  readonly selectedNodeId = input<string | null>(null);
  readonly nodeSelected = output<string | null>();
  readonly nodeMoved = output<{ id: string; x: number; y: number }>();
  readonly nodeRotated = output<{ id: string; rotation: number }>();
  readonly nodeResized = output<{ id: string; width: number; height: number }>();
  readonly nodeLabelChanged = output<{ id: string; label: string }>();
  readonly stageTransformChanged = output<StageTransform>();
  readonly ghostCloneRequested = output<unknown>();
  getViewportCenter(): { x: number; y: number } {
    return { x: 386, y: 150 };
  }
  zoomIn = vi.fn();
  zoomOut = vi.fn();
}

@Component({ selector: 'app-tronc-view', standalone: true, template: '' })
class StubTroncView {
  readonly troncNodes = input<unknown[]>([]);
  readonly baseNodes = input<unknown[]>([]);
  readonly mode = input<string>('editor');
  readonly selectedNodeId = input<string | null>(null);
  readonly nodeSelected = output<string | null>();
  readonly nodeAdded = output<unknown>();
  readonly nodeRemoved = output<string>();
  readonly nodeUpdated = output<unknown>();
  readonly floorRemoved = output<number>();
  readonly baseAdded = output<unknown>();
  readonly baseRemoved = output<string>();
}

@Component({ selector: 'app-template-editor-help-modal', standalone: true, template: '' })
class StubHelpModal {
  readonly autoShow = input(true);
  readonly closed = output<void>();
  open = vi.fn();
  close = vi.fn();
}

@Component({ selector: 'app-rengla-overlay', standalone: true, template: '' })
class StubRenglaOverlay {
  readonly nodes = input<unknown[]>([]);
  readonly rengles = input<unknown[]>([]);
  readonly stageTransform = input<StageTransform>({ x: 0, y: 0, scaleX: 1, scaleY: 1 });
  readonly renglaCreated = output<unknown>();
  readonly renglaUpdated = output<unknown>();
  readonly renglaDeleted = output<unknown>();
}

describe('TemplateEditorComponent — Preview Mode', () => {
  let component: TemplateEditorComponent;
  let fixture: ComponentFixture<TemplateEditorComponent>;

  const mockRouter = { navigate: vi.fn() };
  const mockRoute = {
    snapshot: {
      paramMap: { get: vi.fn().mockReturnValue(null) },
      queryParamMap: { get: vi.fn().mockReturnValue(null) },
    },
  };
  const mockFigureTemplateService = {
    getOne: vi.fn().mockReturnValue(of({ id: '1', name: 'Test', slug: 'test', nodes: [], rengles: [], hasPinya: true })),
    create: vi.fn().mockReturnValue(of({ id: '1' })),
    update: vi.fn().mockReturnValue(of({})),
  };
  const mockCanvasState = {
    gridEnabled: signal(true),
    snapToGrid: signal(false),
    reset: vi.fn(),
  };
  const mockLayout = {
    requestFullscreen: vi.fn(),
    exitFullscreen: vi.fn(),
  };
  const mockToast = {
    success: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TemplateEditorComponent],
      providers: [
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockRoute },
        { provide: FigureTemplateService, useValue: mockFigureTemplateService },
        { provide: CanvasStateService, useValue: mockCanvasState },
        { provide: LayoutService, useValue: mockLayout },
        { provide: ToastService, useValue: mockToast },
        allLucideIconsProvider,
      ],
    })
      .overrideComponent(TemplateEditorComponent, {
        remove: { imports: [FigureCanvasComponent, TroncViewComponent, TemplateEditorHelpModalComponent, RenglaOverlayComponent] },
        add: { imports: [StubFigureCanvas, StubTroncView, StubHelpModal, StubRenglaOverlay] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(TemplateEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('initial state', () => {
    it('should have previewMode = false', () => {
      expect(component.previewMode()).toBe(false);
    });

    it('should have canvasMode = editor', () => {
      expect(component.canvasMode()).toBe('editor');
    });

    it('should have troncMode = editor', () => {
      expect(component.troncMode()).toBe('editor');
    });
  });

  describe('canDeactivate (pending autosave flush) — FE-BUG-26', () => {
    // Fake timers keep the 2s autosave / 2.5s idle-status timers from leaking into later tests.
    beforeEach(() => {
      vi.useFakeTimers();
      mockFigureTemplateService.create.mockClear();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns true synchronously when there is no pending autosave', () => {
      expect(component.canDeactivate()).toBe(true);
    });

    it('flushes the pending autosave immediately and resolves true once the save completes', () => {
      component.onNodeMoved({ id: 'n1', x: 5, y: 5 });
      expect(mockFigureTemplateService.create).not.toHaveBeenCalled();

      const result = component.canDeactivate();
      expect(result).not.toBe(true);

      const emissions: boolean[] = [];
      (result as Observable<boolean>).subscribe((v) => emissions.push(v));

      expect(mockFigureTemplateService.create).toHaveBeenCalledTimes(1);
      expect(emissions).toEqual([true]);
    });

    it('does not schedule a second flush once canDeactivate has cleared the pending timer', () => {
      component.onNodeMoved({ id: 'n1', x: 5, y: 5 });
      (component.canDeactivate() as Observable<boolean>).subscribe();
      expect(component.canDeactivate()).toBe(true);
    });
  });

  describe('beforeunload (tab close with unsaved changes) — FE-BUG-26', () => {
    // Fake timers keep the 2s autosave timer armed by onNodeMoved from leaking into later tests.
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const makeEvent = () => ({ preventDefault: vi.fn(), returnValue: '' }) as unknown as BeforeUnloadEvent;

    it('warns the browser when there is a pending autosave', () => {
      component.onNodeMoved({ id: 'n1', x: 5, y: 5 });
      const event = makeEvent();
      component.onBeforeUnload(event);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('does nothing when there is no pending autosave', () => {
      const event = makeEvent();
      component.onBeforeUnload(event);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('goBack', () => {
    it('navigates to /pinyes (flushing is handled by the route canDeactivate guard)', () => {
      component.goBack();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/pinyes']);
    });
  });

  describe('togglePreview', () => {
    it('should set previewMode to true on first toggle', () => {
      component.togglePreview();
      expect(component.previewMode()).toBe(true);
    });

    it('should set previewMode to false on second toggle', () => {
      component.togglePreview();
      component.togglePreview();
      expect(component.previewMode()).toBe(false);
    });

    it('should clear selectedNodeId when entering preview', () => {
      component.selectedNodeId.set('some-node');
      component.togglePreview();
      expect(component.selectedNodeId()).toBeNull();
    });

    it('should NOT toggle when renglaEditMode is active', () => {
      component.renglaEditMode.set(true);
      component.togglePreview();
      expect(component.previewMode()).toBe(false);
    });

    it('should set previewAnnouncement on enter', () => {
      component.togglePreview();
      expect(component.previewAnnouncement()).toBe('Mode previsualització activat');
    });

    it('should set previewAnnouncement on exit', () => {
      component.togglePreview();
      component.togglePreview();
      expect(component.previewAnnouncement()).toBe('Mode previsualització desactivat');
    });
  });

  describe('canvasMode computed', () => {
    it('should return readonly when previewMode is active', () => {
      component.previewMode.set(true);
      expect(component.canvasMode()).toBe('readonly');
    });

    it('should return readonly when renglaEditMode is active', () => {
      component.renglaEditMode.set(true);
      expect(component.canvasMode()).toBe('readonly');
    });

    it('should return editor by default', () => {
      expect(component.canvasMode()).toBe('editor');
    });

    it('should prioritize previewMode over renglaEditMode', () => {
      component.previewMode.set(true);
      component.renglaEditMode.set(true);
      expect(component.canvasMode()).toBe('readonly');
    });
  });

  describe('troncMode computed', () => {
    it('should return projection when previewMode is active', () => {
      component.previewMode.set(true);
      expect(component.troncMode()).toBe('projection');
    });

    it('should return editor when previewMode is inactive', () => {
      expect(component.troncMode()).toBe('editor');
    });
  });

  describe('rengla mode interaction', () => {
    it('should exit previewMode when toggleRenglaEditMode is called', () => {
      component.previewMode.set(true);
      component.toggleRenglaEditMode();
      expect(component.previewMode()).toBe(false);
      expect(component.renglaEditMode()).toBe(true);
    });
  });

  describe('pinya preset dropdown', () => {
    const makePinyaNode = (overrides: Partial<FigureNodeItem> = {}): FigureNodeItem => ({
      id: 'node-1',
      label: 'AGULLA',
      zone: FigureZone.PINYA,
      positionType: 'agulla',
      x: 100, y: 100, z: 0,
      width: 80, height: 40, rotation: 0,
      color: '#0d9488',
      shape: NodeShape.RECTANGLE,
      sortOrder: 0,
      climbIndicator: null, ringLevel: null, originNodeId: null,
      renglaId: null, renglaPosition: null,
      metadata: {},
      ...overrides,
    });

    beforeEach(() => {
      component.nodes.set([makePinyaNode()]);
      component.selectedNodeId.set('node-1');
      fixture.detectChanges();
    });

    describe('applyPinyaPreset', () => {
      it('does nothing when no node is selected', () => {
        component.selectedNodeId.set(null);
        component.applyPinyaPreset('mans');
        expect(component.nodes()[0].positionType).toBe('agulla');
      });

      it('does nothing for an unknown positionType', () => {
        component.applyPinyaPreset('non-existent');
        expect(component.nodes()[0].positionType).toBe('agulla');
      });

      it('updates positionType, label, color and shape from the preset', () => {
        const mansPreset = PINYA_NODE_PRESETS.find(p => p.positionType === 'mans')!;
        component.applyPinyaPreset('mans');

        const node = component.nodes()[0];
        expect(node.positionType).toBe('mans');
        expect(node.label).toBe(mansPreset.label);
        expect(node.color).toBe(mansPreset.color);
        expect(node.shape).toBe(mansPreset.shape);
      });

      it('does NOT touch renglaId, renglaPosition or ringLevel', () => {
        component.nodes.set([makePinyaNode({ renglaId: 'rengla-1', renglaPosition: 2, ringLevel: 2 })]);
        component.applyPinyaPreset('mans');

        const node = component.nodes()[0];
        expect(node.renglaId).toBe('rengla-1');
        expect(node.renglaPosition).toBe(2);
        expect(node.ringLevel).toBe(2);
      });

      it('does NOT touch x, y, rotation or dimensions', () => {
        component.nodes.set([makePinyaNode({ x: 42, y: 99, rotation: 45, width: 120, height: 60 })]);
        component.applyPinyaPreset('mans');

        const node = component.nodes()[0];
        expect(node.x).toBe(42);
        expect(node.y).toBe(99);
        expect(node.rotation).toBe(45);
        expect(node.width).toBe(120);
        expect(node.height).toBe(60);
      });
    });
  });

  describe('onTroncNodeUpdated — climbIndicator', () => {
    const makeNode = (overrides: Partial<FigureNodeItem> = {}): FigureNodeItem => ({
      id: 'node-1',
      label: 'Segon',
      zone: FigureZone.TRONC,
      positionType: 'segon',
      x: 0, y: 0, z: 1,
      width: 1, height: 1, rotation: 0,
      color: null,
      shape: NodeShape.RECTANGLE,
      sortOrder: 0,
      climbIndicator: null, ringLevel: null, originNodeId: null,
      renglaId: null, renglaPosition: null,
      metadata: {},
      ...overrides,
    });

    it('sets climbIndicator on a TRONC node', () => {
      component.nodes.set([makeNode({ id: 'tronc-1' })]);
      component.selectedNodeId.set('tronc-1');
      fixture.detectChanges();

      component.onTroncNodeUpdated({ nodeId: 'tronc-1', x: 0, width: 1, climbIndicator: 'X' });

      expect(component.nodes()[0].climbIndicator).toBe('X');
    });

    it('sets climbIndicator on a BASE node', () => {
      component.nodes.set([makeNode({ id: 'base-1', zone: FigureZone.BASE, z: 0 })]);
      component.selectedNodeId.set('base-1');
      fixture.detectChanges();

      component.onTroncNodeUpdated({ nodeId: 'base-1', x: 0, width: 1, climbIndicator: 'A' });

      expect(component.nodes()[0].climbIndicator).toBe('A');
    });

    it('clears climbIndicator when set to null', () => {
      component.nodes.set([makeNode({ id: 'tronc-1', climbIndicator: 'X' })]);
      component.selectedNodeId.set('tronc-1');
      fixture.detectChanges();

      component.onTroncNodeUpdated({ nodeId: 'tronc-1', x: 0, width: 1, climbIndicator: null });

      expect(component.nodes()[0].climbIndicator).toBeNull();
    });
  });

  describe('keyboard shortcut', () => {
    function createKeyEvent(key: string, opts: Partial<KeyboardEvent> = {}): KeyboardEvent {
      const event = new KeyboardEvent('keydown', {
        key,
        ctrlKey: opts.ctrlKey ?? false,
        shiftKey: opts.shiftKey ?? false,
        metaKey: opts.metaKey ?? false,
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, 'target', { value: document.body });
      return event;
    }

    it('should toggle preview on Ctrl+Shift+P', () => {
      const event = createKeyEvent('p', { ctrlKey: true, shiftKey: true });
      component.onKeyDown(event);
      expect(component.previewMode()).toBe(true);
    });

    it('should toggle preview on Cmd+Shift+P (macOS)', () => {
      const event = createKeyEvent('p', { metaKey: true, shiftKey: true });
      component.onKeyDown(event);
      expect(component.previewMode()).toBe(true);
    });

    it('should block other shortcuts while in preview mode', () => {
      component.previewMode.set(true);
      component.selectedNodeId.set('some-node');

      const deleteEvent = createKeyEvent('Delete');
      component.onKeyDown(deleteEvent);

      expect(component.selectedNodeId()).toBe('some-node');
    });

    it('should still allow Ctrl+Shift+P to exit preview mode', () => {
      component.previewMode.set(true);
      const event = createKeyEvent('p', { ctrlKey: true, shiftKey: true });
      component.onKeyDown(event);
      expect(component.previewMode()).toBe(false);
    });

    it('should zoom in on Ctrl+=', () => {
      const stub = component.figureCanvas() as unknown as StubFigureCanvas;
      const event = createKeyEvent('=', { ctrlKey: true });
      component.onKeyDown(event);
      expect(stub.zoomIn).toHaveBeenCalled();
    });

    it('should zoom out on Ctrl+-', () => {
      const stub = component.figureCanvas() as unknown as StubFigureCanvas;
      const event = createKeyEvent('-', { ctrlKey: true });
      component.onKeyDown(event);
      expect(stub.zoomOut).toHaveBeenCalled();
    });

    it('should call ghostSelectedNode on Ctrl+Shift+D', () => {
      const ghostSpy = vi.spyOn(component, 'ghostSelectedNode');
      const event = createKeyEvent('D', { ctrlKey: true, shiftKey: true });
      component.onKeyDown(event);
      expect(ghostSpy).toHaveBeenCalled();
    });

    it('should call duplicateSelectedNode (not ghost) on plain Ctrl+D', () => {
      const ghostSpy = vi.spyOn(component, 'ghostSelectedNode');
      const duplicateSpy = vi.spyOn(component, 'duplicateSelectedNode');
      const event = createKeyEvent('d', { ctrlKey: true });
      component.onKeyDown(event);
      expect(duplicateSpy).toHaveBeenCalled();
      expect(ghostSpy).not.toHaveBeenCalled();
    });

    it('should not toggle preview when editing an input', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      const event = new KeyboardEvent('keydown', {
        key: 'p',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      });
      Object.defineProperty(event, 'target', { value: input });
      component.onKeyDown(event);
      expect(component.previewMode()).toBe(false);
      document.body.removeChild(input);
    });
  });

  describe('duplicateSelectedNode / copy-paste — rengla and cordon reset', () => {
    const makePinyaNode = (overrides: Partial<FigureNodeItem> = {}): FigureNodeItem => ({
      id: 'node-1',
      label: 'AGULLA',
      zone: FigureZone.PINYA,
      positionType: 'agulla',
      x: 100, y: 100, z: 0,
      width: 80, height: 40, rotation: 0,
      color: '#0d9488',
      shape: NodeShape.RECTANGLE,
      sortOrder: 0,
      climbIndicator: null, ringLevel: 2, originNodeId: null,
      renglaId: 'rengla-1', renglaPosition: 2,
      metadata: {},
      ...overrides,
    });

    beforeEach(() => {
      component.templateId.set('template-1'); // bypass name prompt
      component.nodes.set([makePinyaNode()]);
      component.selectedNodeId.set('node-1');
      fixture.detectChanges();
    });

    it('duplicateSelectedNode resets renglaId, renglaPosition and ringLevel to null on the new node', () => {
      component.duplicateSelectedNode();

      expect(component.nodes().length).toBe(2);
      const duplicated = component.nodes()[1];
      expect(duplicated.renglaId).toBeNull();
      expect(duplicated.renglaPosition).toBeNull();
      expect(duplicated.ringLevel).toBeNull();
    });

    it('copy then paste resets renglaId, renglaPosition and ringLevel to null on the new node', () => {
      component.copySelectedNode();
      component.pasteNode();

      const pasted = component.nodes()[1];
      expect(pasted.renglaId).toBeNull();
      expect(pasted.renglaPosition).toBeNull();
      expect(pasted.ringLevel).toBeNull();
    });

    it('keeps other properties from the source (label, color, offset position)', () => {
      component.duplicateSelectedNode();

      const duplicated = component.nodes()[1];
      expect(duplicated.label).toBe('AGULLA');
      expect(duplicated.color).toBe('#0d9488');
      expect(duplicated.x).toBe(124);
      expect(duplicated.y).toBe(124);
    });

    it('does not affect the original node', () => {
      component.duplicateSelectedNode();

      const original = component.nodes()[0];
      expect(original.renglaId).toBe('rengla-1');
      expect(original.renglaPosition).toBe(2);
      expect(original.ringLevel).toBe(2);
    });
  });

  describe('onGhostCloneRequested — rengla membership', () => {
    const makePinyaNode = (overrides: Partial<FigureNodeItem> = {}): FigureNodeItem => ({
      id: 'node-1',
      label: 'MANS',
      zone: FigureZone.PINYA,
      positionType: 'mans',
      x: 100, y: 100, z: 0,
      width: 80, height: 40, rotation: 0,
      color: '#FFE082',
      shape: NodeShape.RECTANGLE,
      sortOrder: 0,
      climbIndicator: null, ringLevel: null, originNodeId: null,
      renglaId: null, renglaPosition: null,
      metadata: {},
      ...overrides,
    });

    beforeEach(() => {
      component.templateId.set('template-1'); // bypass name prompt
    });

    it('adds the ghost node to the source rengla, after the last position', () => {
      component.nodes.set([makePinyaNode({ renglaId: 'rengla-1', renglaPosition: 3, ringLevel: 3 })]);
      fixture.detectChanges();

      component.onGhostCloneRequested({
        sourceNode: { id: 'node-1' } as CanvasNode,
        targetPosition: { x: 200, y: 200 },
      });

      expect(component.nodes().length).toBe(2);
      const ghost = component.nodes()[1];
      expect(ghost.renglaId).toBe('rengla-1');
      expect(ghost.renglaPosition).toBe(4);
      expect(ghost.ringLevel).toBe(4);
    });

    it('leaves the ghost node without a rengla when the source does not belong to one', () => {
      component.nodes.set([makePinyaNode()]);
      fixture.detectChanges();

      component.onGhostCloneRequested({
        sourceNode: { id: 'node-1' } as CanvasNode,
        targetPosition: { x: 200, y: 200 },
      });

      const ghost = component.nodes()[1];
      expect(ghost.renglaId).toBeNull();
      expect(ghost.renglaPosition).toBeNull();
      expect(ghost.ringLevel).toBeNull();
    });
  });

  // Both the name-prompt and shortcuts modals are lib-modal instances, so tests scope by title
  // rather than assuming there's only one on the page.
  function findModalByTitle(title: string): ModalComponent {
    const modal = fixture.debugElement
      .queryAll(By.directive(ModalComponent))
      .map((el) => el.componentInstance as ModalComponent)
      .find((m) => m.title() === title);
    expect(modal).toBeTruthy();
    return modal!;
  }

  function findDialogByTitle(title: string): HTMLElement {
    const el = fixture.debugElement
      .queryAll(By.directive(ModalComponent))
      .find((e) => (e.componentInstance as ModalComponent).title() === title);
    expect(el).toBeTruthy();
    const dialog: HTMLElement | null = el!.nativeElement.querySelector('dialog');
    expect(dialog).toBeTruthy();
    return dialog!;
  }

  describe('name-prompt modal (design system)', () => {
    it('renders a lib-modal whose open mirrors showNamePrompt', () => {
      expect(findModalByTitle('Nom de la figura').open()).toBe(false);

      component.showNamePrompt.set(true);
      fixture.detectChanges();

      expect(findModalByTitle('Nom de la figura').open()).toBe(true);
    });

    it('confirms the typed name and closes the prompt', () => {
      component.showNamePrompt.set(true);
      fixture.detectChanges();

      // Scoped to the modal's own dialog — the properties panel has an unrelated field sharing
      // the same accessible name ("Nom de la figura"), never visible at the same time as this
      // prompt, but ambiguous for a plain document-wide query.
      const dialog = findDialogByTitle('Nom de la figura');
      const nameInput: HTMLInputElement = dialog.querySelector('input[aria-label="Nom de la figura"]')!;
      nameInput.value = 'Pilar de 4';
      nameInput.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const confirmButton: HTMLElement = dialog.querySelector('button[aria-label="Confirma el nom"]')!;
      confirmButton.click();
      fixture.detectChanges();

      expect(component.templateName()).toBe('Pilar de 4');
      expect(component.showNamePrompt()).toBe(false);
    });

    it('cancels via the Cancel·la button', () => {
      component.showNamePrompt.set(true);
      fixture.detectChanges();

      const cancelButton: HTMLElement = fixture.nativeElement.querySelector(
        'button[aria-label="Cancel·la"]',
      );
      cancelButton.click();
      fixture.detectChanges();

      expect(component.showNamePrompt()).toBe(false);
    });

    it('cancels when the modal is dismissed natively (e.g. Escape)', () => {
      component.showNamePrompt.set(true);
      fixture.detectChanges();

      findModalByTitle('Nom de la figura').closed.emit();
      fixture.detectChanges();

      expect(component.showNamePrompt()).toBe(false);
    });
  });

  describe('shortcuts modal (design system)', () => {
    it('renders a lib-modal titled "Dreceres de teclat" whose open mirrors shortcutsModalOpen', () => {
      expect(findModalByTitle('Dreceres de teclat').open()).toBe(false);

      component.toggleShortcutsModal();
      fixture.detectChanges();

      expect(findModalByTitle('Dreceres de teclat').open()).toBe(true);
    });

    it('closes when the modal is dismissed natively (e.g. Escape or the close button)', () => {
      component.toggleShortcutsModal();
      fixture.detectChanges();
      expect(component.shortcutsModalOpen()).toBe(true);

      findModalByTitle('Dreceres de teclat').closed.emit();
      fixture.detectChanges();

      expect(component.shortcutsModalOpen()).toBe(false);
    });

    it('still lists the keyboard shortcuts inside the modal', () => {
      component.toggleShortcutsModal();
      fixture.detectChanges();

      const dialog = findDialogByTitle('Dreceres de teclat');
      expect(dialog.textContent).toContain('Selecciona node');
      expect(dialog.textContent).toContain('Duplica node seleccionat');
    });
  });

  describe('top bar (design system)', () => {
    function findButtonByAriaLabel(label: string) {
      const btn = fixture.debugElement
        .queryAll(By.directive(ButtonComponent))
        .find((el) => (el.componentInstance as ButtonComponent).ariaLabel() === label);
      expect(btn).toBeTruthy();
      return btn!.componentInstance as ButtonComponent;
    }

    it('the back-to-list button is a lib-button and navigates back on click', () => {
      const back = findButtonByAriaLabel('Tornar a la llista');
      expect(back).toBeTruthy();

      back.clicked.emit();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/pinyes']);
    });

    // The undo/redo buttons' aria-label grows a ": <description>" suffix once there's a stack
    // entry (see undoDescription/redoDescription), so tests match on a stable prefix and keep
    // the same component-instance reference across a state change rather than re-querying by
    // the now-changed exact label.
    function findButtonByAriaLabelPrefix(prefix: string) {
      const btn = fixture.debugElement
        .queryAll(By.directive(ButtonComponent))
        .find((el) => (el.componentInstance as ButtonComponent).ariaLabel()?.startsWith(prefix));
      expect(btn).toBeTruthy();
      return btn!.componentInstance as ButtonComponent;
    }

    it('undo/redo are icon-only square lib-buttons, disabled state mirrors canUndo/canRedo', () => {
      const undo = findButtonByAriaLabelPrefix('Desfer');
      const redo = findButtonByAriaLabelPrefix('Refer');
      expect(undo.shape()).toBe('square');
      expect(redo.shape()).toBe('square');
      expect(undo.disabled()).toBe(true);
      expect(redo.disabled()).toBe(true);

      component.onNodeMoved({ id: 'n1', x: 5, y: 5 });
      fixture.detectChanges();

      expect(undo.disabled()).toBe(false);
    });

    it('clicking undo/redo calls performUndo/performRedo', () => {
      component.onNodeMoved({ id: 'n1', x: 5, y: 5 });
      fixture.detectChanges();

      const undoSpy = vi.spyOn(component, 'performUndo');
      findButtonByAriaLabelPrefix('Desfer').clicked.emit();
      expect(undoSpy).toHaveBeenCalled();

      fixture.detectChanges();
      const redoSpy = vi.spyOn(component, 'performRedo');
      findButtonByAriaLabelPrefix('Refer').clicked.emit();
      expect(redoSpy).toHaveBeenCalled();
    });

    it('the preview toggle is a lib-button whose variant and aria-pressed mirror previewMode', () => {
      let toggle = findButtonByAriaLabel('Previsualitzar figura');
      expect(toggle.variant()).toBe('ghost');
      expect(toggle.ariaPressed()).toBe(false);

      toggle.clicked.emit();
      fixture.detectChanges();

      toggle = findButtonByAriaLabel('Previsualitzar figura');
      expect(component.previewMode()).toBe(true);
      expect(toggle.variant()).toBe('primary');
      expect(toggle.ariaPressed()).toBe(true);
    });

    it('the preview toggle is disabled while in rengla edit mode', () => {
      component.renglaEditMode.set(true);
      fixture.detectChanges();

      expect(findButtonByAriaLabel('Previsualitzar figura').disabled()).toBe(true);
    });

    it('the shortcuts and editor-help buttons are lib-buttons wired to their triggers', () => {
      findButtonByAriaLabel('Veure dreceres de teclat').clicked.emit();
      fixture.detectChanges();
      expect(component.shortcutsModalOpen()).toBe(true);

      findButtonByAriaLabel("Ajuda de l'editor de figures").clicked.emit();
      fixture.detectChanges();
      expect(component.helpModal().open).toHaveBeenCalled();
    });
  });

  describe('left toolbar (design system)', () => {
    function findButtonByAriaLabel(label: string) {
      const btn = fixture.debugElement
        .queryAll(By.directive(ButtonComponent))
        .find((el) => (el.componentInstance as ButtonComponent).ariaLabel() === label);
      expect(btn).toBeTruthy();
      return btn!.componentInstance as ButtonComponent;
    }

    it('the BASE tile is a lib-button that adds a base node', () => {
      const spy = vi.spyOn(component, 'onBaseNodeAdded');
      findButtonByAriaLabel('Afegeix node base').clicked.emit();
      expect(spy).toHaveBeenCalledWith({ sortOrder: component.baseNodes().length });
    });

    it('each pinya preset tile is a lib-button that adds that preset\'s node', () => {
      const spy = vi.spyOn(component, 'addPinyaNode');
      const preset = component.pinyaPositions[0];
      findButtonByAriaLabel(`Afegir node ${preset.label}`).clicked.emit();
      expect(spy).toHaveBeenCalledWith(preset);
    });

    // Stays raw (not a lib-button) — see the template comment: lib-button's fixed-height box
    // can't fit this tile's wrapped 3-word label in the ~48px-wide column. Still shares the app's
    // real .ds-lift button motion directly, so it's checked here rather than as a ButtonComponent.
    it('the snap-to-grid toggle reflects and toggles snapToGrid, sharing the .ds-lift motion', () => {
      const toggle = () => fixture.nativeElement.querySelector('button[aria-label="Encaixa a la quadrícula"]') as HTMLButtonElement;

      expect(component.snapToGrid()).toBe(false);
      expect(toggle().classList).toContain('ds-lift');
      expect(toggle().getAttribute('aria-pressed')).toBe('false');
      expect(toggle().classList).not.toContain('active');

      toggle().click();
      fixture.detectChanges();

      expect(component.snapToGrid()).toBe(true);
      expect(toggle().getAttribute('aria-pressed')).toBe('true');
      expect(toggle().classList).toContain('active');
    });
  });

  describe('properties panel form controls (design system)', () => {
    const makeNode = (overrides: Partial<FigureNodeItem> = {}): FigureNodeItem => ({
      id: 'node-1',
      label: 'AGULLA',
      zone: FigureZone.PINYA,
      positionType: 'agulla',
      x: 100, y: 100, z: 0,
      width: 80, height: 40, rotation: 0,
      color: '#0d9488',
      shape: NodeShape.RECTANGLE,
      sortOrder: 0,
      climbIndicator: null, ringLevel: null, originNodeId: null,
      renglaId: null, renglaPosition: null,
      metadata: {},
      ...overrides,
    });

    // A field's lib-input is freshly created here (behind the @if branch), so its first
    // ngModel write is a *new* standalone NgModel registration — Angular defers that one's
    // initial writeValue to a microtask (its documented fix for avoiding
    // ExpressionChangedAfterItHasBeenCheckedError on newly-registered controls). Flushing that
    // microtask before the follow-up detectChanges is what makes the initial value observable
    // synchronously in the test; it's invisible in the real app, where nothing paints before
    // microtasks flush anyway.
    async function selectNode(overrides: Partial<FigureNodeItem> = {}): Promise<void> {
      component.nodes.set([makeNode(overrides)]);
      component.selectedNodeId.set('node-1');
      fixture.detectChanges();
      await Promise.resolve();
      fixture.detectChanges();
    }

    // A static `id="..."` on a <lib-input> tag lands on both the (display:contents) host AND
    // the real inner native input it forwards the id to — two elements sharing one id. jsdom's
    // selector engine mishandles a compound `input#id` query against a duplicate id (silently
    // returns null even though `input[id="..."]` finds it fine), so use the attribute-selector
    // form rather than the `#id` shorthand.
    function nativeInput(id: string): HTMLInputElement {
      const el: HTMLInputElement | null = fixture.nativeElement.querySelector(`input[id="${id}"]`);
      expect(el).toBeTruthy();
      return el!;
    }

    function setValue(input: HTMLInputElement, value: string): void {
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    }

    it('the label field is a lib-input bound to the selected node label', async () => {
      await selectNode({ label: 'AGULLA' });
      expect(nativeInput('node-label').value).toBe('AGULLA');

      setValue(nativeInput('node-label'), 'NOVA ETIQUETA');
      expect(component.nodes()[0].label).toBe('NOVA ETIQUETA');
    });

    it('the indicator field (PINYA only) is a lib-input bound to climbIndicator', async () => {
      await selectNode({ zone: FigureZone.PINYA, climbIndicator: 'X' });
      expect(nativeInput('node-indicator').value).toBe('X');

      setValue(nativeInput('node-indicator'), 'Y');
      expect(component.nodes()[0].climbIndicator).toBe('Y');
    });

    it('does not render the indicator field for a TRONC node', async () => {
      await selectNode({ zone: FigureZone.TRONC });
      expect(fixture.nativeElement.querySelector('input[id="node-indicator"]')).toBeNull();
    });

    it('the shape field (non-TRONC nodes) is a lib-select bound to the node shape', async () => {
      await selectNode({ zone: FigureZone.PINYA, shape: NodeShape.ELLIPSE });
      const select: HTMLSelectElement | null = fixture.nativeElement.querySelector('select[id="node-shape"]');
      expect(select).toBeTruthy();
      expect(select!.value).toBe(NodeShape.ELLIPSE);

      select!.value = NodeShape.RECTANGLE;
      select!.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(component.nodes()[0].shape).toBe(NodeShape.RECTANGLE);
    });

    it('the position-type field (PINYA only) is a lib-select bound to positionType, applying the preset', async () => {
      await selectNode({ zone: FigureZone.PINYA, positionType: 'agulla' });
      const select: HTMLSelectElement | null = fixture.nativeElement.querySelector('select[id="node-position-type"]');
      expect(select).toBeTruthy();
      expect(select!.value).toBe('agulla');

      // The color/shape swatch is projected as rich <option> content (shown in the open dropdown,
      // and in the closed control in browsers supporting base-select) AND passed to lib-select's
      // own [swatchColor] input, which renders it in the closed control everywhere else.
      const options = select!.querySelectorAll('option');
      expect(options.length).toBe(PINYA_NODE_PRESETS.length);
      expect(options[0].querySelector('span')).toBeTruthy();

      const agullaPreset = PINYA_NODE_PRESETS.find((p) => p.positionType === 'agulla')!;
      const swatch: HTMLElement | null = fixture.nativeElement.querySelector('[data-testid="lib-select-swatch"]');
      expect(swatch).toBeTruthy();
      expect(component.presetForPositionType('agulla')?.color).toBe(agullaPreset.color);

      const mansPreset = PINYA_NODE_PRESETS.find((p) => p.positionType === 'mans')!;
      select!.value = 'mans';
      select!.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      const node = component.nodes()[0];
      expect(node.positionType).toBe('mans');
      expect(node.label).toBe(mansPreset.label);
      expect(node.color).toBe(mansPreset.color);
    });

    it('does not render the position-type field for a non-PINYA node', async () => {
      await selectNode({ zone: FigureZone.TRONC });
      expect(fixture.nativeElement.querySelector('select[id="node-position-type"]')).toBeNull();
    });

    it('does not render the shape field for a TRONC node', async () => {
      await selectNode({ zone: FigureZone.TRONC });
      expect(fixture.nativeElement.querySelector('[data-testid="lib-select-native"]')).toBeNull();
    });

    it('width/height are lib-inputs bound to the node dimensions (non-TRONC nodes)', async () => {
      await selectNode({ width: 80, height: 40 });
      expect(nativeInput('node-width').value).toBe('80');
      expect(nativeInput('node-height').value).toBe('40');

      setValue(nativeInput('node-width'), '120');
      expect(component.nodes()[0].width).toBe(120);

      setValue(nativeInput('node-height'), '60');
      expect(component.nodes()[0].height).toBe(60);
    });

    it('x/y are lib-inputs bound to the node position (non-TRONC nodes)', async () => {
      await selectNode({ x: 100, y: 100 });
      expect(nativeInput('node-x').value).toBe('100');
      expect(nativeInput('node-y').value).toBe('100');

      setValue(nativeInput('node-x'), '150');
      expect(component.nodes()[0].x).toBe(150);

      setValue(nativeInput('node-y'), '175');
      expect(component.nodes()[0].y).toBe(175);
    });

    it('floor (z) is a lib-input, only for a non-PINYA/BASE/TRONC zone', async () => {
      await selectNode({ zone: FigureZone.DECORATION, z: 2 });
      expect(nativeInput('node-z').value).toBe('2');

      setValue(nativeInput('node-z'), '5');
      expect(component.nodes()[0].z).toBe(5);
    });

    it('does not render the floor field for a PINYA node', async () => {
      await selectNode({ zone: FigureZone.PINYA });
      expect(fixture.nativeElement.querySelector('input[id="node-z"]')).toBeNull();
    });

    it('the template-name field (no node selected) is a lib-input bound to templateName', async () => {
      component.selectedNodeId.set(null);
      component.templateName.set('Pilar de 4');
      fixture.detectChanges();
      await Promise.resolve();
      fixture.detectChanges();

      expect(nativeInput('template-name-input').value).toBe('Pilar de 4');

      setValue(nativeInput('template-name-input'), 'Torre de 6');
      expect(component.templateName()).toBe('Torre de 6');
    });
  });

});

describe('nodeToPayload', () => {
  const baseNode: FigureNodeItem = {
    id: 'node-1',
    label: 'AGULLA',
    zone: FigureZone.PINYA,
    positionType: 'agulla',
    x: 100, y: 100, z: 0,
    width: 80, height: 40, rotation: 0,
    color: '#0d9488',
    shape: NodeShape.RECTANGLE,
    sortOrder: 0,
    climbIndicator: null, ringLevel: null, originNodeId: null,
    renglaId: null, renglaPosition: null,
    metadata: {},
  };

  it('sends renglaId, renglaPosition and originNodeId as null when the node has no rengla — not undefined', () => {
    const payload = nodeToPayload({
      ...baseNode,
      renglaId: null,
      renglaPosition: null,
      originNodeId: null,
    });

    expect(payload.renglaId).toBeNull();
    expect(payload.renglaPosition).toBeNull();
    expect(payload.originNodeId).toBeNull();
  });

  it('sends renglaId, renglaPosition and originNodeId as-is when the node belongs to a rengla', () => {
    const payload = nodeToPayload({
      ...baseNode,
      renglaId: 'rengla-1',
      renglaPosition: 2,
      originNodeId: 'origin-1',
    });

    expect(payload.renglaId).toBe('rengla-1');
    expect(payload.renglaPosition).toBe(2);
    expect(payload.originNodeId).toBe('origin-1');
  });
});
