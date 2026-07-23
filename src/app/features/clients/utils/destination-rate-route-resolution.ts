import { normalizeMxPostalCodeDigits } from '@features/trips/utils/mx-postal-settlement';

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
