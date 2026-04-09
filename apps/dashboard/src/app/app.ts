import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { SidebarComponent } from './shared/components/layout/sidebar/sidebar.component';
import { HeaderComponent } from './shared/components/layout/header/header.component';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    SidebarComponent,
    HeaderComponent,
  ],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
})
export class App {
  private readonly router = inject(Router);

  mobileMenuOpen = signal(false);

  // Signal que detecta si la ruta actual és /login per amagar el layout (sidebar/header).
  // startWith() garanteix un valor inicial correcte quan es carrega directament /login.
  readonly isAuthRoute = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => (e as NavigationEnd).urlAfterRedirects.startsWith('/login')),
      startWith(this.router.url.startsWith('/login')),
    ),
    { initialValue: false },
  );
}
