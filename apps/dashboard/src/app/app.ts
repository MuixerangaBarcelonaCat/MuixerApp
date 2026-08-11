import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { HeaderComponent } from './shared/components/layout/header/header.component';
import { UserChipComponent } from './shared/components/layout/user-chip/user-chip.component';
import { TabNavComponent } from './shared/components/layout/tab-nav/tab-nav.component';
import { LayoutService } from './core/services/layout.service';
import { AuthService } from './core/auth/services/auth.service';
import { ToastComponent } from './shared/components/feedback/toast/toast.component';
import { PrivacyConsentModalComponent } from './shared/components/privacy-consent-modal/privacy-consent-modal.component';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterModule,
    HeaderComponent,
    UserChipComponent,
    TabNavComponent,
    ToastComponent,
    PrivacyConsentModalComponent,
  ],
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App {
  private readonly router = inject(Router);
  protected readonly layout = inject(LayoutService);
  protected readonly auth = inject(AuthService);

  mobileMenuOpen = signal(false);

  /** Public, unauthenticated pages — none of them get the header/tab-nav chrome. */
  private static readonly AUTH_ROUTE_PREFIXES = ['/login', '/forgot-password', '/reset-password'];

  private static isAuthUrl(url: string): boolean {
    return App.AUTH_ROUTE_PREFIXES.some((prefix) => url.startsWith(prefix));
  }

  readonly isAuthRoute = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => App.isAuthUrl((e as NavigationEnd).urlAfterRedirects)),
      startWith(App.isAuthUrl(this.router.url)),
    ),
    { initialValue: false },
  );
}
