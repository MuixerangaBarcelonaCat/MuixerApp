import { Route } from '@angular/router';

export const personsRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./components/person-list.component').then(
        (m) => m.PersonListComponent,
      ),
  },
  {
    path: 'sync-start',
    loadComponent: () =>
      import('./components/person-sync/person-sync.component').then(
        (m) => m.PersonSyncComponent,
      ),
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./components/person-detail/person-detail.component').then(
        (m) => m.PersonDetailComponent,
      ),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./components/person-detail/person-detail.component').then(
        (m) => m.PersonDetailComponent,
      ),
  },
];
