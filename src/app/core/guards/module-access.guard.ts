import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from '@core/services/state/session';
import type { AppModuleCode } from '@shared/models/app-modules.models';
import { canAccessModule } from '@shared/utils/access-control';

export function moduleAccessGuard(moduleCode: AppModuleCode): CanActivateFn {
  return () => {
    const session = inject(SessionService);
    const router = inject(Router);
    if (canAccessModule(session.allowedModules(), moduleCode)) {
      return true;
    }
    return router.createUrlTree(['/dashboard']);
  };
}
