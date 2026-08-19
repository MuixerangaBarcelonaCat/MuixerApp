import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { PushSubscriptionService } from '../../../../core/services/push-subscription.service';

@Component({
  selector: 'app-push-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './push-settings.component.html',
})
export class PushSettingsComponent implements OnInit {
  protected readonly push = inject(PushSubscriptionService);

  async ngOnInit(): Promise<void> {
    await this.push.checkStatus();
  }

  protected async toggle(): Promise<void> {
    if (this.push.isSubscribed()) {
      await this.push.unsubscribe();
    } else {
      await this.push.requestPermissionAndSubscribe();
    }
  }
}
