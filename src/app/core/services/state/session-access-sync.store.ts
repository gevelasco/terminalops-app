import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { ToastService } from '@core/notifications/toast.service';
import { SessionService } from '@core/services/state/session';
import type { StaffModuleGrant } from '@shared/models/app-modules.models';
import {
  APP_MODULE_CODES,
  type AppModuleCode,
} from '@shared/models/app-modules.models';
import {
  canAccessModule,
  canViewAccount,
} from '@shared/utils/access-control';
import { parseHttpApiErrorMessage } from '@shared/utils/http-api-error';

/** Debe coincidir con `MODULE_ACCESS_DENIED_CODE` del API. */
export const MODULE_ACCESS_DENIED_CODE = 'MODULE_ACCESS_DENIED';

type ModuleAccessDeniedBody = {
  code?: string;
  message?: string;
  role?: string;
  companyId?: string;
  moduleGrants?: StaffModuleGrant[];
};

const PATH_MODULE_PREFIXES: ReadonlyArray<readonly [string, AppModuleCode]> = [
  ['/account', APP_MODULE_CODES.ACCOUNT],
  ['/users', APP_MODULE_CODES.USERS],
  ['/trips', APP_MODULE_CODES.TRIPS],
  ['/fleet', APP_MODULE_CODES.FLEET],
  ['/operators', APP_MODULE_CODES.OPERATORS],
  ['/clients', APP_MODULE_CODES.CLIENTS],
  ['/expenses', APP_MODULE_CODES.EXPENSES],
  ['/reports', APP_MODULE_CODES.REPORTS],
  ['/dashboard', APP_MODULE_CODES.DASHBOARD],
];

/**
 * Ante 403 MODULE_ACCESS_DENIED: actualiza sesión con el snapshot del body,
 * notifica y redirige si la ruta actual ya no está permitida.
 * Sin poll ni request extra.
 */
@Injectable({ providedIn: 'root' })
export class SessionAccessSyncStore {
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  private lastToastAt = 0;

  handleModuleAccessDenied(err: unknown): void {
    const body = this.readDeniedBody(err);
    if (!body || !this.session.isLoggedIn()) {
      return;
    }

    if (body.role && body.companyId) {
      this.session.applyAccessSnapshot({
        role: body.role,
        companyId: String(body.companyId),
        moduleGrants: body.moduleGrants ?? [],
      });
    }

    const message =
      (typeof body.message === 'string' && body.message.trim()) ||
      parseHttpApiErrorMessage(err) ||
      'Tu acceso a este módulo fue actualizado.';
    const now = Date.now();
    if (now - this.lastToastAt > 4_000) {
      this.lastToastAt = now;
      this.toast.show(message, 'warning');
    }

    this.redirectIfCurrentRouteForbidden();
  }

  private readDeniedBody(err: unknown): ModuleAccessDeniedBody | null {
    const body = this.errorBody(err);
    if (!body || typeof body !== 'object') {
      return null;
    }
    const typed = body as ModuleAccessDeniedBody;
    if (typed.code !== MODULE_ACCESS_DENIED_CODE) {
      return null;
    }
    return typed;
  }

  private errorBody(err: unknown): unknown {
    if (err instanceof HttpErrorResponse) {
      return err.error;
    }
    if (err && typeof err === 'object') {
      if ('errorBody' in err) {
        return (err as { errorBody?: unknown }).errorBody;
      }
      if ('error' in err) {
        return (err as { error?: unknown }).error;
      }
    }
    return null;
  }

  private redirectIfCurrentRouteForbidden(): void {
    const url = this.router.url.split('?')[0] ?? '';
    const module = PATH_MODULE_PREFIXES.find(([prefix]) =>
      url === prefix || url.startsWith(`${prefix}/`),
    )?.[1];
    if (!module) {
      return;
    }
    if (
      module === APP_MODULE_CODES.ACCOUNT &&
      !canViewAccount(this.session.role())
    ) {
      void this.router.navigateByUrl('/dashboard');
      return;
    }
    if (!canAccessModule(this.session.allowedModules(), module)) {
      void this.router.navigateByUrl('/dashboard');
    }
  }
}
