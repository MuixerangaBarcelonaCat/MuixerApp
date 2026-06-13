import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { AssignmentDetail, AttendanceStatus, HeightMode } from '../../models/assignment.model';
import { floorVariance, varianceLevel, VarianceLevel } from '../../utils/floor-variance.util';

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
}

interface TroncFloor {
  z: number;
  pisLabel: string;
  positionTypeLabel: string;
  nodes: TroncNodeItem[];
  isBase: boolean;
}

interface FloorOption {
  z: number;
  label: string;
  positionType: string;
}

const HEIGHT_BASELINE = 140;

const FLOOR_LABELS: Record<number, FloorOption[]> = {
  1: [
    { z: 1, label: 'Segona', positionType: 'segon' },
    { z: 1, label: 'Alçadora',     positionType: 'alcadora' },
    { z: 1, label: 'Xiqueta',      positionType: 'xiqueta' },
  ],
  2: [
    { z: 2, label: 'Terça', positionType: 'terç' },
    { z: 2, label: 'Alçadora',   positionType: 'alcadora' },
    { z: 2, label: 'Xiqueta',    positionType: 'xiqueta' },
  ],
  3: [
    { z: 3, label: 'Quarta', positionType: 'quart' },
    { z: 3, label: 'Alçadora',     positionType: 'alcadora' },
    { z: 3, label: 'Xiqueta',      positionType: 'xiqueta' },
  ],
  4: [
    { z: 4, label: 'Quinta', positionType: 'quint' },
    { z: 4, label: 'Alçadora',     positionType: 'alcadora' },
    { z: 4, label: 'Xiqueta',      positionType: 'xiqueta' },
  ],
  5: [
    { z: 5, label: 'Alçadora', positionType: 'alcadora' },
    { z: 5, label: 'Xiqueta',  positionType: 'xiqueta' },
  ],
};

const MAX_TRONC_Z = 5;

@Component({
  selector: 'app-tronc-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule],
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

  // ── Outputs ────────────────────────────────────────────────────────────────

  /** Emits the clicked node id. Emits null when deselecting. */
  readonly nodeSelected = output<string | null>();

  /** Emits for popover positioning (assigned node clicked). */
  readonly nodeClicked = output<{ nodeId: string; event: MouseEvent }>();

  /** Editor only: position/width changed for a TRONC node. */
  readonly nodeUpdated = output<{ nodeId: string; x: number; width: number }>();

  /** Editor only: create a new TRONC node on the given floor. */
  readonly nodeAdded = output<{ z: number; positionType: string; label: string; sortOrder: number }>();

  /** Editor only: delete a TRONC node by id. */
  readonly nodeRemoved = output<string>();

  /** Editor only: request creating a new BASE node. */
  readonly baseAdded = output<{ sortOrder: number }>();

  /** Editor only: delete a BASE node by id. */
  readonly baseRemoved = output<string>();

  // ── Local state ────────────────────────────────────────────────────────────

  /** Flip floor order: P1 at top instead of at bottom. */
  readonly inverted = signal(false);

  /** Selected floor option type for the "Afegir pis" dropdown. */
  readonly selectedFloorType = signal<string>('');

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

    const baseFloor: TroncFloor = {
      z: 0,
      pisLabel: 'P1',
      positionTypeLabel: 'Bases',
      nodes: this.sortedBases(),
      isBase: true,
    };

    return [...troncFloors, baseFloor].sort((a, b) => b.z - a.z);
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

  /** Floor options for all z levels that don't yet have any nodes. */
  readonly availableFloorOptions = computed<FloorOption[]>(() => {
    const existing = this.existingZLevels();
    const options: FloorOption[] = [];
    for (let z = 1; z <= MAX_TRONC_Z; z++) {
      if (!existing.has(z)) {
        const zOptions = FLOOR_LABELS[z];
        if (zOptions) options.push(...zOptions);
        break;
      }
    }
    return options;
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

  onNodeXChange(node: TroncNodeItem, value: number): void {
    const rounded = Math.round(Math.max(0, Math.min(8, value)) * 2) / 2;
    this.nodeUpdated.emit({ nodeId: node.id, x: rounded, width: node.width });
  }

  onNodeWidthChange(node: TroncNodeItem, value: number): void {
    const rounded = Math.round(Math.max(0.5, Math.min(8, value)) * 2) / 2;
    this.nodeUpdated.emit({ nodeId: node.id, x: node.x, width: rounded });
  }

  onNodeDelete(node: TroncNodeItem): void {
    this.nodeRemoved.emit(node.id);
  }

  onAddFloor(): void {
    const options = this.availableFloorOptions();
    const typeKey = this.selectedFloorType();
    const option =
      options.find((o) => `${o.z}-${o.positionType}` === typeKey) ?? options[0];
    if (!option) return;

    this.nodeAdded.emit({
      z: option.z,
      positionType: option.positionType,
      label: option.label,
      sortOrder: 0,
    });
    this.selectedFloorType.set('');
  }

  onAddNodeToFloor(floor: TroncFloor): void {
    const floorLabel = this.getFloorDisplayLabel(floor.z, floor.positionTypeLabel);
    this.nodeAdded.emit({
      z: floor.z,
      positionType: floor.positionTypeLabel,
      label: floorLabel,
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
    if (shoulderHeight == null) return '';
    if (this.heightMode() === 'absolute') return `${shoulderHeight}`;
    const diff = shoulderHeight - HEIGHT_BASELINE;
    return diff >= 0 ? `+${diff}` : `${diff}`;
  }

  getAttendanceStatus(assignment: AssignmentDetail): AttendanceStatus | null {
    const personId = assignment.person.id;
    return this.attendanceMap().get(personId) ?? null;
  }

  getAttendanceColor(assignment: AssignmentDetail): string {
    const status = this.getAttendanceStatus(assignment);
    if (status === 'ANIRE' || status === 'ASSISTIT') return 'oklch(var(--su))';
    if (status === 'NO_VAIG' || status === 'NO_PRESENTAT') return 'oklch(var(--er))';
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

  /** Canonical display label for a floor level and position type. */
  private getFloorDisplayLabel(z: number, positionType: string): string {
    const options = FLOOR_LABELS[z];
    if (!options) return positionType;
    return options.find((o) => o.positionType === positionType)?.label ?? positionType;
  }

  private getDominantPositionType(nodes: TroncNodeItem[]): string {
    const counts = new Map<string, number>();
    for (const node of nodes) {
      const pt = node.positionType ?? 'desconegut';
      counts.set(pt, (counts.get(pt) ?? 0) + 1);
    }
    let dominant = 'desconegut';
    let maxCount = 0;
    for (const [type, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        dominant = type;
      }
    }
    return dominant;
  }
}
