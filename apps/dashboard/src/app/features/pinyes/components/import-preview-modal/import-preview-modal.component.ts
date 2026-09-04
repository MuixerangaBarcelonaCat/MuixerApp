import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  OnChanges,
  output,
  signal,
  SimpleChanges,
} from '@angular/core';
import { FigureZone, ImportScope } from '@muixer/shared';
import {
  AssignmentDetail,
  PinyaProjectionComponent,
  ProjectionSegmentData,
  TroncNodeItem,
  TroncViewComponent,
} from '@muixer/pinyes-render';
import { ButtonComponent, ModalComponent } from '@muixer/ui';
import { ProjectionService } from '../../services/projection.service';

@Component({
  selector: 'app-import-preview-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PinyaProjectionComponent, TroncViewComponent, ButtonComponent, ModalComponent],
  templateUrl: './import-preview-modal.component.html',
})
export class ImportPreviewModalComponent implements OnChanges {
  readonly eventId = input.required<string>();
  readonly segmentId = input.required<string>();
  readonly instanceId = input.required<string>();
  readonly scope = input.required<ImportScope>();
  readonly eventTitle = input.required<string>();
  readonly open = input<boolean>(false);

  readonly closed = output<void>();

  private readonly projectionService = inject(ProjectionService);

  readonly ImportScope = ImportScope;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly projectionData = signal<ProjectionSegmentData | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open()) {
      this.loading.set(true);
      this.error.set(null);
      this.projectionData.set(null);
      this.projectionService.getProjection(this.eventId(), this.segmentId()).subscribe({
        next: (data) => {
          this.projectionData.set(data);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('No s\'ha pogut carregar la previsualització.');
          this.loading.set(false);
        },
      });
    }
  }

  /** TRONC-zone nodes of the previewed instance, for direct `lib-tronc-view` rendering. */
  troncNodesFor(): TroncNodeItem[] {
    const inst = this.projectionData()?.instances.find((i) => i.id === this.instanceId());
    return inst ? (inst.nodes.filter((n) => n.zone === FigureZone.TRONC) as TroncNodeItem[]) : [];
  }

  /** BASE-zone nodes of the previewed instance. */
  baseNodesFor(): TroncNodeItem[] {
    const inst = this.projectionData()?.instances.find((i) => i.id === this.instanceId());
    return inst ? (inst.nodes.filter((n) => n.zone === FigureZone.BASE) as TroncNodeItem[]) : [];
  }

  /** Direction nodes (FIGURE_DIRECTION/XICALLA_DIRECTION) of the previewed instance. */
  directionNodesFor(): TroncNodeItem[] {
    const inst = this.projectionData()?.instances.find((i) => i.id === this.instanceId());
    return inst
      ? (inst.nodes.filter(
          (n) => n.zone === FigureZone.FIGURE_DIRECTION || n.zone === FigureZone.XICALLA_DIRECTION,
        ) as TroncNodeItem[])
      : [];
  }

  /** Assignments of the previewed instance, so `lib-tronc-view` shows who's assigned, not just node positions. */
  assignmentsFor(): AssignmentDetail[] {
    const inst = this.projectionData()?.instances.find((i) => i.id === this.instanceId());
    return inst ? inst.assignments : [];
  }

  close(): void {
    this.closed.emit();
  }
}
