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

interface FloorPreset {
  label: string;
  positionType: string;
  fixedZ: number | null;
}

interface TroncFloor {
  z: number;
  pisLabel: string;
  nodes: FigureNodeItem[];
}

const FLOOR_PRESETS: FloorPreset[] = [
  { label: 'Baix',     positionType: 'baix',     fixedZ: 0 },
  { label: 'Segon',    positionType: 'segon',    fixedZ: 1 },
  { label: 'Terç',     positionType: 'terç',     fixedZ: 2 },
  { label: 'Quart',    positionType: 'quart',    fixedZ: 3 },
  { label: 'Alçadora', positionType: 'alcadora', fixedZ: null },
  { label: 'Xiqueta',  positionType: 'xiqueta',  fixedZ: null },
];

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
  readonly mode          = input<'editor' | 'readonly'>('editor');
  readonly selectedNodeId = input<string | null>(null);

  readonly nodeAdded    = output<{ z: number; positionType: string; label: string; sortOrder: number }>();
  readonly nodeRemoved  = output<string>();
  readonly floorRemoved = output<number>();
  readonly nodeUpdated  = output<{ id: string; patch: Partial<FigureNodeItem> }>();
  readonly nodeSelected = output<string | null>();

  readonly expanded  = signal(false);
  readonly viewMode  = signal<'tower' | 'list'>('tower');
  readonly sortAscending = signal(false);
  readonly addMenuOpen = signal(false);

  readonly floorPresets = FLOOR_PRESETS;

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

  readonly maxZ = computed(() => {
    const nodes = this.troncNodes();
    if (nodes.length === 0) return -1;
    return Math.max(...nodes.map((n) => n.z));
  });

  readonly pillLabel = computed(() => {
    const count = this.floorCount();
    return count === 0 ? 'sense pisos' : `${count} ${count === 1 ? 'pis' : 'pisos'}`;
  });

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

  addFloorNode(preset: FloorPreset): void {
    const z = preset.fixedZ !== null ? preset.fixedZ : this.maxZ() + 1;
    const existingAtZ = this.troncNodes().filter((n) => n.z === z);
    const sortOrder = existingAtZ.length;
    this.nodeAdded.emit({ z, positionType: preset.positionType, label: preset.label, sortOrder });
    this.addMenuOpen.set(false);
  }

  removeNode(id: string): void {
    this.nodeRemoved.emit(id);
  }

  removeFloor(z: number): void {
    this.floorRemoved.emit(z);
  }

  toggleClimbPath(node: FigureNodeItem, marker: string): void {
    const current = node.climbPath;
    const next = current === marker ? null : marker;
    this.nodeUpdated.emit({ id: node.id, patch: { climbPath: next } });
  }

  climbPathMarker(positionType: string | null): string | null {
    if (positionType === 'alcadora') return '(A)';
    if (positionType === 'xiqueta') return '(X)';
    return null;
  }

  isSelected(id: string): boolean {
    return this.selectedNodeId() === id;
  }

}
