import { Routes } from '@angular/router';

export const maniobraRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/maniobra-page.component').then((m) => m.ManiobraPageComponent),
  },
];
