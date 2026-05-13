import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { applyStoredThemePreset } from './app/core/services/theme.service';

applyStoredThemePreset();

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
