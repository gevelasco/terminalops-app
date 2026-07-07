import { Routes } from '@angular/router';

export const usuariosRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/usuarios-page.component').then((m) => m.UsuariosPageComponent),
  },
];
