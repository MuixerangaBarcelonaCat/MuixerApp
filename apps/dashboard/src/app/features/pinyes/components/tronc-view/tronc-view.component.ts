import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { FigureZone, TRONC_NODE_PRESETS, TRONC_Z_DEFAULTS, TroncNodePreset } from '@muixer/shared';
import { AssignmentDetail, AttendanceStatus, AvailablePersonPosition, HeightMode, PersonHoverInfo } from '../../models/assignment.model';
import { floorVariance, varianceLevel, VarianceLevel } from '../../utils/floor-variance.util';
import { SHOULDER_HEIGHT_BASELINE_CM } from '../../../../shared/utils/person.util';
import { PersonHoverCardComponent } from '../person-hover-card/person-hover-card.component';
import { ICON_OBSERVACIONS } from '../../../../shared/constants/domain-icons';

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
}

interface TroncFloor {
  z: number;
  pisLabel: string;
  positionTypeLabel: string;
  nodes: TroncNodeItem[];
  isBase: boolean;
}

const MAX_TRONC_Z = 5;


@Component({
  selector: 'app-tronc-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule, PersonHoverCardComponent],
  templateUrl: './tronc-view.component.html',
  styleUrl: './tronc-view.component.scss',
})
export class TroncViewComponent {
  // ── Inputs ─────────────────────────────────────────────────────────────────

  /** TRONC-zone nodes (z≥1). x and width are relative units. */
  readonly troncNodes = input<TroncNodeItem[]>([]);

  /** BASE-zone nodes (z=0, intersection with pinya). Positioned by sortOrder index in tronc view. */
  readonly baseNodes = input<TroncNodeItem[]>([]);

  readonly assignments = input<AssignmentDetail[]>([]);
  readonly selectedNodeId = input<string | null>(null);
  readonly mode = input<'editor' | 'assignment' | 'projection'>('assignment');
  readonly heightMode = input<HeightMode>('relative');
  readonly highlightedNodeIds = input<Set<string>>(new Set());

  /** personId → AttendanceStatus for the next actuació */
  readonly attendanceMap = input<Map<string, AttendanceStatus>>(new Map());
  readonly isPast = input<boolean>(false);

  /** personId → positions/isXicalla/notes/notesEmoji, used to render the hover card on assigned nodes. */
  readonly personDetailsMap = input<Map<string, { positions: AvailablePersonPosition[]; isXicalla: boolean; notes: string | null; notesEmoji: string | null }>>(new Map());

  readonly ICON_OBSERVACIONS = ICON_OBSERVACIONS;

  readonly directionNodes = input<TroncNodeItem[]>([]);

  /** Projection mode only: color used for the panel border and tinted background. */
  readonly panelColor = input<string | null>(null);

  /** Projection mode only: figure name shown as a header inside the panel. */
  readonly figureName = input<string | null>(null);

  // ── Outputs ────────────────────────────────────────────────────────────────

  /** Emits the clicked node id. Emits null when deselecting. */
  readonly nodeSelected = output<string | null>();

  /** Emits for popover positioning (assigned node clicked). */
  readonly nodeClicked = output<{ nodeId: string; event: MouseEvent }>();

  /** Editor only: position/width/positionType changed for a TRONC node. */
  readonly nodeUpdated = output<{ nodeId: string; x: number; width: number; positionType?: string; label?: string; color?: string | null }>();

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

  readonly directionAdded = output<{ zone: string }>();
  readonly directionRemoved = output<string>();

  // ── Local state ────────────────────────────────────────────────────────────

  /** Flip floor order: P1 at top instead of at bottom. */
  readonly inverted = signal(false);

  /** Whether the directions section is expanded. */
  readonly directionsExpanded = signal(true);

  readonly hoveredPerson = signal<{ info: PersonHoverInfo; top: number; left: number; positionType: string | null } | null>(null);

  // ── Direction computed ─────────────────────────────────────────────────────

  readonly figureDirectionNodes = computed(() =>
    this.directionNodes().filter((n) => n.zone === FigureZone.FIGURE_DIRECTION),
  );

  readonly xicallaDirectionNodes = computed(() =>
    this.directionNodes().filter((n) => n.zone === FigureZone.XICALLA_DIRECTION),
  );

  readonly hasAssignedDirections = computed(() => {
    const dirs = this.directionNodes();
    const assigns = this.assignments();
    return dirs.some((d) => assigns.some((a) => a.node.id === d.id));
  });

  private prevHadAssignedDirections = false;

  constructor() {
    effect(() => {
      const has = this.hasAssignedDirections();
      if (has && !this.prevHadAssignedDirections) {
        this.directionsExpanded.set(true);
      }
      this.prevHadAssignedDirections = has;
    });
  }

  // ── Computed ───────────────────────────────────────────────────────────────

  readonly sortedBases = computed(() =>
    [...this.baseNodes()].sort((a, b) => a.sortOrder - b.sortOrder),
  );

  /**
   * Grid columns in half-units (0.5u = 1 CSS column).
   * Doubled internally so fractional x/width map to integer grid lines.
   */
  readonly totalColumns = computed(() => {
    const troncMax = this.troncNodes().reduce(
      (max, n) => Math.max(max, Math.round((n.x + n.width) * 2)),
      0,
    );
    const baseCount = this.sortedBases().length * 2;
    return Math.max(troncMax, baseCount, 2);
  });

  readonly floors = computed<TroncFloor[]>(() => {
    const byZ = new Map<number, TroncNodeItem[]>();

    for (const node of this.troncNodes()) {
      if (!byZ.has(node.z)) byZ.set(node.z, []);
      byZ.get(node.z)!.push(node);
    }

    for (const [, nodes] of byZ) {
      nodes.sort((a, b) => a.sortOrder - b.sortOrder || a.x - b.x);
    }

    const troncFloors: TroncFloor[] = Array.from(byZ.entries()).map(
      ([z, nodes]) => ({
        z,
        pisLabel: `P${z + 1}`,
        positionTypeLabel: this.getDominantPositionType(nodes),
        nodes,
        isBase: false,
      }),
    );

    const sortedBases = this.sortedBases();
    const baseFloor: TroncFloor | null = sortedBases.length > 0
      ? { z: 0, pisLabel: 'P1', positionTypeLabel: 'Bases', nodes: sortedBases, isBase: true }
      : null;

    const allFloors = baseFloor ? [...troncFloors, baseFloor] : troncFloors;
    return allFloors.sort((a, b) => b.z - a.z);
  });

  readonly varianceByFloor = computed(() => {
    const assignments = this.assignments();
    const result = new Map<number, number | null>();

    for (const floor of this.floors()) {
      const nodeIds = floor.nodes.map((n) => n.id);
      result.set(floor.z, floorVariance(nodeIds, assignments));
    }

    return result;
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
    this.nodeSelected.emit(node.id);
    if (this.isAssigned(node.id)) {
      this.nodeClicked.emit({ nodeId: node.id, event });
    }
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
      label: label.trim(),
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
    const past = this.isPast();
    if (status === 'ASSISTIT') return 'oklch(var(--su))';
    if (status === 'ANIRE') return past ? 'oklch(var(--wa))' : 'oklch(var(--su))';
    if (status === 'NO_VAIG') return 'oklch(var(--er))';
    if (status === 'PENDENT') return past ? 'oklch(var(--er))' : 'oklch(var(--bc) / 0.2)';
    return 'oklch(var(--bc) / 0.2)';
  }

  getVarianceColor(z: number): string {
    const level = this.getVarianceLevel(z);
    if (level === 'success') return 'oklch(var(--su))';
    if (level === 'warning') return 'oklch(var(--wa))';
    if (level === 'error') return 'oklch(var(--er))';
    return 'oklch(var(--bc) / 0.4)';
  }

  getVarianceDisplay(z: number): string {
    const v = this.varianceByFloor().get(z);
    if (v == null) return '—';
    return `Δ ${v}cm`;
  }

  getVarianceLevel(z: number): VarianceLevel | null {
    const v = this.varianceByFloor().get(z);
    if (v == null) return null;
    return varianceLevel(v);
  }

  getVarianceAriaLabel(z: number): string {
    const v = this.varianceByFloor().get(z);
    if (v == null) return 'Variança no disponible';
    return `Variança d'alçada: ${v} centímetres`;
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

  onDirectionNodeClick(node: TroncNodeItem, event: MouseEvent): void {
    this.nodeSelected.emit(node.id);
    if (this.isAssigned(node.id)) {
      this.nodeClicked.emit({ nodeId: node.id, event });
    }
  }

  onRemoveDirection(nodeId: string): void {
    this.directionRemoved.emit(nodeId);
  }

  getNodeAriaLabel(node: TroncNodeItem): string {
    const assignment = this.getAssignment(node.id);
    if (!assignment) return `Node ${node.label}, sense assignar`;
    const height = this.getHeightDisplay(assignment.person.shoulderHeight);
    return `${node.label}: ${assignment.person.alias}, alçada ${height}`;
  }

  /** CSS grid-column for a TRONC node (doubled grid: 0.5u = 1 column). */
  getTroncNodeGridColumn(node: TroncNodeItem): string {
    const start = Math.round(node.x * 2) + 1;
    const span = Math.round(node.width * 2);
    return `${start} / span ${span}`;
  }

  /** CSS grid-column for a BASE node by its sorted index (each base = 2 half-cols). */
  getBaseNodeGridColumn(index: number): string {
    return `${index * 2 + 1} / span 2`;
  }

  gridTemplateColumns(): string {
    const halfCols = this.totalColumns();
    const realCols = halfCols / 2;
    const minSize = realCols > 7 ? '1.5rem' : realCols > 4 ? '2rem' : '2.5rem';
    // Add 2 extra half-columns (= 1 real column) for the add-node button
    return `repeat(${halfCols}, minmax(${minSize}, 1fr)) 2.5rem`;
  }

  /** Grid column for the add-node button (always in the extra column at the end). */
  getAddNodeButtonGridColumn(): string {
    const halfCols = this.totalColumns();
    return `${halfCols + 1} / span 2`;
  }

  getNodeColor(node: TroncNodeItem): string | null {
    return node.color ?? null;
  }

  getDirectionColor(zone: string): string {
    return zone === FigureZone.FIGURE_DIRECTION ? '#d97706' : '#db2777';
  }

  getDirectionLabel(zone: string): string {
    return zone === FigureZone.FIGURE_DIRECTION ? 'Dir.' : 'Xic.';
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

  private getDominantPositionType(nodes: TroncNodeItem[]): string {
    const counts = new Map<string, number>();
    for (const node of nodes) {
      const label = node.label || node.positionType || 'desconegut';
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    let dominant = 'desconegut';
    let maxCount = 0;
    for (const [label, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        dominant = label;
      }
    }
    return dominant;
  }
}
