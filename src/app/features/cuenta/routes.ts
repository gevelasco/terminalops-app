import { Routes } from '@angular/router';

export const cuentaRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/cuenta-page.component').then((m) => m.CuentaPageComponent),
  },
];
