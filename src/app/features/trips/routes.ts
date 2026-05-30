import { Routes } from '@angular/router';

export const tripsRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/trips-page.component').then((m) => m.TripsPageComponent),
  },
];
