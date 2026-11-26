import { normalizeMxPostalCodeDigits } from '@features/trips/utils/mx-postal-settlement';
import type { ClientDelivery } from '@shared/models/client.models';
import type { DestinationRate } from '@shared/models/destination-rate.models';
import {
  normalizeDestinationRateScope,
  normalizePlaceKey,
  type DestinationRateScope,
} from '@shared/models/destination-rate-scope';
import { findDestinationRateByRoute } from '@features/clients/utils/find-destination-rate-by-postal-code';
import { parseMexicanCityMunicipalityLine } from '@features/clients/utils/destination-rate-state-resolve.util';

export type ClientDeliveryRouteLinkPreview =
  | 'idle'
  | 'checking'
  | 'linked'
  | 'unpriced';

export function isClientDeliveryRouteLookupReady(params: {
  scope?: DestinationRateScope | string | null;
  postalCode: string;
  locality: string;
  municipalityName?: string;
  stateName?: string;
}): boolean {
  const scope = normalizeDestinationRateScope(params.scope);
  if (scope === 'postal_code') {
    return (
      normalizeMxPostalCodeDigits(params.postalCode).length === 5 &&
      params.locality.trim() !== ''
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

function deliveryMunicipalityState(params: {
  scope?: DestinationRateScope | string | null;
  municipalityName?: string;
  stateName?: string;
  cityMunicipality?: string;
}): { municipalityName: string; stateName: string } {
  const scope = normalizeDestinationRateScope(params.scope);
  const rawCity = (params.cityMunicipality ?? '').trim();
  const parsed = parseMexicanCityMunicipalityLine(rawCity);
  const municipalityName =
    (params.municipalityName ?? '').trim() ||
    (parsed.state ? parsed.municipality.trim() : '');
  // Scope estado: cityMunicipality suele ser solo el estado (sin coma).
  const stateName =
    (params.stateName ?? '').trim() ||
    parsed.state.trim() ||
    (scope === 'state' && !parsed.state ? rawCity : '');
  return {
    municipalityName:
      municipalityName ||
      (scope === 'municipality' ? parsed.municipality.trim() : ''),
    stateName,
  };
}

export function findDestinationRatesByDestination(
  rates: readonly DestinationRate[],
  params: {
    scope?: DestinationRateScope | string | null;
    postalCode: string;
    locality: string;
    municipalityName?: string;
    stateName?: string;
    cityMunicipality?: string;
  },
): DestinationRate[] {
  const scope = normalizeDestinationRateScope(params.scope);
  if (scope === 'postal_code') {
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

  const { municipalityName, stateName } = deliveryMunicipalityState({
    ...params,
    scope,
  });
  if (scope === 'municipality') {
    if (!municipalityName || !stateName) {
      return [];
    }
    return rates.filter(
      (rate) =>
        (rate.destinationScope ?? 'postal_code') === 'municipality' &&
        normalizePlaceKey(rate.stateName ?? '') === normalizePlaceKey(stateName) &&
        normalizePlaceKey(rate.municipalityName ?? '') ===
          normalizePlaceKey(municipalityName),
    );
  }

  if (!stateName) {
    return [];
  }
  return rates.filter(
    (rate) =>
      (rate.destinationScope ?? 'postal_code') === 'state' &&
      normalizePlaceKey(rate.stateName ?? '') === normalizePlaceKey(stateName),
  );
}

export function resolveClientDeliveryRoutePreview(
  rates: readonly DestinationRate[],
  params: {
    scope?: DestinationRateScope | string | null;
    postalCode: string;
    locality: string;
    municipalityName?: string;
    stateName?: string;
    cityMunicipality?: string;
    primaryOriginCenterId: string | null;
  },
): { rateId: string | null; matches: DestinationRate[] } {
  if (!isClientDeliveryRouteLookupReady(params)) {
    return { rateId: null, matches: [] };
  }

  const matches = findDestinationRatesByDestination(rates, params);
  const scope = normalizeDestinationRateScope(params.scope);
  if (params.primaryOriginCenterId && scope === 'postal_code') {
    const exact = findDestinationRateByRoute(
      rates,
      {
        originOperationalCenterId: params.primaryOriginCenterId,
        destinationPostalCode: params.postalCode,
        destinationLocality: params.locality,
      },
      { activeOnly: false },
    );
    if (exact) {
      return { rateId: exact.id, matches };
    }
  } else if (params.primaryOriginCenterId) {
    const originId = params.primaryOriginCenterId.trim();
    const exact =
      matches.find((rate) => rate.originOperationalCenterId === originId) ?? null;
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

export function clientDeliveryRouteStatusLabel(
  delivery: ClientDelivery,
  options?: {
    scope?: DestinationRateScope | string | null;
    rates?: readonly DestinationRate[];
    primaryOriginCenterId?: string | null;
  },
): string {
  const hasPlace =
    !!delivery.postalCode?.trim() ||
    !!delivery.cityMunicipality?.trim() ||
    !!delivery.locality?.trim();
  if (!hasPlace) {
    return '—';
  }
  if (delivery.destinationRateId) {
    return clientDeliveryRouteLinkTitle('linked') ?? 'Ruta tarifada disponible';
  }
  if (delivery.isUnpricedRoute) {
    return (
      clientDeliveryRouteLinkTitle('unpriced') ??
      'Ruta sin tarifa (pendiente de configuración)'
    );
  }

  const rates = options?.rates;
  if (rates && rates.length > 0) {
    const place = deliveryMunicipalityState({
      scope: options?.scope,
      cityMunicipality: delivery.cityMunicipality,
    });
    const preview = resolveClientDeliveryRoutePreview(rates, {
      scope: options?.scope,
      postalCode: delivery.postalCode ?? '',
      locality: delivery.locality ?? '',
      cityMunicipality: delivery.cityMunicipality,
      municipalityName: place.municipalityName,
      stateName: place.stateName,
      primaryOriginCenterId: options?.primaryOriginCenterId ?? null,
    });
    if (preview.rateId || preview.matches.length > 0) {
      return clientDeliveryRouteLinkTitle('linked') ?? 'Ruta tarifada disponible';
    }
    if (
      isClientDeliveryRouteLookupReady({
        scope: options?.scope,
        postalCode: delivery.postalCode ?? '',
        locality: delivery.locality ?? '',
        municipalityName: place.municipalityName,
        stateName: place.stateName,
      })
    ) {
      return (
        clientDeliveryRouteLinkTitle('unpriced') ??
        'Ruta sin tarifa (pendiente de configuración)'
      );
    }
  }
  return '—';
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
