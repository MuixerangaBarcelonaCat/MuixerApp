import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BottomTabBarComponent } from '../../../shared/components/bottom-tab-bar/bottom-tab-bar.component';
import { NoPersonBannerComponent } from '../../../shared/components/no-person-banner/no-person-banner.component';
import { ConsentModalComponent } from '../../../shared/components/consent-modal/consent-modal.component';
import { AuthService } from '../../auth/services/auth.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, BottomTabBarComponent, NoPersonBannerComponent, ConsentModalComponent],
  template: `
    <main class="mx-auto min-h-screen w-full max-w-2xl pb-20 pt-safe-top px-4">
      @if (!auth.hasLinkedPerson()) {
        <app-no-person-banner />
      }
      <router-outlet />
    </main>
    <app-bottom-tab-bar />

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
}
