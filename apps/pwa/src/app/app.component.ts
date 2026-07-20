import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SplashScreenComponent } from './shared/components/splash-screen/splash-screen.component';
import { ToastContainerComponent } from './shared/components/toast-container/toast-container.component';
import { AuthService } from './core/auth/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, SplashScreenComponent, ToastContainerComponent],
  template: `
    @if (showSplash()) {
      <app-splash-screen />
    }
    <router-outlet />
    <app-toast-container />
  `,
})
export class AppComponent {
  private readonly auth = inject(AuthService);
  showSplash = computed(() => !this.auth.isReady());
}
