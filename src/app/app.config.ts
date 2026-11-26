import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { routes } from './app.routes';
import { APP_CONFIG, AppConfig } from '@core/tokens/app-config.token';
import { environment } from '../environments/environment';

const appConfigValue: AppConfig = {
  apiUrl: environment.apiUrl,
  production: environment.production,
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    { provide: APP_CONFIG, useValue: appConfigValue },
    /**
     * SW solo en producción (build con ngsw). En desarrollo no se registra
     * para no interferir con HMR ni caches locales.
     */
    provideServiceWorker('ngsw-worker.js', {
      enabled: environment.production,
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
