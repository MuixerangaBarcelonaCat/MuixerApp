import { Component, ChangeDetectionStrategy, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { NotificationLinkType } from '@muixer/shared';
import { ButtonComponent, ButtonGroupComponent } from '@muixer/ui';
import { NotificationLinkValue } from '../../services/notification.service';

@Component({
  selector: 'app-notification-link-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule, ButtonComponent, ButtonGroupComponent],
  templateUrl: './notification-link-picker.component.html',
})
export class NotificationLinkPickerComponent {
  readonly LinkType = NotificationLinkType;

  link = model.required<NotificationLinkValue>();
  hasLinkedEvent = input(false);

  setType(type: NotificationLinkType): void {
    this.link.set({ type, url: type === NotificationLinkType.CUSTOM ? this.link().url : undefined });
  }

  setUrl(url: string): void {
    this.link.update((l) => ({ ...l, url }));
  }
}
