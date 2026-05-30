import { HttpContext, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AUTH_ALREADY_REFRESHED } from '@core/context/auth-context';
import { isPublicExternalHttpUrl } from '@core/interceptors/public-external-http';
import { AuthService } from '@core/services/api/auth';
import { LogoutService } from '@core/services/logout.service';
import { SessionService } from '@core/services/state/session';

function isPublicAuthUrl(url: string): boolean {
  return url.includes('/auth/login') || url.includes('/auth/refresh');
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(SessionService);
  const authService = inject(AuthService);
  const logoutService = inject(LogoutService);
  const router = inject(Router);
  if (isPublicExternalHttpUrl(req.url)) {
    return next(req);
  }

  const token = session.token();

  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }
      if (isPublicAuthUrl(req.url)) {
        return throwError(() => error);
      }
      if (req.context.get(AUTH_ALREADY_REFRESHED)) {
        logoutService.clearClientState();
        void router.navigateByUrl('/login');
        return throwError(() => error);
      }
      const refresh = session.refreshToken();
      if (!refresh) {
        logoutService.clearClientState();
        void router.navigateByUrl('/login');
        return throwError(() => error);
      }
      return authService.refreshAccessToken().pipe(
        switchMap(() => {
          const newToken = session.token();
          const retried = req.clone({
            setHeaders: { Authorization: `Bearer ${newToken ?? ''}` },
            context: new HttpContext().set(AUTH_ALREADY_REFRESHED, true),
          });
          return next(retried);
        }),
        catchError((refreshErr) => {
          logoutService.clearClientState();
          void router.navigateByUrl('/login');
          return throwError(() => refreshErr);
        }),
      );
    }),
  );
};
