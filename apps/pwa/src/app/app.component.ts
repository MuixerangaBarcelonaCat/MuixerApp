import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SplashScreenComponent } from './shared/components/splash-screen/splash-screen.component';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, SplashScreenComponent],
  template: `
    @if (showSplash()) {
      <app-splash-screen />
    }
    <router-outlet />
  `,
})
export class AppComponent {
  showSplash = signal(false);
}
