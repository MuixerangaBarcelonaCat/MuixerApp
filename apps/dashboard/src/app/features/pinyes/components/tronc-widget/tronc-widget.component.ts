import {
  Component,
  ChangeDetectionStrategy,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { FigureNodeItem } from '../../models/figure-template.model';

interface FloorOption {
  label: string;
  positionType: string;
}

interface TroncFloor {
  z: number;
  pisLabel: string;
  nodes: FigureNodeItem[];
}

// z=0 is reserved for BASE nodes. Tronc floors start at z=1.
// MAX_FLOORS counts the total figure floors including z=0 (base).
const MAX_FLOORS = 6;

// Options available when adding the next sequential tronc floor.
// Keys are z values (starting at 1). z=1 (Segon) up to z=5 (Alçadora/Xiqueta only).
const FLOOR_OPTIONS: Record<number, FloorOption[]> = {
  1: [
    { label: 'Segon',    positionType: 'segon' },
    { label: 'Alçadora', positionType: 'alcadora' },
    { label: 'Xiqueta',  positionType: 'xiqueta' },
  ],
  2: [
    { label: 'Terç',     positionType: 'terç' },
    { label: 'Alçadora', positionType: 'alcadora' },
    { label: 'Xiqueta',  positionType: 'xiqueta' },
  ],
  3: [
    { label: 'Quart',    positionType: 'quart' },
    { label: 'Alçadora', positionType: 'alcadora' },
    { label: 'Xiqueta',  positionType: 'xiqueta' },
  ],
  4: [
    { label: 'Quint',    positionType: 'quint' },
    { label: 'Alçadora', positionType: 'alcadora' },
    { label: 'Xiqueta',  positionType: 'xiqueta' },
  ],
  5: [
    { label: 'Alçadora', positionType: 'alcadora' },
    { label: 'Xiqueta',  positionType: 'xiqueta' },
  ],
};

@Component({
  selector: 'app-tronc-widget',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  templateUrl: './tronc-widget.component.html',
  styleUrl: './tronc-widget.component.scss',
})
export class TroncWidgetComponent {
  readonly troncNodes    = input<FigureNodeItem[]>([]);
  readonly baseNodes     = input<FigureNodeItem[]>([]);
  readonly mode          = input<'editor' | 'readonly'>('editor');
  readonly selectedNodeId = input<string | null>(null);

  readonly nodeAdded    = output<{ z: number; positionType: string; label: string; sortOrder: number }>();
  readonly nodeRemoved  = output<string>();
  readonly floorRemoved = output<number>();
  readonly nodeSelected = output<string | null>();
  readonly baseAdded    = output<{ sortOrder: number }>();
  readonly baseRemoved  = output<string>();

  readonly expanded  = signal(false);
  readonly viewMode  = signal<'tower' | 'list'>('tower');
  readonly sortAscending = signal(false);
  readonly addMenuOpen = signal(false);

  readonly floors = computed<TroncFloor[]>(() => {
    const nodes = this.troncNodes();
    const byZ = new Map<number, FigureNodeItem[]>();

    for (const node of nodes) {
      if (!byZ.has(node.z)) byZ.set(node.z, []);
      byZ.get(node.z)!.push(node);
    }

    // Sort nodes within each floor by sortOrder
    for (const [, floorNodes] of byZ) {
      floorNodes.sort((a, b) => a.sortOrder - b.sortOrder);
    }

    const floors: TroncFloor[] = Array.from(byZ.entries()).map(([z, floorNodes]) => ({
      z,
      pisLabel: `P${z + 1}`,
      nodes: floorNodes,
    }));

    // Sort floors: ascending (P1 first) or descending (top floor first)
    floors.sort((a, b) => this.sortAscending() ? a.z - b.z : b.z - a.z);
    return floors;
  });

  readonly floorCount = computed(() => this.floors().length);

  readonly basesCount = computed(() => this.baseNodes().length);

  // maxZ for tronc floors only (z >= 1). Returns 0 when no tronc floors so nextZ starts at 1.
  readonly maxZ = computed(() => {
    const nodes = this.troncNodes();
    if (nodes.length === 0) return 0;
    return Math.max(...nodes.map((n) => n.z));
  });

  readonly pillLabel = computed(() => {
    const bases = this.basesCount();
    const floors = this.floorCount();
    const totalFloors = bases > 0 ? floors + 1 : floors;
    return totalFloors === 0 ? 'sense pisos' : `${totalFloors} ${totalFloors === 1 ? 'pis' : 'pisos'}`;
  });

  // nextZ for tronc: starts at 1 (z=0 is reserved for BASE)
  readonly nextZ = computed(() => Math.max(1, this.maxZ() + 1));
  // Total floors including base (z=0). MAX_FLOORS = 6 means z=0..5
  readonly canAddFloor = computed(() => this.nextZ() < MAX_FLOORS);
  readonly nextFloorOptions = computed(() => FLOOR_OPTIONS[this.nextZ()] ?? []);

  toggle(): void {
    this.expanded.update((v) => !v);
    if (this.expanded()) this.addMenuOpen.set(false);
  }

  close(): void {
    this.expanded.set(false);
    this.addMenuOpen.set(false);
  }

  setViewMode(mode: 'tower' | 'list'): void {
    this.viewMode.set(mode);
  }

  toggleSortDirection(): void {
    this.sortAscending.update((v) => !v);
  }

  toggleAddMenu(): void {
    this.addMenuOpen.update((v) => !v);
  }

  selectNode(id: string): void {
    this.nodeSelected.emit(id);
  }

  addFloorNode(option: FloorOption): void {
    const z = this.nextZ();
    const existingAtZ = this.troncNodes().filter((n) => n.z === z);
    const sortOrder = existingAtZ.length;
    this.nodeAdded.emit({ z, positionType: option.positionType, label: option.label, sortOrder });
    this.addMenuOpen.set(false);
  }

  removeNode(id: string): void {
    this.nodeRemoved.emit(id);
  }

  removeFloor(z: number): void {
    this.floorRemoved.emit(z);
  }

  addNodeToFloor(floor: TroncFloor): void {
    const ref = floor.nodes[0];
    const positionType = ref?.positionType ?? 'segon';
    const label = ref?.label ?? 'Pos';
    this.nodeAdded.emit({ z: floor.z, positionType, label, sortOrder: floor.nodes.length });
  }

  removeLastNodeFromFloor(floor: TroncFloor): void {
    if (floor.nodes.length === 0) return;
    const last = floor.nodes[floor.nodes.length - 1];
    this.nodeRemoved.emit(last.id);
  }

  addBase(): void {
    const sortOrder = this.baseNodes().length;
    this.baseAdded.emit({ sortOrder });
  }

  removeLastBase(): void {
    const bases = this.baseNodes();
    if (bases.length === 0) return;
    const last = bases[bases.length - 1];
    this.baseRemoved.emit(last.id);
  }

  removeBase(id: string): void {
    this.baseRemoved.emit(id);
  }

  isSelected(id: string): boolean {
    return this.selectedNodeId() === id;
  }

}
