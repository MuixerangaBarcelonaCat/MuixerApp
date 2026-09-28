import { Routes } from '@angular/router';
import { CommunicationComponent } from './communication.component';
import { NewsListComponent } from './components/news-list/news-list.component';
import { NewsEditorComponent } from './components/news-editor/news-editor.component';
import { NotificationSendComponent } from './components/notification-send/notification-send.component';
import { DeviceListComponent } from './components/device-list/device-list.component';
import { NotificationHistoryComponent } from './components/notification-history/notification-history.component';
import { NotificationScheduleListComponent } from './components/notification-schedule-list/notification-schedule-list.component';

export const communicationRoutes: Routes = [
  { path: '', component: CommunicationComponent },
  { path: 'news', component: NewsListComponent, data: { title: 'Notícies' } },
  { path: 'news/new', component: NewsEditorComponent, data: { title: 'Notícia nova' } },
  { path: 'news/:id/edit', component: NewsEditorComponent, data: { title: 'Edita la notícia' } },
  { path: 'notifications', component: NotificationSendComponent, data: { title: 'Envia notificació', mode: 'send' } },
  { path: 'notifications/devices', component: DeviceListComponent, data: { title: 'Dispositius subscrits' } },
  { path: 'notifications/history', component: NotificationHistoryComponent, data: { title: 'Historial de notificacions' } },
  { path: 'notifications/schedules', component: NotificationScheduleListComponent, data: { title: 'Notificacions programades' } },
  {
    path: 'notifications/schedules/new',
    component: NotificationSendComponent,
    data: { title: 'Programa notificació', mode: 'schedule' },
  },
  {
    path: 'notifications/schedules/:id/edit',
    component: NotificationSendComponent,
    data: { title: 'Edita la notificació programada', mode: 'schedule' },
  },
];
