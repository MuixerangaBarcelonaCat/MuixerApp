import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
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

@Component({
  selector: 'app-event-print',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, ButtonComponent, TroncViewComponent],
  templateUrl: './event-print.component.html',
})
export class EventPrintComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly eventService = inject(EventService);
  private readonly eventSegmentService = inject(EventSegmentService);
  private readonly projectionService = inject(ProjectionService);

  readonly loading = signal(true);
  readonly eventTitle = signal('');
  readonly eventDate = signal('');
  readonly segments = signal<PrintSegment[]>([]);

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
