import { Routes } from '@angular/router';

export const fleetRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/fleet-page.component').then((m) => m.FleetPageComponent),
  },
];
