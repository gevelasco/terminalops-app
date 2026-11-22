import { Routes } from '@angular/router';

/**
 * Configuración:
 * - /settings → /settings/controles
 * - /settings/controles
 * - /settings/users
 * - /settings/datos
 */
export const settingsRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'controles' },
  {
    path: ':settingsTab',
    loadComponent: () =>
      import('./pages/settings-page.component').then((m) => m.SettingsPageComponent),
  },
];