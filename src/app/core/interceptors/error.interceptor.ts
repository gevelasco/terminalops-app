import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

/** Central place for HTTP error mapping (toasts, logging, correlation IDs) */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
        // TODO: route 401 to login, track 5xx, sanitize messages for UI
        if (err.status === 401) {
          console.warn('[HTTP] Unauthorized', req.url);
        }
      }
      return throwError(() => err);
    }),
  );
};
