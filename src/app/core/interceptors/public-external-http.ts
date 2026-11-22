/** APIs públicas de routing: no deben llevar Bearer (provoca fallo CORS en preflight). */
export function isPublicExternalHttpUrl(url: string): boolean {
  if (url.includes('router.project-osrm.org')) {
    return true;
  }
  try {
    const host = new URL(url).hostname;
    return host === 'router.project-osrm.org';
  } catch {
    return false;
  }
}
