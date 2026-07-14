import { Routes } from '@angular/router';

export const accountRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/account-page.component').then((m) => m.AccountPageComponent),
  },
];
