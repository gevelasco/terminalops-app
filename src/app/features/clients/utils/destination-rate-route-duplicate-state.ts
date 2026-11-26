import { normalizeMxPostalCodeDigits } from '@features/trips/utils/mx-postal-settlement';
import {
  normalizeDestinationRateScope,
  normalizePlaceKey,
  type DestinationRateScope,
} from '@shared/models/destination-rate-scope';

/** Drawer route resolution: resolve existing route or create new. */
export type DestinationRateRouteDrawerMode =
  | 'CREATE_MODE'
  | 'EXISTING_ROUTE'
  | 'INVALIDATED';

/** Unique route identity aligned with DB UNIQUE constraint (por scope). */
export interface DestinationRateRouteKey {
  scope: DestinationRateScope;
  originOperationalCenterId: string;
  postalCode: string;
  locality: string;
  municipalityName: string;
  stateName: string;
}

export function buildDestinationRateRouteKey(params: {
  scope?: DestinationRateScope | string | null;
  originOperationalCenterId: string;
  postalCode?: string;
  locality?: string;
  municipalityName?: string;
  stateName?: string;
}): DestinationRateRouteKey | null {
  const scope = normalizeDestinationRateScope(params.scope);
  const originOperationalCenterId = params.originOperationalCenterId.trim();
  if (!originOperationalCenterId) {
    return null;
  }

  if (scope === 'postal_code') {
    const postalCode = normalizeMxPostalCodeDigits(params.postalCode ?? '');
    const locality = (params.locality ?? '').trim();
    if (postalCode.length !== 5 || !locality) {
      return null;
    }
    return {
      scope,
      originOperationalCenterId,
      postalCode,
      locality,
      municipalityName: '',
      stateName: '',
    };
  }

  const municipalityName = (params.municipalityName ?? '').trim();
  const stateName = (params.stateName ?? '').trim();
  if (scope === 'municipality') {
    if (!municipalityName || !stateName) {
      return null;
    }
    return {
      scope,
      originOperationalCenterId,
      postalCode: '',
      locality: '',
      municipalityName,
      stateName,
    };
  }

  if (!stateName) {
    return null;
  }
  return {
    scope,
    originOperationalCenterId,
    postalCode: '',
    locality: '',
    municipalityName: '',
    stateName,
  };
}

export function destinationRateRouteKeysEqual(
  a: DestinationRateRouteKey | null | undefined,
  b: DestinationRateRouteKey | null | undefined,
): boolean {
  if (!a || !b) {
    return false;
  }
  if (
    a.scope !== b.scope ||
    a.originOperationalCenterId !== b.originOperationalCenterId
  ) {
    return false;
  }
  if (a.scope === 'postal_code') {
    return (
      a.postalCode === b.postalCode &&
      a.locality.toLowerCase() === b.locality.toLowerCase()
    );
  }
  if (a.scope === 'municipality') {
    return (
      normalizePlaceKey(a.stateName) === normalizePlaceKey(b.stateName) &&
      normalizePlaceKey(a.municipalityName) === normalizePlaceKey(b.municipalityName)
    );
  }
  return normalizePlaceKey(a.stateName) === normalizePlaceKey(b.stateName);
}

export function destinationRateRouteKeyFingerprint(
  key: DestinationRateRouteKey,
): string {
  if (key.scope === 'postal_code') {
    return `${key.scope}|${key.originOperationalCenterId}|${key.postalCode}|${key.locality.toLowerCase()}`;
  }
  if (key.scope === 'municipality') {
    return `${key.scope}|${key.originOperationalCenterId}|${normalizePlaceKey(key.stateName)}|${normalizePlaceKey(key.municipalityName)}`;
  }
  return `${key.scope}|${key.originOperationalCenterId}|${normalizePlaceKey(key.stateName)}`;
}
