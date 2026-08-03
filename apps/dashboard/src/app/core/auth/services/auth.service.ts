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

  /**
   * Marks (in localStorage) that this device has had an authenticated session.
   * The refresh token itself is an httpOnly cookie we can't read, so this hint
   * lets us skip the bootstrap silent-refresh — and its noisy 401/403 console
   * error — for visitors who have never logged in (e.g. the login page).
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

  readonly currentUser = this._currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this._currentUser() !== null);
  readonly isReady = this._isReady.asReadonly();
  readonly userRole = computed(() => this._currentUser()?.role ?? null);
  readonly isAtLeastTechnical = computed(() =>
    [UserRole.TECHNICAL, UserRole.ADMIN].includes(this.userRole()!),
  );
  /** True when the authenticated user must (re)accept the privacy policy before using the app. */
  readonly requiresPrivacyConsent = computed(
    () => this._currentUser()?.requiresPrivacyConsent ?? false,
  );

  /** Retorna l'access token actual en memòria. Usat per l'interceptor d'auth per afegir la capçalera Bearer. */
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

  /** Retorna una Promise que es resol quan el silent refresh inicial ha finalitzat. Guards i resolvers han d'esperar-la. */
  whenReady(): Promise<void> {
    return this._readyPromise;
  }

  /** Neteja l'estat d'autenticació en memòria (access token + usuari) i el hint de sessió. No revoca tokens al backend. */
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
      // localStorage unavailable (private mode / SSR) — refresh still works, just without the optimisation.
    }
  }

  private clearSessionHint(): void {
    try {
      localStorage.removeItem(AuthService.SESSION_HINT_KEY);
    } catch {
      // ignore
    }
  }

  /** Envia les credencials al backend, desa l'access token en memòria i estableix la cookie httpOnly del refresh token. */
  login(credentials: Omit<LoginRequest, 'clientType'>): Observable<void> {
    const body: LoginRequest = { ...credentials, clientType: ClientType.DASHBOARD };
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

  /** Revoca el refresh token de la sessió actual i neteja l'estat local. Si la petició falla, neteja l'estat igualment (fail-safe). */
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

  /** Revoca tots els tokens de l'usuari (tots els dispositius), neteja l'estat i redirigeix al login. */
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

  /**
   * Crida el refresh en segon pla al bootstrap. Si no hi ha hint de sessió en aquest
   * dispositiu (mai s'ha iniciat sessió), s'omet la crida per evitar un 401/403 sorollós
   * a la consola (p. ex. a la pantalla de login). Si falla, neteja l'estat i marca `isReady` igualment.
   */
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

  /** Marca l'inicialització com a completada: activa el signal `isReady` i resol la Promise de `whenReady()`. */
  private markReady(): void {
    this._isReady.set(true);
    this._readyResolve();
  }
}
