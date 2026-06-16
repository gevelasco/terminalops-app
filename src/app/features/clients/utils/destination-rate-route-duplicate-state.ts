import { normalizeMxPostalCodeDigits } from '@features/trips/utils/mx-postal-settlement';

/** Drawer route resolution: resolve existing route or create new. */
export type DestinationRateRouteDrawerMode =
  | 'CREATE_MODE'
  | 'EXISTING_ROUTE'
  | 'INVALIDATED';

/** Unique route identity aligned with DB UNIQUE constraint. */
export interface DestinationRateRouteKey {
  originOperationalCenterId: string;
  postalCode: string;
  locality: string;
}

export function buildDestinationRateRouteKey(params: {
  originOperationalCenterId: string;
  postalCode: string;
  locality: string;
}): DestinationRateRouteKey | null {
  const originOperationalCenterId = params.originOperationalCenterId.trim();
  const postalCode = normalizeMxPostalCodeDigits(params.postalCode);
  const locality = params.locality.trim();
  if (!originOperationalCenterId || postalCode.length !== 5 || !locality) {
    return null;
  }
  return { originOperationalCenterId, postalCode, locality };
}

export function destinationRateRouteKeysEqual(
  a: DestinationRateRouteKey | null | undefined,
  b: DestinationRateRouteKey | null | undefined,
): boolean {
  if (!a || !b) {
    return false;
  }
  return (
    a.originOperationalCenterId === b.originOperationalCenterId &&
    a.postalCode === b.postalCode &&
    a.locality.toLowerCase() === b.locality.toLowerCase()
  );
}

export function destinationRateRouteKeyFingerprint(
  key: DestinationRateRouteKey,
): string {
  return `${key.originOperationalCenterId}|${key.postalCode}|${key.locality.toLowerCase()}`;
}
