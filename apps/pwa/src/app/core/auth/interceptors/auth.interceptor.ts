import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../../environments/environment';

const AUTH_PASSTHROUGH_PATHS = ['/auth/login', '/auth/refresh'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  const isApiRequest = req.url.startsWith(environment.apiUrl);
  if (!isApiRequest) return next(req);

  const isAuthPassthrough = AUTH_PASSTHROUGH_PATHS.some((path) =>
    req.url.startsWith(`${environment.apiUrl}${path}`),
  );
  if (isAuthPassthrough) {
    return next(req.clone({ withCredentials: true }));
  }

  const token = authService.getAccessToken();
  const authReq = req.clone({
    withCredentials: true,
    ...(token ? { setHeaders: { Authorization: `Bearer ${token}` } } : {}),
  });

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401) return throwError(() => err);

      return authService.refresh().pipe(
        catchError((refreshErr) => {
          authService.handleSessionExpired();
          return throwError(() => refreshErr);
        }),
        switchMap(() => {
          const newToken = authService.getAccessToken();
          const retryReq = req.clone({
            withCredentials: true,
            ...(newToken ? { setHeaders: { Authorization: `Bearer ${newToken}` } } : {}),
          });
          return next(retryReq);
        }),
      );
    }),
  );
};
