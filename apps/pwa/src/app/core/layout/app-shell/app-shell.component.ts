import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AlertComponent } from '@muixer/ui';
import { BottomTabBarComponent } from '../../../shared/components/bottom-tab-bar/bottom-tab-bar.component';
import { ConsentModalComponent } from '../../../shared/components/consent-modal/consent-modal.component';
import { InstallPromptBannerComponent } from '../../../shared/components/install-prompt-banner/install-prompt-banner.component';
import { PushPermissionBannerComponent } from '../../../shared/components/push-permission-banner/push-permission-banner.component';
import { InstallPromptService } from '../../../shared/services/install-prompt.service';
import { AuthService } from '../../auth/services/auth.service';
import { LayoutService } from '../../services/layout.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    AlertComponent,
    BottomTabBarComponent,
    ConsentModalComponent,
    InstallPromptBannerComponent,
    PushPermissionBannerComponent,
  ],
  template: `
    <main
      [class.mx-auto]="!layout.isFullscreen()"
      [class.min-h-screen]="!layout.isFullscreen()"
      [class.w-full]="!layout.isFullscreen()"
      [class.max-w-2xl]="!layout.isFullscreen()"
      [class.pb-20]="!layout.isFullscreen()"
      [class.pt-safe-top]="!layout.isFullscreen()"
      [class.px-4]="!layout.isFullscreen()"
    >
      @if (!auth.hasLinkedPerson() && !layout.isFullscreen()) {
        <div class="mb-4">
          <lib-alert variant="warning" title="Compte no vinculat">
            <p class="text-sm">
              El compte no està vinculat a cap membre. Contacteu amb l'equip tècnic.
            </p>
          </lib-alert>
        </div>
      }
      @if (installPrompt.shouldShow()) {
        <app-install-prompt-banner />
      }
      <router-outlet />
    </main>
    @if (!layout.isFullscreen()) {
      <app-bottom-tab-bar />
    }
    @if (!layout.isFullscreen()) {
      <app-push-permission-banner />
    }

    @if (auth.requiresPrivacyConsent()) {
      <app-consent-modal />
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .pt-safe-top {
      padding-top: env(safe-area-inset-top, 0px);
    }
  `,
})
export class AppShellComponent {
  protected readonly auth = inject(AuthService);
  protected readonly layout = inject(LayoutService);
  protected readonly installPrompt = inject(InstallPromptService);
}
