import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { SessionAccessSyncStore } from '@core/services/state/session-access-sync.store';
import { parseHttpApiErrorMessage } from '@shared/utils/http-api-error';

export class ApiHttpError extends Error {
  readonly status: number;
  readonly url: string;
  readonly apiMessage: string | null;
  /** Cuerpo crudo del error Nest (p. ej. `code: MODULE_ACCESS_DENIED`). */
  readonly errorBody: unknown;

  constructor(err: HttpErrorResponse) {
    const apiMessage = parseHttpApiErrorMessage(err);
    super(apiMessage ?? err.message);
    this.name = 'ApiHttpError';
    this.status = err.status;
    this.url = err.url ?? '';
    this.apiMessage = apiMessage;
    this.errorBody = err.error;
  }
}

/** Central place for HTTP error mapping (toasts, logging, correlation IDs) */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const accessSync = inject(SessionAccessSyncStore);

  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
        if (err.status === 401) {
          console.warn('[HTTP] Unauthorized', req.url);
        } else if (err.status >= 500) {
          console.error('[HTTP] Server error', err.status, req.url);
        } else if (err.status === 403) {
          accessSync.handleModuleAccessDenied(err);
        }
        return throwError(() => new ApiHttpError(err));
      }
      return throwError(() => err);
    }),
  );
};
