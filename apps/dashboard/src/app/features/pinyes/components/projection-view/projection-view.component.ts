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
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, switchMap } from 'rxjs/operators';
import { LucideAngularModule } from 'lucide-angular';
import { LayoutService } from '../../../../core/services/layout.service';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';
import { ProjectionService } from '../../services/projection.service';
import { ReferenceElementService } from '../../services/reference-element.service';
import { ProjectionSegmentData, ProjectionInstance, InstanceLayoutUpdate } from '../../models/projection.model';
import { ReferenceElementItem, CreateReferenceElementPayload } from '../../models/reference-element.model';
import { FigurePosition, SegmentCanvasComponent } from '../segment-canvas/segment-canvas.component';
import { FigureProjectionComponent } from '../figure-projection/figure-projection.component';
import { ReferenceElementType } from '@muixer/shared';

type ViewMode = 'segment' | 'figure';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

@Component({
  selector: 'app-projection-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    LucideAngularModule,
    SegmentCanvasComponent,
    FigureProjectionComponent,
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

  readonly loading = signal(true);
  readonly viewMode = signal<ViewMode>('segment');
  readonly editMode = signal(true);
  readonly segmentData = signal<ProjectionSegmentData | null>(null);
  readonly focusedInstanceId = signal<string | null>(null);
  readonly selectedElementId = signal<string | null>(null);
  readonly figurePositions = signal<Map<string, FigurePosition>>(new Map());
  readonly referenceElements = signal<ReferenceElementItem[]>([]);
  readonly cursorVisible = signal(true);
  readonly helpModalOpen = signal(false);
  readonly saveStatus = signal<SaveStatus>('idle');

  readonly activeFigure = computed<ProjectionInstance | undefined>(() => {
    const id = this.focusedInstanceId();
    if (!id) return undefined;
    return this.segmentData()?.instances.find((i) => i.id === id);
  });

  private eventId = '';
  private segmentId = '';
  private cursorTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly layoutSave$ = new Subject<InstanceLayoutUpdate[]>();
  private readonly elementsSave$ = new Subject<void>();
  private subscriptions = new Subscription();

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

  onMouseMove(): void {
    if (this.editMode()) return;
    this.cursorVisible.set(true);
    if (this.cursorTimer) clearTimeout(this.cursorTimer);
    this.cursorTimer = setTimeout(() => this.cursorVisible.set(false), 3000);
  }

  onFigureMoved(event: { instanceId: string; x: number; y: number }): void {
    this.figurePositions.update((map) => {
      const current = map.get(event.instanceId) ?? { x: 0, y: 0, scale: 1 };
      const next = new Map(map);
      next.set(event.instanceId, { ...current, x: event.x, y: event.y });
      return next;
    });
    this.triggerLayoutSave();
  }

  onFigureClicked(instanceId: string): void {
    this.focusedInstanceId.set(instanceId);
    this.viewMode.set('figure');
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

  onElementCreated(type: ReferenceElementType): void {
    const payload: CreateReferenceElementPayload = {
      type,
      x: 100,
      y: 100,
      width: type === ReferenceElementType.RECTANGLE ? 200 : 150,
      height: type === ReferenceElementType.RECTANGLE ? 120 : 20,
      rotation: 0,
      label: type === ReferenceElementType.RECTANGLE ? 'Element' : null,
    };
    this.referenceElementService.create(this.eventId, payload).subscribe({
      next: (el) => this.referenceElements.update((els) => [...els, el]),
      error: () => this.toast.error('Error creant element de referència'),
    });
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

  navigateSegment(direction: 'prev' | 'next'): void {
    const data = this.segmentData();
    if (!data) return;
    const targetId =
      direction === 'prev' ? data.segment.prevSegmentId : data.segment.nextSegmentId;
    if (!targetId) return;

    this.router.navigate(['/pinyes/events', this.eventId, 'segments', targetId, 'project']);
    this.segmentId = targetId;
    this.viewMode.set('segment');
    this.focusedInstanceId.set(null);
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

  private handleEscape(): void {
    if (this.helpModalOpen()) {
      this.helpModalOpen.set(false);
      return;
    }
    if (this.viewMode() === 'figure') {
      this.viewMode.set('segment');
      this.focusedInstanceId.set(null);
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
    const layoutSub = this.layoutSave$
      .pipe(
        debounceTime(2000),
        switchMap((layouts) =>
          this.projectionService.updateProjectionLayout(this.eventId, this.segmentId, layouts),
        ),
      )
      .subscribe({
        next: () => {
          this.saveStatus.set('saved');
          setTimeout(() => this.saveStatus.set('idle'), 2000);
        },
        error: () => this.saveStatus.set('error'),
      });

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

    this.subscriptions.add(layoutSub);
    this.subscriptions.add(elementsSub);
  }

  private triggerLayoutSave(): void {
    const positions = this.figurePositions();
    const layouts: InstanceLayoutUpdate[] = [];
    for (const [instanceId, pos] of positions) {
      layouts.push({ instanceId, x: pos.x, y: pos.y, scale: pos.scale });
    }
    this.saveStatus.set('saving');
    this.layoutSave$.next(layouts);
  }
}
