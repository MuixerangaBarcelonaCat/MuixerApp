import { FigureCanvasComponent, SegmentNodeRef, AssignmentDetail, CreateAdHocNodePayload, InstanceNodeItem, UpdateAdHocNodePayload } from '@muixer/pinyes-render';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  ViewChild,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import {
  DECORATION_NODE_PRESETS,
  NodePreset,
  NodeShape,
  PINYA_NODE_PRESETS,
} from '@muixer/shared';
import { AdHocNodePropertiesComponent } from '../../../ad-hoc-node-properties/ad-hoc-node-properties.component';
import { SegmentWorkspaceStateService } from '../../../../services/segment-workspace-state.service';
import { AssignmentStateService } from '../../../../services/assignment-state.service';
import { NodeAssignmentService } from '../../../../services/node-assignment.service';
import { ToastService, TextareaComponent, ButtonComponent, ButtonGroupComponent, ModalComponent } from '@muixer/ui';

interface AdHocNodeSnapshot {
  zone: string;
  positionType: string | null;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  shape: string;
  color: string | null;
  rotation: number;
}

/**
 * Nodes extra tab of the segment workspace: figure selector on the left, all
 * figures on one canvas (non-selected dimmed) in the center, node palette +
 * ad-hoc node properties panel on the right. Person assignment lives in the
 * Pinyes/Troncs tabs — this tab is only about creating/editing ad-hoc nodes.
 */
@Component({
  selector: 'app-nodes-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    LucideAngularModule,
    FigureCanvasComponent,
    AdHocNodePropertiesComponent,
    TextareaComponent,
    ButtonComponent,
    ButtonGroupComponent,
    ModalComponent,
  ],
  templateUrl: './nodes-tab.component.html',
})
export class NodesTabComponent implements OnInit {
  readonly ws = inject(SegmentWorkspaceStateService);
  readonly state = inject(AssignmentStateService);
  private readonly assignmentService = inject(NodeAssignmentService);
  private readonly toast = inject(ToastService);

  readonly isPast = input(false);

  // Queried by template ref (not by type) so tests can substitute a stub component.
  @ViewChild('canvas') private canvasRef?: FigureCanvasComponent;

  readonly adHocPresets = PINYA_NODE_PRESETS;
  readonly decorationPresets = DECORATION_NODE_PRESETS;
  readonly NodeShape = NodeShape;

  // Content equality avoids re-rendering the canvas (and breaking dblclick) on re-selection.
  readonly selectedRef = signal<SegmentNodeRef | null>(null, {
    equal: (a, b) => a?.slotId === b?.slotId && a?.nodeId === b?.nodeId,
  });

  readonly comodinInputOpen = signal(false);
  readonly comodinLabel = signal('');
  private readonly pendingLabelPreset = signal<NodePreset | null>(null);

  readonly deleteModalOpen = signal(false);
  private readonly pendingDeleteNodeId = signal<string | null>(null);

  private readonly clipboardAdHocNode = signal<AdHocNodeSnapshot | null>(null);

  /**
   * Below `sm`, the fixed-width figure selector (w-52) + node palette (w-72)
   * leave the canvas too narrow to use (same root cause as WI-13's
   * Pinyes/Troncs guard: P-M2, GE-H3). Shows a guard message instead until
   * the mobile layout is designed. Driven by `matchMedia`; falls back to
   * `false` where `matchMedia` is unavailable.
   */
  readonly mobileUnsupported = signal(false);

  constructor() {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const mql = window.matchMedia('(max-width: 639.98px)');
      this.mobileUnsupported.set(mql.matches);
      const listener = (e: MediaQueryListEvent) => this.mobileUnsupported.set(e.matches);
      mql.addEventListener('change', listener);
      inject(DestroyRef).onDestroy(() => mql.removeEventListener('change', listener));
    }
  }

  readonly dimmedSlotIds = computed(() => {
    const selected = this.ws.selectedInstanceId();
    return new Set(this.ws.instances().map((i) => i.instanceId).filter((id) => id !== selected));
  });

  readonly selectedNode = computed<InstanceNodeItem | null>(() => {
    const ref = this.selectedRef();
    if (!ref) return null;
    return this.nodeFor(ref);
  });

  readonly selectedAdHocNode = computed(() => {
    const node = this.selectedNode();
    return node?.isAdHoc ? node : null;
  });

  readonly selectedAssignment = computed<AssignmentDetail | null>(() => {
    const ref = this.selectedRef();
    if (!ref) return null;
    return (
      this.state.assignments().find((a) => a.figureInstanceId === ref.slotId && a.node.id === ref.nodeId) ?? null
    );
  });

  readonly pendingDeleteNodeLabel = computed(() => {
    const nodeId = this.pendingDeleteNodeId();
    if (!nodeId) return '';
    return this.instanceFor(this.selectedRef()?.slotId ?? '')?.nodes.find((n) => n.id === nodeId)?.label ?? '';
  });

  readonly pendingDeletePersonName = computed(() => {
    const nodeId = this.pendingDeleteNodeId();
    if (!nodeId) return '';
    const assignment = this.state.assignments().find((a) => a.node.id === nodeId);
    if (!assignment) return '';
    return assignment.person.alias || `${assignment.person.name} ${assignment.person.firstSurname}`;
  });

  readonly labelDialogTitle = computed(() =>
    this.pendingLabelPreset()?.zone === 'DECORATION' ? 'Etiqueta del node decoratiu' : 'Etiqueta del comodí',
  );

  private static readonly DECORATION_LABELS: Record<string, string> = {
    rectangle: 'Rectangle',
    ellipse: 'El·lipse',
    arrow: 'Fletxa dreta',
    'arrow-left': 'Fletxa esquerra',
    'arrow-up': 'Fletxa amunt',
    'arrow-down': 'Fletxa avall',
    'double-arrow': 'Fletxa doble',
    triangle: 'Triangle',
    star: 'Estrella',
    circle: 'Cercle',
  };

  getDecorationLabel(preset: NodePreset): string {
    return NodesTabComponent.DECORATION_LABELS[preset.positionType ?? ''] ?? preset.positionType ?? '';
  }

  ngOnInit(): void {
    // Positions/nodes may have changed in another tab since the workspace's one-time load().
    this.ws.refresh();
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const isEditing =
      !!target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable);
    if (isEditing) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      if (this.state.isPlacementMode()) {
        this.state.exitPlacementMode();
        return;
      }
      if (this.deleteModalOpen()) {
        this.cancelDelete();
        return;
      }
      if (this.comodinInputOpen()) {
        this.cancelComodinInput();
        return;
      }
      this.clearSelection();
      return;
    }

    const isMod = event.ctrlKey || event.metaKey;
    if (isMod && (event.key === '+' || event.key === '=')) {
      event.preventDefault();
      this.canvasRef?.zoomIn();
      return;
    }

    if (isMod && event.key === '-') {
      event.preventDefault();
      this.canvasRef?.zoomOut();
      return;
    }

    if (this.ws.isLocked()) return;

    const node = this.selectedAdHocNode();

    if ((event.key === 'Delete' || event.key === 'Backspace') && node) {
      event.preventDefault();
      this.onDeleteRequested(node.id);
      return;
    }

    const ARROW_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    if (ARROW_KEYS.includes(event.key) && node) {
      event.preventDefault();
      this.moveAdHocNodeByKey(node, event.key, event.shiftKey);
      return;
    }

    if (event.key === 'c' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      this.copySelectedAdHocNode();
      return;
    }

    if (event.key === 'v' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      this.pasteAdHocNode();
      return;
    }

    if (event.key === 'd' && (event.ctrlKey || event.metaKey) && node) {
      event.preventDefault();
      this.duplicateSelected();
    }
  }

  selectFigure(instanceId: string): void {
    this.ws.selectInstance(instanceId);
    this.clearSelection();
  }

  onSegmentNodeSelected(ref: SegmentNodeRef | null): void {
    if (!ref) {
      this.clearSelection();
      return;
    }

    this.ws.selectInstance(ref.slotId);
    const node = this.nodeFor(ref);
    if (node?.isAdHoc) {
      this.selectedRef.set(ref);
      this.state.setSelectedNodeId(ref.nodeId);
    } else {
      this.selectedRef.set(null);
      this.state.setSelectedNodeId(null);
    }
  }

  onPresetSelected(preset: NodePreset): void {
    if (preset.requiresCustomLabel) {
      this.pendingLabelPreset.set(preset);
      this.comodinInputOpen.set(true);
      this.comodinLabel.set('');
      return;
    }
    this.state.enterPlacementMode(preset);
  }

  confirmComodinLabel(): void {
    const label = this.comodinLabel().trim();
    if (!label) return;
    const preset = this.pendingLabelPreset();
    if (!preset) return;
    this.comodinInputOpen.set(false);
    this.pendingLabelPreset.set(null);
    this.state.enterPlacementMode(preset, label);
  }

  cancelComodinInput(): void {
    this.comodinInputOpen.set(false);
    this.comodinLabel.set('');
    this.pendingLabelPreset.set(null);
  }

  onCanvasClicked(event: { x: number; y: number }): void {
    if (!this.state.isPlacementMode()) return;
    const preset = this.state.placementPreset();
    if (!preset) return;
    const instanceId = this.ws.selectedInstanceId();
    if (!instanceId) return;

    const label = preset.requiresCustomLabel ? this.state.placementCustomLabel() || 'Comodí' : preset.label;

    const payload: CreateAdHocNodePayload = {
      zone: preset.zone,
      positionType: preset.positionType ?? undefined,
      label,
      x: event.x,
      y: event.y,
      width: preset.width,
      height: preset.height,
      shape: preset.shape,
      color: preset.color ?? undefined,
    };

    this.assignmentService.createAdHocNode(instanceId, payload).subscribe({
      next: () => {
        this.state.exitPlacementMode();
        this.ws.refreshInstance(instanceId);
        this.toast.success(`Node "${label}" creat.`);
      },
      error: (err) => {
        this.state.exitPlacementMode();
        const msg = err?.error?.message ?? 'Error en crear el node.';
        this.toast.error(msg);
      },
    });
  }

  onAdHocPropertyChanged(event: { nodeId: string; patch: Partial<UpdateAdHocNodePayload> }): void {
    const ref = this.selectedRef();
    if (!ref) return;
    this.applyAdHocPatch(ref.slotId, event.nodeId, event.patch);
  }

  /** Ad-hoc node dragged directly on the canvas (Nodes extra tab only). */
  onSegmentAdHocNodeMoved(event: SegmentNodeRef & { x: number; y: number }): void {
    this.applyAdHocPatch(event.slotId, event.nodeId, { x: event.x, y: event.y });
  }

  /** Ad-hoc node resized/rotated via the canvas transformer (Nodes extra tab only). */
  onSegmentAdHocNodeTransformed(
    event: SegmentNodeRef & { x: number; y: number; width: number; height: number; rotation: number },
  ): void {
    this.applyAdHocPatch(event.slotId, event.nodeId, {
      x: event.x,
      y: event.y,
      width: event.width,
      height: event.height,
      rotation: event.rotation,
    });
  }

  private applyAdHocPatch(instanceId: string, nodeId: string, patch: Partial<UpdateAdHocNodePayload>): void {
    this.ws.instances.update((list) =>
      list.map((i) =>
        i.instanceId === instanceId
          ? { ...i, nodes: i.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)) }
          : i,
      ),
    );

    this.assignmentService.updateAdHocNode(instanceId, nodeId, patch).subscribe({
      error: () => {
        this.toast.error('Error en actualitzar el node.');
        this.ws.refreshInstance(instanceId);
      },
    });
  }

  onAdHocNodeUpdated(): void {
    const instanceId = this.selectedRef()?.slotId;
    if (instanceId) this.ws.refreshInstance(instanceId);
  }

  onDeleteRequested(nodeId: string): void {
    const isAssigned = this.state.assignments().some((a) => a.node.id === nodeId);
    if (isAssigned) {
      this.pendingDeleteNodeId.set(nodeId);
      this.deleteModalOpen.set(true);
    } else {
      this.deleteAdHocNode(nodeId);
    }
  }

  confirmDelete(): void {
    const nodeId = this.pendingDeleteNodeId();
    if (!nodeId) return;
    this.deleteModalOpen.set(false);
    this.pendingDeleteNodeId.set(null);
    this.deleteAdHocNode(nodeId);
  }

  cancelDelete(): void {
    this.deleteModalOpen.set(false);
    this.pendingDeleteNodeId.set(null);
  }

  duplicateSelected(): void {
    const node = this.selectedAdHocNode();
    if (!node) return;
    this.createFromSnapshot(
      {
        zone: node.zone,
        positionType: node.positionType,
        label: node.label,
        x: node.x + 20,
        y: node.y + 20,
        width: node.width,
        height: node.height,
        shape: node.shape,
        color: node.color,
        rotation: node.rotation,
      },
      `Node "${node.label}" duplicat.`,
    );
  }

  onUnassign(): void {
    // Nodes extra never surfaces the unassign action (no person panel here);
    // kept only so the properties panel's output has a handler to bind to.
  }

  private moveAdHocNodeByKey(node: InstanceNodeItem, key: string, large: boolean): void {
    const step = large ? 10 : 1;
    const delta: Record<string, { x: number; y: number }> = {
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
    };
    const d = delta[key];
    if (!d) return;
    this.onAdHocPropertyChanged({ nodeId: node.id, patch: { x: node.x + d.x, y: node.y + d.y } });
  }

  private copySelectedAdHocNode(): void {
    const node = this.selectedAdHocNode();
    if (!node) return;
    this.clipboardAdHocNode.set({
      zone: node.zone,
      positionType: node.positionType,
      label: node.label,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      shape: node.shape,
      color: node.color,
      rotation: node.rotation,
    });
    this.toast.success('Node copiat.');
  }

  private pasteAdHocNode(): void {
    const clipboard = this.clipboardAdHocNode();
    if (!clipboard) return;
    this.createFromSnapshot(
      { ...clipboard, x: clipboard.x + 20, y: clipboard.y + 20 },
      `Node "${clipboard.label}" enganxat.`,
    );
  }

  private createFromSnapshot(snapshot: AdHocNodeSnapshot, successMessage: string): void {
    const instanceId = this.ws.selectedInstanceId();
    if (!instanceId) return;

    const payload: CreateAdHocNodePayload = {
      zone: snapshot.zone,
      positionType: snapshot.positionType ?? undefined,
      label: snapshot.label,
      x: snapshot.x,
      y: snapshot.y,
      width: snapshot.width,
      height: snapshot.height,
      shape: snapshot.shape,
      color: snapshot.color ?? undefined,
      rotation: snapshot.rotation,
    };

    this.assignmentService.createAdHocNode(instanceId, payload).subscribe({
      next: () => {
        this.ws.refreshInstance(instanceId);
        this.toast.success(successMessage);
      },
      error: () => this.toast.error('Error en crear el node.'),
    });
  }

  private deleteAdHocNode(nodeId: string): void {
    const instanceId = this.selectedRef()?.slotId;
    if (!instanceId) return;

    this.clearSelection();
    this.assignmentService.deleteAdHocNode(instanceId, nodeId).subscribe({
      next: () => {
        this.ws.refreshInstance(instanceId);
        this.state.refreshPersonList();
        this.toast.success('Node eliminat.');
      },
      error: () => this.toast.error('Error en eliminar el node.'),
    });
  }

  private clearSelection(): void {
    this.selectedRef.set(null);
    this.state.setSelectedNodeId(null);
  }

  private instanceFor(instanceId: string) {
    return this.ws.instances().find((i) => i.instanceId === instanceId) ?? null;
  }

  private nodeFor(ref: SegmentNodeRef): InstanceNodeItem | null {
    return this.instanceFor(ref.slotId)?.nodes.find((n) => n.id === ref.nodeId) ?? null;
  }
}
