import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, finalize, map, Observable, of, share, tap } from 'rxjs';
import { AuthResponse, ClientType, LoginRequest, UserProfile } from '@muixer/shared';
import { ToastService } from '../../../shared/services/toast.service';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  /**
   * Marks (in localStorage) that this device has had an authenticated session, so the
   * bootstrap silent-refresh — and its noisy 401/403 console error — is skipped for
   * visitors who have never logged in (e.g. the login page). The refresh token is an
   * httpOnly cookie we can't read, hence this hint.
   */
  private static readonly SESSION_HINT_KEY = 'muixer_has_session';

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
  /** True when the authenticated user must (re)accept the privacy policy before using the app. */
  readonly requiresPrivacyConsent = computed(
    () => this._currentUser()?.requiresPrivacyConsent ?? false,
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
    this.clearSessionHint();
  }

  private hasSessionHint(): boolean {
    try {
      return localStorage.getItem(AuthService.SESSION_HINT_KEY) === '1';
    } catch {
      return false;
    }
  }

  private setSessionHint(): void {
    try {
      localStorage.setItem(AuthService.SESSION_HINT_KEY, '1');
    } catch {
      // localStorage unavailable (private mode) — refresh still works, just without the optimisation.
    }
  }

  private clearSessionHint(): void {
    try {
      localStorage.removeItem(AuthService.SESSION_HINT_KEY);
    } catch {
      // ignore
    }
  }

  handleSessionExpired(): void {
    if (this._sessionExpiredHandled) return;
    this._sessionExpiredHandled = true;
    this.clearState();
    this.toast.error('La sessió ha caducat. Torneu a entrar.');
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
          this.setSessionHint();
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
          this.setSessionHint();
        }),
        map(() => void 0),
        finalize(() => {
          this._refreshInProgress$ = null;
        }),
        share(),
      );

    return this._refreshInProgress$;
  }

  /**
   * Registra l'acceptació de la política de privacitat i actualitza l'usuari en memòria amb el
   * perfil retornat (fa que `requiresPrivacyConsent` passi a false i el modal es tanqui).
   * Nota: crida `/consent/...`, NO `/auth/...` — l'interceptor treu el Bearer a les rutes `/auth/`.
   */
  acceptPrivacyConsent(): Observable<void> {
    return this.http
      .post<UserProfile>(
        `${environment.apiUrl}/consent/privacy-policy`,
        {},
        { withCredentials: true },
      )
      .pipe(
        tap((user) => this._currentUser.set(user)),
        map(() => void 0),
      );
  }

  /** Sol·licita un correu de recuperació de contrasenya. No indica si l'email existeix (evita enumeració de comptes). */
  requestPasswordReset(email: string): Observable<void> {
    return this.http
      .post<{ message: string }>(`${environment.apiUrl}/auth/forgot-password`, { email })
      .pipe(map(() => void 0));
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
    if (!this.hasSessionHint()) {
      this.markReady();
      return;
    }

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
