import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
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
  ],
};
