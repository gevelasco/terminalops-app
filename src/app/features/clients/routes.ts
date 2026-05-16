import { Routes } from '@angular/router';

export const clientsRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/clients-page.component').then((m) => m.ClientsPageComponent),
  },
];
