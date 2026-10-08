import { ChangeDetectionStrategy, Component, ElementRef, computed, input, output, signal, viewChild } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { AlertComponent, EmptyStateComponent, THEME_NAMES } from '@muixer/ui';
import {
  baseNodeGridColumn,
  FigureNodeItem,
  layoutTroncFloors,
  troncNodeGridColumn,
  troncTotalColumns,
} from '@muixer/pinyes-render';
import { FigureZone, isValidStandsOnTarget, TRONC_NODE_PRESETS } from '@muixer/shared';
import { SupportLink } from './tronc-support-editor.model';

/** Height of a floor row. Fixed, so line endpoints can be computed instead of measured. */
export const ROW_HEIGHT_REM = 2.75;
/** Vertical room between floors, where the links are drawn. */
export const FLOOR_GAP_REM = 2.5;

/** Minimum pointer travel (px) before a press on a handle becomes a drag rather than a click. */
const DRAG_THRESHOLD_PX = 6;

/**
 * A link ready to draw. Coordinates are in the board's SVG space: `x` in percent of the board
 * width (the grid has no column gap, so a node's centre is exactly its columns' centre) and `y`
 * in rem from the top of the board.
 */
export interface DrawnLink extends SupportLink {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface PendingDrag {
  nodeId: string;
  startX: number;
  startY: number;
}

/**
 * «Who stands on whom» editor for the template editor's Tronc tab: the tronc's floors laid out
 * like the tronc panel next to it, with a line from each TRONC node down to every node it stands
 * on. Links are drawn by dragging from a node's bottom handle onto a node of the floor directly
 * below, or by clicking the handle and then the node(s) below; clicking a line removes it.
 */
@Component({
  selector: 'app-tronc-support-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, AlertComponent, EmptyStateComponent],
  host: {
    '[attr.data-theme]': 'pinnedTheme',
    '(document:keydown.escape)': 'cancelConnect()',
  },
  templateUrl: './tronc-support-editor.component.html',
  styleUrl: './tronc-support-editor.component.scss',
})
export class TroncSupportEditorComponent {
  /** Pinned light, like the tronc panel it sits next to (figure rendering, see DESIGN_SYSTEM.md). */
  protected readonly pinnedTheme = THEME_NAMES.light;
  protected readonly ROW_HEIGHT_REM = ROW_HEIGHT_REM;

  readonly troncNodes = input<FigureNodeItem[]>([]);
  readonly baseNodes = input<FigureNodeItem[]>([]);
  readonly selectedNodeId = input<string | null>(null);

  readonly linkAdded = output<SupportLink>();
  readonly linkRemoved = output<SupportLink>();
  readonly nodeSelected = output<string>();

  /** The TRONC node whose links are being drawn (by drag or click-click), if any. */
  readonly connectFrom = signal<string | null>(null);
  /** Pointer position during a drag, in board coordinates. */
  private readonly dragPointer = signal<{ x: number; y: number } | null>(null);
  private pendingDrag: PendingDrag | null = null;
  private swallowNextHandleClick = false;

  private readonly board = viewChild<ElementRef<HTMLElement>>('board');

  readonly hasTronc = computed(() => this.troncNodes().length > 0);

  readonly floors = computed(() =>
    layoutTroncFloors(this.troncNodes(), this.baseNodes(), { fillGaps: true }),
  );

  private readonly totalColumns = computed(() =>
    troncTotalColumns(this.troncNodes(), this.baseNodes().length),
  );

  readonly gridTemplateColumns = computed(() => `repeat(${this.totalColumns()}, minmax(0, 1fr))`);

  readonly boardHeight = computed(() => {
    const rows = this.floors().length;
    return rows * ROW_HEIGHT_REM + Math.max(0, rows - 1) * FLOOR_GAP_REM;
  });

  private readonly nodesById = computed(
    () => new Map([...this.troncNodes(), ...this.baseNodes()].map((n) => [n.id, n])),
  );

  /** Each node's centre x (percent) and row top y (rem). */
  private readonly anchors = computed(() => {
    const anchors = new Map<string, { x: number; top: number }>();
    const cols = this.totalColumns();
    this.floors().forEach((floor, row) => {
      const top = row * (ROW_HEIGHT_REM + FLOOR_GAP_REM);
      floor.nodes.forEach((node, index) => {
        const [start, span] = floor.isBase ? [index * 2, 2] : [Math.round(node.x * 2), Math.round(node.width * 2)];
        anchors.set(node.id, { x: ((start + span / 2) / cols) * 100, top });
      });
    });
    return anchors;
  });

  /** Floors (by z) whose floor below has nothing to stand on. */
  private readonly unsupportedFloors = computed(() => {
    const populated = new Set(this.floors().filter((f) => f.nodes.length > 0).map((f) => f.z));
    return new Set(
      [...populated].filter((z) => z >= 1 && !populated.has(z - 1)),
    );
  });

  readonly gapNotices = computed(() =>
    [...this.unsupportedFloors()]
      .sort((a, b) => a - b)
      .map((z) =>
        z === 1
          ? 'No hi ha bases: afegiu-ne per a indicar damunt de qui va el P2.'
          : `El P${z} està buit: afegiu-hi nodes per a indicar damunt de qui va el P${z + 1}.`,
      ),
  );

  readonly links = computed<DrawnLink[]>(() => {
    const byId = this.nodesById();
    const anchors = this.anchors();
    return this.troncNodes().flatMap((upper) =>
      upper.standsOnNodeIds.flatMap((lowerId) => {
        const lower = byId.get(lowerId);
        const from = anchors.get(upper.id);
        const to = anchors.get(lowerId);
        if (!lower || !from || !to || !isValidStandsOnTarget(upper, lower)) return [];
        return [{ upperId: upper.id, lowerId, x1: from.x, y1: from.top + ROW_HEIGHT_REM, x2: to.x, y2: to.top }];
      }),
    );
  });

  readonly rubberBand = computed(() => {
    const pointer = this.dragPointer();
    const from = this.connectFrom();
    const anchor = from ? this.anchors().get(from) : undefined;
    if (!pointer || !anchor) return null;
    return { x1: anchor.x, y1: anchor.top + ROW_HEIGHT_REM, x2: pointer.x, y2: pointer.y };
  });

  readonly connectStatus = computed(() => {
    const from = this.connectFrom();
    const label = from ? this.nodesById().get(from)?.label : null;
    return label ? `Trieu qui té davall ${label}. Premeu Esc per a cancel·lar.` : '';
  });

  // ── Template helpers ───────────────────────────────────────────────────────

  troncColumn(node: FigureNodeItem): string {
    return troncNodeGridColumn(node);
  }

  baseColumn(index: number): string {
    return baseNodeGridColumn(index);
  }

  rowTop(row: number): number {
    return row * (ROW_HEIGHT_REM + FLOOR_GAP_REM);
  }

  nodeColor(node: FigureNodeItem): string | null {
    if (node.zone !== FigureZone.TRONC) return null;
    return node.color ?? TRONC_NODE_PRESETS.find((p) => p.positionType === node.positionType)?.color ?? null;
  }

  handleDisabled(node: FigureNodeItem): boolean {
    return this.unsupportedFloors().has(node.z);
  }

  isSelected(node: FigureNodeItem): boolean {
    return this.selectedNodeId() === node.id;
  }

  isSource(node: FigureNodeItem): boolean {
    return this.connectFrom() === node.id;
  }

  isTarget(node: FigureNodeItem): boolean {
    const source = this.sourceNode();
    return !!source && isValidStandsOnTarget(source, node);
  }

  isDimmed(node: FigureNodeItem): boolean {
    return !!this.connectFrom() && !this.isSource(node) && !this.isTarget(node);
  }

  isLinkActive(link: SupportLink): boolean {
    const highlighted = this.connectFrom() ?? this.selectedNodeId();
    return !!highlighted && (link.upperId === highlighted || link.lowerId === highlighted);
  }

  linkLabel(link: SupportLink): string {
    const byId = this.nodesById();
    return `Elimina l'enllaç: ${byId.get(link.upperId)?.label} damunt de ${byId.get(link.lowerId)?.label}`;
  }

  // ── Click-click connecting ─────────────────────────────────────────────────

  onHandleClick(node: FigureNodeItem, event: MouseEvent): void {
    event.stopPropagation();
    if (this.swallowNextHandleClick) {
      this.swallowNextHandleClick = false;
      return;
    }
    if (this.handleDisabled(node)) return;
    this.connectFrom.set(this.connectFrom() === node.id ? null : node.id);
  }

  onNodeClick(node: FigureNodeItem, event: MouseEvent): void {
    event.stopPropagation();
    const source = this.sourceNode();
    if (source && this.isTarget(node)) {
      this.addLink(source, node);
      return;
    }
    this.cancelConnect();
    this.nodeSelected.emit(node.id);
  }

  cancelConnect(): void {
    this.connectFrom.set(null);
    this.dragPointer.set(null);
    this.pendingDrag = null;
  }

  // ── Drag connecting ────────────────────────────────────────────────────────

  onHandlePointerDown(node: FigureNodeItem, event: PointerEvent): void {
    if (event.button !== 0 || this.handleDisabled(node)) return;
    event.stopPropagation();
    this.pendingDrag = { nodeId: node.id, startX: event.clientX, startY: event.clientY };
    (event.currentTarget as Element | null)?.setPointerCapture?.(event.pointerId);
  }

  onHandlePointerMove(event: PointerEvent): void {
    const pending = this.pendingDrag;
    if (!pending) return;
    if (!this.dragPointer()) {
      const moved = Math.hypot(event.clientX - pending.startX, event.clientY - pending.startY);
      if (moved < DRAG_THRESHOLD_PX) return;
      this.connectFrom.set(pending.nodeId);
    }
    this.dragPointer.set(this.toBoard(event));
  }

  onHandlePointerUp(event: PointerEvent): void {
    const pending = this.pendingDrag;
    this.pendingDrag = null;
    if (!pending || !this.dragPointer()) return;

    const source = this.sourceNode();
    const targetId = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-support-node-id]')?.dataset['supportNodeId'];
    const target = targetId ? this.nodesById().get(targetId) : undefined;
    if (source && target && this.isTarget(target)) this.addLink(source, target);

    // The browser follows a drag with a click on the handle — it must not start click-connecting.
    this.swallowNextHandleClick = true;
    this.cancelConnect();
  }

  onHandlePointerCancel(): void {
    this.cancelConnect();
  }

  // ── Removing ───────────────────────────────────────────────────────────────

  onLinkActivate(link: SupportLink, event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.linkRemoved.emit({ upperId: link.upperId, lowerId: link.lowerId });
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private sourceNode(): FigureNodeItem | undefined {
    const from = this.connectFrom();
    return from ? this.nodesById().get(from) : undefined;
  }

  private addLink(upper: FigureNodeItem, lower: FigureNodeItem): void {
    if (upper.standsOnNodeIds.includes(lower.id)) return;
    this.linkAdded.emit({ upperId: upper.id, lowerId: lower.id });
  }

  /** Client coordinates → board SVG coordinates (x in percent, y in rem). */
  private toBoard(event: PointerEvent): { x: number; y: number } {
    const rect = this.board()?.nativeElement.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    return {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * this.boardHeight(),
    };
  }
}
