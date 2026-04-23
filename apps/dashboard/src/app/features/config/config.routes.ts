import { Routes } from '@angular/router';
import { ConfigComponent } from './config.component';
import { ConfigPlaceholderComponent } from './components/config-placeholder.component';

export const configRoutes: Routes = [
  { path: '', component: ConfigComponent },
  { path: 'users', component: ConfigPlaceholderComponent, data: { title: 'Usuaris' } },
  { path: 'tags', component: ConfigPlaceholderComponent, data: { title: 'Etiquetes' } },
  { path: 'seasons', component: ConfigPlaceholderComponent, data: { title: 'Temporades' } },
];
