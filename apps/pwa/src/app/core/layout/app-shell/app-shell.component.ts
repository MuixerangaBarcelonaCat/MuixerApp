import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BottomTabBarComponent } from '../../../shared/components/bottom-tab-bar/bottom-tab-bar.component';
import { NoPersonBannerComponent } from '../../../shared/components/no-person-banner/no-person-banner.component';
import { ConsentModalComponent } from '../../../shared/components/consent-modal/consent-modal.component';
import { AuthService } from '../../auth/services/auth.service';
import { LayoutService } from '../../services/layout.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, BottomTabBarComponent, NoPersonBannerComponent, ConsentModalComponent],
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
        <app-no-person-banner />
      }
      <router-outlet />
    </main>
    @if (!layout.isFullscreen()) {
      <app-bottom-tab-bar />
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
}
