import { Routes } from '@angular/router';

/**
 * Comercial:
 * - /comercial → /comercial/clients
 * - /comercial/clients
 * - /comercial/destination-rates
 */
export const clientsRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'clients' },
  {
    path: ':comercialTab',
    loadComponent: () =>
      import('./pages/clients-page.component').then((m) => m.ClientsPageComponent),
  },
];
