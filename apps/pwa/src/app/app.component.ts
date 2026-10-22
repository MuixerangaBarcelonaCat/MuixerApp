import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastContainerComponent } from '@muixer/ui';
import { SplashScreenComponent } from './shared/components/splash-screen/splash-screen.component';
import { UpdateBannerComponent } from './shared/components/update-banner/update-banner.component';
import { AuthService } from './core/auth/services/auth.service';
import { PinchZoomGuardService } from './core/services/pinch-zoom-guard.service';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, SplashScreenComponent, ToastContainerComponent, UpdateBannerComponent],
  template: `
    @if (showSplash()) {
      <app-splash-screen />
    }
    <router-outlet />
    <app-update-banner />
    <lib-toast-container />
  `,
})
export class AppComponent {
  private readonly auth = inject(AuthService);
  showSplash = computed(() => !this.auth.isReady());

  constructor() {
    inject(PinchZoomGuardService).install();
  }
}
