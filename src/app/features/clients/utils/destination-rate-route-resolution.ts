import { normalizeMxPostalCodeDigits } from '@features/trips/utils/mx-postal-settlement';
import {
  normalizeDestinationRateScope,
  type DestinationRateScope,
} from '@shared/models/destination-rate-scope';

export function isDestinationRateRouteInputComplete(params: {
  scope?: DestinationRateScope | string | null;
  originOperationalCenterId: string;
  postalCode: string;
  locality: string;
  cityMunicipality: string;
  municipalityName?: string;
  stateName?: string;
}): boolean {
  if (!params.originOperationalCenterId.trim()) {
    return false;
  }
  const scope = normalizeDestinationRateScope(params.scope);
  if (scope === 'postal_code') {
    return (
      normalizeMxPostalCodeDigits(params.postalCode).length === 5 &&
      params.locality.trim() !== '' &&
      params.cityMunicipality.trim() !== ''
    );
  }
  if (scope === 'municipality') {
    return (
      (params.municipalityName ?? '').trim() !== '' &&
      (params.stateName ?? '').trim() !== ''
    );
  }
  return (params.stateName ?? '').trim() !== '';
}

/** Km operativos (ida + vuelta) a partir de ruta OSRM; alinea con backend `isRoundTrip: true`. */
export function operationalDistanceFromRouteKm(
  routeKm: number,
  isRoundTrip = true,
): number {
  return isRoundTrip ? routeKm * 2 : routeKm;
}
