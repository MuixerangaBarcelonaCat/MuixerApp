import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { ButtonComponent } from '@muixer/ui';
import {
  TroncViewComponent,
  TroncNodeItem,
  ProjectionInstance,
  ProjectionSegmentData,
  getFigureColor,
  SINGLE_FIGURE_PANEL_COLOR,
} from '@muixer/pinyes-render';
import { FigureZone, computeSegmentDisplayName, computeInstanceDisplayNames } from '@muixer/shared';
import { EventService } from '../../services/event.service';
import { EventSegmentService } from '../../../pinyes/services/event-segment.service';
import { ProjectionService } from '../../../pinyes/services/projection.service';

interface PrintInstance {
  id: string;
  name: string;
  color: string;
  troncNodes: TroncNodeItem[];
  baseNodes: TroncNodeItem[];
  directionNodes: TroncNodeItem[];
  assignments: ProjectionInstance['assignments'];
}

interface PrintSegment {
  id: string;
  number: number;
  title: string;
  instances: PrintInstance[];
}

// A4 portrait content area at 96dpi, minus the 8mm @page margin (styles.scss).
const PRINT_PAGE_HEIGHT_PX = ((297 - 16) / 25.4) * 96;
const PRINT_PAGE_WIDTH_PX = ((210 - 16) / 25.4) * 96;

@Component({
  selector: 'app-event-print',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, ButtonComponent, TroncViewComponent],
  templateUrl: './event-print.component.html',
})
export class EventPrintComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly eventService = inject(EventService);
  private readonly eventSegmentService = inject(EventSegmentService);
  private readonly projectionService = inject(ProjectionService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly printArea = viewChild<ElementRef<HTMLElement>>('printArea');

  readonly loading = signal(true);
  readonly eventTitle = signal('');
  readonly eventDate = signal('');
  readonly segments = signal<PrintSegment[]>([]);
  readonly printScale = signal(1);

  private readonly onBeforePrint = (): void => this.fitToOnePage();
  private readonly onAfterPrint = (): void => {
    this.printScale.set(1);
    this.cdr.detectChanges();
  };

  ngAfterViewInit(): void {
    window.addEventListener('beforeprint', this.onBeforePrint);
    window.addEventListener('afterprint', this.onAfterPrint);
  }

  ngOnDestroy(): void {
    window.removeEventListener('beforeprint', this.onBeforePrint);
    window.removeEventListener('afterprint', this.onAfterPrint);
  }

  /**
   * Shrinks the whole grid down so a busy assaig still prints on a single A4 sheet.
   * Uses CSS `zoom`, not `transform: scale` — a transform is paint-only and doesn't
   * change the element's layout box, so Chromium's print pagination still measures
   * the pre-scale height and keeps splitting into extra pages. `zoom` actually
   * resizes the layout box, so pagination recomputes against the shrunk height.
   *
   * Checks width too: a wide figure (many tronc columns) can force its grid cell
   * wider than the page — a "grid blowout" — which silently clips off the page
   * edge instead of wrapping, since a printed page can't scroll horizontally.
   */
  private fitToOnePage(): void {
    const el = this.printArea()?.nativeElement;
    if (!el) return;

    this.printScale.set(1);
    this.cdr.detectChanges();

    const contentHeight = el.scrollHeight;
    const contentWidth = el.scrollWidth;
    const scale = Math.max(
      0.3,
      Math.min(1, PRINT_PAGE_HEIGHT_PX / contentHeight, PRINT_PAGE_WIDTH_PX / contentWidth),
    );

    this.printScale.set(scale);
    this.cdr.detectChanges();
  }

  ngOnInit(): void {
    const eventId = this.route.snapshot.paramMap.get('id');
    if (!eventId) return;

    this.eventService.getOne(eventId).subscribe((ev) => {
      this.eventTitle.set(ev.title);
      this.eventDate.set(this.formatDate(ev.date));
    });

    this.eventSegmentService.getByEvent(eventId).subscribe(({ data: segments }) => {
      const ordered = [...segments].sort((a, b) => a.sortOrder - b.sortOrder);
      if (ordered.length === 0) {
        this.loading.set(false);
        return;
      }

      forkJoin(
        ordered.map((s) => this.projectionService.getProjection(eventId, s.id)),
      ).subscribe((projections) => {
        this.segments.set(projections.map((p, index) => this.toPrintSegment(p, index + 1)));
        this.loading.set(false);
      });
    });
  }

  private formatDate(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('ca-ES', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  private toPrintSegment(data: ProjectionSegmentData, number: number): PrintSegment {
    const singleFigure = data.instances.length === 1;
    const instanceNames = computeInstanceDisplayNames(
      data.instances.map((i) => ({ id: i.id, label: i.label, figureMode: i.figureMode, figureTemplate: i.figureTemplate })),
    );

    return {
      id: data.segment.id,
      number,
      title: computeSegmentDisplayName(data.segment.name, data.instances),
      instances: data.instances.map((instance, index) => ({
        id: instance.id,
        name: instanceNames.get(instance.id) ?? instance.figureTemplate?.name ?? '?',
        color: singleFigure ? SINGLE_FIGURE_PANEL_COLOR : getFigureColor(index),
        troncNodes: instance.nodes.filter((n) => n.zone === FigureZone.TRONC) as TroncNodeItem[],
        baseNodes: instance.nodes.filter((n) => n.zone === FigureZone.BASE) as TroncNodeItem[],
        directionNodes: instance.nodes.filter((n) => n.zone === FigureZone.DIRECTION) as TroncNodeItem[],
        assignments: instance.assignments,
      })),
    };
  }

  print(): void {
    window.print();
  }

  goBack(): void {
    this.router.navigate(['..'], { relativeTo: this.route });
  }
}
