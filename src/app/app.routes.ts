import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth.guard';
import {
  comercialAccessGuard,
  moduleAccessGuard,
} from '@core/guards/module-access.guard';
import { APP_MODULE_CODES } from '@shared/models/app-modules.models';
import { loginPageGuard } from '@core/guards/login-page.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'en-mx',
  },
  {
    path: 'en-mx',
    loadComponent: () =>
      import('./features/marketing/marketing-page.component').then(
        (m) => m.MarketingPageComponent,
      ),
  },
  {
    path: 'privacidad',
    loadComponent: () =>
      import('./features/marketing/marketing-info-page.component').then(
        (m) => m.MarketingInfoPageComponent,
      ),
  },
  {
    path: 'terminos',
    loadComponent: () =>
      import('./features/marketing/marketing-info-page.component').then(
        (m) => m.MarketingInfoPageComponent,
      ),
  },
  {
    path: 'seguridad',
    loadComponent: () =>
      import('./features/marketing/marketing-info-page.component').then(
        (m) => m.MarketingInfoPageComponent,
      ),
  },
  {
    path: 'soporte',
    loadComponent: () =>
      import('./features/marketing/marketing-info-page.component').then(
        (m) => m.MarketingInfoPageComponent,
      ),
  },
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
    path: 'forgot-password',
    canActivate: [loginPageGuard],
    loadComponent: () =>
      import('./core/pages/forgot-password-page.component').then(
        (m) => m.ForgotPasswordPageComponent,
      ),
  },
  {
    path: 'reset-password',
    canActivate: [loginPageGuard],
    loadComponent: () =>
      import('./core/pages/reset-password-page.component').then(
        (m) => m.ResetPasswordPageComponent,
      ),
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
        path: 'comercial',
        canActivate: [comercialAccessGuard],
        loadChildren: () =>
          import('./features/clients/routes').then((m) => m.clientsRoutes),
      },
      {
        path: 'clients',
        redirectTo: 'comercial/clients',
        pathMatch: 'full',
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
        path: 'account',
        canActivate: [moduleAccessGuard(APP_MODULE_CODES.ACCOUNT)],
        loadChildren: () =>
          import('./features/account/routes').then((m) => m.accountRoutes),
      },
      {
        path: 'settings',
        canActivate: [moduleAccessGuard(APP_MODULE_CODES.USERS)],
        loadChildren: () =>
          import('./features/settings/routes').then((m) => m.settingsRoutes),
      },
      {
        path: 'users',
        redirectTo: 'settings/users',
        pathMatch: 'full',
      },
    ],
  },
];
