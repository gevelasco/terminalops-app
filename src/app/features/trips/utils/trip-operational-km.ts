import type { Trip } from '@shared/models/logistics.models';

/**
 * Km operativos de la maniobra: siempre ida + vuelta (`routeDistanceKm × 2`).
 * El API ya no persiste `operationalDistanceKm` ni `isRoundTrip`.
 *
 * @see TRIP-DISTANCE-RULES.md
 */
export function tripOperationalKm(
  trip: Pick<Trip, 'routeDistanceKm' | 'maneuverKind'>,
): number {
  const route = trip.routeDistanceKm;
  if (typeof route === 'number' && Number.isFinite(route) && route > 0) {
    return route * 2;
  }
  const kind = trip.maneuverKind?.trim().toLowerCase() ?? '';
  if (kind === 'local') {
    return 25 * 2;
  }
  if (kind === 'foránea' || kind === 'foranea') {
    return 450 * 2;
  }
  return 0;
}

/** Precio diesel MXN/L derivado de monto / litros (si ambos son válidos). */
export function derivedDieselPricePerLiter(
  trip: Pick<Trip, 'dieselAmount' | 'dieselLiters'>,
): number | null {
  const amount = Number(String(trip.dieselAmount ?? '').replace(/,/g, '').trim());
  const liters = Number(String(trip.dieselLiters ?? '').replace(/,/g, '').trim());
  if (!Number.isFinite(amount) || !Number.isFinite(liters) || liters <= 0 || amount < 0) {
    return null;
  }
  return amount / liters;
}
