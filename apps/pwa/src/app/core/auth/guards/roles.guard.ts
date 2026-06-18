import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserRole } from '@muixer/shared';
import { AuthService } from '../services/auth.service';

export const rolesGuard = (...allowedRoles: UserRole[]): CanActivateFn =>
  async () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    await auth.whenReady();

    const role = auth.userRole();
    if (role && allowedRoles.includes(role)) return true;
    return router.createUrlTree(['/login']);
  };
