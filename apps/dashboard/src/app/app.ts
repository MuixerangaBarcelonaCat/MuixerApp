import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { HeaderComponent } from './shared/components/layout/header/header.component';
import { UserChipComponent } from './shared/components/layout/user-chip/user-chip.component';
import { TabNavComponent } from './shared/components/layout/tab-nav/tab-nav.component';
import { LayoutService } from './core/services/layout.service';
import { ToastComponent } from './shared/components/feedback/toast/toast.component';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterModule,
    HeaderComponent,
    UserChipComponent,
    TabNavComponent,
    ToastComponent,
  ],
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App {
  private readonly router = inject(Router);
  protected readonly layout = inject(LayoutService);

  mobileMenuOpen = signal(false);

  readonly isAuthRoute = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => (e as NavigationEnd).urlAfterRedirects.startsWith('/login')),
      startWith(this.router.url.startsWith('/login')),
    ),
    { initialValue: false },
  );
}
