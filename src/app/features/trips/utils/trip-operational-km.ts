import type { Trip } from '@shared/models/logistics.models';

/**
 * Km operativos de la maniobra (`operationalDistanceKm` del API).
 * El fallback legacy (route × 2) vive solo en el mapper del backend.
 *
 * @see TRIP-DISTANCE-RULES.md — no derivar vuelta en cliente; usar operationalDistanceKm del API.
 * Verificación: `npm run check:trip-distance`
 */
export function tripOperationalKm(trip: Trip): number {
  const op = trip.operationalDistanceKm;
  return typeof op === 'number' && Number.isFinite(op) && op > 0 ? op : 0;
}
