import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { SessionStore } from '../services/session.store';

/** Si ya hay sesión válida del día, no mostrar de nuevo el login. */
export const loginPageGuard: CanActivateFn = () => {
  if (environment.authDevBypass) {
    return true;
  }
  const session = inject(SessionStore);
  const router = inject(Router);
  session.syncSessionWithStorage();
  if (session.token()) {
    return router.createUrlTree(['/dashboard']);
  }
  return true;
};
