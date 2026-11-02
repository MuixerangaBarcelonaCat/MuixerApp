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
  async () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    await auth.whenReady();

    const role = auth.userRole();
    if (role && allowedRoles.includes(role)) return true;
    // Staff on a route above their role (e.g. TECHNICAL on an ADMIN-only screen) stay logged in: the
    // shell lets every staff role into /home. Members and anonymous users go to the login screen.
    const isStaff = role === UserRole.TECHNICAL || role === UserRole.ADMIN;
    return router.createUrlTree([isStaff ? '/home' : '/login']);
  };
