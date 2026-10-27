import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ACCESS_STATUS_LABELS, AccessStatus } from '@muixer/shared';
import { BadgeComponent, BadgeSize, BadgeVariant, badgeClasses } from '@muixer/ui';

/** Semantic colors, as in the attendance list; «Sense accés» is a quiet outline, not an alarm. */
const VARIANTS: Record<AccessStatus, BadgeVariant> = {
  [AccessStatus.ACTIVE]: 'success',
  [AccessStatus.INVITED]: 'warning',
  [AccessStatus.INVITE_EXPIRED]: 'error',
  [AccessStatus.MANAGED]: 'info',
  [AccessStatus.NONE]: 'neutral',
};

const isOutlined = (status: AccessStatus) => status === AccessStatus.NONE;

/** The badge's classes, for raw-markup callers such as a data-table `badge` column. */
export function accessStatusBadgeClass(status: AccessStatus, size: BadgeSize = 'sm'): string {
  return [badgeClasses(VARIANTS[status], size), isOutlined(status) ? 'badge-outline' : ''].filter(Boolean).join(' ');
}

@Component({
  selector: 'app-access-status-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent],
  template: `<lib-badge [variant]="variant()" [outline]="outline()" [size]="size()">{{ label() }}</lib-badge>`,
})
export class AccessStatusBadgeComponent {
  status = input.required<AccessStatus>();
  size = input<BadgeSize>('sm');

  protected readonly label = computed(() => ACCESS_STATUS_LABELS[this.status()]);
  protected readonly variant = computed(() => VARIANTS[this.status()]);
  protected readonly outline = computed(() => isOutlined(this.status()));
}
