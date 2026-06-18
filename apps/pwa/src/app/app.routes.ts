import { Routes } from '@angular/router';
import { UserRole } from '@muixer/shared';
import { authGuard } from './core/auth/guards/auth.guard';
import { rolesGuard } from './core/auth/guards/roles.guard';
import { alreadyAuthGuard } from './core/auth/guards/already-auth.guard';

export const appRoutes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(
        (m) => m.LoginComponent,
      ),
    canActivate: [alreadyAuthGuard],
  },
  {
    path: '',
    loadComponent: () =>
      import('./core/layout/app-shell/app-shell.component').then(
        (m) => m.AppShellComponent,
      ),
    canActivate: [
      authGuard,
      rolesGuard(UserRole.MEMBER, UserRole.TECHNICAL, UserRole.ADMIN),
    ],
    children: [
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      {
        path: 'home',
        loadComponent: () =>
          import('./features/home/home.component').then(
            (m) => m.HomeComponent,
          ),
      },
      {
        path: 'events',
        loadComponent: () =>
          import('./features/events/event-list/event-list.component').then(
            (m) => m.EventListComponent,
          ),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/profile/profile.component').then(
            (m) => m.ProfileComponent,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
