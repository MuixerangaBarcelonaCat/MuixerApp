import { Routes } from '@angular/router';
import { CommunicationComponent } from './communication.component';
import { NewsListComponent } from './components/news-list/news-list.component';
import { NewsEditorComponent } from './components/news-editor/news-editor.component';
import { NotificationSendComponent } from './components/notification-send/notification-send.component';
import { DeviceListComponent } from './components/device-list/device-list.component';

export const communicationRoutes: Routes = [
  { path: '', component: CommunicationComponent },
  { path: 'news', component: NewsListComponent, data: { title: 'Notícies' } },
  { path: 'news/new', component: NewsEditorComponent, data: { title: 'Notícia nova' } },
  { path: 'news/:id/edit', component: NewsEditorComponent, data: { title: 'Edita la notícia' } },
  { path: 'notifications', component: NotificationSendComponent, data: { title: 'Enviar notificació' } },
  { path: 'notifications/devices', component: DeviceListComponent, data: { title: 'Dispositius subscrits' } },
];
