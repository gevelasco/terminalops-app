import { Routes } from '@angular/router';

export const reportsRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/reports-page.component').then((m) => m.ReportsPageComponent),
  },
];
