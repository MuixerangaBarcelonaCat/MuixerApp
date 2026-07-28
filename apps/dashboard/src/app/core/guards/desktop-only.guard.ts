import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { ToastService } from '../../shared/components/feedback/toast/toast.service';

/**
 * Blocks navigation to desktop-only routes (template editor, composition editor, segment assignment)
 * when accessed from mobile viewports (< 1024px width).
 *
 * Mobile users are redirected to /pinyes with an error toast.
 *
 * Usage:
 * ```typescript
 * { path: 'templates/new', component: TemplateEditorComponent, canActivate: [desktopOnlyGuard] }
 * ```
 */
export const desktopOnlyGuard: CanActivateFn = () => {
  const router = inject(Router);
  const toast = inject(ToastService);

  const isMobile = window.innerWidth < 1024;

  if (isMobile) {
    toast.error('Aquesta funcionalitat només està disponible en dispositius d\'escriptori o tauleta.');
    router.navigate(['/pinyes']);
    return false;
  }

  return true;
};
