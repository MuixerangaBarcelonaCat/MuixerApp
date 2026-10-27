import {
  ApplicationConfig,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  inject,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, TitleStrategy } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideServiceWorker } from '@angular/service-worker';
import { appRoutes } from './app.routes';
import { authInterceptor } from './core/auth/interceptors/auth.interceptor';
import { AuthService } from './core/auth/services/auth.service';
import { AppTitleStrategy } from './core/services/title.strategy';
import { PINYES_RENDER_SETTINGS } from '@muixer/pinyes-render/settings';
import { CollaSettingsService } from './core/services/colla-settings.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimationsAsync(),
    provideAppInitializer(() => inject(AuthService).init()),
    { provide: PINYES_RENDER_SETTINGS, useFactory: () => inject(CollaSettingsService).renderSettings },
    provideServiceWorker('custom-sw.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    { provide: TitleStrategy, useClass: AppTitleStrategy },
  ],
};
