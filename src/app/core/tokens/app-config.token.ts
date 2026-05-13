import { InjectionToken } from '@angular/core';

export interface AppConfig {
  apiUrl: string;
  production: boolean;
  authDevBypass: boolean;
}

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');
