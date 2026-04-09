import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { UserRole, ClientType } from '@muixer/shared';
import { AuthResponse, LoginRequest, UserProfile } from '../models/auth.models';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _currentUser = signal<UserProfile | null>(null);
  private readonly _accessToken = signal<string | null>(null);

  readonly currentUser = this._currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this._currentUser() !== null);
  readonly userRole = computed(() => this._currentUser()?.role ?? null);
  readonly isAtLeastTechnical = computed(() =>
    [UserRole.TECHNICAL, UserRole.ADMIN].includes(this.userRole()!),
  );

  getAccessToken(): string | null {
    return this._accessToken();
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

  refresh(): Observable<void> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/refresh`, {}, { withCredentials: true })
      .pipe(
        tap((res) => {
          this._accessToken.set(res.accessToken);
          this._currentUser.set(res.user);
        }),
        map(() => void 0),
      );
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

  loadCurrentUser(): Observable<void> {
    return this.refresh().pipe(
      catchError(() => {
        this.clearState();
        return of(void 0);
      }),
    );
  }
}
