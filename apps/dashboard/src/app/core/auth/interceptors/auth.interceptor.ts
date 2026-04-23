import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Skip auth endpoints to avoid infinite loops
  if (req.url.includes('/auth/')) {
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
        switchMap(() => {
          const newToken = authService.getAccessToken();
          const retryReq = authReq.clone({
            withCredentials: true,
            ...(newToken ? { setHeaders: { Authorization: `Bearer ${newToken}` } } : {}),
          });
          return next(retryReq);
        }),
        catchError((refreshErr) => {
          authService.clearState();
          router.navigate(['/login']);
          return throwError(() => refreshErr);
        }),
      );
    }),
  );
};
