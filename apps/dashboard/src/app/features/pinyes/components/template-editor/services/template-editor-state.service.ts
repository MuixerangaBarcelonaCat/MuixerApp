import {
  Injectable,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { generateUUID } from '../../../../../shared/utils';
import { FigureTemplateService } from '../../../services/figure-template.service';
import { CanvasStateService } from '../../../services/canvas-state.service';
import { ToastService } from '../../../../../shared/components/feedback/toast/toast.service';
import {
  FigureTemplateDetail,
  FigureNodeItem,
  CreateFigureNodePayload,
  RenglaItem,
} from '../../../models/figure-template.model';
import { FigureZone, NodeShape } from '@muixer/shared';
import { RenglaCreatedEvent, RenglaUpdatedEvent, RenglaDeletedEvent } from '../../rengla-overlay/rengla-overlay.component';
import { validateBaseOrdering } from '../../../utils/base-ordering.util';
import { slugify } from '../../../utils/slugify.util';
import { CanvasNode } from '../../figure-canvas/figure-canvas.component';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface PinyaPosition {
  positionType: string;
  label: string;
  color: string;
}

const DEFAULT_NODE_WIDTH = 80;
const DEFAULT_NODE_HEIGHT = 40;

export const PINYA_POSITIONS: PinyaPosition[] = [
  { positionType: 'agulla',      label: 'AGULLA',      color: '#0d9488' },
  { positionType: 'mans',        label: 'MANS',        color: '#FFE082' },
  { positionType: 'laterals',    label: 'LATERALS',    color: '#80DEEA' },
  { positionType: 'vents',       label: 'VENTS',       color: '#A5D6A7' },
  { positionType: 'cordo-obert', label: 'CORDO OBERT', color: '#FFF9C4' },
  { positionType: 'tap',         label: 'TAP',         color: '#be185d' },
  { positionType: 'crossa',      label: 'CROSSA',      color: '#9FA8DA' },
  { positionType: 'contrafort',  label: 'CONTRAFORT',  color: '#EF9A9A' },
];

/**
 * Component-scoped service that owns all figure-template editing state and operations.
 * Provided in TemplateEditorComponent's providers array — one instance per editor.
 */
@Injectable()
export class TemplateEditorStateService {
  private readonly figureTemplateService = inject(FigureTemplateService);
  private readonly canvasState = inject(CanvasStateService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  // ── Template metadata ────────────────────────────────────────────────────
  readonly templateId = signal<string | null>(null);
  readonly templateName = signal('Nova Figura');
  readonly templateSlug = signal('');
  readonly templateDescription = signal('');
  readonly hasPinya = signal(true);

  // ── Node state ───────────────────────────────────────────────────────────
  readonly nodes = signal<FigureNodeItem[]>([]);
  readonly selectedNodeId = signal<string | null>(null);
  private readonly clipboardNode = signal<FigureNodeItem | null>(null);
  readonly rengles = signal<RenglaItem[]>([]);

  // ── UI status ────────────────────────────────────────────────────────────
  readonly saveStatus = signal<SaveStatus>('idle');
  readonly loading = signal(false);

  // ── Computed ─────────────────────────────────────────────────────────────
  readonly pinyaNodes = computed(() => this.nodes().filter((n) => n.zone !== FigureZone.TRONC));
  readonly baseNodes = computed(() => this.nodes().filter((n) => n.zone === FigureZone.BASE));
  readonly troncNodes = computed(() => this.nodes().filter((n) => n.zone === FigureZone.TRONC));
  readonly selectedNode = computed(() => {
    const id = this.selectedNodeId();
    return id ? (this.nodes().find((n) => n.id === id) ?? null) : null;
  });
  readonly saveStatusLabel = computed(() => {
    const s = this.saveStatus();
    if (s === 'saving') return 'Guardant...';
    if (s === 'saved') return 'Guardat';
    if (s === 'error') return 'Error en guardar';
    return '';
  });
  readonly baseOrderingValidation = computed(() =>
    validateBaseOrdering(this.baseNodes().map((n) => ({ sortOrder: n.sortOrder, x: n.x, y: n.y }))),
  );
  readonly canvasMode = computed(() => this.renglaEditMode() ? 'readonly' as const : 'editor' as const);

  readonly renglaEditMode = signal(false);

  readonly gridEnabled = this.canvasState.gridEnabled;
  readonly snapToGrid = this.canvasState.snapToGrid;

  private autosaveTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Initialisation ───────────────────────────────────────────────────────

  reset(): void {
    this.templateId.set(null);
    this.templateName.set('Nova Figura');
    this.templateSlug.set('');
    this.templateDescription.set('');
    this.hasPinya.set(true);
    this.nodes.set([]);
    this.selectedNodeId.set(null);
    this.rengles.set([]);
    this.saveStatus.set('idle');
    this.renglaEditMode.set(false);
    this.canvasState.reset();
  }

  loadTemplate(id: string): void {
    this.loading.set(true);
    this.figureTemplateService.getOne(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (tmpl: FigureTemplateDetail) => {
        this.templateName.set(tmpl.name);
        this.templateSlug.set(tmpl.slug);
        this.templateDescription.set(tmpl.description ?? '');
        this.hasPinya.set(tmpl.hasPinya);
        this.nodes.set(tmpl.nodes);
        this.rengles.set(tmpl.rengles ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.router.navigate(['/pinyes']);
      },
    });
  }

  // ── Node CRUD ────────────────────────────────────────────────────────────

  addPinyaNode(pos: PinyaPosition): void {
    this.addNode(FigureZone.PINYA, 0, pos.positionType, pos.color, pos.label);
  }

  addNode(
    zone: FigureZone,
    z = 0,
    positionType: string | null = null,
    color: string | null = null,
    labelOverride?: string,
  ): void {
    const id = generateUUID();
    const newNode: FigureNodeItem = {
      id,
      label: labelOverride ?? this.defaultLabel(zone, z),
      zone, positionType,
      x: 200 + Math.random() * 40 - 20,
      y: 200 + Math.random() * 40 - 20,
      z,
      width: DEFAULT_NODE_WIDTH,
      height: DEFAULT_NODE_HEIGHT,
      rotation: 0, color,
      shape: NodeShape.RECTANGLE,
      sortOrder: this.nodes().length,
      climbPath: null, ringLevel: null, originNodeId: null,
      renglaId: null, renglaPosition: null, metadata: {},
    };
    this.nodes.update((n) => [...n, newNode]);
    this.selectedNodeId.set(id);
    this.scheduleAutosave();
  }

  updateNode(id: string, patch: Partial<FigureNodeItem>): void {
    this.nodes.update((nodes) => nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }

  updateSelectedNodeProp<K extends keyof FigureNodeItem>(key: K, value: FigureNodeItem[K]): void {
    const id = this.selectedNodeId();
    if (!id) return;
    const patch: Partial<FigureNodeItem> = { [key]: value } as Partial<FigureNodeItem>;
    if (key === 'zone' && (value === FigureZone.PINYA || value === FigureZone.BASE)) {
      patch.z = 0;
    }
    this.updateNode(id, patch);
    this.scheduleAutosave();
  }

  deleteSelectedNode(): void {
    const id = this.selectedNodeId();
    if (!id) return;
    this.nodes.update((n) => n.filter((node) => node.id !== id));
    this.selectedNodeId.set(null);
    this.scheduleAutosave();
  }

  copySelectedNode(): void {
    const node = this.selectedNode();
    if (node) this.clipboardNode.set(node);
  }

  pasteNode(): void {
    const source = this.clipboardNode();
    if (!source) return;
    const newNode: FigureNodeItem = {
      ...source,
      id: generateUUID(),
      x: source.x + 24,
      y: source.y + 24,
      sortOrder: this.nodes().length,
    };
    this.nodes.update((n) => [...n, newNode]);
    this.selectedNodeId.set(newNode.id);
    this.clipboardNode.set(newNode);
    this.scheduleAutosave();
  }

  moveSelectedNodeByKey(key: string, large: boolean): void {
    const id = this.selectedNodeId();
    if (!id) return;
    const step = large ? 10 : 1;
    const delta: Record<string, { x: number; y: number }> = {
      ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step },
      ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 },
    };
    const d = delta[key];
    if (!d) return;
    const node = this.nodes().find((n) => n.id === id);
    if (!node) return;
    this.updateNode(id, { x: node.x + d.x, y: node.y + d.y });
    this.scheduleAutosave();
  }

  // ── Tronc events ─────────────────────────────────────────────────────────

  onTroncNodeAdded(event: { z: number; positionType: string; label: string; sortOrder: number }): void {
    const id = generateUUID();
    const existingAtZ = this.troncNodes().filter((n) => n.z === event.z);
    const nextX = existingAtZ.reduce((max, n) => Math.max(max, n.x + n.width), 0);
    const newNode: FigureNodeItem = {
      id, label: event.label, zone: FigureZone.TRONC, positionType: event.positionType,
      x: nextX, y: 0, z: event.z, width: 1, height: 40, rotation: 0, color: null,
      shape: NodeShape.RECTANGLE, sortOrder: event.sortOrder,
      climbPath: null, ringLevel: null, originNodeId: null,
      renglaId: null, renglaPosition: null, metadata: {},
    };
    this.nodes.update((n) => [...n, newNode]);
    this.selectedNodeId.set(id);
    this.scheduleAutosave();
  }

  onTroncNodeRemoved(id: string): void {
    this.nodes.update((n) => n.filter((node) => node.id !== id));
    if (this.selectedNodeId() === id) this.selectedNodeId.set(null);
    this.scheduleAutosave();
  }

  onTroncNodeUpdated(event: { nodeId: string; x: number; width: number }): void {
    this.updateNode(event.nodeId, { x: event.x, width: event.width });
    this.scheduleAutosave();
  }

  onTroncFloorRemoved(z: number): void {
    this.nodes.update((n) => n.filter((node) => !(node.zone === FigureZone.TRONC && node.z === z)));
    this.selectedNodeId.set(null);
    this.scheduleAutosave();
  }

  onBaseNodeAdded(event: { sortOrder: number }): void {
    const id = generateUUID();
    const baseNumber = this.baseNodes().length + 1;
    const newNode: FigureNodeItem = {
      id, label: `Base ${baseNumber}`, zone: FigureZone.BASE,
      positionType: 'base',
      x: 200 + Math.random() * 40 - 20, y: 200 + Math.random() * 40 - 20,
      z: 0, width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT,
      rotation: 0, color: '#EEEEEE', shape: NodeShape.RECTANGLE,
      sortOrder: event.sortOrder, climbPath: null, ringLevel: null,
      originNodeId: null, renglaId: null, renglaPosition: null, metadata: {},
    };
    this.nodes.update((n) => [...n, newNode]);
    this.selectedNodeId.set(id);
    this.scheduleAutosave();
  }

  onBaseNodeRemoved(id: string): void {
    this.nodes.update((n) => n.filter((node) => node.id !== id));
    if (this.selectedNodeId() === id) this.selectedNodeId.set(null);
    this.scheduleAutosave();
  }

  // ── Rengla events ─────────────────────────────────────────────────────────

  onRenglaCreated(event: RenglaCreatedEvent): void {
    const renglaId = generateUUID();
    const newRengla: RenglaItem = {
      id: renglaId, name: event.rengla.name, sortOrder: event.rengla.sortOrder,
      startPosition: event.rengla.startPosition, allowsCordoObert: event.rengla.allowsCordoObert,
    };
    this.rengles.update((r) => [...r, newRengla]);
    this.nodes.update((nodes) =>
      nodes.map((n) => {
        const a = event.nodeAssignments.find((x) => x.nodeId === n.id);
        if (!a) return n;
        return { ...n, renglaId, renglaPosition: a.renglaPosition, ringLevel: event.rengla.startPosition + a.renglaPosition - 1 };
      }),
    );
    this.scheduleAutosave();
  }

  onRenglaUpdated(event: RenglaUpdatedEvent): void {
    this.rengles.update((list) => list.map((r) => (r.id === event.rengla.id ? event.rengla : r)));
    this.nodes.update((nodes) =>
      nodes.map((n) =>
        n.renglaId === event.rengla.id && n.renglaPosition != null
          ? { ...n, ringLevel: event.rengla.startPosition + n.renglaPosition - 1 }
          : n,
      ),
    );
    this.scheduleAutosave();
  }

  onRenglaDeleted(event: RenglaDeletedEvent): void {
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

  // ── Ghost clone ────────────────────────────────────────────────────────────

  onGhostCloneRequested(event: { sourceNode: CanvasNode; targetPosition: { x: number; y: number } }): void {
    const source = this.nodes().find((n) => n.id === event.sourceNode.id);
    if (!source) return;

    const newId = generateUUID();
    let renglaId = source.renglaId;
    let renglaPosition = source.renglaPosition != null ? source.renglaPosition + 1 : null;
    let ringLevel = source.ringLevel != null ? source.ringLevel + 1 : null;

    if (renglaId) {
      this.nodes.update((nodes) =>
        nodes.map((n) =>
          n.renglaId === renglaId && n.renglaPosition != null && n.renglaPosition >= renglaPosition!
            ? { ...n, renglaPosition: n.renglaPosition + 1, ringLevel: n.ringLevel != null ? n.ringLevel + 1 : null }
            : n,
        ),
      );
    } else {
      const autoRenglaId = generateUUID();
      const renglaIndex = this.rengles().length;
      this.rengles.update((r) => [...r, {
        id: autoRenglaId, name: `${source.label} ${renglaIndex + 1}`,
        sortOrder: renglaIndex, startPosition: 1, allowsCordoObert: false,
      }]);
      this.nodes.update((nodes) =>
        nodes.map((n) => n.id === source.id ? { ...n, renglaId: autoRenglaId, renglaPosition: 1, ringLevel: 1 } : n),
      );
      renglaId = autoRenglaId;
      renglaPosition = 2;
      ringLevel = 2;
    }

    const clonedNode: FigureNodeItem = {
      id: newId, label: source.label, zone: source.zone, positionType: source.positionType,
      x: event.targetPosition.x, y: event.targetPosition.y, z: source.z,
      width: source.width, height: source.height, rotation: source.rotation,
      color: source.color, shape: source.shape, sortOrder: this.nodes().length,
      climbPath: null, ringLevel, originNodeId: null, renglaId, renglaPosition, metadata: {},
    };
    this.nodes.update((n) => [...n, clonedNode]);
    this.selectedNodeId.set(newId);
    this.scheduleAutosave();
  }

  // ── Metadata ──────────────────────────────────────────────────────────────

  onNameChange(value: string): void {
    this.templateName.set(value);
    if (!this.templateId()) this.templateSlug.set(slugify(value));
    this.scheduleAutosave();
  }

  onSlugChange(value: string): void {
    this.templateSlug.set(value);
    this.scheduleAutosave();
  }

  onHasPinyaChange(value: boolean): void {
    this.hasPinya.set(value);
    this.scheduleAutosave();
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  scheduleAutosave(): void {
    if (this.autosaveTimer) clearTimeout(this.autosaveTimer);
    this.autosaveTimer = setTimeout(() => this.save(), 2000);
  }

  destroyTimers(): void {
    if (this.autosaveTimer) clearTimeout(this.autosaveTimer);
  }

  private save(): void {
    const name = this.templateName().trim();
    const slug = this.templateSlug().trim();
    if (!name || !slug) return;

    this.saveStatus.set('saving');
    const payload = this.buildPayload();
    const id = this.templateId();

    if (id) {
      this.figureTemplateService.update(id, payload).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => this.onSaveSuccess(),
        error: (err: HttpErrorResponse) => this.onSaveError(err),
      });
    } else {
      this.figureTemplateService
        .create({ name, slug, hasPinya: this.hasPinya(), nodes: payload.nodes ?? [] })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (created) => {
            this.templateId.set(created.id);
            this.router.navigate(['/pinyes/templates', created.id, 'edit'], { replaceUrl: true });
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
    const slug = this.templateSlug();

    if (err.status === 409 && (msgLower.includes('slug') || msgLower.includes('identificador'))) {
      this.toast.error(`L'identificador "${slug}" ja l'utilitza una altra figura. Canvia'l per poder desar.`);
    } else if (err.status === 409 && (msgLower.includes('instànci') || msgLower.includes('composici'))) {
      this.toast.error(msg || "No es pot esborrar: hi ha instàncies o composicions que fan servir aquesta figura.");
    } else if (err.status === 409) {
      this.toast.error(msg || 'Conflicte en desar la figura. Revisa les dades i torna-ho a intentar.');
    } else if (err.status === 500 && msgLower.includes('slug')) {
      this.toast.error(`L'identificador "${slug}" ja l'utilitza una altra figura. Canvia'l per poder desar.`);
    } else {
      this.toast.error("No s'ha pogut desar la figura. Torna-ho a intentar.");
    }
  }

  private buildPayload() {
    return {
      name: this.templateName().trim(),
      slug: this.templateSlug().trim(),
      description: this.templateDescription().trim() || undefined,
      hasPinya: this.hasPinya(),
      nodes: this.nodes().map(nodeToPayload),
      rengles: this.rengles(),
    };
  }

  private defaultLabel(zone: FigureZone, z = 0): string {
    if (zone === FigureZone.BASE) return `Base ${this.baseNodes().length + 1}`;
    if (zone === FigureZone.PINYA) return 'Pinya';
    if (zone === FigureZone.TRONC) return `Pis ${z}`;
    if (zone === FigureZone.FIGURE_DIRECTION) return 'Direcció';
    return 'Xicalla Dir.';
  }
}

function nodeToPayload(node: FigureNodeItem): CreateFigureNodePayload {
  return {
    id: node.id, label: node.label, zone: node.zone,
    positionType: node.positionType ?? undefined,
    x: node.x, y: node.y, z: node.z,
    width: node.width, height: node.height,
    rotation: node.rotation, color: node.color ?? undefined,
    shape: node.shape, sortOrder: node.sortOrder,
    climbPath: node.climbPath ?? undefined,
    ringLevel: node.ringLevel ?? undefined,
    originNodeId: node.originNodeId ?? undefined,
    renglaId: node.renglaId ?? undefined,
    renglaPosition: node.renglaPosition ?? undefined,
    metadata: node.metadata,
  };
}
