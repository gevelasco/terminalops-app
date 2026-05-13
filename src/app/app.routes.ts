import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./core/pages/login-page.component').then((m) => m.LoginPageComponent),
  },
  {
    path: '',
    loadComponent: () => import('./core/layout/shell.component').then((m) => m.ShellComponent),
    canActivateChild: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadChildren: () =>
          import('./features/dashboard/routes').then((m) => m.dashboardRoutes),
      },
      {
        path: 'trips',
        redirectTo: 'maniobra',
        pathMatch: 'full',
      },
      {
        path: 'maniobra',
        loadChildren: () =>
          import('./features/maniobra/routes').then((m) => m.maniobraRoutes),
      },
      {
        path: 'fleet',
        loadChildren: () => import('./features/fleet/routes').then((m) => m.fleetRoutes),
      },
      {
        path: 'operators',
        loadChildren: () =>
          import('./features/operators/routes').then((m) => m.operatorsRoutes),
      },
      {
        path: 'expenses',
        loadChildren: () =>
          import('./features/expenses/routes').then((m) => m.expensesRoutes),
      },
      {
        path: 'reports',
        loadChildren: () =>
          import('./features/reports/routes').then((m) => m.reportsRoutes),
      },
    ],
  },
];
