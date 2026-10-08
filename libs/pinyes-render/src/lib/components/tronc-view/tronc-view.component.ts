import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Scale } from 'lucide-angular';
import { ButtonComponent, InputComponent, BadgeComponent, THEME_NAMES } from '@muixer/ui';
import {
  analyzeTroncHeights,
  CumulativeHeight,
  DIRECTION_NODE_PRESETS,
  DIRECTION_SLOTS,
  DirectionAssignmentEntry,
  EventPhase,
  FigureZone,
  FloorHeightGap,
  formatDirectionNames,
  ICON_OBSERVACIONS,
  isArrivalPhase,
  SHOULDER_HEIGHT_BASELINE_CM,
  TRONC_HEIGHT_THRESHOLDS,
  TRONC_NODE_PRESETS,
  TRONC_Z_DEFAULTS,
  TroncHeightThresholds,
  TroncNodePreset,
} from '@muixer/shared';
import { AssignmentDetail, AttendanceStatus, AvailablePersonPosition, HeightMode, PersonHoverInfo } from '../../models/assignment.model';
import { PersonHoverCardComponent } from '../person-hover-card/person-hover-card.component';
import { formatAssignedLabel } from '../../utils/assigned-label.util';
import { FitTextDirective } from '../../directives/fit-text.directive';
import { LongPressDetector } from '../../utils/long-press.util';
import {
  baseNodeGridColumn,
  layoutTroncFloors,
  sortTroncBases,
  troncNodeGridColumn,
  troncTotalColumns,
  TroncLayoutFloor,
} from '../../utils/tronc-layout.util';

/**
 * Minimal node shape accepted by TroncViewComponent.
 * Compatible with both FigureNodeItem (editor) and InstanceNodeItem (assignment).
 */
export interface TroncNodeItem {
  id: string;
  label: string;
  zone: string;
  positionType: string | null;
  /** For TRONC nodes: relative horizontal start position (0-based units).
   *  For BASE nodes: position is derived from sorted index — this field is ignored. */
  x: number;
  z: number;
  /** For TRONC nodes: relative column span (1–4 units, 1u = one person width).
   *  For BASE nodes: always treated as 1. */
  width: number;
  sortOrder: number;
  color: string | null;
  /** Short marker shown next to the assigned person's name, e.g. "X". */
  climbIndicator: string | null;
  /** TRONC only: the nodes of floor `z - 1` this person stands on (feeds the cumulative heights). */
  standsOnNodeIds?: readonly string[];
}

/** One floor's entry in the right-hand height column (assignment mode). */
export interface FloorGapView {
  text: string;
  tooltip: string;
  /** Badge colour when the spread crosses a threshold; null renders muted text. */
  badge: 'warning' | 'error' | null;
}

/** A person standing on nodes whose cumulative heights differ past the support threshold. */
export interface SupportGapView {
  nodeId: string;
  text: string;
  tooltip: string;
  level: 'warning' | 'error';
  /** The person's node and the nodes they stand on — outlined while the chip is hovered or focused. */
  nodeIds: string[];
}

type TroncFloor = TroncLayoutFloor<TroncNodeItem>;

const MAX_TRONC_Z = 5;

/** Minimum pointer movement (px) before a pointerdown is treated as a drag rather than a tap/click. */
const DRAG_THRESHOLD_PX = 6;


/** Sort key for heights known to be set (supporters of a reported support gap). */
function knownCm(height: CumulativeHeight | undefined): number {
  return height?.known ? height.cm : 0;
}

@Component({
  selector: 'app-tronc-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule, PersonHoverCardComponent, FitTextDirective, ButtonComponent, InputComponent, BadgeComponent],
  host: { '[attr.data-theme]': 'pinnedTheme' },
  templateUrl: './tronc-view.component.html',
  styleUrl: './tronc-view.component.scss',
})
export class TroncViewComponent {
  /** Figure rendering stays on the light theme until it's themed for dark mode (see DEBT.md). */
  protected readonly pinnedTheme = THEME_NAMES.light;

  // ── Inputs ─────────────────────────────────────────────────────────────────

  /** TRONC-zone nodes (z≥1). x and width are relative units. */
  /** Figure instance id, used to scope drag-and-drop node refs across sibling tronc-views. */
  readonly instanceId = input<string>('');

  readonly troncNodes = input<TroncNodeItem[]>([]);

  /** BASE-zone nodes (z=0, intersection with pinya). Positioned by sortOrder index in tronc view. */
  readonly baseNodes = input<TroncNodeItem[]>([]);

  readonly assignments = input<AssignmentDetail[]>([]);
  readonly selectedNodeId = input<string | null>(null);
  /** Person IDs in conflict in this segment; a node is flagged when its assigned person is one. */
  readonly conflictPersonIds = input<Set<string>>(new Set());
  readonly mode = input<'editor' | 'assignment' | 'projection'>('assignment');
  /** Assignment mode: whether a placed person can be dragged onto another node. Off on touch, where a long press starts the move instead. */
  readonly personDragEnabled = input(true);
  readonly heightMode = input<HeightMode>('relative');
  /** Where the floor spread and uneven-supporter warnings turn yellow / red. */
  readonly heightThresholds = input<TroncHeightThresholds>(TRONC_HEIGHT_THRESHOLDS);
  readonly highlightedNodeIds = input<Set<string>>(new Set());

  /** personId → AttendanceStatus for the next actuació */
  readonly attendanceMap = input<Map<string, AttendanceStatus>>(new Map());
  /** Before / on / after the event day: from the event day on, ANIRE is a no-show and PENDENT a no-answer. */
  readonly phase = input<EventPhase>('before');

  /** personId → positions/isXicalla/notes/notesEmoji, used to render the hover card on assigned nodes. */
  readonly personDetailsMap = input<Map<string, { positions: AvailablePersonPosition[]; isXicalla: boolean; notes: string | null; notesEmoji: string | null }>>(new Map());

  readonly ICON_OBSERVACIONS = ICON_OBSERVACIONS;

  readonly directionNodes = input<TroncNodeItem[]>([]);

  /** Projection mode only: color used for the panel border and tinted background. */
  readonly panelColor = input<string | null>(null);

  /** Projection mode only: color used for the panel border, if different from panelColor. */
  readonly panelBorderColor = input<string | null>(null);

  /** Projection mode only: figure name shown as a header inside the panel. */
  readonly figureName = input<string | null>(null);

  // ── Outputs ────────────────────────────────────────────────────────────────

  /** Emits the clicked node id. Emits null when deselecting. */
  readonly nodeSelected = output<string | null>();

  /** Emits for popover positioning (assigned node clicked). */
  readonly nodeClicked = output<{ nodeId: string; event: MouseEvent }>();

  /**
   * Assignment mode: a node was right-clicked (the same gesture a long press will trigger on
   * touch). Emitted for empty nodes too, since it can also pick the destination of a move.
   */
  readonly nodeContextMenu = output<string>();

  /** Editor only: position/width/positionType changed for a TRONC node. */
  readonly nodeUpdated = output<{ nodeId: string; x: number; width: number; positionType?: string; label?: string; color?: string | null; climbIndicator?: string | null }>();

  /** Editor only: create a new TRONC node on the given floor. */
  readonly nodeAdded = output<{ z: number; positionType: string; label: string; sortOrder: number }>();

  /** Editor only: delete a TRONC node by id. */
  readonly nodeRemoved = output<string>();

  /** Editor only: request creating a new BASE node. */
  readonly baseAdded = output<{ sortOrder: number }>();

  /** Editor only: delete a BASE node by id. */
  readonly baseRemoved = output<string>();

  /** Editor only: delete all TRONC nodes at a given z-level. */
  readonly floorRemoved = output<number>();

  /** Assignment mode: request unassignment for a node id. */
  readonly nodeUnassigned = output<string>();

  /** Assignment mode: a person was dragged off a node (possibly of a sibling tronc-view) and dropped here. */
  readonly nodeDropped = output<{
    sourceInstanceId: string;
    sourceNodeId: string;
    targetInstanceId: string;
    targetNodeId: string;
  }>();

  readonly directionAdded = output<{ positionType: string }>();
  readonly directionRemoved = output<string>();

  // ── Local state ────────────────────────────────────────────────────────────

  /** Flip floor order: P1 at top instead of at bottom. */
  readonly inverted = signal(false);

  /** Whether the directions section is expanded. */
  readonly directionsExpanded = signal(true);

  readonly hoveredPerson = signal<{ info: PersonHoverInfo; top: number; left: number; positionType: string | null } | null>(null);

  /** Assignment-mode drag-and-drop: id of the node whose person is currently being dragged. */
  readonly draggingNodeId = signal<string | null>(null);
  /** Id of the node currently under the pointer while dragging. */
  readonly dragOverNodeId = signal<string | null>(null);

  /**
   * Pointer captured on pointerdown, before we know whether it's a tap/click
   * (never moves) or a real drag (moves past DRAG_THRESHOLD_PX). Keeping this
   * separate from `draggingNodeId` avoids flashing the "dragging" look on a
   * plain tap — HTML5 DnD had this movement gate built in; pointer events don't.
   */
  private pointerDragOrigin: { nodeId: string; pointerId: number; x: number; y: number } | null = null;
  /** Touch long press on a node: starts the "move a person" gesture (see `nodeContextMenu`). */
  private readonly longPress = new LongPressDetector();

  // ── Direction computed ─────────────────────────────────────────────────────

  /**
   * One entry per direction flavour (`DIRECTION_SLOTS` order: tronc → xicalla → pinya), each
   * with the instance's nodes of that flavour. Every slot is always present — an empty one
   * still renders its "Afegir" button.
   */
  readonly directionSlots = computed(() => {
    const nodes = this.directionNodes();
    return DIRECTION_SLOTS.map((slot) => ({
      slot,
      nodes: nodes.filter((n) => n.positionType === slot.positionType),
    }));
  });

  /**
   * Projection mode: every assigned direction person on ONE line, in `DIRECTION_SLOTS` order.
   * Each name carries its flavour marker — «(X)» for direcció xicalla, «(P)» for direcció
   * pinya, nothing for direcció tronc. The line wraps when it is too long.
   */
  readonly projectionDirectionNames = computed<string[]>(() => {
    const assigns = this.assignments();
    const entries = this.directionNodes()
      .map((node): DirectionAssignmentEntry | null => {
        const assignment = assigns.find((a) => a.node.id === node.id);
        return assignment
          ? { positionType: node.positionType, personAlias: assignment.person.alias }
          : null;
      })
      .filter((e): e is DirectionAssignmentEntry => e !== null);
    return formatDirectionNames(entries);
  });

  readonly hasAssignedDirections = computed(() => {
    const dirs = this.directionNodes();
    const assigns = this.assignments();
    return dirs.some((d) => assigns.some((a) => a.node.id === d.id));
  });

  private prevHadAssignedDirections = false;

  constructor() {
    // A pending long press must not fire into a destroyed component (emitting on it throws).
    inject(DestroyRef).onDestroy(() => this.longPress.cancel());

    effect(() => {
      const has = this.hasAssignedDirections();
      if (has && !this.prevHadAssignedDirections) {
        this.directionsExpanded.set(true);
      }
      this.prevHadAssignedDirections = has;
    });
  }

  // ── Computed ───────────────────────────────────────────────────────────────

  readonly sortedBases = computed(() => sortTroncBases(this.baseNodes()));

  /** Grid columns in half-units (0.5u = 1 CSS column) — see `tronc-layout.util`. */
  readonly totalColumns = computed(() =>
    troncTotalColumns(this.troncNodes(), this.sortedBases().length),
  );

  readonly floors = computed<TroncFloor[]>(() =>
    layoutTroncFloors(this.troncNodes(), this.baseNodes(), { fillGaps: this.mode() === 'editor' }),
  );

  /** Assigned node id → person's shoulder height; an absent node is empty. */
  private readonly heightByNodeId = computed(
    () => new Map(this.assignments().map((a) => [a.node.id, a.person.shoulderHeight])),
  );

  private readonly aliasByNodeId = computed(
    () => new Map(this.assignments().map((a) => [a.node.id, a.person.alias])),
  );

  /** Cumulative heights, floor spreads and uneven supporters — see `tronc-height.util`. */
  readonly heightAnalysis = computed(() =>
    analyzeTroncHeights(
      [...this.troncNodes(), ...this.baseNodes()].map((n) => ({
        id: n.id,
        zone: n.zone as FigureZone,
        z: n.z,
        standsOnNodeIds: n.standsOnNodeIds,
      })),
      this.heightByNodeId(),
      this.heightThresholds(),
    ),
  );

  /** Floors with a single node are left out: there is nothing to compare them with. */
  readonly floorGapViews = computed(() => {
    const nodeCount = new Map<number, number>();
    for (const n of [...this.troncNodes(), ...this.baseNodes()]) nodeCount.set(n.z, (nodeCount.get(n.z) ?? 0) + 1);

    const views = new Map<number, FloorGapView>();
    for (const [z, gap] of this.heightAnalysis().floors) {
      if ((nodeCount.get(z) ?? 0) >= 2) views.set(z, this.toFloorGapView(gap));
    }
    return views;
  });

  /** Keyed by the floor of the person standing on uneven supporters. */
  readonly supportGapViews = computed(() => {
    const { cumulativeByNodeId, supports } = this.heightAnalysis();
    const nodeById = new Map(this.troncNodes().map((n) => [n.id, n]));
    const views = new Map<number, SupportGapView[]>();

    for (const [nodeId, gap] of supports) {
      const node = nodeById.get(nodeId);
      if (!node || gap.level === 'ok') continue;
      const byHeight = [...gap.supporterIds].sort(
        (a, b) => knownCm(cumulativeByNodeId.get(a)) - knownCm(cumulativeByNodeId.get(b)),
      );
      const cm = Math.round(gap.gapCm);
      const upper = this.aliasByNodeId().get(nodeId) ?? node.label;
      const view: SupportGapView = {
        nodeId,
        text: `${cm} cm`,
        tooltip: `${this.gapSentence(cm, byHeight[0], byHeight[byHeight.length - 1])}, que porten ${upper}.`,
        level: gap.level,
        nodeIds: [nodeId, ...gap.supporterIds],
      };
      views.set(node.z, [...(views.get(node.z) ?? []), view]);
    }
    return views;
  });

  /** The uneven-supporter chip currently hovered or focused. */
  readonly focusedSupportNodeId = signal<string | null>(null);

  private readonly focusedSupport = computed(() => {
    const id = this.focusedSupportNodeId();
    if (!id) return null;
    for (const views of this.supportGapViews().values()) {
      const view = views.find((v) => v.nodeId === id);
      if (view) return view;
    }
    return null;
  });

  readonly progressByFloor = computed(() => {
    const assignments = this.assignments();
    const assignedIds = new Set(assignments.map((a) => a.node.id));
    const result = new Map<number, { assigned: number; total: number }>();

    for (const floor of this.floors()) {
      result.set(floor.z, {
        assigned: floor.nodes.filter((n) => assignedIds.has(n.id)).length,
        total: floor.nodes.length,
      });
    }

    return result;
  });

  /** The currently selected TRONC node (null if BASE or nothing selected). */
  readonly selectedTroncNode = computed(() => {
    const id = this.selectedNodeId();
    if (!id) return null;
    return this.troncNodes().find((n) => n.id === id) ?? null;
  });

  /** The currently selected BASE node (null if TRONC or nothing selected). */
  readonly selectedBaseNode = computed(() => {
    const id = this.selectedNodeId();
    if (!id) return null;
    return this.baseNodes().find((n) => n.id === id) ?? null;
  });

  /** The currently selected TRONC or BASE node, whichever matches (null if neither). */
  readonly selectedFloorNode = computed(() => this.selectedTroncNode() ?? this.selectedBaseNode());

  /** All z levels that currently have tronc nodes. */
  readonly existingZLevels = computed(() =>
    new Set(this.troncNodes().map((n) => n.z)),
  );

  readonly baseCount = computed(() => this.baseNodes().length);

  readonly maxExistingZ = computed(() => {
    const zLevels = [...this.existingZLevels()];
    return zLevels.length > 0 ? Math.max(...zLevels) : 0;
  });

  readonly canAddFloor = computed(() => {
    const nextZ = this.maxExistingZ() + 1;
    return nextZ <= MAX_TRONC_Z && this.baseNodes().length > 0;
  });

  readonly hasTronc = computed(
    () => this.troncNodes().length > 0 || this.baseNodes().length > 0,
  );

  // ── Event handlers ─────────────────────────────────────────────────────────

  onNodeClick(node: TroncNodeItem, event: MouseEvent): void {
    // The click the browser emits when the finger is lifted after a long press is not a real tap.
    if (this.longPress.swallowsClick()) return;
    this.nodeSelected.emit(node.id);
    if (this.isAssigned(node.id)) {
      this.nodeClicked.emit({ nodeId: node.id, event });
      // Touch has no hover: a tap reveals the same person card mouseenter shows.
      this.onNodeHover(event, node.id);
    }
  }

  /** Tapping empty space in the tronc (not a node) dismisses the tap-revealed hover card. */
  onBackgroundClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.onNodeLeave();
    }
  }

  // ── Drag-and-drop (assignment mode) ───────────────────────────────────────

  isDraggableNode(nodeId: string): boolean {
    return this.mode() === 'assignment' && this.personDragEnabled() && this.isAssigned(nodeId);
  }

  isDragging(nodeId: string): boolean {
    return this.draggingNodeId() === nodeId;
  }

  isDragOverSwap(nodeId: string): boolean {
    return this.dragOverNodeId() === nodeId && this.isAssigned(nodeId);
  }

  isDragOverMove(nodeId: string): boolean {
    return this.dragOverNodeId() === nodeId && !this.isAssigned(nodeId);
  }

  onNodePointerDown(node: TroncNodeItem, event: PointerEvent): void {
    // A finger (not the mouse, which has right-click) held on a node starts the move gesture.
    if (this.mode() === 'assignment' && event.pointerType !== 'mouse') {
      this.longPress.start(event.clientX, event.clientY, () => this.nodeContextMenu.emit(node.id));
    }
    if (!this.isDraggableNode(node.id)) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    this.pointerDragOrigin = { nodeId: node.id, pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  onNodePointerMove(event: PointerEvent): void {
    this.longPress.move(event.clientX, event.clientY);
    const origin = this.pointerDragOrigin;
    if (!origin || origin.pointerId !== event.pointerId) return;

    if (this.draggingNodeId() === null) {
      const distance = Math.hypot(event.clientX - origin.x, event.clientY - origin.y);
      if (distance < DRAG_THRESHOLD_PX) return; // still just a tap/click
      this.draggingNodeId.set(origin.nodeId);
      this.longPress.cancel();
    }

    event.preventDefault();
    const target = this.resolveDropTarget(event.clientX, event.clientY);
    const isOrigin = target?.nodeId === origin.nodeId && target.instanceId === this.instanceId();
    this.dragOverNodeId.set(target && !isOrigin ? target.nodeId : null);
  }

  onNodePointerUp(event: PointerEvent): void {
    this.longPress.end();
    const origin = this.pointerDragOrigin;
    if (!origin || origin.pointerId !== event.pointerId) return;

    if (this.draggingNodeId() !== null) {
      const target = this.resolveDropTarget(event.clientX, event.clientY);
      const isOrigin = target?.nodeId === origin.nodeId && target.instanceId === this.instanceId();
      if (target && !isOrigin) {
        this.nodeDropped.emit({
          sourceInstanceId: this.instanceId(),
          sourceNodeId: origin.nodeId,
          targetInstanceId: target.instanceId,
          targetNodeId: target.nodeId,
        });
      }
    }
    this.endPointerDrag();
  }

  onNodePointerCancel(event: PointerEvent): void {
    this.longPress.end();
    if (this.pointerDragOrigin?.pointerId !== event.pointerId) return;
    this.endPointerDrag();
  }

  private endPointerDrag(): void {
    this.pointerDragOrigin = null;
    this.draggingNodeId.set(null);
    this.dragOverNodeId.set(null);
  }

  /** Resolves which node (and which tronc-view instance, possibly a sibling) sits under a client point. */
  private resolveDropTarget(clientX: number, clientY: number): { nodeId: string; instanceId: string } | null {
    const el = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-tronc-node-id]');
    const nodeId = el?.dataset['troncNodeId'];
    const instanceId = el?.dataset['instanceId'];
    return nodeId && instanceId !== undefined ? { nodeId, instanceId } : null;
  }

  onStepX(node: TroncNodeItem, delta: number): void {
    const bc = this.baseCount();
    const newX = Math.round((node.x + delta) * 2) / 2;
    const clamped = Math.max(0, Math.min(bc - node.width, newX));
    this.nodeUpdated.emit({ nodeId: node.id, x: clamped, width: node.width });
  }

  onStepWidth(node: TroncNodeItem, delta: number): void {
    const bc = this.baseCount();
    const newW = Math.round((node.width + delta) * 2) / 2;
    const clamped = Math.max(0.5, Math.min(bc - node.x, newW));
    this.nodeUpdated.emit({ nodeId: node.id, x: node.x, width: clamped });
  }

  xAtMin(node: TroncNodeItem): boolean { return node.x <= 0; }
  xAtMax(node: TroncNodeItem): boolean { return node.x >= this.baseCount() - node.width; }
  widthAtMin(node: TroncNodeItem): boolean { return node.width <= 0.5; }
  widthAtMax(node: TroncNodeItem): boolean { return node.width >= this.baseCount() - node.x; }

  onNodeDelete(node: TroncNodeItem): void {
    this.nodeRemoved.emit(node.id);
  }

  onLabelChange(node: TroncNodeItem, label: string): void {
    if (!label.trim()) return;
    this.nodeUpdated.emit({
      nodeId: node.id,
      x: node.x,
      width: node.width,
      label: label.trim().slice(0, 30),
    });
  }

  onIndicatorChange(node: TroncNodeItem, indicator: string): void {
    this.nodeUpdated.emit({
      nodeId: node.id,
      x: node.x,
      width: node.width,
      climbIndicator: indicator.trim().slice(0, 6) || null,
    });
  }

  onPositionTypeChange(node: TroncNodeItem, preset: TroncNodePreset): void {
    const isLabelDefault = this.isDefaultLabel(node);
    this.nodeUpdated.emit({
      nodeId: node.id,
      x: node.x,
      width: node.width,
      positionType: preset.positionType,
      color: preset.color,
      ...(isLabelDefault ? { label: preset.label } : {}),
    });
  }

  onAddFloor(): void {
    if (!this.canAddFloor()) return;
    const nextZ = this.maxExistingZ() + 1;
    const defaults = TRONC_Z_DEFAULTS[nextZ] ?? { label: `Pis ${nextZ + 1}`, positionType: 'tronc' };

    this.nodeAdded.emit({
      z: nextZ,
      positionType: defaults.positionType,
      label: defaults.label,
      sortOrder: 0,
    });
  }

  canRemoveFloor(z: number): boolean {
    return z === this.maxExistingZ();
  }

  onRemoveFloor(z: number): void {
    if (!this.canRemoveFloor(z)) return;
    this.floorRemoved.emit(z);
  }

  onAddNodeToFloor(floor: TroncFloor): void {
    const lastNode = floor.nodes[floor.nodes.length - 1];
    const defaults = TRONC_Z_DEFAULTS[floor.z] ?? { label: `Pis ${floor.z + 1}`, positionType: 'tronc' };
    const positionType = lastNode?.positionType ?? defaults.positionType;
    const label = lastNode?.label ?? defaults.label;

    this.nodeAdded.emit({
      z: floor.z,
      positionType,
      label,
      sortOrder: floor.nodes.length,
    });
  }

  onAddBase(): void {
    this.baseAdded.emit({ sortOrder: this.baseNodes().length });
  }

  onRemoveBase(id: string): void {
    this.baseRemoved.emit(id);
  }

  toggleOrientation(): void {
    this.inverted.update((v) => !v);
  }

  // ── Presets exposed to template ──────────────────────────────────────────────

  readonly presets = TRONC_NODE_PRESETS;
  readonly Scale = Scale;

  // ── Template helpers ───────────────────────────────────────────────────────

  isAssigned(nodeId: string): boolean {
    return this.assignments().some((a) => a.node.id === nodeId);
  }

  isSelected(nodeId: string): boolean {
    return this.selectedNodeId() === nodeId;
  }

  isHighlighted(nodeId: string): boolean {
    return this.highlightedNodeIds().has(nodeId);
  }

  getAssignment(nodeId: string): AssignmentDetail | undefined {
    return this.assignments().find((a) => a.node.id === nodeId);
  }

  /** True when the node's assigned person holds >1 placement in the segment (Phase 3). */
  isConflict(nodeId: string): boolean {
    const assignment = this.getAssignment(nodeId);
    return !!assignment && this.conflictPersonIds().has(assignment.person.id);
  }

  getHeightDisplay(shoulderHeight: number | null): string {
    if (shoulderHeight == null || shoulderHeight === 0) return '';
    if (this.heightMode() === 'absolute') return `${shoulderHeight}`;
    const diff = shoulderHeight - SHOULDER_HEIGHT_BASELINE_CM;
    return diff >= 0 ? `+${diff}` : `${diff}`;
  }

  getAttendanceStatus(assignment: AssignmentDetail): AttendanceStatus | null {
    const personId = assignment.person.id;
    return this.attendanceMap().get(personId) ?? null;
  }

  getNotes(assignment: AssignmentDetail): string | null {
    return this.personDetailsMap().get(assignment.person.id)?.notes ?? null;
  }

  getNotesEmoji(assignment: AssignmentDetail): string | null {
    return this.personDetailsMap().get(assignment.person.id)?.notesEmoji ?? null;
  }

  onNodeHover(event: MouseEvent, nodeId: string): void {
    // After a long press the browser still emits mouse events; that is not a hover, and the card
    // would pop up over the neighbouring node the user is about to tap as the destination.
    if (this.longPress.swallowsClick()) return;
    const assignment = this.getAssignment(nodeId);
    if (!assignment) {
      this.hoveredPerson.set(null);
      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const details = this.personDetailsMap().get(assignment.person.id);
    const node = [...this.troncNodes(), ...this.baseNodes(), ...this.directionNodes()].find((n) => n.id === nodeId);
    this.hoveredPerson.set({
      info: {
        alias: assignment.person.alias,
        attendanceStatus: this.getAttendanceStatus(assignment),
        isXicalla: details?.isXicalla ?? false,
        shoulderHeight: assignment.person.shoulderHeight,
        cumulativeHeight: this.cumulativeCm(nodeId),
        notes: details?.notes ?? null,
        notesEmoji: details?.notesEmoji ?? null,
        positions: details?.positions ?? [],
      },
      top: rect.top,
      left: rect.right + 8,
      positionType: node?.positionType ?? null,
    });
  }

  onNodeLeave(): void {
    this.hoveredPerson.set(null);
  }

  getAttendanceColor(assignment: AssignmentDetail): string {
    const status = this.getAttendanceStatus(assignment);
    const past = isArrivalPhase(this.phase());
    if (status === 'ASSISTIT') return 'oklch(var(--su))';
    if (status === 'ANIRE') return past ? 'oklch(var(--wa))' : 'oklch(var(--su))';
    if (status === 'NO_VAIG') return 'oklch(var(--er))';
    if (status === 'PENDENT') return past ? 'oklch(var(--er))' : 'oklch(var(--bc) / 0.2)';
    return 'oklch(var(--bc) / 0.2)';
  }

  /** Only the chip that set the highlight may clear it: leaving one chip must not undo focusing another. */
  clearSupportFocus(nodeId: string): void {
    if (this.focusedSupportNodeId() === nodeId) this.focusedSupportNodeId.set(null);
  }

  isSupportFocused(nodeId: string): boolean {
    return this.focusedSupport()?.nodeIds.includes(nodeId) ?? false;
  }

  isSupportFocusError(nodeId: string): boolean {
    return this.focusedSupport()?.level === 'error' && this.isSupportFocused(nodeId);
  }

  private toFloorGapView(gap: FloorHeightGap): FloorGapView {
    switch (gap.status) {
      case 'ok': {
        const cm = Math.round(gap.gapCm);
        return {
          text: `${cm} cm`,
          tooltip: `${this.gapSentence(cm, gap.lowestNodeId, gap.highestNodeId)}.`,
          badge: gap.level === 'ok' ? null : gap.level,
        };
      }
      case 'missing-height':
        return {
          text: '?? cm',
          tooltip: "No es pot calcular la diferència d'alçades perquè hi ha persones que no la tenen registrada.",
          badge: null,
        };
      case 'insufficient':
        return {
          text: '—',
          tooltip:
            gap.reason === 'unlinked'
              ? 'Falta indicar a la plantilla damunt de qui va cada persona.'
              : "Cal assignar almenys dues persones en este pis per a calcular la diferència d'alçades.",
          badge: null,
        };
    }
  }

  /** «La diferència d'alçades és 4 cm, entre Anna i Bea» — both nodes have a known height, so both are assigned. */
  private gapSentence(cm: number, lowestNodeId: string, highestNodeId: string): string {
    const aliases = this.aliasByNodeId();
    return `La diferència d'alçades és ${cm} cm, entre ${aliases.get(lowestNodeId)} i ${aliases.get(highestNodeId)}`;
  }

  /** Rounded cumulative height of a node, null while unknown. */
  private cumulativeCm(nodeId: string): number | null {
    const height = this.heightAnalysis().cumulativeByNodeId.get(nodeId);
    return height?.known ? Math.round(height.cm) : null;
  }

  getProgressDisplay(z: number): string {
    const p = this.progressByFloor().get(z);
    if (!p) return '';
    return `${p.assigned}/${p.total}`;
  }

  getZLevelColor(z: number): string {
    return TRONC_Z_DEFAULTS[z]?.color ?? (z === 0 ? '#607D8B' : '#78909C');
  }

  onUnassignNode(nodeId: string): void {
    this.nodeUnassigned.emit(nodeId);
  }

  /** Right-click in assignment mode: replaces the browser menu with the move gesture. */
  onNodeContextMenu(node: TroncNodeItem, event: MouseEvent): void {
    if (this.mode() !== 'assignment') return;
    event.preventDefault();
    // Android fires this natively on a long press too: the long-press detector reports that
    // gesture (once), so it must not also be reported here as a mouse right-click.
    if (this.longPress.absorbNativeContextMenu()) return;
    this.nodeContextMenu.emit(node.id);
  }

  onDirectionNodeClick(node: TroncNodeItem, event: MouseEvent): void {
    if (this.longPress.swallowsClick()) return;
    this.nodeSelected.emit(node.id);
    if (this.isAssigned(node.id)) {
      this.nodeClicked.emit({ nodeId: node.id, event });
      this.onNodeHover(event, node.id);
    }
  }

  onRemoveDirection(nodeId: string): void {
    this.directionRemoved.emit(nodeId);
  }

  getNodeAriaLabel(node: TroncNodeItem): string {
    const assignment = this.getAssignment(node.id);
    if (!assignment) return `Node ${this.displayLabel(node)}, sense assignar`;
    const height = this.getHeightDisplay(assignment.person.shoulderHeight);
    const label = `${node.label}: ${this.displayAlias(node, assignment)}, alçada ${height}`;
    const cumulative = this.cumulativeCm(node.id);
    return cumulative === null ? label : `${label}, alçada acumulada ${cumulative} cm`;
  }

  /** Person alias with the node's climb indicator appended, e.g. "Marta (X)". */
  displayAlias(node: TroncNodeItem, assignment: AssignmentDetail): string {
    return formatAssignedLabel(assignment.person.alias, node.climbIndicator);
  }

  /** Node label with its climb indicator appended, e.g. "Segona (X)", shown when unassigned. */
  displayLabel(node: TroncNodeItem): string {
    return formatAssignedLabel(node.label, node.climbIndicator);
  }

  /** CSS grid-column for a TRONC node (doubled grid: 0.5u = 1 column). */
  getTroncNodeGridColumn(node: TroncNodeItem): string {
    return troncNodeGridColumn(node);
  }

  /** CSS grid-column for a BASE node by its sorted index (each base = 2 half-cols). */
  getBaseNodeGridColumn(index: number): string {
    return baseNodeGridColumn(index);
  }

  gridTemplateColumns(): string {
    const halfCols = this.totalColumns();
    const realCols = halfCols / 2;
    const minSize = realCols > 7 ? '1.5rem' : realCols > 4 ? '2rem' : '2.5rem';
    const base = `repeat(${halfCols}, minmax(${minSize}, 1fr))`;
    // Add 2 extra half-columns (= 1 real column) for the add-node button — editor mode only,
    // the only mode that renders it (see `floor-add-node-btn` in the template). Reserving it
    // unconditionally made every panel (assignment/projection) measure and render wider than
    // its real content, most visibly as extra empty space on the right in the projection panel.
    return this.mode() === 'editor' ? `${base} 2.5rem` : base;
  }

  /** Grid column for the add-node button (always in the extra column at the end). */
  getAddNodeButtonGridColumn(): string {
    const halfCols = this.totalColumns();
    return `${halfCols + 1} / span 2`;
  }

  getNodeColor(node: TroncNodeItem): string | null {
    return node.color ?? null;
  }

  /** Border/accent colour for a direction flavour, by `positionType`. */
  getDirectionColor(positionType: string | null): string {
    return DIRECTION_NODE_PRESETS.find((p) => p.positionType === positionType)?.color ?? '#64748b';
  }

  /** Short row caption for a direction flavour, by `positionType`. */
  getDirectionLabel(positionType: string | null): string {
    return DIRECTION_NODE_PRESETS.find((p) => p.positionType === positionType)?.shortLabel ?? 'Dir.';
  }

  getPositionTypeBadge(node: TroncNodeItem): string {
    if (!node.positionType) return '';
    const preset = TRONC_NODE_PRESETS.find((p) => p.positionType === node.positionType);
    return preset?.abbrev ?? node.positionType.slice(0, 3);
  }

  isPresetActive(node: TroncNodeItem, preset: TroncNodePreset): boolean {
    return node.positionType === preset.positionType;
  }

  /** Whether the node's label matches a known preset label (auto-generated). */
  private isDefaultLabel(node: TroncNodeItem): boolean {
    return TRONC_NODE_PRESETS.some((p) => p.label === node.label);
  }

}
