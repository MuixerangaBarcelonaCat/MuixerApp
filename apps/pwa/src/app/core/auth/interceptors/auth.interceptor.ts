import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../../../shared/services/toast.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastService);

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
          toast.error('La sessió ha expirat. Torna a entrar.');
          router.navigate(['/login']);
          return throwError(() => refreshErr);
        }),
      );
    }),
  );
};
