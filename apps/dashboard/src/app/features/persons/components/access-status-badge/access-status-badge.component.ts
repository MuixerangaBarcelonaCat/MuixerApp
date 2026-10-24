import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ACCESS_STATUS_LABELS, AccessStatus } from '@muixer/shared';
import { BadgeComponent, BadgeSize, BadgeVariant } from '@muixer/ui';

/** Semantic colors, as in the attendance list; «Sense accés» is a quiet outline, not an alarm. */
const VARIANTS: Record<AccessStatus, BadgeVariant> = {
  [AccessStatus.ACTIVE]: 'success',
  [AccessStatus.INVITED]: 'warning',
  [AccessStatus.INVITE_EXPIRED]: 'error',
  [AccessStatus.MANAGED]: 'info',
  [AccessStatus.NONE]: 'neutral',
};

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
  protected readonly outline = computed(() => this.status() === AccessStatus.NONE);
}
