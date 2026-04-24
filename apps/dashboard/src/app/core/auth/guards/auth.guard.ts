import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guard de ruta que protegeix qualsevol ruta que requereixi autenticació.
 * Espera que el silent refresh inicial hagi finalitzat (`whenReady()`) abans de decidir
 * per evitar redireccions innecessàries al login durant el bootstrap de l'app.
 */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.whenReady();

  return auth.isAuthenticated() ? true : router.createUrlTree(['/login']);
};
