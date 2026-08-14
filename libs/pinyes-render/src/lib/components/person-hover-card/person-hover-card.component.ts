import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { AttendanceStatus, AvailablePersonPosition, HeightMode, PersonHoverInfo } from '../../models/assignment.model';
import { getContrastColor, ICON_OBSERVACIONS, SHOULDER_HEIGHT_BASELINE_CM } from '@muixer/shared';

@Component({
  selector: 'app-person-hover-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  template: `
    <div
      class="px-2.5 py-2 text-xs"
      [class.rounded-box]="!bare()"
      [class.bg-base-100]="!bare()"
      [class.border]="!bare()"
      [class.border-base-300]="!bare()"
      [class.shadow-lg]="!bare()"
      [class.min-w-40]="!bare()"
      [class.max-w-64]="!bare()"
    >
      <div class="flex items-start justify-between gap-2 mb-1">
        <div class="flex items-center gap-1.5 min-w-0">
          <p class="font-semibold text-sm truncate">{{ info().alias }}</p>
          <span class="badge badge-xs shrink-0" [class]="statusBadgeClass()">
            {{ statusLabel() }}
          </span>
          @if (info().isXicalla) {
            <span class="shrink-0" aria-label="Xicalla" title="Xicalla">👶</span>
          }
        </div>
        @if (formatHeight(); as height) {
          <span class="text-xs text-base-content/40 shrink-0 mt-0.5">{{ height }}</span>
        }
      </div>

      @if (sortedPositions().length > 0) {
        <div class="flex flex-wrap gap-1">
          @for (pos of sortedPositions(); track pos.id) {
            <span
              class="badge badge-xs"
              [class.opacity-50]="!isPositionMatch(pos)"
              [style.background-color]="pos.color ?? '#888'"
              [style.color]="getContrastColor(pos.color ?? '#888')"
            >
              {{ pos.name }}
            </span>
          }
        </div>
      }

      @if (info().notes; as notes) {
        <div class="flex items-start gap-1 mt-1.5 pt-1.5 border-t border-base-300 text-warning">
          @if (info().notesEmoji; as emoji) {
            <span class="shrink-0 mt-0.5 leading-none">{{ emoji }}</span>
          } @else {
            <lucide-icon [name]="ICON_OBSERVACIONS" [size]="12" class="shrink-0 mt-0.5" />
          }
          <span class="whitespace-pre-wrap break-words">{{ notes }}</span>
        </div>
      }
    </div>
  `,
})
export class PersonHoverCardComponent {
  readonly info = input.required<PersonHoverInfo>();
  readonly isPast = input<boolean>(false);
  readonly heightMode = input<HeightMode>('relative');
  /** Strips the floating-tooltip chrome (border/shadow/rounding/background) for flush inline use, e.g. in a list. */
  readonly bare = input<boolean>(false);
  /** When set, the position tag matching this type is promoted first and shown filled; the rest render outlined. */
  readonly activeNodePositionType = input<string | null>(null);

  readonly getContrastColor = getContrastColor;
  readonly ICON_OBSERVACIONS = ICON_OBSERVACIONS;

  readonly sortedPositions = computed(() => {
    const posType = this.activeNodePositionType();
    const positions = this.info().positions;
    if (!posType) return positions;
    return [...positions].sort((a, b) => Number(this.isPositionMatch(b)) - Number(this.isPositionMatch(a)));
  });

  isPositionMatch(pos: AvailablePersonPosition): boolean {
    const posType = this.activeNodePositionType();
    if (!posType) return true;
    return (pos.positionTypes ?? []).includes(posType);
  }

  private readonly statusBadgeClasses: Record<AttendanceStatus, string> = {
    PENDENT: 'badge-ghost',
    ANIRE: 'badge-success',
    NO_VAIG: 'badge-error',
    ASSISTIT: 'badge-success',
  };

  formatHeight(): string {
    const h = this.info().shoulderHeight;
    if (h === null || h === 0) return '';
    if (this.heightMode() === 'relative') {
      const diff = h - SHOULDER_HEIGHT_BASELINE_CM;
      return diff >= 0 ? `+${diff}` : `${diff}`;
    }
    return `${h} cm`;
  }

  statusBadgeClass(): string {
    const status = this.info().attendanceStatus;
    if (!status) return 'badge-ghost';
    if (status === 'ANIRE' && this.isPast()) return 'badge-warning';
    return this.statusBadgeClasses[status];
  }

  statusLabel(): string {
    const status = this.info().attendanceStatus;
    if (!status) return '';
    const past = this.isPast();
    const labels: Record<AttendanceStatus, string> = {
      PENDENT: 'Pendent',
      ANIRE: past ? 'No presentat' : 'Aniré',
      NO_VAIG: past ? 'No va anar' : 'No vaig',
      ASSISTIT: 'Assistit',
    };
    return labels[status];
  }
}
