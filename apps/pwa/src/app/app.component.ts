import { Component, ChangeDetectionStrategy, inject, computed, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { HostMovedComponent, movedHostUrl } from './shared/components/host-moved/host-moved.component';
import { ToastContainerComponent } from '@muixer/ui';
import { SplashScreenComponent } from './shared/components/splash-screen/splash-screen.component';
import { UpdateBannerComponent } from './shared/components/update-banner/update-banner.component';
import { AuthService } from './core/auth/services/auth.service';
import { PinchZoomGuardService } from './core/services/pinch-zoom-guard.service';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, SplashScreenComponent, ToastContainerComponent, UpdateBannerComponent, HostMovedComponent],
  template: `
    @if (movedTo(); as url) {
      <app-host-moved [url]="url" />
    } @else {
      @if (showSplash()) {
        <app-splash-screen />
      }
      <router-outlet />
      <app-update-banner />
      <lib-toast-container />
    }
  `,
})
export class AppComponent {
  private readonly auth = inject(AuthService);
  showSplash = computed(() => !this.auth.isReady());
  protected readonly movedTo = signal<string | null>(null);

  constructor() {
    inject(PinchZoomGuardService).install();
    this.checkPublicHost(inject(DOCUMENT).location.host);
  }

  // Background check, never blocks boot. Plain fetch (not HttpClient) keeps it out of the
  // auth interceptor; any failure (dev server, offline, unset var) leaves the app as is.
  private checkPublicHost(host: string): void {
    fetch('/app-host.txt', { cache: 'no-store' })
      .then((res) => (res.ok ? res.text() : null))
      .then((body) => this.movedTo.set(movedHostUrl(body, host)))
      .catch(() => undefined);
  }
}
