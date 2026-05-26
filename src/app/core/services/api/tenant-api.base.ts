import { inject } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { SessionService } from '../state/session';

export function companyApiUrl(path: string): string {
  const session = inject(SessionService);
  const companyId = session.companyId();
  if (!companyId) {
    throw new Error('No hay empresa en sesión');
  }
  const segment = path.replace(/^\//, '');
  return `${environment.apiUrl}/companies/${companyId}/${segment}`;
}
