import { Route } from '@angular/router';

export const personsRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./components/person-list.component').then((m) => m.PersonListComponent),
  },
];
