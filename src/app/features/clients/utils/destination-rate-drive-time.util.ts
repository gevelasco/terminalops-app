import { formatEstimatedTimeValueNumber } from '@features/clients/utils/destination-rate-estimated-time';

/** Velocidad promedio efectiva en autopista (tracto cargado, 5 ejes). */
export const DESTINATION_RATE_TRUCK_SPEED_KMH = 60;

/**
 * Redondeo operativo en horas enteras: fracción ≤ 0,10 → hora base;
 * fracción ≥ 0,11 → siguiente hora entera (p. ej. 1,10 → 1; 1,11 → 2).
 */
export function roundSuggestedDriveTimeHours(exactHours: number): number {
  if (!Number.isFinite(exactHours) || exactHours <= 0) {
    return 0;
  }
  const whole = Math.floor(exactHours);
  const fraction = Math.round((exactHours - whole) * 100) / 100;
  if (fraction <= 0.1) {
    return whole > 0 ? whole : 1;
  }
  return whole + 1;
}

/** Horas de manejo sugeridas para un tramo de `routeDistanceKm` (ida). */
export function suggestedDriveTimeHoursFromRouteKm(
  routeDistanceKm: number,
): number {
  if (!Number.isFinite(routeDistanceKm) || routeDistanceKm <= 0) {
    return 0;
  }
  const exact = routeDistanceKm / DESTINATION_RATE_TRUCK_SPEED_KMH;
  return roundSuggestedDriveTimeHours(exact);
}

export function suggestedDriveTimeHoursLabelFromRouteKm(
  routeDistanceKm: number | null | undefined,
): string {
  if (routeDistanceKm == null || routeDistanceKm <= 0) {
    return '';
  }
  return formatEstimatedTimeValueNumber(
    suggestedDriveTimeHoursFromRouteKm(routeDistanceKm),
  );
}