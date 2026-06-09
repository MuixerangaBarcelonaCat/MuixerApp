import {
  Component,
  ChangeDetectionStrategy,
  HostListener,
  inject,
  signal,
  OnInit,
  OnDestroy,
  viewChild,
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { FigureCanvasComponent, CanvasNode } from '../figure-canvas/figure-canvas.component';
import { TroncViewComponent } from '../tronc-view/tronc-view.component';
import { TemplateEditorHelpModalComponent } from '../template-editor-help-modal/template-editor-help-modal.component';
import { RenglaOverlayComponent, RenglaCreatedEvent, RenglaUpdatedEvent, RenglaDeletedEvent } from '../rengla-overlay/rengla-overlay.component';
import { StageTransform } from '../../utils/rengla-coordinates.util';
import { LayoutService } from '../../../../core/services/layout.service';
import { FigureZone, NodeShape } from '@muixer/shared';
import { FigureNodeItem } from '../../models/figure-template.model';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { FloatingPanelDragDirective } from '../../../../shared/directives/floating-panel-drag.directive';
import {
  TemplateEditorStateService,
  PINYA_POSITIONS,
} from './services/template-editor-state.service';

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
    FloatingPanelDragDirective,
    CdkTrapFocus,
  ],
  providers: [TemplateEditorStateService],
  templateUrl: './template-editor.component.html',
  styleUrl: './template-editor.component.scss',
})
export class TemplateEditorComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly layout = inject(LayoutService);
  readonly st = inject(TemplateEditorStateService);

  readonly helpModal = viewChild.required(TemplateEditorHelpModalComponent);

  // ── UI-only state (not delegated to state service) ───────────────────────
  readonly propertiesPanelOpen = signal(true);
  readonly shortcutsModalOpen = signal(false);
  readonly troncDrawerOpen = signal(false);
  readonly stageTransform = signal<StageTransform>({ x: 0, y: 0, scaleX: 1, scaleY: 1 });

  // ── Signal aliases (so template works unchanged) ─────────────────────────
  readonly templateId = this.st.templateId;
  readonly templateName = this.st.templateName;
  readonly templateSlug = this.st.templateSlug;
  readonly templateDescription = this.st.templateDescription;
  readonly hasPinya = this.st.hasPinya;
  readonly nodes = this.st.nodes;
  readonly selectedNodeId = this.st.selectedNodeId;
  readonly rengles = this.st.rengles;
  readonly renglaEditMode = this.st.renglaEditMode;
  readonly saveStatus = this.st.saveStatus;
  readonly loading = this.st.loading;
  readonly gridEnabled = this.st.gridEnabled;
  readonly snapToGrid = this.st.snapToGrid;
  readonly pinyaNodes = this.st.pinyaNodes;
  readonly baseNodes = this.st.baseNodes;
  readonly troncNodes = this.st.troncNodes;
  readonly selectedNode = this.st.selectedNode;
  readonly saveStatusLabel = this.st.saveStatusLabel;
  readonly baseOrderingValidation = this.st.baseOrderingValidation;
  readonly canvasMode = this.st.canvasMode;

  // ── Enums and constants for template ────────────────────────────────────
  readonly FigureZone = FigureZone;
  readonly NodeShape = NodeShape;
  readonly pinyaPositions = PINYA_POSITIONS;

  ngOnInit(): void {
    this.layout.requestFullscreen();
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.st.templateId.set(id);
      this.st.loadTemplate(id);
    } else {
      this.st.reset();
    }
  }

  ngOnDestroy(): void {
    this.layout.exitFullscreen();
    this.st.destroyTimers();
  }

  // ── Keyboard handler ─────────────────────────────────────────────────────

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

    if (isMod && event.key === 'c') {
      event.preventDefault();
      this.st.copySelectedNode();
      return;
    }
    if (isMod && event.key === 'v') {
      event.preventDefault();
      this.st.pasteNode();
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (!this.st.selectedNodeId()) return;
      event.preventDefault();
      this.st.deleteSelectedNode();
      return;
    }
    const ARROW_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    if (ARROW_KEYS.includes(event.key)) {
      if (!this.st.selectedNodeId()) return;
      event.preventDefault();
      this.st.moveSelectedNodeByKey(event.key, event.shiftKey);
    }
  }

  // ── Canvas events ─────────────────────────────────────────────────────────

  onNodeSelected(id: string | null): void {
    this.st.selectedNodeId.set(id);
  }

  onNodeMoved(event: { id: string; x: number; y: number }): void {
    this.st.updateNode(event.id, { x: event.x, y: event.y });
    this.st.scheduleAutosave();
  }

  onNodeRotated(event: { id: string; rotation: number }): void {
    this.st.updateNode(event.id, { rotation: event.rotation });
    this.st.scheduleAutosave();
  }

  onNodeResized(event: { id: string; width: number; height: number }): void {
    this.st.updateNode(event.id, { width: event.width, height: event.height });
    this.st.scheduleAutosave();
  }

  onNodeLabelChanged(event: { id: string; label: string }): void {
    this.st.updateNode(event.id, { label: event.label });
    this.st.scheduleAutosave();
  }

  onGhostCloneRequested(event: { sourceNode: CanvasNode; targetPosition: { x: number; y: number } }): void {
    this.st.onGhostCloneRequested(event);
  }

  onStageTransformChanged(t: StageTransform): void {
    this.stageTransform.set(t);
  }

  // ── Tronc events ──────────────────────────────────────────────────────────

  onTroncNodeAdded(event: { z: number; positionType: string; label: string; sortOrder: number }): void {
    this.st.onTroncNodeAdded(event);
  }

  onTroncNodeRemoved(id: string): void {
    this.st.onTroncNodeRemoved(id);
  }

  onTroncNodeUpdated(event: { nodeId: string; x: number; width: number }): void {
    this.st.onTroncNodeUpdated(event);
  }

  onTroncFloorRemoved(z: number): void {
    this.st.onTroncFloorRemoved(z);
  }

  onBaseNodeAdded(event: { sortOrder: number }): void {
    this.st.onBaseNodeAdded(event);
  }

  onBaseNodeRemoved(id: string): void {
    this.st.onBaseNodeRemoved(id);
  }

  // ── Toolbar ───────────────────────────────────────────────────────────────

  addPinyaNode(pos: typeof PINYA_POSITIONS[0]): void {
    this.st.addPinyaNode(pos);
  }

  deleteSelectedNode(): void {
    this.st.deleteSelectedNode();
  }

  updateSelectedNodeProp<K extends keyof FigureNodeItem>(key: K, value: FigureNodeItem[K]): void {
    this.st.updateSelectedNodeProp(key, value);
  }

  // ── Metadata fields ───────────────────────────────────────────────────────

  onNameChange(value: string): void {
    this.st.onNameChange(value);
  }

  onSlugChange(value: string): void {
    this.st.onSlugChange(value);
  }

  onHasPinyaChange(value: boolean): void {
    this.st.onHasPinyaChange(value);
  }

  // ── UI toggles ────────────────────────────────────────────────────────────

  togglePropertiesPanel(): void {
    this.propertiesPanelOpen.update((v) => !v);
  }

  toggleShortcutsModal(): void {
    this.shortcutsModalOpen.update((v) => !v);
  }

  toggleGrid(): void {
    this.st.gridEnabled.update((v) => !v);
  }

  toggleSnapToGrid(): void {
    this.st.snapToGrid.update((v) => !v);
  }

  toggleRenglaEditMode(): void {
    this.st.renglaEditMode.update((v) => !v);
    if (this.st.renglaEditMode()) {
      this.st.selectedNodeId.set(null);
    }
  }

  // ── Rengla events ─────────────────────────────────────────────────────────

  onRenglaCreated(event: RenglaCreatedEvent): void {
    this.st.onRenglaCreated(event);
  }

  onRenglaUpdated(event: RenglaUpdatedEvent): void {
    this.st.onRenglaUpdated(event);
  }

  onRenglaDeleted(event: RenglaDeletedEvent): void {
    this.st.onRenglaDeleted(event);
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  goBack(): void {
    this.router.navigate(['/pinyes']);
  }
}
