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

/**
 * Servei base per a les crides HTTP a l'API de MuixerApp.
 * Tots els serveis de features hereten d'aquest per tenir accés als mètodes HTTP amb el `baseUrl` preconfigutat.
 * L'autenticació (capçalera Bearer) s'afegeix automàticament via `authInterceptor`.
 */
@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly http = inject(HttpClient);
  protected readonly baseUrl = environment.apiUrl;

  /** Realitza una petició GET a `{baseUrl}{path}`. */
  protected get<T>(path: string, options?: HttpOptions): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}${path}`, options);
  }

  /** Realitza una petició POST a `{baseUrl}{path}` amb el body indicat. */
  protected post<T>(path: string, body: unknown, options?: HttpOptions): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}${path}`, body, options);
  }

  /** Realitza una petició PUT a `{baseUrl}{path}` amb el body indicat (substitució completa). */
  protected put<T>(path: string, body: unknown, options?: HttpOptions): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}${path}`, body, options);
  }

  /** Realitza una petició PATCH a `{baseUrl}{path}` (actualització parcial). */
  protected patch<T>(path: string, body: unknown, options?: HttpOptions): Observable<T> {
    return this.http.patch<T>(`${this.baseUrl}${path}`, body, options);
  }

  /** Realitza una petició DELETE a `{baseUrl}{path}`. */
  protected delete<T>(path: string, options?: HttpOptions): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}${path}`, options);
  }
}
