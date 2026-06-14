import {
  Component,
  ChangeDetectionStrategy,
  computed,
  input,
  output,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, X, Trash2, UserMinus, Copy } from 'lucide-angular';
import { AssignmentDetail, HeightMode, InstanceNodeItem, UpdateAdHocNodePayload } from '../../models/assignment.model';
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
  readonly assignment = input<AssignmentDetail | null>(null);
  readonly heightMode = input<HeightMode>('relative');
  readonly attendanceStatus = input<string | null>(null);
  readonly closed = output<void>();
  readonly nodeUpdated = output<void>();
  readonly deleteRequested = output<string>();
  readonly duplicateRequested = output<void>();
  readonly propertyChanged = output<{ nodeId: string; patch: Partial<UpdateAdHocNodePayload> }>();
  readonly unassign = output<AssignmentDetail>();

  readonly X = X;
  readonly Trash2 = Trash2;
  readonly UserMinus = UserMinus;
  readonly Copy = Copy;
  readonly NodeShape = NodeShape;
  readonly FigureZone = FigureZone;

  readonly isDecoration = computed(
    () => this.node().zone === FigureZone.DECORATION,
  );

  readonly isDirection = computed(
    () => (DIRECTION_ZONES as readonly string[]).includes(this.node().zone),
  );

  readonly heightDisplay = computed(() => {
    const h = this.assignment()?.person?.shoulderHeight;
    if (h === null || h === undefined) return null;
    if (this.heightMode() === 'relative') {
      const diff = h - 140;
      return diff >= 0 ? `+${diff}` : `${diff}`;
    }
    return `${h} cm`;
  });

  readonly attendanceBadgeClass = computed(() => {
    const status = this.attendanceStatus();
    if (status === 'ANIRE') return 'badge-success';
    if (status === 'NO_VAIG') return 'badge-error';
    if (status === 'PENDENT') return 'badge-warning';
    return 'badge-ghost';
  });

  readonly attendanceLabel = computed(() => {
    const status = this.attendanceStatus();
    if (status === 'ANIRE') return 'Vinc';
    if (status === 'NO_VAIG') return 'No vinc';
    if (status === 'PENDENT') return 'Pendent';
    return 'Assignat/da';
  });

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

  onDuplicate(): void {
    this.duplicateRequested.emit();
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
