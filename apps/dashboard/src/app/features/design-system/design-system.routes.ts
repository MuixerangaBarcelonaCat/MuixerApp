import { Routes } from '@angular/router';
import { UserRole } from '@muixer/shared';
import { rolesGuard } from '../../core/auth/guards/role.guard';
import { DesignSystemComponent } from './design-system.component';

export const designSystemRoutes: Routes = [
  {
    path: '',
    component: DesignSystemComponent,
    data: { title: 'Design System' },
    // Internal build tool, not a real end-user feature — ADMIN only, unlike the rest of the
    // dashboard which is TECHNICAL+ADMIN.
    canActivate: [rolesGuard(UserRole.ADMIN)],
  },
];
