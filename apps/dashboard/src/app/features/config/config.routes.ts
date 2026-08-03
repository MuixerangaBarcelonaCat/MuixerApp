import { Routes } from '@angular/router';
import { ConfigComponent } from './config.component';
import { UserListComponent } from './components/user-list.component';
import { TagsListComponent } from './components/tags-list/tags-list.component';
import { SeasonListComponent } from './components/season-list/season-list.component';
import { LegalDocumentsComponent } from './components/legal-documents/legal-documents.component';

export const configRoutes: Routes = [
  { path: '', component: ConfigComponent },
  { path: 'users', component: UserListComponent, data: { title: 'Usuaris' } },
  { path: 'tags', component: TagsListComponent, data: { title: 'Etiquetes' } },
  { path: 'seasons', component: SeasonListComponent, data: { title: 'Temporades' } },
  { path: 'legal', component: LegalDocumentsComponent, data: { title: 'Privacitat i legal' } },
];
