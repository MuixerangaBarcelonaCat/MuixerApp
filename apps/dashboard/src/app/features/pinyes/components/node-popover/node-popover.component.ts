import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  input,
  output,
} from '@angular/core';
import { LucideAngularModule, X, UserMinus } from 'lucide-angular';
import { AssignmentDetail, HeightMode } from '../../models/assignment.model';

@Component({
  selector: 'app-node-popover',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  template: `
    <div
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="'Assignació: ' + assignment()?.person?.alias"
      class="absolute z-50 bg-base-100 border border-base-300 rounded-lg shadow-xl p-3 min-w-48"
      [style.left.px]="position().x"
      [style.top.px]="position().y"
    >
      <div class="flex items-start justify-between gap-3 mb-2">
        <div>
          <p class="text-sm font-semibold text-base-content">{{ assignment()?.person?.alias }}</p>
          <p class="text-xs text-base-content/60">
            {{ assignment()?.person?.name }} {{ assignment()?.person?.firstSurname }}
          </p>
          <p class="text-xs text-base-content/50 mt-0.5">
            {{ heightDisplay() }}
          </p>
        </div>
        <button
          type="button"
          class="btn btn-ghost btn-xs"
          (click)="close.emit()"
          aria-label="Tancar"
        >
          <i-lucide [img]="X" class="size-3" />
        </button>
      </div>

      <div class="flex items-center gap-1 mb-2 text-xs">
        <span class="badge badge-sm" [class]="attendanceBadgeClass()">
          {{ attendanceLabel() }}
        </span>
        @if (assignment()?.node?.label) {
          <span class="text-base-content/50">· {{ assignment()?.node?.label }}</span>
        }
      </div>

      <button
        type="button"
        class="btn btn-error btn-xs w-full gap-1"
        (click)="unassign.emit(assignment()!)"
        aria-label="Desassignar persona d'aquest node"
      >
        <i-lucide [img]="UserMinus" class="size-3" />
        Desassignar
      </button>
    </div>
  `,
})
export class NodePopoverComponent {
  readonly assignment = input<AssignmentDetail | null>(null);
  readonly position = input<{ x: number; y: number }>({ x: 0, y: 0 });
  readonly heightMode = input<HeightMode>('relative');
  readonly attendanceStatus = input<string | null>(null);

  readonly unassign = output<AssignmentDetail>();
  readonly close = output<void>();

  readonly X = X;
  readonly UserMinus = UserMinus;

  readonly heightDisplay = computed(() => {
    const h = this.assignment()?.person?.shoulderHeight;
    if (h === null || h === undefined) return '-';
    if (this.heightMode() === 'relative') {
      const diff = h - 140;
      return diff >= 0 ? `+${diff}` : `${diff}`;
    }
    return `${h} cm`;
  });

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close.emit();
  }

  attendanceBadgeClass(): string {
    const status = this.attendanceStatus();
    if (status === 'ANIRE') return 'badge-success';
    if (status === 'NO_VAIG') return 'badge-error';
    if (status === 'PENDENT') return 'badge-warning';
    return 'badge-ghost';
  }

  attendanceLabel(): string {
    const status = this.attendanceStatus();
    if (status === 'ANIRE') return 'Vinc';
    if (status === 'NO_VAIG') return 'No vinc';
    if (status === 'PENDENT') return 'Pendent';
    return 'Assignat/da';
  }
}
