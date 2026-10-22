import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RefreshCw } from 'lucide-angular';
import { AlertComponent, ButtonComponent } from '@muixer/ui';
import { AppUpdateService } from '../../../core/services/app-update.service';

@Component({
  selector: 'app-update-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AlertComponent, ButtonComponent],
  template: `
    @if (appUpdate.updateReady()) {
      <div class="fixed top-0 inset-x-0 z-modal pt-safe-top px-safe">
        <div class="mx-auto max-w-2xl mt-2">
          <lib-alert variant="info" title="Hi ha una versió nova de l'app" [icon]="RefreshCw">
            <span actions class="shrink-0 self-center">
              <lib-button size="sm" (clicked)="appUpdate.update()">Actualitza</lib-button>
            </span>
          </lib-alert>
        </div>
      </div>
    }
  `,
  styles: `
    .pt-safe-top {
      padding-top: env(safe-area-inset-top, 0px);
    }
  `,
})
export class UpdateBannerComponent {
  protected readonly appUpdate = inject(AppUpdateService);
  protected readonly RefreshCw = RefreshCw;
}
