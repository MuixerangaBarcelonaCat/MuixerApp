import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideAngularModule, type LucideIconData } from 'lucide-angular';

@Component({
  selector: 'lib-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  templateUrl: './empty-state.component.html',
  styleUrls: ['./empty-state.component.scss'],
})
export class EmptyStateComponent {
  // No default icon — an icon that doesn't match the context (PWA's old hardcoded `Calendar`
  // default showing up on a failed-profile-load or a generic error message) is worse than none.
  icon = input<LucideIconData>();
  message = input.required<string>();
  actionLabel = input<string>();

  clicked = output<void>();
}
