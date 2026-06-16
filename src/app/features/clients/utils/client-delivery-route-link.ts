import { normalizeMxPostalCodeDigits } from '@features/trips/utils/mx-postal-settlement';
import type { DestinationRate } from '@shared/models/destination-rate.models';
import { findDestinationRateByRoute } from '@features/clients/utils/find-destination-rate-by-postal-code';

export type ClientDeliveryRouteLinkPreview =
  | 'idle'
  | 'checking'
  | 'linked'
  | 'unpriced';

export function isClientDeliveryRouteLookupReady(params: {
  postalCode: string;
  locality: string;
}): boolean {
  return (
    normalizeMxPostalCodeDigits(params.postalCode).length === 5 &&
    params.locality.trim() !== ''
  );
}

export function findDestinationRatesByDestination(
  rates: readonly DestinationRate[],
  params: { postalCode: string; locality: string },
): DestinationRate[] {
  const cp = normalizeMxPostalCodeDigits(params.postalCode);
  const locality = params.locality.trim().toLowerCase();
  if (cp.length !== 5 || !locality) {
    return [];
  }
  return rates.filter(
    (rate) =>
      rate.postalCode === cp && rate.locality.trim().toLowerCase() === locality,
  );
}

export function resolveClientDeliveryRoutePreview(
  rates: readonly DestinationRate[],
  params: {
    postalCode: string;
    locality: string;
    primaryOriginCenterId: string | null;
  },
): { rateId: string | null; matches: DestinationRate[] } {
  const cp = normalizeMxPostalCodeDigits(params.postalCode);
  const locality = params.locality.trim();
  if (!isClientDeliveryRouteLookupReady({ postalCode: cp, locality })) {
    return { rateId: null, matches: [] };
  }

  const matches = findDestinationRatesByDestination(rates, {
    postalCode: cp,
    locality,
  });
  if (params.primaryOriginCenterId) {
    const exact = findDestinationRateByRoute(
      rates,
      {
        originOperationalCenterId: params.primaryOriginCenterId,
        destinationPostalCode: cp,
        destinationLocality: locality,
      },
      { activeOnly: false },
    );
    if (exact) {
      return { rateId: exact.id, matches };
    }
  }
  if (matches.length === 1) {
    return { rateId: matches[0].id, matches };
  }
  return { rateId: null, matches };
}

export function clientDeliveryRouteLinkTitle(
  status: ClientDeliveryRouteLinkPreview,
): string | null {
  switch (status) {
    case 'linked':
      return 'Ruta tarifada disponible';
    case 'unpriced':
      return 'Ruta sin tarifa (pendiente de configuración)';
    case 'checking':
      return 'Verificando ruta…';
    default:
      return null;
  }
}

export function clientDeliveryRouteLinkHint(
  status: ClientDeliveryRouteLinkPreview,
): string | null {
  switch (status) {
    case 'linked':
      return 'Ruta existente vinculada. Se usará la tarifa configurada cuando exista.';
    case 'unpriced':
      return 'Este destino quedará pendiente hasta que se configure una tarifa.';
    default:
      return null;
  }
}
