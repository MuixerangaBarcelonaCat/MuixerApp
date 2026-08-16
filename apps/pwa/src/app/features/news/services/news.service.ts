import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MeNewsItem } from '@muixer/shared';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class NewsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/me/news`;

  findAll(): Observable<MeNewsItem[]> {
    return this.http.get<MeNewsItem[]>(this.baseUrl);
  }

  findOne(id: string): Observable<MeNewsItem> {
    return this.http.get<MeNewsItem>(`${this.baseUrl}/${id}`);
  }
}
