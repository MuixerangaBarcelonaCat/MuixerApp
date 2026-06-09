import {
  Component,
  ChangeDetectionStrategy,
  computed,
  input,
  output,
  signal,
  HostListener,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { FigureNodeItem, RenglaItem } from '../../models/figure-template.model';
import { FigureZone } from '@muixer/shared';
import { StageTransform, stageToScreen, isCentralNode } from '../../utils/rengla-coordinates.util';
import { getRenglaColor } from '../../utils/rengla-colors';

export interface RenglaCreatedEvent {
  rengla: Omit<RenglaItem, 'id'>;
  nodeAssignments: { nodeId: string; renglaPosition: number }[];
}

export interface RenglaUpdatedEvent {
  rengla: RenglaItem;
}

export interface RenglaDeletedEvent {
  renglaId: string;
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
  imports: [FormsModule, LucideAngularModule],
  templateUrl: './rengla-overlay.component.html',
  host: { class: 'block absolute inset-0 pointer-events-none z-10' },
})
export class RenglaOverlayComponent {
  readonly nodes = input.required<FigureNodeItem[]>();
  readonly rengles = input.required<RenglaItem[]>();
  readonly stageTransform = input<StageTransform>({ x: 0, y: 0, scaleX: 1, scaleY: 1 });

  readonly renglaCreated = output<RenglaCreatedEvent>();
  readonly renglaUpdated = output<RenglaUpdatedEvent>();
  readonly renglaDeleted = output<RenglaDeletedEvent>();

  readonly creatingRengla = signal(false);
  readonly pendingNodeIds = signal<string[]>([]);
  readonly selectedRenglaId = signal<string | null>(null);
  readonly showMiniDialog = signal(false);

  readonly dialogName = signal('');
  readonly dialogStartPosition = signal(1);
  readonly dialogAllowsCordoObert = signal(false);

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
        color: getRenglaColor(idx),
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

  // -- Actions --

  startCreating(): void {
    this.creatingRengla.set(true);
    this.pendingNodeIds.set([]);
    this.selectedRenglaId.set(null);
  }

  onNodeClick(nodeId: string): void {
    if (this.showMiniDialog()) return;

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
    }
  }

  onRenglaLineClick(renglaId: string): void {
    if (this.creatingRengla()) return;
    this.selectedRenglaId.set(renglaId);
  }

  finishCreating(): void {
    const ids = this.pendingNodeIds();
    if (ids.length < 2) return;

    const firstNode = this.nodes().find((n) => n.id === ids[0]);
    const suggestedName = this.suggestName(firstNode?.positionType ?? null);
    this.dialogName.set(suggestedName);
    this.dialogStartPosition.set(1);
    this.dialogAllowsCordoObert.set(false);
    this.showMiniDialog.set(true);
  }

  confirmCreate(): void {
    const ids = this.pendingNodeIds();
    if (ids.length < 2) return;

    this.renglaCreated.emit({
      rengla: {
        name: this.dialogName().trim() || 'Rengla',
        sortOrder: this.rengles().length,
        startPosition: this.dialogStartPosition(),
        allowsCordoObert: this.dialogAllowsCordoObert(),
      },
      nodeAssignments: ids.map((nodeId, i) => ({
        nodeId,
        renglaPosition: i + 1,
      })),
    });

    this.cancelCreate();
  }

  cancelCreate(): void {
    this.creatingRengla.set(false);
    this.pendingNodeIds.set([]);
    this.showMiniDialog.set(false);
  }

  editSelectedRengla(): void {
    const r = this.selectedRengla();
    if (!r) return;
    this.dialogName.set(r.name);
    this.dialogStartPosition.set(r.startPosition);
    this.dialogAllowsCordoObert.set(r.allowsCordoObert);
    this.showMiniDialog.set(true);
  }

  confirmEdit(): void {
    const r = this.selectedRengla();
    if (!r) return;

    this.renglaUpdated.emit({
      rengla: {
        ...r,
        name: this.dialogName().trim() || r.name,
        startPosition: this.dialogStartPosition(),
        allowsCordoObert: this.dialogAllowsCordoObert(),
      },
    });

    this.showMiniDialog.set(false);
    this.selectedRenglaId.set(null);
  }

  deleteSelectedRengla(): void {
    const id = this.selectedRenglaId();
    if (!id) return;
    this.renglaDeleted.emit({ renglaId: id });
    this.selectedRenglaId.set(null);
    this.showMiniDialog.set(false);
  }

  cancelDialog(): void {
    this.showMiniDialog.set(false);
    if (this.creatingRengla()) {
      this.cancelCreate();
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (this.showMiniDialog()) {
        this.cancelDialog();
      } else if (this.creatingRengla()) {
        this.cancelCreate();
      } else if (this.selectedRenglaId()) {
        this.selectedRenglaId.set(null);
      }
      return;
    }

    if (event.key === 'Enter' && this.creatingRengla() && !this.showMiniDialog()) {
      event.preventDefault();
      this.finishCreating();
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

  private suggestName(positionType: string | null): string {
    if (!positionType) return 'Rengla';
    const existing = this.rengles().filter((r) =>
      r.name.toLowerCase().startsWith(positionType.toUpperCase()),
    ).length;
    const label = positionType.toUpperCase();
    return existing > 0 ? `${label} ${existing + 1}` : label;
  }
}
