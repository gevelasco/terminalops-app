import { environment } from '../../../../environments/environment';

export function requireCompanyId(companyId: string | null | undefined): string {
  if (!companyId?.trim()) {
    throw new Error('No hay empresa en sesión');
  }
  return companyId;
}

export function companyResourceUrl(companyId: string, segment: string): string {
  const path = segment.replace(/^\//, '');
  return `${environment.apiUrl}/companies/${companyId}/${path}`;
}

export function resourceByIdUrl(resource: string, id: string, suffix = ''): string {
  const base = `${environment.apiUrl}/${resource}/${id}`;
  const tail = suffix.replace(/^\//, '');
  return tail ? `${base}/${tail}` : base;
}
