import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, finalize, map, Observable, of, share, tap } from 'rxjs';
import { ClientType } from '@muixer/shared';
import { AuthResponse, LoginRequest, UserProfile } from '../models/auth.models';
import { ToastService } from '../../../shared/services/toast.service';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  private readonly _currentUser = signal<UserProfile | null>(null);
  private readonly _accessToken = signal<string | null>(null);
  private readonly _isReady = signal(false);

  private _readyResolve!: () => void;
  private readonly _readyPromise = new Promise<void>((resolve) => {
    this._readyResolve = resolve;
  });

  private _refreshInProgress$: Observable<void> | null = null;
  private _sessionExpiredHandled = false;

  readonly currentUser = this._currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this._currentUser() !== null);
  readonly isReady = this._isReady.asReadonly();
  readonly userRole = computed(() => this._currentUser()?.role ?? null);
  readonly hasLinkedPerson = computed(() => !!this._currentUser()?.person);

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

  handleSessionExpired(): void {
    if (this._sessionExpiredHandled) return;
    this._sessionExpiredHandled = true;
    this.clearState();
    this.toast.error('La sessió ha expirat. Torna a entrar.');
    this.router.navigate(['/login']);
    setTimeout(() => { this._sessionExpiredHandled = false; }, 2000);
  }

  login(credentials: Omit<LoginRequest, 'clientType'>): Observable<void> {
    const body: LoginRequest = { ...credentials, clientType: ClientType.PWA };
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
