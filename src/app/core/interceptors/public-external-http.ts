/** APIs públicas de routing/geocoding: no deben llevar Bearer (provoca fallo CORS en preflight). */
export function isPublicExternalHttpUrl(url: string): boolean {
  if (
    url.includes('router.project-osrm.org') ||
    url.includes('photon.komoot.io')
  ) {
    return true;
  }
  try {
    const host = new URL(url).hostname;
    return host === 'router.project-osrm.org' || host === 'photon.komoot.io';
  } catch {
    return false;
  }
}
