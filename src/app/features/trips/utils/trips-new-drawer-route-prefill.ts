import type { Client, ClientDelivery } from '@shared/models/client.models';
import type { MxPostalSettlement } from '@shared/services/mexico-postal-code.service';
import { localityKey, normalizeMxPostalCodeDigits } from '@features/trips/utils/mx-postal-settlement';
import { latLonFromPrefill } from '@shared/services/lat-lon';
import type { LatLon } from '@shared/services/osrm-driving-route.service';
import {
  deliveryMunicipalityLabel,
  deliveryStateLabel,
  validClientDeliveries,
  validClientDeliveriesForScope,
} from '@features/clients/utils/client-deliveries';
import {
  normalizeDestinationRateScope,
  type DestinationRateScope,
} from '@shared/models/destination-rate-scope';

/** Datos de un extremo de ruta ya conocidos (centro operativo o entrega del cliente). */
export type TripRouteEndpointPrefill = {
  postalCode: string;
  settlementConsId?: string;
  cityMunicipality?: string;
  locality?: string;
  municipalityName?: string;
  stateName?: string;
  latitude?: number | null;
  longitude?: number | null;
};

/** Shape mínimo persistido (sesión / deliveries) para omitir SEPOMEX+Photon. */
export type StoredRouteLocationShape = {
  postalCode?: string;
  locality?: string;
  latitude?: unknown;
  longitude?: unknown;
};

export type TripRouteEndpointPrefillResult = {
  postalCode: string;
  settlements: MxPostalSettlement[];
  localityKey: string;
  coords: LatLon | null;
  /** CP + localidad + coords listos → solo OSRM. */
  complete: boolean;
};

/** CP (5 dígitos) + localidad + lat/lon finitos → no hace falta normalizar de nuevo. */
export function hasCompleteLocationData(loc: StoredRouteLocationShape): boolean {
  const postalCode = normalizeMxPostalCodeDigits(loc.postalCode ?? '');
  const locality = loc.locality?.trim() ?? '';
  const coords = latLonFromPrefill(loc.latitude, loc.longitude);
  return postalCode.length === 5 && locality.length > 0 && coords != null;
}

export function stateFromCityMunicipalityLine(line: string | undefined): string {
  const parts = (line ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  return parts.length > 0 ? (parts[parts.length - 1] ?? '') : '';
}

export function cityFromCityMunicipalityLine(line: string | undefined): string {
  const parts = (line ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  return parts.length > 0 ? (parts[0] ?? '') : '';
}

/** Huella estable del extremo en el formulario (detecta edición manual). */
export function routeEndpointFingerprint(
  cpDigits: string,
  localityKeyValue: string,
  coords: LatLon | null,
): string {
  const lat = coords?.lat ?? '';
  const lon = coords?.lon ?? '';
  return `${cpDigits}|${localityKeyValue.trim()}|${lat}|${lon}`;
}

/** CP de origen desde entidad de centro operativo (SSOT). */
export function originPrefillFromOperationalCenter(center: {
  postalCode?: string;
  cityMunicipality?: string;
  locality?: string;
  settlementConsId?: string;
  latitude?: number | null;
  longitude?: number | null;
}): TripRouteEndpointPrefill | null {
  const postalCode = normalizeMxPostalCodeDigits(center.postalCode ?? '');
  if (postalCode.length !== 5) {
    return null;
  }
  return {
    postalCode,
    settlementConsId: center.settlementConsId?.trim() || undefined,
    cityMunicipality: center.cityMunicipality?.trim() || undefined,
    locality: center.locality?.trim() || undefined,
    latitude: center.latitude ?? null,
    longitude: center.longitude ?? null,
  };
}

/** Destino desde una ubicación de entrega concreta. */
export function destinationPrefillFromDelivery(
  delivery: ClientDelivery,
  scope?: DestinationRateScope | string | null,
): TripRouteEndpointPrefill | null {
  const normalized = normalizeDestinationRateScope(scope);
  const postalCode = normalizeMxPostalCodeDigits(delivery.postalCode ?? '');
  const cityMunicipality = delivery.cityMunicipality?.trim() || undefined;
  const stateName =
    deliveryStateLabel(delivery) === '—'
      ? undefined
      : deliveryStateLabel(delivery);
  const municipalityName =
    deliveryMunicipalityLabel(delivery) === '—'
      ? undefined
      : deliveryMunicipalityLabel(delivery);

  if (normalized === 'postal_code') {
    if (postalCode.length !== 5) {
      return null;
    }
  } else if (normalized === 'municipality') {
    if (!municipalityName || !stateName) {
      return null;
    }
  } else if (!stateName && !cityMunicipality) {
    return null;
  }

  return {
    postalCode: postalCode.length === 5 ? postalCode : '',
    settlementConsId: delivery.settlementConsId?.trim() || undefined,
    cityMunicipality:
      cityMunicipality ||
      (normalized === 'state'
        ? stateName
        : [municipalityName, stateName].filter(Boolean).join(', ') || undefined),
    locality: delivery.locality?.trim() || municipalityName || undefined,
    municipalityName,
    stateName: stateName || (normalized === 'state' ? cityMunicipality : undefined),
    latitude: delivery.latitude ?? null,
    longitude: delivery.longitude ?? null,
  };
}

/**
 * Destino desde expediente del cliente.
 * Solo auto-rellena cuando hay exactamente una ubicación válida para el scope.
 */
export function destinationPrefillFromClient(
  client: Client,
  scope?: DestinationRateScope | string | null,
): TripRouteEndpointPrefill | null {
  const deliveries = validClientDeliveriesForScope(client, scope);
  if (deliveries.length !== 1) {
    return null;
  }
  return destinationPrefillFromDelivery(deliveries[0]!, scope);
}

function parseCityMunicipalityLine(line: string): {
  city: string;
  state: string;
  municipality: string;
} {
  const parts = line
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length === 0) {
    return { city: '', state: '', municipality: '' };
  }
  const state = parts[parts.length - 1] ?? '';
  const city = parts[0] ?? '';
  return { city, state, municipality: city || (parts[0] ?? '') };
}

function syntheticSettlement(
  prefill: TripRouteEndpointPrefill,
): MxPostalSettlement | null {
  const postalCode = normalizeMxPostalCodeDigits(prefill.postalCode);
  if (postalCode.length !== 5) {
    return null;
  }
  const locality = prefill.locality?.trim() || 'Ubicación';
  const parsed = parseCityMunicipalityLine(prefill.cityMunicipality ?? '');
  const state = parsed.state || 'México';
  const city = parsed.city || parsed.municipality;
  const municipality = parsed.municipality || city;
  const settlementConsId =
    prefill.settlementConsId?.trim() ||
    `${postalCode}|${locality}|${municipality}`;
  return {
    postalCode,
    settlement: locality,
    settlementType: '',
    municipality,
    state,
    city,
    settlementConsId,
  };
}

function resolveCoords(prefill: TripRouteEndpointPrefill): LatLon | null {
  return latLonFromPrefill(prefill.latitude, prefill.longitude);
}

function pickLocalityKey(
  prefill: TripRouteEndpointPrefill,
  settlements: MxPostalSettlement[],
): string {
  const wantId = prefill.settlementConsId?.trim();
  if (wantId) {
    const match = settlements.find((r) => r.settlementConsId === wantId);
    if (match) {
      return localityKey(match);
    }
  }
  if (settlements.length === 1) {
    return localityKey(settlements[0]!);
  }
  const locality = prefill.locality?.trim().toLowerCase();
  if (locality) {
    const match = settlements.find(
      (r) =>
        r.settlement.toLowerCase() === locality ||
        `${r.settlementType} ${r.settlement}`.trim().toLowerCase() === locality,
    );
    if (match) {
      return localityKey(match);
    }
  }
  return settlements.length > 0 ? localityKey(settlements[0]!) : '';
}

/** Aplica CP + asentamientos + localidad + coords sin request extra (SEPOMEX opcional después si el usuario edita CP). */
export function buildRouteEndpointPrefillResult(
  prefill: TripRouteEndpointPrefill,
  sepomexRows?: MxPostalSettlement[],
): TripRouteEndpointPrefillResult | null {
  const postalCode = normalizeMxPostalCodeDigits(prefill.postalCode);
  if (postalCode.length !== 5) {
    return null;
  }

  const synthetic = syntheticSettlement(prefill);
  const rows = sepomexRows?.length ? sepomexRows : synthetic ? [synthetic] : [];
  if (rows.length === 0) {
    return null;
  }

  const localityKeyValue = pickLocalityKey(prefill, rows);
  const coords = resolveCoords(prefill);
  const complete = hasCompleteLocationData({
    postalCode,
    locality: prefill.locality,
    latitude: coords?.lat,
    longitude: coords?.lon,
  });
  return {
    postalCode,
    settlements: rows,
    localityKey: localityKeyValue,
    coords,
    complete,
  };
}
