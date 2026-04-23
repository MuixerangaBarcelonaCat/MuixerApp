import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

interface HttpOptions {
  headers?: HttpHeaders | { [header: string]: string | string[] };
  context?: HttpContext;
  observe?: 'body';
  params?: HttpParams | { [param: string]: string | number | boolean | ReadonlyArray<string | number | boolean> };
  reportProgress?: boolean;
  responseType?: 'json';
  withCredentials?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly http = inject(HttpClient);
  protected readonly baseUrl = environment.apiUrl;

  protected get<T>(path: string, options?: HttpOptions): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}${path}`, options);
  }

  protected post<T>(path: string, body: unknown, options?: HttpOptions): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}${path}`, body, options);
  }

  protected put<T>(path: string, body: unknown, options?: HttpOptions): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}${path}`, body, options);
  }

  protected patch<T>(path: string, body: unknown, options?: HttpOptions): Observable<T> {
    return this.http.patch<T>(`${this.baseUrl}${path}`, body, options);
  }

  protected delete<T>(path: string, options?: HttpOptions): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}${path}`, options);
  }
}
