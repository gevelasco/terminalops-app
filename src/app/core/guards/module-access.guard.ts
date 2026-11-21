import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from '@core/services/state/session';
import {
  APP_MODULE_CODES,
  type AppModuleCode,
} from '@shared/models/app-modules.models';
import {
  canAccessComercial,
  canAccessModule,
  canViewAccount,
} from '@shared/utils/access-control';

/** Acceso a Comercial si hay lectura en Clientes y/o Tarifas. */
export const comercialAccessGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  const router = inject(Router);
  if (canAccessComercial(session.role(), session.moduleGrants())) {
    return true;
  }
  return router.createUrlTree(['/dashboard']);
};

export function moduleAccessGuard(moduleCode: AppModuleCode): CanActivateFn {
  return () => {
    const session = inject(SessionService);
    const router = inject(Router);
    if (moduleCode === APP_MODULE_CODES.DASHBOARD) {
      return true;
    }
    if (
      moduleCode === APP_MODULE_CODES.ACCOUNT &&
      !canViewAccount(session.role())
    ) {
      return router.createUrlTree(['/dashboard']);
    }
    if (canAccessModule(session.allowedModules(), moduleCode)) {
      return true;
    }
    return router.createUrlTree(['/dashboard']);
  };
}
