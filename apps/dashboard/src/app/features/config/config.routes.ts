import { Routes } from '@angular/router';
import { ConfigComponent } from './config.component';
import { ConfigPlaceholderComponent } from './components/config-placeholder.component';
import { UserListComponent } from './components/user-list.component';
import { PositionListComponent } from './components/position-list/position-list.component';

export const configRoutes: Routes = [
  { path: '', component: ConfigComponent },
  { path: 'users', component: UserListComponent, data: { title: 'Usuaris' } },
  { path: 'tags', component: PositionListComponent, data: { title: 'Etiquetes' } },
  { path: 'seasons', component: ConfigPlaceholderComponent, data: { title: 'Temporades' } },
];
