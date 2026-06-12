import {
  Component,
  ChangeDetectionStrategy,
  HostListener,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
  viewChild,
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Undo2, Redo2, Eye, EyeOff } from 'lucide-angular';
import { HttpErrorResponse } from '@angular/common/http';
import { generateUUID } from '../../../../shared/utils/uuid.util';
import { FigureTemplateService } from '../../services/figure-template.service';
import { CanvasStateService } from '../../services/canvas-state.service';
import { FigureCanvasComponent, CanvasNode } from '../figure-canvas/figure-canvas.component';
import { TroncViewComponent } from '../tronc-view/tronc-view.component';
import { TemplateEditorHelpModalComponent } from '../template-editor-help-modal/template-editor-help-modal.component';
import {
  FigureTemplateDetail,
  FigureNodeItem,
  CreateFigureNodePayload,
  RenglaModel,
} from '../../models/figure-template.model';
import { FigureZone, NodeShape } from '@muixer/shared';
import { RenglaOverlayComponent, RenglaCreatedEvent, RenglaDeletedEvent } from '../rengla-overlay/rengla-overlay.component';
import { StageTransform } from '../../utils/rengla-coordinates.util';
import { LayoutService } from '../../../../core/services/layout.service';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';
import { validateBaseOrdering } from '../../utils/base-ordering.util';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface TemplateSnapshot {
  description: string;
  nodes: FigureNodeItem[];
  rengles: RenglaModel[];
}

const MAX_UNDO_STACK = 50;

interface PinyaPosition {
  positionType: string;
  label: string;
  color: string;
  shape: NodeShape;
}

// TODO: Adjust default node dimensions to match visual needs
const DEFAULT_NODE_WIDTH = 80;
const DEFAULT_NODE_HEIGHT = 40;

const PINYA_POSITIONS: PinyaPosition[] = [
  { positionType: 'agulla',      label: 'AGULLA',      color: '#0d9488', shape: NodeShape.RECTANGLE },
  { positionType: 'mans',        label: 'MANS',        color: '#FFE082', shape: NodeShape.RECTANGLE },
  { positionType: 'laterals',    label: 'LATERALS',    color: '#80DEEA', shape: NodeShape.RECTANGLE },
  { positionType: 'vents',       label: 'VENTS',       color: '#A5D6A7', shape: NodeShape.RECTANGLE },
  { positionType: 'cordo-obert', label: 'CORDO OBERT', color: '#FFF9C4', shape: NodeShape.ELLIPSE },
  { positionType: 'tap',         label: 'TAP',         color: '#be185d', shape: NodeShape.RECTANGLE },
  { positionType: 'crossa',      label: 'CROSSA',      color: '#9FA8DA', shape: NodeShape.RECTANGLE},
  { positionType: 'contrafort',  label: 'CONTRAFORT',  color: '#EF9A9A', shape: NodeShape.RECTANGLE },
];

@Component({
  selector: 'app-template-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    LucideAngularModule,
    FigureCanvasComponent,
    TroncViewComponent,
    TemplateEditorHelpModalComponent,
    RenglaOverlayComponent,
  ],
  templateUrl: './template-editor.component.html',
  styleUrl: './template-editor.component.scss',
})
export class TemplateEditorComponent implements OnInit, OnDestroy {
  private readonly figureTemplateService = inject(FigureTemplateService);
  private readonly canvasState = inject(CanvasStateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly layout = inject(LayoutService);
  private readonly toast = inject(ToastService);

  readonly helpModal = viewChild.required(TemplateEditorHelpModalComponent);

  // Template metadata
  templateId = signal<string | null>(null);
  templateName = signal('Nova Figura');
  templateSlug = signal('');
  templateDescription = signal('');
  hasPinya = signal(true);

  // Nodes
  nodes = signal<FigureNodeItem[]>([]);
  selectedNodeId = signal<string | null>(null);
  private clipboardNode = signal<FigureNodeItem | null>(null);

  // Rengles
  rengles = signal<RenglaModel[]>([]);
  renglaEditMode = signal(false);
  stageTransform = signal<StageTransform>({ x: 0, y: 0, scaleX: 1, scaleY: 1 });

  // Name enforcement
  readonly showNamePrompt = signal(false);
  private pendingAction: (() => void) | null = null;
  readonly needsName = computed(() => {
    const name = this.templateName().trim();
    return !this.templateId() && (!name || name === 'Nova Figura');
  });

  // Preview mode
  readonly previewMode = signal(false);
  readonly previewAnnouncement = signal('');

  readonly canvasMode = computed(() => {
    if (this.previewMode()) return 'readonly' as const;
    if (this.renglaEditMode()) return 'readonly' as const;
    return 'editor' as const;
  });

  readonly troncMode = computed<'editor' | 'projection'>(() =>
    this.previewMode() ? 'projection' : 'editor',
  );

  // Panel visibility
  propertiesPanelOpen = signal(true);
  shortcutsModalOpen = signal(false);
  troncDrawerOpen = signal(false);

  // Ad-hoc instance awareness
  readonly adHocInstanceCount = signal(0);
  readonly adHocBannerDismissed = signal(false);

  // Floating tronc panel drag state
  readonly troncPanelPos = signal({ x: 16, y: 60 });
  private troncDragging = false;
  private troncDragOffset = { x: 0, y: 0 };

  // Icons
  readonly Undo2 = Undo2;
  readonly Redo2 = Redo2;
  readonly Eye = Eye;
  readonly EyeOff = EyeOff;

  // Undo/redo (memento pattern)
  private readonly undoStack = signal<TemplateSnapshot[]>([]);
  private readonly redoStack = signal<TemplateSnapshot[]>([]);
  readonly canUndo = computed(() => this.undoStack().length > 0);
  readonly canRedo = computed(() => this.redoStack().length > 0);
  readonly undoDescription = computed(() => {
    const stack = this.undoStack();
    return stack.length > 0 ? stack[stack.length - 1].description : null;
  });
  readonly redoDescription = computed(() => {
    const stack = this.redoStack();
    return stack.length > 0 ? stack[stack.length - 1].description : null;
  });

  // Status
  loading = signal(false);
  saveStatus = signal<SaveStatus>('idle');
  private autosaveTimer: ReturnType<typeof setTimeout> | null = null;

  // Expose canvas state signals for template binding
  readonly gridEnabled = this.canvasState.gridEnabled;
  readonly snapToGrid = this.canvasState.snapToGrid;

  // Enums for template
  readonly FigureZone = FigureZone;
  readonly NodeShape = NodeShape;
  readonly pinyaPositions = PINYA_POSITIONS;

  readonly pinyaNodes = computed(() =>
    this.nodes().filter((n) => n.zone !== FigureZone.TRONC),
  );

  readonly baseNodes = computed(() =>
    this.nodes().filter((n) => n.zone === FigureZone.BASE),
  );

  readonly troncNodes = computed(() =>
    this.nodes().filter((n) => n.zone === FigureZone.TRONC),
  );

  readonly selectedNode = computed(() => {
    const id = this.selectedNodeId();
    return id ? (this.nodes().find((n) => n.id === id) ?? null) : null;
  });

  readonly saveStatusLabel = computed(() => {
    const s = this.saveStatus();
    if (s === 'saving') return 'Alçant...';
    if (s === 'saved') return 'Alçat';
    if (s === 'error') return "S'ha produït un error en alçar";
    return '';
  });

  /** Validation of BASE node counter-clockwise ordering. Recomputes on any node change. */
  readonly baseOrderingValidation = computed(() =>
    validateBaseOrdering(
      this.baseNodes().map((n) => ({ sortOrder: n.sortOrder, x: n.x, y: n.y })),
    ),
  );

  ngOnInit(): void {
    this.layout.requestFullscreen();
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.templateId.set(id);
      this.loadTemplate(id);
    } else {
      this.canvasState.reset();
    }
  }

  ngOnDestroy(): void {
    this.layout.exitFullscreen();
    if (this.autosaveTimer) clearTimeout(this.autosaveTimer);
  }

  goBack(): void {
    this.router.navigate(['/pinyes']);
  }

  // ── Canvas events ──────────────────────────────────────────────────────────

  onNodeSelected(id: string | null): void {
    this.selectedNodeId.set(id);
  }

  onNodeMoved(event: { id: string; x: number; y: number }): void {
    this.pushSnapshot('Moure node');
    this.updateNode(event.id, { x: event.x, y: event.y });
    this.scheduleAutosave();
  }

  onNodeRotated(event: { id: string; rotation: number }): void {
    this.pushSnapshot('Rotar node');
    this.updateNode(event.id, { rotation: event.rotation });
    this.scheduleAutosave();
  }

  onNodeResized(event: { id: string; width: number; height: number }): void {
    this.pushSnapshot('Redimensionar node');
    this.updateNode(event.id, { width: event.width, height: event.height });
    this.scheduleAutosave();
  }

  onNodeLabelChanged(event: { id: string; label: string }): void {
    this.pushSnapshot('Canviar etiqueta');
    this.updateNode(event.id, { label: event.label });
    this.scheduleAutosave();
  }

  // ── Tronc widget events ────────────────────────────────────────────────────

  onTroncNodeAdded(event: {
    z: number;
    positionType: string;
    label: string;
    sortOrder: number;
  }): void {
    const doAdd = () => {
      this.pushSnapshot('Afegir node de tronc');
      const id = generateUUID();
      const existingAtZ = this.troncNodes().filter((n) => n.z === event.z);
      const nextX = existingAtZ.reduce(
        (max, n) => Math.max(max, n.x + n.width),
        0,
      );
      const newNode: FigureNodeItem = {
        id,
        label: event.label,
        zone: FigureZone.TRONC,
        positionType: event.positionType,
        x: nextX,
        y: 0,
        z: event.z,
        width: 1,
        height: 40,
        rotation: 0,
        color: null,
        shape: NodeShape.RECTANGLE,
        sortOrder: event.sortOrder,
        climbPath: null,
        ringLevel: null,
        originNodeId: null,
        renglaId: null,
        renglaPosition: null,
        metadata: {},
      };
      this.nodes.update((n) => [...n, newNode]);
      this.selectedNodeId.set(id);
      this.scheduleAutosave();
    };

    if (!this.requireName(doAdd)) return;
    doAdd();
  }

  onTroncNodeRemoved(id: string): void {
    this.pushSnapshot('Eliminar node de tronc');
    this.nodes.update((n) => n.filter((node) => node.id !== id));
    if (this.selectedNodeId() === id) this.selectedNodeId.set(null);
    this.scheduleAutosave();
  }

  onTroncNodeUpdated(event: {
    nodeId: string;
    x: number;
    width: number;
  }): void {
    this.pushSnapshot('Modificar node de tronc');
    this.updateNode(event.nodeId, { x: event.x, width: event.width });
    this.scheduleAutosave();
  }

  onTroncFloorRemoved(z: number): void {
    this.pushSnapshot('Eliminar pis');
    this.nodes.update((n) =>
      n.filter((node) => !(node.zone === FigureZone.TRONC && node.z === z)),
    );
    this.selectedNodeId.set(null);
    this.scheduleAutosave();
  }

  // ── Base node events (from tronc widget bases section) ────────────────────

  onBaseNodeAdded(event: { sortOrder: number }): void {
    const doAdd = () => {
      this.pushSnapshot('Afegir base');
      const id = generateUUID();
      const stageCenter = { x: 200, y: 200 };
      const baseNumber = this.baseNodes().length + 1;
      const newNode: FigureNodeItem = {
        id,
        label: `Base ${baseNumber}`,
        zone: FigureZone.BASE,
        positionType: 'base',
        x: stageCenter.x + Math.random() * 40 - 20,
        y: stageCenter.y + Math.random() * 40 - 20,
        z: 0,
        width: DEFAULT_NODE_WIDTH,
        height: DEFAULT_NODE_HEIGHT,
        rotation: 0,
        color: '#EEEEEE',
        shape: NodeShape.RECTANGLE,
        sortOrder: event.sortOrder,
        climbPath: null,
        ringLevel: null,
        originNodeId: null,
        renglaId: null,
        renglaPosition: null,
        metadata: {},
      };
      this.nodes.update((n) => [...n, newNode]);
      this.selectedNodeId.set(id);
      this.scheduleAutosave();
    };

    if (!this.requireName(doAdd)) return;
    doAdd();
  }

  onBaseNodeRemoved(id: string): void {
    this.pushSnapshot('Eliminar base');
    this.nodes.update((n) => n.filter((node) => node.id !== id));
    if (this.selectedNodeId() === id) this.selectedNodeId.set(null);
    this.scheduleAutosave();
  }

  // ── Toolbar actions ────────────────────────────────────────────────────────

  addPinyaNode(pos: PinyaPosition): void {
    this.addNode(
      FigureZone.PINYA,
      0,
      pos.positionType,
      pos.color,
      pos.label,
      pos.shape,
    );
  }

  addNode(
    zone: FigureZone,
    z = 0,
    positionType: string | null = null,
    color: string | null = null,
    labelOverride?: string,
    shape: NodeShape = NodeShape.RECTANGLE,
  ): void {
    const doAdd = () => {
      this.pushSnapshot(`Afegir ${labelOverride ?? 'node'}`);
      const id = generateUUID();
      const stageCenter = { x: 200, y: 200 };
      const newNode: FigureNodeItem = {
        id,
        label: labelOverride ?? this.defaultLabel(zone, z),
        zone,
        positionType,
        x: stageCenter.x + Math.random() * 40 - 20,
        y: stageCenter.y + Math.random() * 40 - 20,
        z,
        width: DEFAULT_NODE_WIDTH,
        height: DEFAULT_NODE_HEIGHT,
        rotation: 0,
        color,
        shape: shape,
        sortOrder: this.nodes().length,
        climbPath: null,
        ringLevel: null,
        originNodeId: null,
        renglaId: null,
        renglaPosition: null,
        metadata: {},
      };
      this.nodes.update((n) => [...n, newNode]);
      this.selectedNodeId.set(id);
      this.scheduleAutosave();
    };

    if (!this.requireName(doAdd)) return;
    doAdd();
  }

  // ── Tronc panel drag ─────────────────────────────────────────────────────

  onTroncDragStart(event: MouseEvent): void {
    if ((event.target as HTMLElement).closest('button')) return;
    this.troncDragging = true;
    const pos = this.troncPanelPos();
    this.troncDragOffset = {
      x: event.clientX - pos.x,
      y: event.clientY - pos.y,
    };
    event.preventDefault();
  }

  @HostListener('document:mousemove', ['$event'])
  onTroncDragMove(event: MouseEvent): void {
    if (!this.troncDragging) return;
    this.troncPanelPos.set({
      x: event.clientX - this.troncDragOffset.x,
      y: event.clientY - this.troncDragOffset.y,
    });
  }

  @HostListener('document:mouseup')
  onTroncDragEnd(): void {
    this.troncDragging = false;
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    const isEditing =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable;
    if (isEditing) return;

    const isMod = event.metaKey || event.ctrlKey;

    if (isMod && event.shiftKey && event.key.toLowerCase() === 'p') {
      event.preventDefault();
      this.togglePreview();
      return;
    }

    if (this.previewMode()) return;

    if (isMod && event.key === 'z' && !event.shiftKey) {
      event.preventDefault();
      this.performUndo();
      return;
    }

    if (isMod && event.key === 'z' && event.shiftKey) {
      event.preventDefault();
      this.performRedo();
      return;
    }

    if (isMod && event.key === 'c') {
      event.preventDefault();
      this.copySelectedNode();
      return;
    }

    if (isMod && event.key === 'v') {
      event.preventDefault();
      this.pasteNode();
      return;
    }

    if (isMod && event.key === 'd') {
      event.preventDefault();
      this.duplicateSelectedNode();
      return;
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (!this.selectedNodeId()) return;
      event.preventDefault();
      this.deleteSelectedNode();
      return;
    }

    const ARROW_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    if (ARROW_KEYS.includes(event.key)) {
      const id = this.selectedNodeId();
      if (!id) return;
      event.preventDefault();
      this.moveSelectedNodeByKey(event.key, event.shiftKey);
    }
  }

  deleteSelectedNode(): void {
    const id = this.selectedNodeId();
    if (!id) return;
    const node = this.nodes().find((n) => n.id === id);
    this.pushSnapshot(`Eliminar ${node?.label ?? 'node'}`);
    this.nodes.update((n) => n.filter((node) => node.id !== id));
    this.selectedNodeId.set(null);
    this.scheduleAutosave();
  }

  copySelectedNode(): void {
    const node = this.selectedNode();
    if (!node) return;
    this.clipboardNode.set(node);
  }

  pasteNode(): void {
    const source = this.clipboardNode();
    if (!source) return;

    const doPaste = () => {
      this.pushSnapshot(`Enganxar ${source.label}`);
      const PASTE_OFFSET = 24;
      const newNode: FigureNodeItem = {
        ...source,
        id: generateUUID(),
        x: source.x + PASTE_OFFSET,
        y: source.y + PASTE_OFFSET,
        sortOrder: this.nodes().length,
      };
      this.nodes.update((n) => [...n, newNode]);
      this.selectedNodeId.set(newNode.id);
      this.clipboardNode.set(newNode);
      this.scheduleAutosave();
    };

    if (!this.requireName(doPaste)) return;
    doPaste();
  }

  duplicateSelectedNode(): void {
    this.copySelectedNode();
    this.pasteNode();
  }

  private moveSelectedNodeByKey(key: string, large: boolean): void {
    const id = this.selectedNodeId();
    if (!id) return;
    this.pushSnapshot('Moure node');
    const step = large ? 10 : 1;
    const delta = {
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
    }[key];
    if (!delta) return;

    const node = this.nodes().find((n) => n.id === id);
    if (!node) return;

    this.updateNode(id, { x: node.x + delta.x, y: node.y + delta.y });
    this.scheduleAutosave();
  }

  // ── Properties panel ──────────────────────────────────────────────────────

  updateSelectedNodeProp<K extends keyof FigureNodeItem>(
    key: K,
    value: FigureNodeItem[K],
  ): void {
    const id = this.selectedNodeId();
    if (!id) return;
    this.pushSnapshot('Canviar propietat');

    const patch: Partial<FigureNodeItem> = {
      [key]: value,
    } as Partial<FigureNodeItem>;

    // BASE and PINYA nodes always live at z=0
    if (
      key === 'zone' &&
      (value === FigureZone.PINYA || value === FigureZone.BASE)
    ) {
      patch.z = 0;
    }

    this.updateNode(id, patch);
    this.scheduleAutosave();
  }

  // ── Metadata fields ────────────────────────────────────────────────────────

  onNameChange(value: string): void {
    this.templateName.set(value);
    this.templateSlug.set(this.slugify(value));
    this.scheduleAutosave();
  }

  confirmNamePrompt(name: string): void {
    if (!name.trim()) return;
    this.templateName.set(name.trim());
    this.templateSlug.set(this.slugify(name.trim()));
    this.showNamePrompt.set(false);
    if (this.pendingAction) {
      this.pendingAction();
      this.pendingAction = null;
    }
  }

  cancelNamePrompt(): void {
    this.showNamePrompt.set(false);
    this.pendingAction = null;
  }

  private requireName(action: () => void): boolean {
    if (this.needsName()) {
      this.pendingAction = action;
      this.showNamePrompt.set(true);
      return false;
    }
    return true;
  }

  onHasPinyaChange(value: boolean): void {
    this.hasPinya.set(value);
    this.scheduleAutosave();
  }

  // ── Canvas controls ────────────────────────────────────────────────────────

  toggleGrid(): void {
    this.canvasState.gridEnabled.update((v) => !v);
  }

  toggleSnapToGrid(): void {
    this.canvasState.snapToGrid.update((v) => !v);
  }

  togglePropertiesPanel(): void {
    this.propertiesPanelOpen.update((v) => !v);
  }

  toggleShortcutsModal(): void {
    this.shortcutsModalOpen.update((v) => !v);
  }

  togglePreview(): void {
    if (this.renglaEditMode()) return;
    const entering = !this.previewMode();
    this.previewMode.set(entering);
    if (entering) {
      this.selectedNodeId.set(null);
    }
    this.previewAnnouncement.set(
      entering ? 'Mode previsualització activat' : 'Mode previsualització desactivat',
    );
  }

  // ── Undo / Redo ──────────────────────────────────────────────────────────

  private lastSnapshotTime = 0;
  private lastSnapshotType = '';
  private static readonly COALESCE_MS = 300;

  private pushSnapshot(description: string): void {
    const now = Date.now();
    const shouldCoalesce =
      description === this.lastSnapshotType &&
      now - this.lastSnapshotTime < TemplateEditorComponent.COALESCE_MS;

    if (shouldCoalesce) {
      this.lastSnapshotTime = now;
      return;
    }

    this.lastSnapshotTime = now;
    this.lastSnapshotType = description;

    const snapshot: TemplateSnapshot = {
      description,
      nodes: structuredClone(this.nodes()),
      rengles: structuredClone(this.rengles()),
    };
    this.undoStack.update((stack) => {
      const next = [...stack, snapshot];
      if (next.length > MAX_UNDO_STACK) next.shift();
      return next;
    });
    this.redoStack.set([]);
  }

  performUndo(): void {
    const stack = this.undoStack();
    if (stack.length === 0) return;
    const snapshot = stack[stack.length - 1];

    const currentState: TemplateSnapshot = {
      description: snapshot.description,
      nodes: structuredClone(this.nodes()),
      rengles: structuredClone(this.rengles()),
    };
    this.redoStack.update((s) => [...s, currentState]);
    this.undoStack.set(stack.slice(0, -1));

    this.nodes.set(snapshot.nodes);
    this.rengles.set(snapshot.rengles);
    this.selectedNodeId.set(null);
    this.scheduleAutosave();
  }

  performRedo(): void {
    const stack = this.redoStack();
    if (stack.length === 0) return;
    const snapshot = stack[stack.length - 1];

    const currentState: TemplateSnapshot = {
      description: snapshot.description,
      nodes: structuredClone(this.nodes()),
      rengles: structuredClone(this.rengles()),
    };
    this.undoStack.update((s) => [...s, currentState]);
    this.redoStack.set(stack.slice(0, -1));

    this.nodes.set(snapshot.nodes);
    this.rengles.set(snapshot.rengles);
    this.selectedNodeId.set(null);
    this.scheduleAutosave();
  }

  // ── Rengla mode ──────────────────────────────────────────────────────────

  toggleRenglaEditMode(): void {
    if (this.previewMode()) this.previewMode.set(false);
    this.renglaEditMode.update((v) => !v);
    if (this.renglaEditMode()) {
      this.selectedNodeId.set(null);
    }
  }

  onStageTransformChanged(t: StageTransform): void {
    this.stageTransform.set(t);
  }

  onRenglaCreated(event: RenglaCreatedEvent): void {
    this.pushSnapshot('Crear rengla');
    const renglaId = generateUUID();
    const newRengla: RenglaModel = {
      id: renglaId,
      name: event.rengla.name,
      sortOrder: event.rengla.sortOrder,
      allowsCordoObert: event.rengla.allowsCordoObert,
    };
    this.rengles.update((r) => [...r, newRengla]);

    this.nodes.update((nodes) =>
      nodes.map((n) => {
        const assignment = event.nodeAssignments.find((a) => a.nodeId === n.id);
        if (!assignment) return n;
        return {
          ...n,
          renglaId,
          renglaPosition: assignment.renglaPosition,
          ringLevel: assignment.renglaPosition,
        };
      }),
    );

    this.scheduleAutosave();
  }

  onRenglaDeleted(event: RenglaDeletedEvent): void {
    this.pushSnapshot('Eliminar rengla');
    this.rengles.update((list) => list.filter((r) => r.id !== event.renglaId));
    this.nodes.update((nodes) =>
      nodes.map((n) =>
        n.renglaId === event.renglaId
          ? { ...n, renglaId: null, renglaPosition: null, ringLevel: null }
          : n,
      ),
    );
    this.scheduleAutosave();
  }

  // ── Ghost clone ─────────────────────────────────────────────────────────────

  onGhostCloneRequested(event: {
    sourceNode: CanvasNode;
    targetPosition: { x: number; y: number };
  }): void {
    const source = this.nodes().find((n) => n.id === event.sourceNode.id);
    if (!source) return;

    const doClone = () => {
      this.pushSnapshot('Clonar node');
      const newId = generateUUID();

      const clonedNode: FigureNodeItem = {
        id: newId,
        label: source.label,
        zone: source.zone,
        positionType: source.positionType,
        x: event.targetPosition.x,
        y: event.targetPosition.y,
        z: source.z,
        width: source.width,
        height: source.height,
        rotation: source.rotation,
        color: source.color,
        shape: source.shape,
        sortOrder: this.nodes().length,
        climbPath: null,
        ringLevel: null,
        originNodeId: null,
        renglaId: null,
        renglaPosition: null,
        metadata: {},
      };

      this.nodes.update((n) => [...n, clonedNode]);
      this.selectedNodeId.set(newId);
      this.scheduleAutosave();
    };

    if (!this.requireName(doClone)) return;
    doClone();
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  private scheduleAutosave(): void {
    if (this.autosaveTimer) clearTimeout(this.autosaveTimer);
    this.autosaveTimer = setTimeout(() => this.save(), 2000);
  }

  private save(): void {
    const name = this.templateName().trim();
    const slug = this.templateSlug().trim() || this.slugify(name);
    if (!name || !slug) return;
    this.templateSlug.set(slug);

    this.saveStatus.set('saving');
    const payload = this.buildPayload();
    const id = this.templateId();

    if (id) {
      this.figureTemplateService.update(id, payload).subscribe({
        next: () => this.onSaveSuccess(),
        error: (err: HttpErrorResponse) => this.onSaveError(err),
      });
    } else {
      this.figureTemplateService
        .create({
          name,
          slug,
          hasPinya: this.hasPinya(),
          nodes: payload.nodes ?? [],
        })
        .subscribe({
          next: (created) => {
            this.templateId.set(created.id);
            this.templateName.set(created.name);
            this.templateSlug.set(created.slug);
            this.router.navigate(['/pinyes/templates', created.id, 'edit'], {
              replaceUrl: true,
            });
            this.onSaveSuccess();
          },
          error: (err: HttpErrorResponse) => this.onSaveError(err),
        });
    }
  }

  private onSaveSuccess(): void {
    this.saveStatus.set('saved');
    setTimeout(() => this.saveStatus.set('idle'), 2500);
  }

  private onSaveError(err: HttpErrorResponse): void {
    this.saveStatus.set('error');
    const msg = (err.error?.message as string | undefined) ?? '';
    const msgLower = msg.toLowerCase();

    if (
      err.status === 409 &&
      (msgLower.includes('instànci') ||
        msgLower.includes('instanci') ||
        msgLower.includes('composici'))
    ) {
      this.toast.error(
        msg ||
          'No es pot esborrar: hi ha instàncies o composicions que fan servir aquesta figura.',
      );
    } else if (err.status === 409 && msgLower.includes('name')) {
      this.toast.error('Ja existeix una altra figura amb aquest nom. Tria un nom diferent.');
    } else if (err.status === 409) {
      this.toast.error(
        msg ||
          'Conflicte en desar la figura. Prova a canviar el nom.',
      );
    } else {
      this.toast.error("No s'ha pogut desar la figura. Torna-ho a intentar.");
    }
  }

  private buildPayload() {
    return {
      name: this.templateName().trim(),
      description: this.templateDescription().trim() || undefined,
      hasPinya: this.hasPinya(),
      nodes: this.nodes().map(nodeToPayload),
      rengles: this.rengles(),
    };
  }

  dismissAdHocBanner(): void {
    this.adHocBannerDismissed.set(true);
  }

  private loadTemplate(id: string): void {
    this.loading.set(true);
    this.figureTemplateService.getOne(id).subscribe({
      next: (tmpl: FigureTemplateDetail) => {
        this.templateName.set(tmpl.name);
        this.templateSlug.set(tmpl.slug);
        this.templateDescription.set(tmpl.description ?? '');
        this.hasPinya.set(tmpl.hasPinya);
        this.nodes.set(tmpl.nodes);
        this.rengles.set(tmpl.rengles ?? []);
        this.adHocInstanceCount.set(tmpl.adHocInstanceCount ?? 0);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.router.navigate(['/pinyes']);
      },
    });
  }

  private updateNode(id: string, patch: Partial<FigureNodeItem>): void {
    this.nodes.update((nodes) =>
      nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    );
  }

  private defaultLabel(zone: FigureZone, z = 0): string {
    if (zone === FigureZone.BASE) return `Base ${this.baseNodes().length + 1}`;
    if (zone === FigureZone.PINYA) return 'Pinya';
    if (zone === FigureZone.TRONC) return `Pis ${z}`;
    if (zone === FigureZone.FIGURE_DIRECTION) return 'Direcció';
    return 'Xicalla Dir.';
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
  }
}

function nodeToPayload(node: FigureNodeItem): CreateFigureNodePayload {
  return {
    id: node.id,
    label: node.label,
    zone: node.zone,
    positionType: node.positionType ?? undefined,
    x: node.x,
    y: node.y,
    z: node.z,
    width: node.width,
    height: node.height,
    rotation: node.rotation,
    color: node.color ?? undefined,
    shape: node.shape,
    sortOrder: node.sortOrder,
    climbPath: node.climbPath ?? undefined,
    ringLevel: node.ringLevel ?? undefined,
    originNodeId: node.originNodeId ?? undefined,
    renglaId: node.renglaId ?? undefined,
    renglaPosition: node.renglaPosition ?? undefined,
    metadata: node.metadata,
  };
}
