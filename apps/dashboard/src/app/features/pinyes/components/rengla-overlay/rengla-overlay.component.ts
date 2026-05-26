import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
  HostListener,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { FigureNodeItem } from '../../models/figure-template.model';
import { FigureZone } from '@muixer/shared';

// One color per rengla (cycles if > 10)
const RENGLA_COLORS = [
  '#f59e0b',
  '#3b82f6',
  '#10b981',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
  '#f97316',
  '#6366f1',
];

interface NodeCenter {
  node: FigureNodeItem;
  cx: number;
  cy: number;
}

@Component({
  selector: 'app-rengla-overlay',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="rengla-overlay"
      (mousemove)="onMouseMove($event)"
      (click)="onOverlayClick($event)"
    >
      <svg
        #svgEl
        class="rengla-svg"
        [attr.width]="svgWidth()"
        [attr.height]="svgHeight()"
      >
        <g [attr.transform]="svgTransform()">
          <!-- Committed rengla lines -->
          @for (entry of committedLines(); track entry.rengla) {
            @for (seg of entry.segments; track $index) {
              <line
                [attr.x1]="seg.x1"
                [attr.y1]="seg.y1"
                [attr.x2]="seg.x2"
                [attr.y2]="seg.y2"
                [attr.stroke]="entry.color"
                stroke-width="2"
                stroke-dasharray="6 3"
                opacity="0.7"
              />
            }
          }

          <!-- In-progress lines -->
          @for (seg of inProgressSegments(); track $index) {
            <line
              [attr.x1]="seg.x1"
              [attr.y1]="seg.y1"
              [attr.x2]="seg.x2"
              [attr.y2]="seg.y2"
              stroke="#f59e0b"
              stroke-width="2"
              opacity="0.9"
            />
          }

          <!-- Live cursor line -->
          @if (liveLineStart(); as start) {
            <line
              [attr.x1]="start.x"
              [attr.y1]="start.y"
              [attr.x2]="cursorPos().x"
              [attr.y2]="cursorPos().y"
              stroke="#f59e0b"
              stroke-width="2"
              stroke-dasharray="4 4"
              opacity="0.6"
            />
          }

          <!-- Node hit areas + badges -->
          @for (nc of nodeCenters(); track nc.node.id) {
            @let inProgress = inProgressIndex(nc.node);
            @let committed = committedInfo(nc.node);
            @let isInProgress = inProgress !== -1;
            @let isCommitted = committed !== null;

            <!-- Badge circle for in-progress -->
            @if (isInProgress) {
              <circle
                [attr.cx]="nc.cx"
                [attr.cy]="nc.cy"
                [attr.r]="badgeRadius(nc.node)"
                fill="#f59e0b"
                stroke="white"
                stroke-width="2"
                opacity="0.9"
                class="pointer-events-none"
              />
              <text
                [attr.x]="nc.cx"
                [attr.y]="nc.cy"
                text-anchor="middle"
                dominant-baseline="central"
                fill="white"
                font-size="13"
                font-weight="bold"
                font-family="Inter, sans-serif"
                class="pointer-events-none"
              >
                {{ inProgress + 1 }}
              </text>
            }

            <!-- Badge for committed nodes -->
            @if (isCommitted && !isInProgress) {
              <circle
                [attr.cx]="nc.cx"
                [attr.cy]="nc.cy"
                [attr.r]="badgeRadius(nc.node)"
                [attr.fill]="committed!.color"
                stroke="white"
                stroke-width="2"
                opacity="0.85"
                class="pointer-events-none"
              />
              <text
                [attr.x]="nc.cx"
                [attr.y]="nc.cy"
                text-anchor="middle"
                dominant-baseline="central"
                fill="white"
                font-size="11"
                font-weight="bold"
                font-family="Inter, sans-serif"
                class="pointer-events-none"
              >
                {{ committed!.position }}
              </text>
              <!-- Rengla name label above -->
              <text
                [attr.x]="nc.cx"
                [attr.y]="nc.cy - badgeRadius(nc.node) - 6"
                text-anchor="middle"
                dominant-baseline="auto"
                [attr.fill]="committed!.color"
                font-size="9"
                font-family="Inter, sans-serif"
                class="pointer-events-none"
              >
                {{ committed!.rengla }}
              </text>
            }
          }
        </g>
      </svg>

      <!-- Floating action bar -->
      <div class="rengla-actionbar">
        @if (renglaInProgress().length === 0) {
          <span class="text-xs text-base-content/60">
            Fes clic als nodes de pinya per crear una rengla
          </span>
        } @else {
          <span class="text-xs text-base-content/60">
            {{ renglaInProgress().length }} node{{
              renglaInProgress().length !== 1 ? 's' : ''
            }}
            seleccionat{{ renglaInProgress().length !== 1 ? 's' : '' }}
          </span>
          <button
            type="button"
            class="btn btn-xs btn-ghost text-error"
            (click)="cancel.emit()"
          >
            Cancel·lar <kbd class="kbd kbd-xs ml-1">Supr</kbd>
          </button>
          <button
            type="button"
            class="btn btn-xs btn-warning"
            [disabled]="renglaInProgress().length < 1"
            (click)="finalize.emit()"
          >
            Finalitzar rengla <kbd class="kbd kbd-xs ml-1">↵</kbd>
          </button>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .rengla-overlay {
        position: absolute;
        inset: 0;
        z-index: 10;
      }
      .rengla-svg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        overflow: visible;
      }
      .rengla-actionbar {
        position: absolute;
        bottom: 16px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 8px;
        background: oklch(var(--b1));
        border: 1px solid oklch(var(--b3));
        border-radius: 9999px;
        padding: 6px 16px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        white-space: nowrap;
      }
    `,
  ],
})
export class RenglaOverlayComponent implements AfterViewInit, OnDestroy {
  @ViewChild('svgEl') svgRef!: ElementRef<SVGSVGElement>;

  readonly nodes = input<FigureNodeItem[]>([]);
  readonly renglaInProgress = input<FigureNodeItem[]>([]);
  readonly renglaMap = input<Map<string, FigureNodeItem[]>>(new Map());

  readonly nodeClicked = output<FigureNodeItem>();
  readonly finalize = output<void>();
  readonly cancel = output<void>();

  readonly cursorPos = signal({ x: 0, y: 0 });
  readonly svgWidth = signal(0);
  readonly svgHeight = signal(0);

  private resizeObserver: ResizeObserver | null = null;
  readonly stageTransform = input<{ x: number; y: number; scale: number }>({
    x: 0,
    y: 0,
    scale: 1,
  });
  readonly svgTransform = computed(() => {
    const t = this.stageTransform();
    return `translate(${t.x}, ${t.y}) scale(${t.scale})`;
  });

  // ── Coordinate helpers ─────────────────────────────────────────────────────
  // The SVG overlay sits over the canvas div at the same position.
  // Node x/y are in Konva scene coordinates. We need to map them to the
  // overlay's pixel space. Since we don't have access to the Konva stage,
  // we read the canvas container's bounding rect and assume the stage
  // starts at (0,0) with scale=1 initially. For a proper implementation,
  // the editor would need to pass stageOffset and stageScale signals.
  // For now we match the canvas container's client rect offset.

  private overlayRect = { left: 0, top: 0 };

  readonly nodeCenters = computed<NodeCenter[]>(() =>
    this.nodes()
      .filter((n) => n.zone === FigureZone.PINYA)
      .map((n) => ({ node: n, cx: n.x, cy: n.y })),
  );

  readonly inProgressSegments = computed(() => {
    const arr = this.renglaInProgress();
    const centers = this.nodeCenters();
    const segs: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let i = 0; i < arr.length - 1; i++) {
      const a = centers.find((c) => c.node.id === arr[i].id);
      const b = centers.find((c) => c.node.id === arr[i + 1].id);
      if (a && b) segs.push({ x1: a.cx, y1: a.cy, x2: b.cx, y2: b.cy });
    }
    return segs;
  });

  readonly liveLineStart = computed<{ x: number; y: number } | null>(() => {
    const arr = this.renglaInProgress();
    if (arr.length === 0) return null;
    const last = arr[arr.length - 1];
    const center = this.nodeCenters().find((c) => c.node.id === last.id);
    return center ? { x: center.cx, y: center.cy } : null;
  });

  readonly committedLines = computed(() => {
    const result: {
      rengla: string;
      color: string;
      segments: { x1: number; y1: number; x2: number; y2: number }[];
    }[] = [];

    let colorIdx = 0;
    for (const [rengla, nodes] of this.renglaMap()) {
      const color = RENGLA_COLORS[colorIdx % RENGLA_COLORS.length];
      colorIdx++;
      const centers = this.nodeCenters();
      const segs: { x1: number; y1: number; x2: number; y2: number }[] = [];
      for (let i = 0; i < nodes.length - 1; i++) {
        const a = centers.find((c) => c.node.id === nodes[i].id);
        const b = centers.find((c) => c.node.id === nodes[i + 1].id);
        if (a && b) segs.push({ x1: a.cx, y1: a.cy, x2: b.cx, y2: b.cy });
      }
      result.push({ rengla, color, segments: segs });
    }
    return result;
  });

  // Assign stable colors to rengla names
  private renglaColorCache = new Map<string, string>();
  private colorCounter = 0;

  private getRenglaColor(name: string): string {
    if (!this.renglaColorCache.has(name)) {
      this.renglaColorCache.set(
        name,
        RENGLA_COLORS[this.colorCounter++ % RENGLA_COLORS.length],
      );
    }
    return this.renglaColorCache.get(name)!;
  }

  committedInfo(
    node: FigureNodeItem,
  ): { rengla: string; position: number; color: string } | null {
    if (!node.rengla || !node.renglaPosition) return null;
    return {
      rengla: node.rengla,
      position: node.renglaPosition,
      color: this.getRenglaColor(node.rengla),
    };
  }

  inProgressIndex(node: FigureNodeItem): number {
    return this.renglaInProgress().findIndex((n) => n.id === node.id);
  }

  hitRadius(node: FigureNodeItem): number {
    return Math.max(node.width, node.height) / 2 + 4;
  }

  badgeRadius(node: FigureNodeItem): number {
    return (Math.min(node.width, node.height) / 2) * 0.7;
  }

  ngAfterViewInit(): void {
    const el = this.svgRef.nativeElement.parentElement!;
    this.resizeObserver = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      this.svgWidth.set(r.width);
      this.svgHeight.set(r.height);
    });
    this.resizeObserver.observe(el);
    const r = el.getBoundingClientRect();
    this.svgWidth.set(r.width);
    this.svgHeight.set(r.height);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  onMouseMove(event: MouseEvent): void {
    const t = this.stageTransform();
    this.cursorPos.set({
      x: (event.offsetX - t.x) / t.scale,
      y: (event.offsetY - t.y) / t.scale,
    });
  }

  onOverlayClick(event: MouseEvent): void {
    const t = this.stageTransform();

    // Convert CSS pixel click → Konva scene coordinates
    const sceneX = (event.offsetX - t.x) / t.scale;
    const sceneY = (event.offsetY - t.y) / t.scale;

    // Find closest PINYA node within a reasonable hit radius
    let closest: FigureNodeItem | null = null;
    let closestDist = Infinity;

    for (const nc of this.nodeCenters()) {
      const dx = nc.cx - sceneX;
      const dy = nc.cy - sceneY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Hit threshold: half the largest dimension + a small buffer
      const threshold = Math.max(nc.node.width, nc.node.height) / 2 + 8;
      if (dist < threshold && dist < closestDist) {
        closest = nc.node;
        closestDist = dist;
      }
    }

    if (closest) {
      this.nodeClicked.emit(closest);
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    const isEditing =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable;
    if (isEditing) return;

    if (event.key === 'Enter') {
      event.preventDefault();
      this.finalize.emit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.cancel.emit();
    }
  }
}
