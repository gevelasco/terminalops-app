/** Texto de snapshot (CP, localidad, licencia) o em dash si no hay dato. */
export function snapshotTextOrDash(value: string | undefined | null): string {
  const t = value?.trim() ?? '';
  return t.length > 0 ? t : '—';
}

/** Formato de km de ruta (UI es-MX, una decimal). */
export function formatRouteKmEsMx(km: number): string {
  return km.toLocaleString('es-MX', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

/** Etiqueta para distancia OSRM guardada (`Trip.routeDistanceKm`, solo ida). */
export function storedRouteDistanceKmLabel(km: number | null | undefined): string {
  if (km === undefined || km === null || Number.isNaN(km)) {
    return '—';
  }
  return `${formatRouteKmEsMx(km)} km`;
}

/** Etiqueta para distancia operativa (`Trip.operationalDistanceKm`). */
export function storedOperationalDistanceKmLabel(
  km: number | null | undefined,
): string {
  if (km === undefined || km === null || Number.isNaN(km)) {
    return '—';
  }
  return `${formatRouteKmEsMx(km)} km`;
}

/** Regla de negocio del formulario: local vs foránea por umbral de km OSRM. */
export function maneuverKindFromRouteKm(
  km: number | null,
): 'Local' | 'Foránea' | undefined {
  if (km === null || !Number.isFinite(km)) {
    return undefined;
  }
  return km <= 25 ? 'Local' : 'Foránea';
}
