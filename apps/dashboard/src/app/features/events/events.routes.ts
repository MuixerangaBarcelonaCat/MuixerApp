import { Routes } from '@angular/router';
import { EventType } from '@muixer/shared';

/**
 * Factory que genera una ruta de llistat d'events.
 * Reutilitza EventListComponent per a diferents tipus d'event (assajos/actuacions)
 * passant el tipus via route.data.
 *
 * @param eventType - Tipus d'event (ASSAIG o ACTUACIO)
 * @returns Configuració de ruta per al llistat
 */
const listRoute = (eventType: EventType) => ({
  path: '',
  loadComponent: () =>
    import('./components/event-list/event-list.component').then((m) => m.EventListComponent),
  data: { eventType },
});

/**
 * Factory que genera una ruta de sincronització d'events.
 * Reutilitza EventSyncComponent per a diferents tipus d'event
 * passant el tipus via route.data.
 *
 * @param eventType - Tipus d'event (ASSAIG o ACTUACIO)
 * @returns Configuració de ruta per a la sincronització
 */
const syncRoute = (eventType: EventType) => ({
  path: 'sync',
  loadComponent: () =>
    import('./components/event-sync/event-sync.component').then((m) => m.EventSyncComponent),
  data: { eventType },
});

/**
 * Ruta de detall d'un event.
 * No necessita factory perquè el tipus es resol des de l'event carregat per :id.
 */
const detailRoute = {
  path: ':id',
  loadComponent: () =>
    import('./components/event-detail/event-detail.component').then((m) => m.EventDetailComponent),
};

/**
 * Rutes per a assajos (/rehearsals).
 * Inclou: llistat, sincronització i detall d'assajos.
 */
export const rehearsalRoutes: Routes = [
  listRoute(EventType.ASSAIG),
  syncRoute(EventType.ASSAIG),
  detailRoute,
];

/**
 * Rutes per a actuacions (/performances).
 * Inclou: llistat, sincronització i detall d'actuacions.
 */
export const performanceRoutes: Routes = [
  listRoute(EventType.ACTUACIO),
  syncRoute(EventType.ACTUACIO),
  detailRoute,
];
