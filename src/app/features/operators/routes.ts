import { Routes } from '@angular/router';

export const operatorsRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/operators-page.component').then((m) => m.OperatorsPageComponent),
  },
];
