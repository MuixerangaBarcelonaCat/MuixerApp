import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { FigureTemplateService } from '../../services/figure-template.service';
import { CanvasStateService } from '../../services/canvas-state.service';
import { FigureCanvasComponent } from '../figure-canvas/figure-canvas.component';
import {
  FigureTemplateDetail,
  FigureNodeItem,
  CreateFigureNodePayload,
} from '../../models/figure-template.model';
import { FigureZone, NodeShape } from '@muixer/shared';
import { LayoutService } from '../../../../core/services/layout.service';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const DEFAULT_NODE_WIDTH = 60;
const DEFAULT_NODE_HEIGHT = 40;

@Component({
  selector: 'app-template-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule, FigureCanvasComponent],
  templateUrl: './template-editor.component.html',
  styleUrl: './template-editor.component.scss',
})
export class TemplateEditorComponent implements OnInit, OnDestroy {
  private readonly figureTemplateService = inject(FigureTemplateService);
  private readonly canvasState = inject(CanvasStateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly layout = inject(LayoutService);

  // Template metadata
  templateId = signal<string | null>(null);
  templateName = signal('Nova Figura');
  templateSlug = signal('');
  templateDescription = signal('');
  hasPinya = signal(true);

  // Nodes
  nodes = signal<FigureNodeItem[]>([]);
  selectedNodeId = signal<string | null>(null);

  // Panel visibility
  propertiesPanelOpen = signal(true);

  // Status
  loading = signal(false);
  saveStatus = signal<SaveStatus>('idle');
  private autosaveTimer: ReturnType<typeof setTimeout> | null = null;

  // Expose canvas state signals for template binding
  readonly gridEnabled = this.canvasState.gridEnabled;
  readonly troncVisible = this.canvasState.troncVisible;
  readonly snapToGrid = this.canvasState.snapToGrid;

  // Enums for template
  readonly FigureZone = FigureZone;
  readonly NodeShape = NodeShape;

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
    this.updateNode(event.id, { x: event.x, y: event.y });
    this.scheduleAutosave();
  }

  onNodeRotated(event: { id: string; rotation: number }): void {
    this.updateNode(event.id, { rotation: event.rotation });
    this.scheduleAutosave();
  }

  onNodeResized(event: { id: string; width: number; height: number }): void {
    this.updateNode(event.id, { width: event.width, height: event.height });
    this.scheduleAutosave();
  }

  // ── Toolbar actions ────────────────────────────────────────────────────────

  addNode(zone: FigureZone, z = 0): void {
    const id = crypto.randomUUID();
    const stageCenter = { x: 200, y: 200 };
    const newNode: FigureNodeItem = {
      id,
      label: this.defaultLabel(zone),
      zone,
      positionType: null,
      x: stageCenter.x + Math.random() * 40 - 20,
      y: stageCenter.y + Math.random() * 40 - 20,
      z,
      width: DEFAULT_NODE_WIDTH,
      height: DEFAULT_NODE_HEIGHT,
      rotation: 0,
      color: null,
      shape: NodeShape.ELLIPSE,
      sortOrder: this.nodes().length,
      climbPath: null,
      metadata: {},
    };
    this.nodes.update((n) => [...n, newNode]);
    this.selectedNodeId.set(id);
    this.scheduleAutosave();
  }

  deleteSelectedNode(): void {
    const id = this.selectedNodeId();
    if (!id) return;
    this.nodes.update((n) => n.filter((node) => node.id !== id));
    this.selectedNodeId.set(null);
    this.scheduleAutosave();
  }

  // ── Properties panel ──────────────────────────────────────────────────────

  updateSelectedNodeProp<K extends keyof FigureNodeItem>(
    key: K,
    value: FigureNodeItem[K],
  ): void {
    const id = this.selectedNodeId();
    if (!id) return;
    
    const patch: Partial<FigureNodeItem> = { [key]: value } as Partial<FigureNodeItem>;
    
    // If changing zone to PINYA, automatically set z to 0
    if (key === 'zone' && value === FigureZone.PINYA) {
      patch.z = 0;
    }
    
    this.updateNode(id, patch);
    this.scheduleAutosave();
  }

  // ── Metadata fields ────────────────────────────────────────────────────────

  onNameChange(value: string): void {
    this.templateName.set(value);
    if (!this.templateId()) {
      this.templateSlug.set(this.slugify(value));
    }
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

  // ── Canvas controls ────────────────────────────────────────────────────────

  toggleGrid(): void {
    this.canvasState.gridEnabled.update((v) => !v);
  }

  toggleTronc(): void {
    this.canvasState.troncVisible.update((v) => !v);
  }

  toggleSnapToGrid(): void {
    this.canvasState.snapToGrid.update((v) => !v);
  }

  togglePropertiesPanel(): void {
    this.propertiesPanelOpen.update((v) => !v);
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  private scheduleAutosave(): void {
    if (this.autosaveTimer) clearTimeout(this.autosaveTimer);
    this.autosaveTimer = setTimeout(() => this.save(), 2000);
  }

  private save(): void {
    const name = this.templateName().trim();
    const slug = this.templateSlug().trim();
    if (!name || !slug) return;

    this.saveStatus.set('saving');
    const payload = this.buildPayload();
    const id = this.templateId();

    if (id) {
      this.figureTemplateService.update(id, payload).subscribe({
        next: () => this.onSaveSuccess(),
        error: () => this.saveStatus.set('error'),
      });
    } else {
      this.figureTemplateService
        .create({ name, slug, hasPinya: this.hasPinya(), nodes: payload.nodes ?? [] })
        .subscribe({
          next: (created) => {
            this.templateId.set(created.id);
            this.router.navigate(['/pinyes/templates', created.id, 'edit'], {
              replaceUrl: true,
            });
            this.onSaveSuccess();
          },
          error: () => this.saveStatus.set('error'),
        });
    }
  }

  private onSaveSuccess(): void {
    this.saveStatus.set('saved');
    setTimeout(() => this.saveStatus.set('idle'), 2500);
  }

  private buildPayload() {
    return {
      name: this.templateName().trim(),
      slug: this.templateSlug().trim(),
      description: this.templateDescription().trim() || undefined,
      hasPinya: this.hasPinya(),
      nodes: this.nodes().map(nodeToPayload),
    };
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

  private defaultLabel(zone: FigureZone): string {
    const count = this.nodes().filter((n) => n.zone === zone).length + 1;
    const prefix =
      zone === FigureZone.PINYA
        ? 'Pinya'
        : zone === FigureZone.FIGURE_DIRECTION
          ? 'Direcció'
          : zone === FigureZone.XICALLA_DIRECTION
            ? 'Xicalla Dir.'
            : 'Tronc';
    return `${prefix} ${count}`;
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
    metadata: node.metadata,
  };
}
