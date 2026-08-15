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
    path: 'forgot-password',
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent,
      ),
    canActivate: [alreadyAuthGuard],
  },
  {
    path: 'activate',
    loadComponent: () =>
      import('./features/auth/activate/activate.component').then(
        (m) => m.ActivateComponent,
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
        title: 'Inici',
        loadComponent: () =>
          import('./features/home/home.component').then(
            (m) => m.HomeComponent,
          ),
      },
      {
        path: 'events',
        title: 'Agenda',
        loadComponent: () =>
          import('./features/events/event-list/event-list.component').then(
            (m) => m.EventListComponent,
          ),
      },
      {
        path: 'events/:id',
        title: 'Detall',
        loadComponent: () =>
          import('./features/events/event-detail/event-detail.component').then(
            (m) => m.EventDetailComponent,
          ),
      },
      {
        path: 'profile',
        title: 'Perfil',
        loadComponent: () =>
          import('./features/profile/profile.component').then(
            (m) => m.ProfileComponent,
          ),
      },
      {
        path: 'profile/settings',
        title: 'Configuració',
        loadComponent: () =>
          import('./features/profile/settings/settings.component').then(
            (m) => m.SettingsComponent,
          ),
      },
      {
        path: 'pending-dependents',
        title: 'Xicalla pendent',
        loadComponent: () =>
          import('./features/dependents/pending-dependents/pending-dependents.component').then(
            (m) => m.PendingDependentsComponent,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
