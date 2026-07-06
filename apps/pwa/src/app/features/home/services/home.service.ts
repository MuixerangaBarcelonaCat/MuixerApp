import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, catchError, of } from 'rxjs';
import { EventType, MeEvent } from '@muixer/shared';
import { EventService } from '../../events/services/event.service';

export interface HomeData {
  nextRehearsal: MeEvent | null;
  nextPerformance: MeEvent | null;
}

@Injectable({ providedIn: 'root' })
export class HomeService {
  private readonly eventService = inject(EventService);

  loadHomeData(): Observable<HomeData> {
    return forkJoin({
      nextRehearsal: this.eventService
        .findAll({ timeFilter: 'upcoming', type: EventType.ASSAIG, limit: 1 })
        .pipe(
          map((r) => r.data[0] ?? null),
          catchError(() => of(null)),
        ),
      nextPerformance: this.eventService
        .findAll({ timeFilter: 'upcoming', type: EventType.ACTUACIO, limit: 1 })
        .pipe(
          map((r) => r.data[0] ?? null),
          catchError(() => of(null)),
        ),
    });
  }
}
