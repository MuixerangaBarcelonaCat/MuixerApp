import { Routes } from '@angular/router';
import { ConfigComponent } from './config.component';
import { UserListComponent } from './components/user-list.component';
import { PositionListComponent } from './components/position-list/position-list.component';
import { SeasonListComponent } from './components/season-list/season-list.component';

export const configRoutes: Routes = [
  { path: '', component: ConfigComponent },
  { path: 'users', component: UserListComponent, data: { title: 'Usuaris' } },
  { path: 'tags', component: PositionListComponent, data: { title: 'Etiquetes' } },
  { path: 'seasons', component: SeasonListComponent, data: { title: 'Temporades' } },
];
