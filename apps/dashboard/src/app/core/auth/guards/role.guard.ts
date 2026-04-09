import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserRole } from '@muixer/shared';
import { AuthService } from '../services/auth.service';

/**
 * Guard basat en llista explícita de roles permesos.
 * No hi ha jerarquia implícita: cada ruta declara exactament quins roles hi poden accedir.
 *
 * Exemple:
 *   rolesGuard(UserRole.TECHNICAL, UserRole.ADMIN)
 */
export const rolesGuard = (...allowedRoles: UserRole[]): CanActivateFn =>
  () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const role = auth.userRole();
    if (role && allowedRoles.includes(role)) return true;
    return router.createUrlTree(['/login']);
  };
