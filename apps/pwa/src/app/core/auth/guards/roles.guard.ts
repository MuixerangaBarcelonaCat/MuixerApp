import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserRole } from '@muixer/shared';
import { AuthService } from '../services/auth.service';

/**
 * @param allowedRoles roles permitted to activate the route.
 * @param signOutOnDeny when true (default, for the top-level AppShell guard), a role mismatch
 *   clears the session and redirects to /login — the user doesn't belong in this app at all.
 *   Pass false for a child-route guard where denial should just bounce back within the app
 *   without signing the user out (e.g. a MEMBER hitting a TECHNICAL-only bookmarked link).
 */
export const rolesGuard = (
  allowedRoles: UserRole[],
  signOutOnDeny = true,
): CanActivateFn => {
  return async (route) => {
    const auth = inject(AuthService);
    const router = inject(Router);

    await auth.whenReady();

    const role = auth.userRole();
    if (role && allowedRoles.includes(role)) return true;

    if (!signOutOnDeny) {
      const eventId = route.paramMap.get('id');
      return router.createUrlTree(eventId ? ['/events', eventId] : ['/home']);
    }

    if (role) {
      auth.clearState();
    }
    return router.createUrlTree(['/login']);
  };
};
