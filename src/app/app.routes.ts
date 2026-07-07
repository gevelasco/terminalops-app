import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth.guard';
import { moduleAccessGuard } from '@core/guards/module-access.guard';
import { APP_MODULE_CODES } from '@shared/models/app-modules.models';
import { loginPageGuard } from '@core/guards/login-page.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [loginPageGuard],
    loadComponent: () =>
      import('./core/pages/login-page.component').then((m) => m.LoginPageComponent),
  },
  {
    path: 'register',
    canActivate: [loginPageGuard],
    loadComponent: () =>
      import('./core/pages/register-page.component').then((m) => m.RegisterPageComponent),
  },
  {
    path: '',
    loadComponent: () => import('./core/layout/shell.component').then((m) => m.ShellComponent),
    canActivateChild: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        canActivate: [moduleAccessGuard(APP_MODULE_CODES.DASHBOARD)],
        loadChildren: () =>
          import('./features/dashboard/routes').then((m) => m.dashboardRoutes),
      },
      {
        path: 'trips',
        canActivate: [moduleAccessGuard(APP_MODULE_CODES.TRIPS)],
        loadChildren: () => import('./features/trips/routes').then((m) => m.tripsRoutes),
      },
      {
        path: 'maniobra',
        redirectTo: 'trips',
        pathMatch: 'full',
      },
      {
        path: 'fleet',
        canActivate: [moduleAccessGuard(APP_MODULE_CODES.FLEET)],
        loadChildren: () => import('./features/fleet/routes').then((m) => m.fleetRoutes),
      },
      {
        path: 'operators',
        canActivate: [moduleAccessGuard(APP_MODULE_CODES.OPERATORS)],
        loadChildren: () =>
          import('./features/operators/routes').then((m) => m.operatorsRoutes),
      },
      {
        path: 'clients',
        canActivate: [moduleAccessGuard(APP_MODULE_CODES.CLIENTS)],
        loadChildren: () =>
          import('./features/clients/routes').then((m) => m.clientsRoutes),
      },
      {
        path: 'expenses',
        canActivate: [moduleAccessGuard(APP_MODULE_CODES.EXPENSES)],
        loadChildren: () =>
          import('./features/expenses/routes').then((m) => m.expensesRoutes),
      },
      {
        path: 'reports',
        canActivate: [moduleAccessGuard(APP_MODULE_CODES.REPORTS)],
        loadChildren: () =>
          import('./features/reports/routes').then((m) => m.reportsRoutes),
      },
      {
        path: 'cuenta',
        canActivate: [moduleAccessGuard(APP_MODULE_CODES.CUENTA)],
        loadChildren: () =>
          import('./features/cuenta/routes').then((m) => m.cuentaRoutes),
      },
      {
        path: 'usuarios',
        canActivate: [moduleAccessGuard(APP_MODULE_CODES.USUARIOS)],
        loadChildren: () =>
          import('./features/usuarios/routes').then((m) => m.usuariosRoutes),
      },
    ],
  },
];
