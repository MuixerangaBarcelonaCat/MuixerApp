import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BottomTabBarComponent } from '../../../shared/components/bottom-tab-bar/bottom-tab-bar.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, BottomTabBarComponent],
  template: `
    <main class="min-h-screen pb-20 pt-safe-top px-4">
      <router-outlet />
    </main>
    <app-bottom-tab-bar />
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
export class AppShellComponent {}
