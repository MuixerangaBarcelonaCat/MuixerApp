import { Component, input, output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { of } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { FigureZone, NodeShape, PINYA_NODE_PRESETS } from '@muixer/shared';
import { FigureNodeItem } from '../../models/figure-template.model';
import { TemplateEditorComponent, nodeToPayload } from './template-editor.component';
import { FigureCanvasComponent } from '../figure-canvas/figure-canvas.component';
import { TroncViewComponent } from '../tronc-view/tronc-view.component';
import { TemplateEditorHelpModalComponent } from '../template-editor-help-modal/template-editor-help-modal.component';
import { RenglaOverlayComponent } from '../rengla-overlay/rengla-overlay.component';
import { FigureTemplateService } from '../../services/figure-template.service';
import { CanvasStateService } from '../../services/canvas-state.service';
import { LayoutService } from '../../../../core/services/layout.service';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';
import { StageTransform } from '../../utils/rengla-coordinates.util';

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
      climbPath: null, ringLevel: null, originNodeId: null,
      renglaId: null, renglaPosition: null,
      metadata: {},
      ...overrides,
    });

    beforeEach(() => {
      component.nodes.set([makePinyaNode()]);
      component.selectedNodeId.set('node-1');
      fixture.detectChanges();
    });

    describe('currentPinyaPreset', () => {
      it('returns null when no node is selected', () => {
        component.selectedNodeId.set(null);
        expect(component.currentPinyaPreset()).toBeNull();
      });

      it('returns the matching preset when positionType matches', () => {
        const preset = component.currentPinyaPreset();
        expect(preset).not.toBeNull();
        expect(preset?.positionType).toBe('agulla');
        expect(preset?.label).toBe(PINYA_NODE_PRESETS.find(p => p.positionType === 'agulla')?.label);
      });

      it('returns null when positionType does not match any preset', () => {
        component.nodes.set([makePinyaNode({ positionType: 'custom-type' })]);
        expect(component.currentPinyaPreset()).toBeNull();
      });

      it('returns null for a non-PINYA node', () => {
        component.nodes.set([makePinyaNode({ zone: FigureZone.BASE, positionType: 'agulla' })]);
        expect(component.currentPinyaPreset()).toBeNull();
      });

      it('returns null when positionType is null', () => {
        component.nodes.set([makePinyaNode({ positionType: null })]);
        expect(component.currentPinyaPreset()).toBeNull();
      });
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

      it('closes the dropdown after applying a preset', () => {
        component.presetDropdownOpen.set(true);
        component.applyPinyaPreset('mans');
        expect(component.presetDropdownOpen()).toBe(false);
      });
    });

    describe('presetDropdownOpen', () => {
      it('defaults to false', () => {
        expect(component.presetDropdownOpen()).toBe(false);
      });

      it('onNodeSelected closes the dropdown', () => {
        component.presetDropdownOpen.set(true);
        component.onNodeSelected(null);
        expect(component.presetDropdownOpen()).toBe(false);
      });

      it('onNodeSelected to a different node closes the dropdown', () => {
        component.nodes.set([
          makePinyaNode({ id: 'node-1' }),
          makePinyaNode({ id: 'node-2', positionType: 'mans' }),
        ]);
        component.presetDropdownOpen.set(true);
        component.onNodeSelected('node-2');
        expect(component.presetDropdownOpen()).toBe(false);
      });
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
    climbPath: null, ringLevel: null, originNodeId: null,
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
