import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { SessionStore } from '../services/session.store';

/** Stub: allows feature routes when authDevBypass; otherwise requires a token */
export const authGuard: CanActivateChildFn = (_child, state) => {
  if (environment.authDevBypass) {
    return true;
  }
  const session = inject(SessionStore);
  const router = inject(Router);
  if (session.token()) {
    return true;
  }
  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });
};
