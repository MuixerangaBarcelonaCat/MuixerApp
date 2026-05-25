import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, switchMap } from 'rxjs/operators';
import { LucideAngularModule } from 'lucide-angular';
import { LayoutService } from '../../../../core/services/layout.service';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';
import { ProjectionService } from '../../services/projection.service';
import { ReferenceElementService } from '../../services/reference-element.service';
import { ProjectionSegmentData, ProjectionInstance } from '../../models/projection.model';
import { ReferenceElementItem, CreateReferenceElementPayload } from '../../models/reference-element.model';
import { FigurePosition, SegmentCanvasComponent } from '../segment-canvas/segment-canvas.component';
import { FigureCanvasComponent } from '../figure-canvas/figure-canvas.component';
import { TroncViewComponent, TroncNodeItem } from '../tronc-view/tronc-view.component';
import { ReferenceElementType, FigureZone } from '@muixer/shared';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

@Component({
  selector: 'app-projection-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    LucideAngularModule,
    SegmentCanvasComponent,
    FigureCanvasComponent,
    TroncViewComponent,
  ],
  templateUrl: './projection-view.component.html',
})
export class ProjectionViewComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly layoutService = inject(LayoutService);
  private readonly projectionService = inject(ProjectionService);
  private readonly referenceElementService = inject(ReferenceElementService);
  private readonly toast = inject(ToastService);

  readonly ReferenceElementType = ReferenceElementType;
  readonly FigureZone = FigureZone;

  // ── State signals ───────────────────────────────────────────────────────────

  readonly loading = signal(true);
  readonly editMode = signal(true);
  readonly segmentData = signal<ProjectionSegmentData | null>(null);
  /** Kept for edit-mode SegmentCanvas mini-preview positions (not persisted). */
  readonly figurePositions = signal<Map<string, FigurePosition>>(new Map());
  readonly selectedElementId = signal<string | null>(null);
  readonly referenceElements = signal<ReferenceElementItem[]>([]);
  readonly cursorVisible = signal(true);
  readonly helpModalOpen = signal(false);
  readonly saveStatus = signal<SaveStatus>('idle');

  /** Projection mode: shows tronc floating panel for the double-clicked figure. */
  readonly troncOverlayInstanceId = signal<string | null>(null);

  /** Background color for projection mode. */
  readonly bgColor = signal<'white' | 'black'>('white');

  /** Add-element modal state. */
  readonly addElementModalOpen = signal(false);
  readonly addElementModalType = signal<ReferenceElementType | null>(null);
  readonly addElementModalLabel = signal('');

  // ── Computed ────────────────────────────────────────────────────────────────

  /**
   * Grid columns:
   *  1→1, 2→2, 3→3, 4→2×2, 5+→3 cols (last row centered via flex justify-center)
   */
  readonly gridCols = computed(() => {
    const n = this.segmentData()?.instances.length ?? 0;
    if (n <= 1) return 1;
    if (n === 2) return 2;
    if (n === 3) return 3;
    if (n === 4) return 2;
    return 3;
  });

  readonly gridRows = computed(() => {
    const n = this.segmentData()?.instances.length ?? 0;
    return Math.ceil(n / this.gridCols());
  });

  /** Flex item width — accounts for 6px total gap (3px per side margin). */
  readonly itemWidthStyle = computed(() => `calc(${100 / this.gridCols()}% - 6px)`);

  /** Flex item height — accounts for 6px total gap. */
  readonly itemHeightStyle = computed(() => `calc(${100 / this.gridRows()}% - 6px)`);

  readonly troncOverlayInstance = computed(() => {
    const id = this.troncOverlayInstanceId();
    if (!id) return null;
    return this.segmentData()?.instances.find((i) => i.id === id) ?? null;
  });

  readonly troncOverlayTroncNodes = computed<TroncNodeItem[]>(() =>
    (this.troncOverlayInstance()?.nodes.filter((n) => n.zone === FigureZone.TRONC) ?? []) as TroncNodeItem[],
  );

  readonly troncOverlayBaseNodes = computed<TroncNodeItem[]>(() =>
    (this.troncOverlayInstance()?.nodes.filter((n) => n.zone === FigureZone.BASE) ?? []) as TroncNodeItem[],
  );

  // ── Route params (public for RouterLink in template) ────────────────────────

  eventId = '';
  segmentId = '';

  private cursorTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly elementsSave$ = new Subject<void>();
  private subscriptions = new Subscription();

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.layoutService.requestFullscreen();
    const params = this.route.snapshot.params;
    this.eventId = params['eventId'];
    this.segmentId = params['segmentId'];
    this.loadSegment();
    this.setupAutoSave();
  }

  ngOnDestroy(): void {
    this.layoutService.exitFullscreen();
    if (this.cursorTimer) clearTimeout(this.cursorTimer);
    this.subscriptions.unsubscribe();
  }

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') this.navigateSegment('prev');
    if (event.key === 'ArrowRight') this.navigateSegment('next');
    if (event.key === 'Escape') this.handleEscape();
    if (event.key === 'f' || event.key === 'F') this.toggleBrowserFullscreen();
    if (event.key === 'e' || event.key === 'E') this.editMode.update((v) => !v);
    if (event.key === '?' || event.key === 'h' || event.key === 'H') {
      this.helpModalOpen.update((v) => !v);
    }
  }

  // ── Mouse / cursor management ───────────────────────────────────────────────

  onMouseMove(): void {
    if (this.editMode()) return;
    this.cursorVisible.set(true);
    if (this.cursorTimer) clearTimeout(this.cursorTimer);
    this.cursorTimer = setTimeout(() => this.cursorVisible.set(false), 3000);
  }

  // ── Figure grid interactions ────────────────────────────────────────────────

  /** Double-click on a grid cell: show tronc floating panel for that figure. */
  onFigureDoubleClicked(instanceId: string): void {
    this.troncOverlayInstanceId.set(instanceId);
  }

  closeTroncOverlay(): void {
    this.troncOverlayInstanceId.set(null);
  }

  /** Returns pinya+base nodes for a figure (excludes TRONC zone). */
  getInstancePinyaNodes(instance: ProjectionInstance) {
    return instance.nodes.filter((n) => n.zone !== FigureZone.TRONC);
  }

  getInstanceName(instance: ProjectionInstance): string {
    return instance.label ?? instance.figureTemplate?.name ?? 'Figura';
  }

  // ── Edit-mode canvas interactions ───────────────────────────────────────────

  /** Updates local figurePositions state; positions are NOT persisted (grid layout replaces positioning). */
  onFigureMoved(event: { instanceId: string; x: number; y: number }): void {
    this.figurePositions.update((map) => {
      const current = map.get(event.instanceId) ?? { x: 0, y: 0, scale: 1 };
      const next = new Map(map);
      next.set(event.instanceId, { ...current, x: event.x, y: event.y });
      return next;
    });
  }

  onElementMoved(event: {
    elementId: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
  }): void {
    this.referenceElements.update((els) =>
      els.map((el) =>
        el.id === event.elementId
          ? { ...el, x: event.x, y: event.y, width: event.width, height: event.height, rotation: event.rotation }
          : el,
      ),
    );
    this.elementsSave$.next();
  }

  // ── Reference element management ────────────────────────────────────────────

  openAddElementModal(type: ReferenceElementType): void {
    this.addElementModalType.set(type);
    this.addElementModalLabel.set('');
    this.addElementModalOpen.set(true);
  }

  confirmAddElement(): void {
    const type = this.addElementModalType();
    if (!type) return;
    const label = this.addElementModalLabel().trim() || null;
    this.createReferenceElement(type, label);
    this.addElementModalOpen.set(false);
    this.addElementModalType.set(null);
    this.addElementModalLabel.set('');
  }

  onElementDeleted(elementId: string): void {
    this.referenceElementService.remove(this.eventId, elementId).subscribe({
      next: () => {
        this.referenceElements.update((els) => els.filter((el) => el.id !== elementId));
        if (this.selectedElementId() === elementId) this.selectedElementId.set(null);
      },
      error: () => this.toast.error('Error eliminant element de referència'),
    });
  }

  // ── Background color ────────────────────────────────────────────────────────

  toggleBgColor(): void {
    this.bgColor.update((c) => (c === 'white' ? 'black' : 'white'));
  }

  // ── Segment navigation ──────────────────────────────────────────────────────

  navigateSegment(direction: 'prev' | 'next'): void {
    const data = this.segmentData();
    if (!data) return;
    const targetId =
      direction === 'prev' ? data.segment.prevSegmentId : data.segment.nextSegmentId;
    if (!targetId) return;
    this.router.navigate(['/pinyes/events', this.eventId, 'segments', targetId, 'project']);
    this.segmentId = targetId;
    this.troncOverlayInstanceId.set(null);
    this.loadSegment();
  }

  toggleEditMode(): void {
    this.editMode.update((v) => !v);
    if (!this.editMode()) {
      this.cursorVisible.set(true);
      this.cursorTimer = setTimeout(() => this.cursorVisible.set(false), 3000);
    }
  }

  goBack(): void {
    this.router.navigate(['/events', this.eventId]);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private handleEscape(): void {
    if (this.addElementModalOpen()) {
      this.addElementModalOpen.set(false);
      return;
    }
    if (this.helpModalOpen()) {
      this.helpModalOpen.set(false);
      return;
    }
    if (this.troncOverlayInstanceId()) {
      this.troncOverlayInstanceId.set(null);
      return;
    }
    if (!this.editMode()) {
      this.editMode.set(true);
      return;
    }
    this.goBack();
  }

  private toggleBrowserFullscreen(): void {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  private createReferenceElement(type: ReferenceElementType, label: string | null): void {
    const payload: CreateReferenceElementPayload = {
      type,
      x: 100,
      y: 100,
      width: type === ReferenceElementType.RECTANGLE ? 200 : 150,
      height: type === ReferenceElementType.RECTANGLE ? 120 : 20,
      rotation: 0,
      label,
    };
    this.referenceElementService.create(this.eventId, payload).subscribe({
      next: (el) => this.referenceElements.update((els) => [...els, el]),
      error: () => this.toast.error('Error creant element de referència'),
    });
  }

  private loadSegment(): void {
    this.loading.set(true);
    this.projectionService.getProjection(this.eventId, this.segmentId).subscribe({
      next: (data) => {
        this.segmentData.set(data);
        const positions = new Map<string, FigurePosition>();
        for (const instance of data.instances) {
          positions.set(instance.id, {
            x: instance.projectionX ?? -1,
            y: instance.projectionY ?? -1,
            scale: instance.projectionScale ?? 1,
          });
        }
        this.figurePositions.set(positions);
        this.referenceElements.set(data.referenceElements);
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('Error carregant les dades de projecció');
        this.loading.set(false);
      },
    });
  }

  private setupAutoSave(): void {
    const elementsSub = this.elementsSave$
      .pipe(
        debounceTime(2000),
        switchMap(() => {
          const elements = this.referenceElements().map((el) => ({
            id: el.id,
            x: el.x,
            y: el.y,
            width: el.width,
            height: el.height,
            rotation: el.rotation,
          }));
          return this.referenceElementService.batchUpdate(this.eventId, elements);
        }),
      )
      .subscribe({
        next: () => {
          this.saveStatus.set('saved');
          setTimeout(() => this.saveStatus.set('idle'), 2000);
        },
        error: () => this.saveStatus.set('error'),
      });

    this.subscriptions.add(elementsSub);
  }
}
