import { Route } from '@angular/router';

export const appRoutes: Route[] = [
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
];
