import { environment } from '../../../../environments/environment';

export function requireCompanyId(companyId: string | null | undefined): string {
  if (!companyId?.trim()) {
    throw new Error('No hay empresa en sesión');
  }
  return companyId;
}

export function companyResourceUrl(
  companyId: string,
  segment: string,
  query?: Record<string, string | boolean | undefined>,
): string {
  const path = segment.replace(/^\//, '');
  const base = `${environment.apiUrl}/companies/${companyId}/${path}`;
  if (!query) {
    return base;
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === false) {
      continue;
    }
    params.set(key, value === true ? 'true' : String(value));
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function resourceByIdUrl(resource: string, id: string, suffix = ''): string {
  const base = `${environment.apiUrl}/${resource}/${id}`;
  const tail = suffix.replace(/^\//, '');
  return tail ? `${base}/${tail}` : base;
}
