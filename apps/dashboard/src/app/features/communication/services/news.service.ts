import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { News } from '@muixer/shared';
import { ApiService } from '../../../core/services/api.service';

export interface NewsPayload {
  title: string;
  body: string;
  publishedAt?: string | null;
}

@Injectable({ providedIn: 'root' })
export class NewsService extends ApiService {
  getAll(): Observable<News[]> {
    return this.get<News[]>('/news');
  }

  getOne(id: string): Observable<News> {
    return this.get<News>(`/news/${id}`);
  }

  create(payload: NewsPayload): Observable<News> {
    return this.post<News>('/news', payload);
  }

  update(id: string, payload: Partial<NewsPayload>): Observable<News> {
    return this.patch<News>(`/news/${id}`, payload);
  }

  remove(id: string): Observable<void> {
    return this.delete<void>(`/news/${id}`);
  }
}
