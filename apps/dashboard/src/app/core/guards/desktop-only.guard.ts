import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { ToastService } from '@muixer/ui';

/**
 * Blocks navigation to desktop/tablet-only routes (template editor, composition editor, segment
 * assignment) when accessed from phone viewports (< 768px width, the Tailwind `md` breakpoint).
 *
 * Tablets (>= 768px, e.g. iPad portrait at 768px) are allowed through — only phones are redirected
 * to /pinyes with an error toast.
 *
 * Usage:
 * ```typescript
 * { path: 'templates/new', component: TemplateEditorComponent, canActivate: [desktopOnlyGuard] }
 * ```
 */
export const desktopOnlyGuard: CanActivateFn = () => {
  const router = inject(Router);
  const toast = inject(ToastService);

  const isMobile = window.innerWidth < 768;

  if (isMobile) {
    toast.error('Aquesta funcionalitat només està disponible en dispositius d\'escriptori o tauleta.');
    router.navigate(['/pinyes']);
    return false;
  }

  return true;
};
