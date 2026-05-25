import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { TroncViewComponent } from '../tronc-view/tronc-view.component';
import { FigureCanvasComponent } from '../figure-canvas/figure-canvas.component';
import { ProjectionInstance } from '../../models/projection.model';
import { AssignmentDetail } from '../../models/assignment.model';
import { FigureZone } from '@muixer/shared';

@Component({
  selector: 'app-figure-projection',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, TroncViewComponent, FigureCanvasComponent],
  templateUrl: './figure-projection.component.html',
})
export class FigureProjectionComponent {
  readonly instance = input.required<ProjectionInstance>();

  readonly backToSegment = output<void>();

  readonly pinyaNodes = computed(() =>
    this.instance().nodes.filter(
      (n) => n.zone !== FigureZone.TRONC && n.zone !== FigureZone.BASE,
    ),
  );

  readonly troncNodes = computed(() =>
    this.instance().nodes.filter((n) => n.zone === FigureZone.TRONC),
  );

  readonly baseNodes = computed(() =>
    this.instance().nodes.filter((n) => n.zone === FigureZone.BASE),
  );

  readonly assignmentList = computed<AssignmentDetail[]>(() =>
    this.instance().assignments,
  );
}
