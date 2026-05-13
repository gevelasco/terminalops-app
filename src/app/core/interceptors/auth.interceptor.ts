import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { SessionStore } from '../services/session.store';

/** Attaches Authorization when a bearer token exists; leaves relative URLs unchanged */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(SessionStore);
  const token = session.token();

  if (!token || req.headers.has('Authorization')) {
    return next(req);
  }

  const apiUrl = environment.apiUrl;
  const isApiRequest = req.url.startsWith(apiUrl) || req.url.startsWith('/api');

  if (!isApiRequest) {
    return next(req);
  }

  const authReq = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });
  return next(authReq);
};
