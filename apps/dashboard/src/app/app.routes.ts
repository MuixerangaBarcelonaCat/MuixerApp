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
      { path: '', redirectTo: 'persons', pathMatch: 'full' },
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
    ],
  },
];
