import { Route } from '@angular/router';
import { UserRole } from '@muixer/shared';
import { authGuard } from './core/auth/guards/auth.guard';
import { rolesGuard } from './core/auth/guards/role.guard';
import { LoginComponent } from './features/auth/login/login.component';

export const appRoutes: Route[] = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    canActivate: [authGuard, rolesGuard(UserRole.TECHNICAL, UserRole.ADMIN)],
    children: [
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      {
        path: 'home',
        loadChildren: () =>
          import('./features/home/home.routes').then((m) => m.homeRoutes),
      },
      {
        path: 'persons',
        loadChildren: () =>
          import('./features/persons/persons.routes').then((m) => m.personsRoutes),
      },
      {
        path: 'rehearsals',
        loadChildren: () =>
          import('./features/events/events.routes').then((m) => m.rehearsalRoutes),
      },
      {
        path: 'performances',
        loadChildren: () =>
          import('./features/events/events.routes').then((m) => m.performanceRoutes),
      },
      {
        path: 'sync',
        loadChildren: () =>
          import('./features/sync/sync.routes').then((m) => m.syncRoutes),
      },
      {
        path: 'pinyes',
        loadChildren: () =>
          import('./features/pinyes/pinyes.routes').then((m) => m.pinyesRoutes),
      },
      {
        path: 'config',
        loadChildren: () =>
          import('./features/config/config.routes').then((m) => m.configRoutes),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
