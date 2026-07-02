import {
  Component,
  ChangeDetectionStrategy,
  computed,
  input,
  output,
  signal,
  HostListener,
} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { FigureNodeItem, RenglaModel } from '../../models/figure-template.model';
import { FigureZone } from '@muixer/shared';
import { StageTransform, stageToScreen, isCentralNode } from '../../utils/rengla-coordinates.util';
import { getFigureColor } from '../../utils/figure-palette.util';

export interface RenglaCreatedEvent {
  rengla: Omit<RenglaModel, 'id'>;
  nodeAssignments: { nodeId: string; renglaPosition: number }[];
}

export interface RenglaDeletedEvent {
  renglaId: string;
}

export interface RenglaStartChangedEvent {
  renglaId: string;
  newStart: number;
}

interface ScreenNode {
  id: string;
  label: string;
  positionType: string | null;
  cx: number;
  cy: number;
  width: number;
  height: number;
  rotation: number;
  renglaId: string | null;
  renglaPosition: number | null;
}

@Component({
  selector: 'app-rengla-overlay',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  templateUrl: './rengla-overlay.component.html',
  host: { class: 'block absolute inset-0 pointer-events-none z-10' },
})
export class RenglaOverlayComponent {
  readonly nodes = input.required<FigureNodeItem[]>();
  readonly rengles = input.required<RenglaModel[]>();
  readonly stageTransform = input<StageTransform>({ x: 0, y: 0, scaleX: 1, scaleY: 1 });

  readonly renglaCreated = output<RenglaCreatedEvent>();
  readonly renglaDeleted = output<RenglaDeletedEvent>();
  readonly renglaStartChanged = output<RenglaStartChangedEvent>();

  readonly creatingRengla = signal(false);
  readonly pendingNodeIds = signal<string[]>([]);
  readonly selectedRenglaId = signal<string | null>(null);
  readonly startPosition = signal(1);

  /** PINYA nodes eligible for rengla assignment (excludes central nodes) */
  readonly eligibleNodes = computed(() =>
    this.nodes().filter(
      (n) => n.zone === FigureZone.PINYA && !isCentralNode(n.positionType),
    ),
  );

  /** All eligible nodes projected to screen coordinates */
  readonly screenNodes = computed<ScreenNode[]>(() => {
    const t = this.stageTransform();
    return this.eligibleNodes().map((n) => {
      const pos = stageToScreen(n.x, n.y, t);
      return {
        id: n.id,
        label: n.label,
        positionType: n.positionType,
        cx: pos.x,
        cy: pos.y,
        width: n.width * t.scaleX,
        height: n.height * t.scaleY,
        rotation: n.rotation,
        renglaId: n.renglaId,
        renglaPosition: n.renglaPosition,
      };
    });
  });

  /** Rengla lines: each rengla with its ordered screen-projected nodes */
  readonly renglaLines = computed(() => {
    const screenMap = new Map(this.screenNodes().map((n) => [n.id, n]));
    const allNodes = this.nodes();

    return this.rengles().map((r, idx) => {
      const rNodes = allNodes
        .filter((n) => n.renglaId === r.id)
        .sort((a, b) => (a.renglaPosition ?? 0) - (b.renglaPosition ?? 0));

      const points = rNodes
        .map((n) => screenMap.get(n.id))
        .filter((sn): sn is ScreenNode => !!sn);

      return {
        rengla: r,
        color: getFigureColor(idx),
        points,
      };
    });
  });

  /** Polyline points string for the in-progress rengla creation */
  readonly pendingLine = computed(() => {
    const ids = this.pendingNodeIds();
    if (ids.length < 2) return '';
    const screenMap = new Map(this.screenNodes().map((n) => [n.id, n]));
    return ids
      .map((id) => screenMap.get(id))
      .filter((sn): sn is ScreenNode => !!sn)
      .map((sn) => `${sn.cx},${sn.cy}`)
      .join(' ');
  });

  /** IDs of nodes that are already part of the pending creation sequence */
  readonly pendingNodeIdSet = computed(() => new Set(this.pendingNodeIds()));

  /** IDs of nodes that belong to ANY existing rengla */
  readonly assignedNodeIds = computed(() => {
    const set = new Set<string>();
    for (const n of this.nodes()) {
      if (n.renglaId) set.add(n.id);
    }
    return set;
  });

  readonly selectedRengla = computed(() => {
    const id = this.selectedRenglaId();
    return id ? (this.rengles().find((r) => r.id === id) ?? null) : null;
  });

  readonly selectedRenglaStartPosition = computed(() => {
    const id = this.selectedRenglaId();
    if (!id) return 1;
    const positions = this.nodes()
      .filter((n) => n.renglaId === id && n.renglaPosition !== null)
      .map((n) => n.renglaPosition as number);
    return positions.length > 0 ? Math.min(...positions) : 1;
  });

  // -- Actions --

  startCreating(): void {
    this.creatingRengla.set(true);
    this.pendingNodeIds.set([]);
    this.startPosition.set(1);
    this.selectedRenglaId.set(null);
  }

  onNodeClick(nodeId: string): void {
    if (this.creatingRengla()) {
      const ids = this.pendingNodeIds();
      if (ids.includes(nodeId)) {
        this.pendingNodeIds.set(ids.filter((id) => id !== nodeId));
      } else {
        this.pendingNodeIds.set([...ids, nodeId]);
      }
      return;
    }
    const node = this.nodes().find((n) => n.id === nodeId);
    if (node?.renglaId) {
      this.selectedRenglaId.set(node.renglaId);
    } else {
      // Auto-start creation when the user taps an unassigned eligible node
      this.startCreating();
      this.pendingNodeIds.set([nodeId]);
    }
  }

  onRenglaLineClick(renglaId: string): void {
    if (this.creatingRengla()) return;
    this.selectedRenglaId.set(renglaId);
  }

  finishCreating(): void {
    const ids = this.pendingNodeIds();
    if (ids.length < 1) return;
    const start = this.startPosition();

    this.renglaCreated.emit({
      rengla: {
        name: `Rengla ${this.rengles().length + 1}`,
        sortOrder: this.rengles().length,
      },
      nodeAssignments: ids.map((nodeId, i) => ({
        nodeId,
        renglaPosition: start + i,
      })),
    });

    this.cancelCreate();
  }

  cancelCreate(): void {
    this.creatingRengla.set(false);
    this.pendingNodeIds.set([]);
    this.startPosition.set(1);
  }

  onStartPositionChange(event: Event): void {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    if (!isNaN(value) && value >= 1) {
      this.startPosition.set(value);
    }
  }

  onSelectedStartPositionChange(event: Event): void {
    const id = this.selectedRenglaId();
    if (!id) return;
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    if (isNaN(value) || value < 1) return;
    this.renglaStartChanged.emit({ renglaId: id, newStart: value });
  }

  deleteSelectedRengla(): void {
    const id = this.selectedRenglaId();
    if (!id) return;
    this.renglaDeleted.emit({ renglaId: id });
    this.selectedRenglaId.set(null);
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (this.creatingRengla()) {
        this.cancelCreate();
      } else if (this.selectedRenglaId()) {
        this.selectedRenglaId.set(null);
      }
      return;
    }
    if (event.key === 'Enter' && this.creatingRengla()) {
      event.preventDefault();
      this.finishCreating();
      return;
    }
    if ((event.key === 'Delete' || event.key === 'Backspace') && this.selectedRenglaId()) {
      event.preventDefault();
      this.deleteSelectedRengla();
    }
  }

  isNodePending(nodeId: string): boolean {
    return this.pendingNodeIdSet().has(nodeId);
  }

  getPendingIndex(nodeId: string): number {
    return this.pendingNodeIds().indexOf(nodeId);
  }

  toPolylinePoints(points: ScreenNode[]): string {
    return points.map((p) => `${p.cx},${p.cy}`).join(' ');
  }

  screenNodeById(nodeId: string): ScreenNode | undefined {
    return this.screenNodes().find((sn) => sn.id === nodeId);
  }
}
