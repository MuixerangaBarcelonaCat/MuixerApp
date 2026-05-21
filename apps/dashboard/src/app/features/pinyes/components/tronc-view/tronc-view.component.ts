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

// Available floor types per next z level. Keys are the nextZ value.
const FLOOR_OPTIONS: Record<number, FloorOption[]> = {
  1: [
    { z: 1, label: 'Segon/Segona', positionType: 'segon' },
    { z: 1, label: 'Alçadora',     positionType: 'alcadora' },
    { z: 1, label: 'Xiqueta',      positionType: 'xiqueta' },
  ],
  2: [
    { z: 2, label: 'Terç/Terça', positionType: 'terç' },
    { z: 2, label: 'Alçadora',   positionType: 'alcadora' },
    { z: 2, label: 'Xiqueta',    positionType: 'xiqueta' },
  ],
  3: [
    { z: 3, label: 'Quart/Quarta', positionType: 'quart' },
    { z: 3, label: 'Alçadora',     positionType: 'alcadora' },
    { z: 3, label: 'Xiqueta',      positionType: 'xiqueta' },
  ],
  4: [
    { z: 4, label: 'Quint/Quinta', positionType: 'quint' },
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
  readonly mode = input<'editor' | 'assignment'>('assignment');
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
   * Total grid columns = max between:
   * - TRONC: max(x + width) across all tronc nodes
   * - BASE: count of base nodes (each occupies 1 column by index)
   */
  readonly totalColumns = computed(() => {
    const troncMax = this.troncNodes().reduce(
      (max, n) => Math.max(max, n.x + n.width),
      0,
    );
    const baseCount = this.sortedBases().length;
    return Math.max(troncMax, baseCount, 1);
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

    const allFloors = [...troncFloors, baseFloor].sort((a, b) =>
      this.inverted() ? a.z - b.z : b.z - a.z,
    );

    return allFloors;
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

  readonly maxTroncZ = computed(() =>
    this.troncNodes().reduce((max, n) => Math.max(max, n.z), 0),
  );

  readonly nextFloorOptions = computed<FloorOption[]>(() => {
    const nextZ = this.maxTroncZ() + 1;
    if (nextZ > MAX_TRONC_Z) return [];
    return FLOOR_OPTIONS[nextZ] ?? [];
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
    this.nodeUpdated.emit({ nodeId: node.id, x: Math.max(0, Math.floor(value)), width: node.width });
  }

  onNodeWidthChange(node: TroncNodeItem, value: number): void {
    const clamped = Math.max(1, Math.min(4, Math.floor(value)));
    this.nodeUpdated.emit({ nodeId: node.id, x: node.x, width: clamped });
  }

  onNodeDelete(node: TroncNodeItem): void {
    this.nodeRemoved.emit(node.id);
  }

  onAddFloor(): void {
    const options = this.nextFloorOptions();
    const typeKey = this.selectedFloorType();
    const option =
      options.find((o) => o.positionType === typeKey) ?? options[0];
    if (!option) return;

    const existingAtZ = this.troncNodes().filter((n) => n.z === option.z);
    this.nodeAdded.emit({
      z: option.z,
      positionType: option.positionType,
      label: option.label,
      sortOrder: existingAtZ.length,
    });
    this.selectedFloorType.set('');
  }

  onAddNodeToFloor(floor: TroncFloor): void {
    const nextX = floor.nodes.reduce((max, n) => Math.max(max, n.x + n.width), 0);
    this.nodeAdded.emit({
      z: floor.z,
      positionType: floor.positionTypeLabel,
      label: `${floor.positionTypeLabel} ${floor.nodes.length + 1}`,
      sortOrder: floor.nodes.length,
    });
    // Also emit nodeUpdated immediately with correct x so parent can set it
    // (parent creates node at x:0; a separate nodeUpdated would be redundant since
    // parent's onTroncNodeAdded sets x:0 by default — user adjusts in the panel)
    void nextX; // x positioning is handled via the x input after creation
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

  getAttendanceCss(assignment: AssignmentDetail): string {
    const status = this.getAttendanceStatus(assignment);
    if (status === 'ANIRE' || status === 'ASSISTIT') return 'bg-success';
    if (status === 'NO_VAIG' || status === 'NO_PRESENTAT') return 'bg-error';
    return 'bg-base-300';
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

  /** CSS grid-column value for a TRONC node. */
  getTroncNodeGridColumn(node: TroncNodeItem): string {
    return `${node.x + 1} / span ${node.width}`;
  }

  /** CSS grid-column value for a BASE node by its sorted index. */
  getBaseNodeGridColumn(index: number): string {
    return `${index + 1} / span 1`;
  }

  gridTemplateColumns(): string {
    const cols = this.totalColumns();
    // Drawer is 480px → content ~440px. Aim for ≥60px per col when ≤7 cols.
    const minSize = cols > 7 ? '3rem' : cols > 4 ? '4rem' : '5rem';
    return `repeat(${cols}, minmax(${minSize}, 1fr))`;
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
