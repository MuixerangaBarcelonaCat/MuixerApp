import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FigureNodeItem } from '../../models/figure-template.model';
import { AssignmentDetail, HeightMode } from '../../models/assignment.model';
import { CanvasNode, CanvasMode, CompositionSlotWithNodes } from './types/canvas-types';
import { KonvaStageService } from './services/konva-stage.service';
import { EditorNodeRenderer } from './renderers/editor-node.renderer';
import { CompositionSlotRenderer } from './renderers/composition-slot.renderer';
import { AssignmentNodeRenderer } from './renderers/assignment-node.renderer';
import { ReadonlyNodeRenderer } from './renderers/readonly-node.renderer';
import { CanvasEmitters } from './renderers/canvas-emitters.interface';

export type { CanvasNode, CanvasMode, CompositionSlotWithNodes };

@Component({
  selector: 'app-figure-canvas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  providers: [KonvaStageService],
  templateUrl: './figure-canvas.component.html',
  styleUrl: './figure-canvas.component.scss',
})
export class FigureCanvasComponent implements AfterViewInit, OnDestroy {
  private readonly containerRef = viewChild.required<ElementRef<HTMLDivElement>>('canvasContainer');
  private readonly stageService = inject(KonvaStageService);

  readonly nodes = input<CanvasNode[]>([]);
  readonly mode = input<CanvasMode>('editor');
  readonly gridEnabled = input<boolean>(true);
  readonly gridSpacing = input<number>(40);
  readonly selectedNodeId = input<string | null>(null);
  readonly snapToGrid = input<boolean>(false);
  readonly compositionSlots = input<CompositionSlotWithNodes[]>([]);
  readonly selectedSlotId = input<string | null>(null);
  readonly assignments = input<AssignmentDetail[]>([]);
  readonly heightMode = input<HeightMode>('relative');
  readonly attendanceMap = input<Map<string, string>>(new Map());
  readonly nextPerformanceMap = input<Map<string, string | null>>(new Map());
  readonly highlightedNodeIds = input<Set<string>>(new Set());

  readonly nodeSelected = output<string | null>();
  readonly nodeClicked = output<{ nodeId: string; x: number; y: number }>();
  readonly nodeMoved = output<{ id: string; x: number; y: number }>();
  readonly nodeRotated = output<{ id: string; rotation: number }>();
  readonly nodeResized = output<{ id: string; width: number; height: number }>();
  readonly nodeLabelChanged = output<{ id: string; label: string }>();
  readonly slotSelected = output<string | null>();
  readonly slotMoved = output<{ slotId: string; offsetX: number; offsetY: number }>();
  readonly stageTransformChanged = output<{ x: number; y: number; scaleX: number; scaleY: number }>();
  readonly ghostCloneRequested = output<{ sourceNode: CanvasNode; targetPosition: { x: number; y: number } }>();

  readonly zoomLevel = signal(1);

  private editorRenderer!: EditorNodeRenderer;
  private compositionRenderer!: CompositionSlotRenderer;
  private assignmentRenderer!: AssignmentNodeRenderer;
  private readonlyRenderer!: ReadonlyNodeRenderer;

  constructor() {
    effect(() => {
      this.gridEnabled();
      this.gridSpacing();
      if (!this.stageService.stage) return;
      untracked(() => this.stageService.renderGrid(this.gridEnabled(), this.gridSpacing()));
    });

    effect(() => {
      this.nodes();
      this.selectedNodeId();
      this.mode();
      if (!this.stageService.stage) return;
      untracked(() => {
        const m = this.mode();
        if (m === 'composition' || m === 'assignment' || m === 'readonly') return;
        this.renderEditorNodes();
        this.stageService.updateTransformer(this.selectedNodeId(), m === 'editor');
      });
    });

    effect(() => {
      this.compositionSlots();
      this.selectedSlotId();
      if (!this.stageService.stage) return;
      if (this.mode() !== 'composition') return;
      untracked(() => this.compositionRenderer.renderCompositionSlots(
        this.compositionSlots(), this.selectedSlotId(), this.snapToGrid(), this.gridSpacing(),
      ));
    });

    effect(() => {
      this.assignments();
      this.heightMode();
      this.attendanceMap();
      this.nextPerformanceMap();
      this.selectedNodeId();
      this.highlightedNodeIds();
      if (!this.stageService.stage) return;
      untracked(() => {
        if (this.mode() === 'assignment') {
          this.assignmentRenderer.renderAssignmentNodes({
            nodes: this.nodes(),
            assignments: this.assignments(),
            heightMode: this.heightMode(),
            attendanceMap: this.attendanceMap(),
            nextPerformanceMap: this.nextPerformanceMap(),
            selectedNodeId: this.selectedNodeId(),
            highlightedNodeIds: this.highlightedNodeIds(),
          });
        } else if (this.mode() === 'readonly') {
          this.readonlyRenderer.renderReadonlyNodes(this.nodes(), this.assignments());
        }
      });
    });
  }

  ngAfterViewInit(): void {
    const container = this.containerRef().nativeElement;
    const emitters: CanvasEmitters = {
      nodeSelected: (id) => this.nodeSelected.emit(id),
      nodeClicked: (d) => this.nodeClicked.emit(d),
      nodeMoved: (d) => this.nodeMoved.emit(d),
      nodeRotated: (d) => this.nodeRotated.emit(d),
      nodeResized: (d) => this.nodeResized.emit(d),
      nodeLabelChanged: (d) => this.nodeLabelChanged.emit(d),
      slotSelected: (id) => this.slotSelected.emit(id),
      slotMoved: (d) => this.slotMoved.emit(d),
      ghostCloneRequested: (d) => this.ghostCloneRequested.emit(d),
    };

    this.stageService.init(
      container,
      (t) => { this.stageTransformChanged.emit(t); },
      () => {
        if (this.mode() === 'composition') this.slotSelected.emit(null);
        else { this.nodeSelected.emit(null); this.stageService.transformer.nodes([]); }
      },
      () => this.mode() === 'composition',
      () => this.mode() === 'composition' ? !!this.selectedSlotId() : !!this.selectedNodeId(),
    );

    this.editorRenderer = new EditorNodeRenderer(
      this.stageService, emitters,
      () => container.parentElement!,
    );
    this.compositionRenderer = new CompositionSlotRenderer(this.stageService, emitters);
    this.assignmentRenderer = new AssignmentNodeRenderer(this.stageService, emitters);
    this.readonlyRenderer = new ReadonlyNodeRenderer(this.stageService);

    this.stageService.observeResize(container, () => this.gridEnabled(), () => this.gridSpacing());

    this.renderAll();
  }

  ngOnDestroy(): void {
    this.editorRenderer?.clearAllGhostTimers();
    this.readonlyRenderer?.destroy();
    this.stageService.destroy();
  }

  fitToScreen(): void {
    this.stageService.fitToScreen();
    this.zoomLevel.set(this.stageService.zoomLevel());
  }

  fitAllSlots(): void {
    this.stageService.fitAllSlots();
    this.zoomLevel.set(this.stageService.zoomLevel());
  }

  setZoom(level: number): void {
    this.stageService.setZoom(level);
    this.zoomLevel.set(level);
  }

  private renderAll(): void {
    this.stageService.renderGrid(this.gridEnabled(), this.gridSpacing());
    const m = this.mode();
    if (m === 'composition') {
      this.compositionRenderer.renderCompositionSlots(
        this.compositionSlots(), this.selectedSlotId(), this.snapToGrid(), this.gridSpacing(),
      );
    } else if (m === 'assignment') {
      this.assignmentRenderer.renderAssignmentNodes({
        nodes: this.nodes(), assignments: this.assignments(),
        heightMode: this.heightMode(), attendanceMap: this.attendanceMap(),
        nextPerformanceMap: this.nextPerformanceMap(), selectedNodeId: this.selectedNodeId(),
        highlightedNodeIds: this.highlightedNodeIds(),
      });
    } else if (m === 'readonly') {
      this.readonlyRenderer.renderReadonlyNodes(this.nodes(), this.assignments());
      setTimeout(() => this.fitToScreen());
    } else {
      this.renderEditorNodes();
    }
  }

  private renderEditorNodes(): void {
    this.editorRenderer.renderNodes(
      this.nodes() as FigureNodeItem[],
      this.mode() === 'editor',
      this.selectedNodeId(),
      this.snapToGrid(),
      this.gridSpacing(),
    );
  }
}
