import { normalizeMxPostalCodeDigits } from '@features/trips/utils/mx-postal-settlement';
import type { DestinationRate } from '@shared/models/destination-rate.models';
import {
  destinationRateHasRouteCache,
  findDestinationRateByRoute,
} from '@features/clients/utils/find-destination-rate-by-postal-code';

export function isDestinationRateRouteInputComplete(params: {
  originOperationalCenterId: string;
  postalCode: string;
  locality: string;
  cityMunicipality: string;
}): boolean {
  return (
    params.originOperationalCenterId.trim() !== '' &&
    normalizeMxPostalCodeDigits(params.postalCode).length === 5 &&
    params.locality.trim() !== '' &&
    params.cityMunicipality.trim() !== ''
  );
}

/** Km operativos (ida + vuelta) a partir de ruta OSRM; alinea con backend `isRoundTrip: true`. */
export function operationalDistanceFromRouteKm(
  routeKm: number,
  isRoundTrip = true,
): number {
  return isRoundTrip ? routeKm * 2 : routeKm;
}

export function findCachedDestinationRateDistances(
  rates: readonly DestinationRate[],
  params: {
    originOperationalCenterId: string;
    destinationPostalCode: string;
    destinationLocality: string;
  },
): { routeDistanceKm: number; operationalDistanceKm: number } | null {
  const rate = findDestinationRateByRoute(rates, params, { activeOnly: false });
  if (!rate || !destinationRateHasRouteCache(rate)) {
    return null;
  }
  const routeDistanceKm = rate.routeDistanceKm!;
  const operationalDistanceKm =
    rate.operationalDistanceKm != null && rate.operationalDistanceKm > 0
      ? rate.operationalDistanceKm
      : operationalDistanceFromRouteKm(routeDistanceKm, rate.isRoundTrip !== false);
  return { routeDistanceKm, operationalDistanceKm };
}
