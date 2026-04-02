import { Routes } from '@angular/router';
import { EventType } from '@muixer/shared';

const listRoute = (eventType: EventType) => ({
  path: '',
  loadComponent: () =>
    import('./components/event-list/event-list.component').then((m) => m.EventListComponent),
  data: { eventType },
});

const syncRoute = (eventType: EventType) => ({
  path: 'sync',
  loadComponent: () =>
    import('./components/event-sync/event-sync.component').then((m) => m.EventSyncComponent),
  data: { eventType },
});

const detailRoute = {
  path: ':id',
  loadComponent: () =>
    import('./components/event-detail/event-detail.component').then((m) => m.EventDetailComponent),
};

export const rehearsalRoutes: Routes = [
  listRoute(EventType.ASSAIG),
  syncRoute(EventType.ASSAIG),
  detailRoute,
];

export const performanceRoutes: Routes = [
  listRoute(EventType.ACTUACIO),
  syncRoute(EventType.ACTUACIO),
  detailRoute,
];
