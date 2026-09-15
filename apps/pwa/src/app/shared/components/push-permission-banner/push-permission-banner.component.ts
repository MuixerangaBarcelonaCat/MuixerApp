import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { LucideAngularModule, Bell } from 'lucide-angular';
import { ButtonComponent } from '@muixer/ui';
import { PushSubscriptionService } from '../../../core/services/push-subscription.service';

@Component({
  selector: 'app-push-permission-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, ButtonComponent],
  templateUrl: './push-permission-banner.component.html',
})
export class PushPermissionBannerComponent {
  protected readonly push = inject(PushSubscriptionService);
  protected readonly Bell = Bell;

  protected readonly shouldShow = computed(
    () =>
      this.push.pushSupported() &&
      this.push.pushPermission() === 'default' &&
      !this.push.isSubscribed() &&
      !this.push.isDismissedRecently(),
  );

  protected async activate(): Promise<void> {
    await this.push.requestPermissionAndSubscribe();
  }

  protected dismiss(): void {
    this.push.dismissBanner();
  }
}
