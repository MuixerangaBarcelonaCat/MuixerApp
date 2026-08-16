import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map } from 'rxjs';
import { EventType, MeEvent, MeNewsItem } from '@muixer/shared';
import { EventService } from '../../events/services/event.service';
import { NewsService } from '../../news/services/news.service';

export interface HomeData {
  nextRehearsal: MeEvent | null;
  nextPerformance: MeEvent | null;
  news: MeNewsItem[];
}

@Injectable({ providedIn: 'root' })
export class HomeService {
  private readonly eventService = inject(EventService);
  private readonly newsService = inject(NewsService);

  loadHomeData(): Observable<HomeData> {
    return forkJoin({
      nextRehearsal: this.eventService
        .findAll({ timeFilter: 'upcoming', type: EventType.ASSAIG, limit: 1 })
        .pipe(map((r) => r.data[0] ?? null)),
      nextPerformance: this.eventService
        .findAll({ timeFilter: 'upcoming', type: EventType.ACTUACIO, limit: 1 })
        .pipe(map((r) => r.data[0] ?? null)),
      news: this.newsService.findAll(),
    });
  }
}
