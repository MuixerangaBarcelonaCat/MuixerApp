import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Bell } from 'lucide-angular';
import { CheckboxComponent } from '@muixer/ui';
import { PushSubscriptionService } from '../../../../core/services/push-subscription.service';

@Component({
  selector: 'app-push-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, FormsModule, CheckboxComponent],
  templateUrl: './push-settings.component.html',
})
export class PushSettingsComponent implements OnInit {
  protected readonly push = inject(PushSubscriptionService);
  protected readonly Bell = Bell;

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
