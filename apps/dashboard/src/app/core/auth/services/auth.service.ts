import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, finalize, map, Observable, of, share, tap } from 'rxjs';
import { UserRole, ClientType } from '@muixer/shared';
import { AuthResponse, LoginRequest, UserProfile } from '../models/auth.models';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _currentUser = signal<UserProfile | null>(null);
  private readonly _accessToken = signal<string | null>(null);
  private readonly _isReady = signal(false);

  private _readyResolve!: () => void;
  private readonly _readyPromise = new Promise<void>((resolve) => {
    this._readyResolve = resolve;
  });

  private _refreshInProgress$: Observable<void> | null = null;

  readonly currentUser = this._currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this._currentUser() !== null);
  readonly isReady = this._isReady.asReadonly();
  readonly userRole = computed(() => this._currentUser()?.role ?? null);
  readonly isAtLeastTechnical = computed(() =>
    [UserRole.TECHNICAL, UserRole.ADMIN].includes(this.userRole()!),
  );

  getAccessToken(): string | null {
    return this._accessToken();
  }

  /**
   * Triggers silent refresh and returns a Promise that resolves when done.
   * Called from provideAppInitializer — NOT from the constructor,
   * because HttpClient uses authInterceptor which injects AuthService back,
   * causing NG0200 circular dependency if called during construction.
   */
  init(): Promise<void> {
    this.silentRefresh();
    return this._readyPromise;
  }

  whenReady(): Promise<void> {
    return this._readyPromise;
  }

  clearState(): void {
    this._currentUser.set(null);
    this._accessToken.set(null);
  }

  login(credentials: Omit<LoginRequest, 'clientType'>): Observable<void> {
    const body: LoginRequest = { ...credentials, clientType: ClientType.DASHBOARD };
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/login`, body, { withCredentials: true })
      .pipe(
        tap((res) => {
          this._accessToken.set(res.accessToken);
          this._currentUser.set(res.user);
        }),
        map(() => void 0),
      );
  }

  /**
   * Rotates the refresh token via httpOnly cookie.
   * Concurrent callers share a single in-flight HTTP request
   * to prevent token-reuse detection on the backend.
   */
  refresh(): Observable<void> {
    if (this._refreshInProgress$) return this._refreshInProgress$;

    this._refreshInProgress$ = this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/refresh`, {}, { withCredentials: true })
      .pipe(
        tap((res) => {
          this._accessToken.set(res.accessToken);
          this._currentUser.set(res.user);
        }),
        map(() => void 0),
        finalize(() => {
          this._refreshInProgress$ = null;
        }),
        share(),
      );

    return this._refreshInProgress$;
  }

  logout(): Observable<void> {
    return this.http
      .post<void>(`${environment.apiUrl}/auth/logout`, {}, { withCredentials: true })
      .pipe(
        tap(() => this.clearState()),
        catchError(() => {
          this.clearState();
          return of(void 0);
        }),
      );
  }

  logoutAll(): Observable<void> {
    return this.http
      .post<void>(`${environment.apiUrl}/auth/logout-all`, {}, { withCredentials: true })
      .pipe(
        tap(() => {
          this.clearState();
          this.router.navigate(['/login']);
        }),
        catchError(() => {
          this.clearState();
          this.router.navigate(['/login']);
          return of(void 0);
        }),
      );
  }

  private silentRefresh(): void {
    this.refresh()
      .pipe(
        catchError(() => {
          this.clearState();
          return of(void 0);
        }),
        finalize(() => this.markReady()),
      )
      .subscribe();
  }

  private markReady(): void {
    this._isReady.set(true);
    this._readyResolve();
  }
}
