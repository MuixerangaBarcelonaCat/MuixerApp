import { Routes } from '@angular/router';
import { UserRole } from '@muixer/shared';
import { rolesGuard } from '../../core/auth/guards/role.guard';
import { ConfigComponent } from './config.component';
import { UserListComponent } from './components/user-list.component';
import { TagsListComponent } from './components/tags-list/tags-list.component';
import { TagDetailComponent } from './components/tag-detail/tag-detail.component';
import { SeasonListComponent } from './components/season-list/season-list.component';
import { LegalDocumentsComponent } from './components/legal-documents/legal-documents.component';

export const configRoutes: Routes = [
  { path: '', component: ConfigComponent },
  { path: 'users', component: UserListComponent, data: { title: 'Usuaris' } },
  { path: 'tags', component: TagsListComponent, data: { title: 'Etiquetes' } },
  { path: 'tags/:id', component: TagDetailComponent, data: { title: "Detall d'etiqueta" } },
  { path: 'seasons', component: SeasonListComponent, data: { title: 'Temporades' } },
  {
    path: 'legal',
    component: LegalDocumentsComponent,
    data: { title: 'Privacitat i legal' },
    // Only ADMIN may edit the Privacy Policy / Transparency Clause texts.
    canActivate: [rolesGuard(UserRole.ADMIN)],
  },
];
