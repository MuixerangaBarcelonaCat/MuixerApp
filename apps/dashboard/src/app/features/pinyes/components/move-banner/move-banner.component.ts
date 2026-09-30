import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonComponent } from '@muixer/ui';
import { LucideAngularModule, X } from 'lucide-angular';

/**
 * Small floating notice shown while a person is being moved (right-click / long-press a person,
 * then press the destination). Non-blocking: it only says who is moving and offers a cross to
 * cancel. Positioning is up to the host (it is a plain inline pill).
 */
@Component({
  selector: 'app-move-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, ButtonComponent],
  templateUrl: './move-banner.component.html',
})
export class MoveBannerComponent {
  readonly alias = input.required<string>();
  readonly cancelled = output<void>();

  readonly X = X;
}
