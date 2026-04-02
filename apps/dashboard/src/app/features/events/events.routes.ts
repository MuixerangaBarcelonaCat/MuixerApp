import { Routes } from '@angular/router';

export const eventsRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/event-list/event-list.component').then((m) => m.EventListComponent),
  },
  {
    path: 'sync',
    loadComponent: () =>
      import('./components/event-sync/event-sync.component').then((m) => m.EventSyncComponent),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./components/event-detail/event-detail.component').then((m) => m.EventDetailComponent),
  },
];
