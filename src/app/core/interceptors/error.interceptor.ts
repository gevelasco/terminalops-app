import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { parseHttpApiErrorMessage } from '@shared/utils/http-api-error';

export class ApiHttpError extends Error {
  readonly status: number;
  readonly url: string;
  readonly apiMessage: string | null;

  constructor(err: HttpErrorResponse) {
    const apiMessage = parseHttpApiErrorMessage(err);
    super(apiMessage ?? err.message);
    this.name = 'ApiHttpError';
    this.status = err.status;
    this.url = err.url ?? '';
    this.apiMessage = apiMessage;
  }
}

/** Central place for HTTP error mapping (toasts, logging, correlation IDs) */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
        if (err.status === 401) {
          console.warn('[HTTP] Unauthorized', req.url);
        } else if (err.status >= 500) {
          console.error('[HTTP] Server error', err.status, req.url);
        }
        return throwError(() => new ApiHttpError(err));
      }
      return throwError(() => err);
    }),
  );
};
