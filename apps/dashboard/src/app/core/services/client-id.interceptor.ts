import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { ClientIdService } from './client-id.service';

/**
 * Tags every request with this tab's id, so the API can attribute a resulting
 * live-push change to its origin — letting that same tab recognize the change
 * as its own echo instead of showing itself a "someone else changed this" banner.
 */
export const clientIdInterceptor: HttpInterceptorFn = (req, next) => {
  const clientId = inject(ClientIdService).id;
  return next(req.clone({ setHeaders: { 'X-Client-Id': clientId } }));
};
