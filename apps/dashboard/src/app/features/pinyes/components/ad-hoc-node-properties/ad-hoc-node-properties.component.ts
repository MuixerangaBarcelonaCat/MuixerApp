import {
  Component,
  ChangeDetectionStrategy,
  computed,
  input,
  output,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, X, Trash2 } from 'lucide-angular';
import { InstanceNodeItem, UpdateAdHocNodePayload } from '../../models/assignment.model';
import { NodeAssignmentService } from '../../services/node-assignment.service';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';
import { FigureZone, NodeShape, DIRECTION_ZONES } from '@muixer/shared';

@Component({
  selector: 'app-ad-hoc-node-properties',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule],
  templateUrl: './ad-hoc-node-properties.component.html',
})
export class AdHocNodePropertiesComponent {
  private readonly assignmentService = inject(NodeAssignmentService);
  private readonly toast = inject(ToastService);

  readonly node = input.required<InstanceNodeItem>();
  readonly instanceId = input.required<string>();
  readonly closed = output<void>();
  readonly nodeUpdated = output<void>();
  readonly deleteRequested = output<string>();
  readonly propertyChanged = output<{ nodeId: string; patch: Partial<UpdateAdHocNodePayload> }>();

  readonly X = X;
  readonly Trash2 = Trash2;
  readonly NodeShape = NodeShape;
  readonly FigureZone = FigureZone;

  readonly isDecoration = computed(
    () => this.node().zone === FigureZone.DECORATION,
  );

  readonly isDirection = computed(
    () => (DIRECTION_ZONES as readonly string[]).includes(this.node().zone),
  );

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  close(): void {
    this.closed.emit();
  }

  onPropChange(
    key: keyof UpdateAdHocNodePayload,
    value: string | number | null,
  ): void {
    const payload: UpdateAdHocNodePayload = { [key]: value };
    this.propertyChanged.emit({ nodeId: this.node().id, patch: payload });
    this.debouncedUpdate(payload);
  }

  clearDecorationFill(): void {
    this.onPropChange('color', null);
  }

  onDelete(): void {
    this.deleteRequested.emit(this.node().id);
  }

  private debouncedUpdate(payload: UpdateAdHocNodePayload): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.assignmentService
        .updateAdHocNode(this.instanceId(), this.node().id, payload)
        .subscribe({
          next: () => this.nodeUpdated.emit(),
          error: () => this.toast.error('Error en actualitzar el node.'),
        });
    }, 300);
  }
}
