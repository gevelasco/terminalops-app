import { Routes } from '@angular/router';

export const usersRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/users-page.component').then((m) => m.UsersPageComponent),
  },
];
