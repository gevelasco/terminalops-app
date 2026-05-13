import { Routes } from '@angular/router';

export const expensesRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/expenses-page.component').then((m) => m.ExpensesPageComponent),
  },
];
