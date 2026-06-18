import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, catchError, of } from 'rxjs';
import { EventType, MeEvent } from '@muixer/shared';
import { EventService } from '../../events/services/event.service';

export interface HomeData {
  nextRehearsals: MeEvent[];
  nextPerformances: MeEvent[];
}

@Injectable({ providedIn: 'root' })
export class HomeService {
  private readonly eventService = inject(EventService);

  loadHomeData(): Observable<HomeData> {
    return forkJoin({
      nextRehearsals: this.eventService
        .findAll({ timeFilter: 'upcoming', type: EventType.ASSAIG, limit: 2 })
        .pipe(
          map((r) => r.data),
          catchError(() => of([])),
        ),
      nextPerformances: this.eventService
        .findAll({ timeFilter: 'upcoming', type: EventType.ACTUACIO, limit: 2 })
        .pipe(
          map((r) => r.data),
          catchError(() => of([])),
        ),
    });
  }
}
