import {
  Component,
  ChangeDetectionStrategy,
  computed,
  input,
  output,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, X, Trash2, UserMinus, Copy } from 'lucide-angular';
import { AssignmentDetail, HeightMode, InstanceNodeItem, UpdateAdHocNodePayload } from '../../models/assignment.model';
import { NodeAssignmentService } from '../../services/node-assignment.service';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';
import { FigureZone, NodeShape, DIRECTION_ZONES } from '@muixer/shared';
import { SHOULDER_HEIGHT_BASELINE_CM } from '../../../../shared/utils/person.util';

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
  readonly isPast = input<boolean>(false);
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
    if (h === null || h === undefined || h === 0) return null;
    if (this.heightMode() === 'relative') {
      const diff = h - SHOULDER_HEIGHT_BASELINE_CM;
      return diff >= 0 ? `+${diff}` : `${diff}`;
    }
    return `${h} cm`;
  });

  readonly attendanceBadgeClass = computed(() => {
    const status = this.attendanceStatus();
    if (status === 'ASSISTIT') return 'badge-success';
    if (status === 'ANIRE') return this.isPast() ? 'badge-warning' : 'badge-success';
    if (status === 'NO_VAIG') return 'badge-error';
    if (status === 'PENDENT') return 'badge-warning';
    return 'badge-ghost';
  });

  readonly attendanceLabel = computed(() => {
    const status = this.attendanceStatus();
    if (status === 'ASSISTIT') return 'Assistit';
    if (status === 'ANIRE') return this.isPast() ? 'No presentat' : 'Vinc';
    if (status === 'NO_VAIG') return 'No vinc';
    if (status === 'PENDENT') return 'Pendent';
    return 'Assignat/da';
  });

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly rotationPreview = signal<number | null>(null);
  readonly rotationDisplay = computed(
    () => this.rotationPreview() ?? this.node().rotation,
  );

  private readonly labelPreview = signal<string | null>(null);
  readonly labelDisplay = computed(
    () => this.labelPreview() ?? this.node().label,
  );

  private readonly colorPreview = signal<string | null | undefined>(undefined);
  readonly colorDisplay = computed(
    () => (this.colorPreview() === undefined ? this.node().color : this.colorPreview()),
  );

  close(): void {
    this.closed.emit();
  }

  onRotationPreview(value: number): void {
    this.rotationPreview.set(value);
  }

  onRotationCommit(value: number): void {
    this.rotationPreview.set(null);
    this.commitProperty('rotation', value);
  }

  onLabelPreview(value: string): void {
    this.labelPreview.set(value);
  }

  onLabelCommit(): void {
    const value = this.labelPreview();
    this.labelPreview.set(null);
    if (value === null) return;
    this.commitProperty('label', value);
  }

  onColorPreview(value: string): void {
    this.colorPreview.set(value);
  }

  onColorCommit(value: string): void {
    this.colorPreview.set(undefined);
    this.commitProperty('color', value);
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
    this.commitProperty('color', null);
  }

  onDelete(): void {
    this.deleteRequested.emit(this.node().id);
  }

  onDuplicate(): void {
    this.duplicateRequested.emit();
  }

  private commitProperty(
    key: keyof UpdateAdHocNodePayload,
    value: string | number | null,
  ): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    const payload: UpdateAdHocNodePayload = { [key]: value };
    this.propertyChanged.emit({ nodeId: this.node().id, patch: payload });
    this.sendUpdate(payload);
  }

  private debouncedUpdate(payload: UpdateAdHocNodePayload): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.sendUpdate(payload), 300);
  }

  private sendUpdate(payload: UpdateAdHocNodePayload): void {
    this.assignmentService
      .updateAdHocNode(this.instanceId(), this.node().id, payload)
      .subscribe({
        next: () => this.nodeUpdated.emit(),
        error: () => this.toast.error('Error en actualitzar el node.'),
      });
  }
}
