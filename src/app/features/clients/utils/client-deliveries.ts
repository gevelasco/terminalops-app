import { parseMexicanCityMunicipalityLine } from '@features/clients/utils/destination-rate-state-resolve.util';
import { normalizeMxPostalCodeDigits } from '@features/trips/utils/mx-postal-settlement';
import type { Client, ClientDelivery } from '@shared/models/client.models';
import {
  normalizeDestinationRateScope,
  normalizePlaceKey,
  type DestinationRateScope,
} from '@shared/models/destination-rate-scope';

export function clientDeliveries(
  client: Pick<Client, 'deliveries'> | null | undefined,
): ClientDelivery[] {
  if (!client?.deliveries?.length) {
    return [];
  }
  return client.deliveries;
}

export function validClientDeliveries(
  client: Pick<Client, 'deliveries'> | null | undefined,
): ClientDelivery[] {
  return clientDeliveries(client).filter(
    (row) => normalizeMxPostalCodeDigits(row.postalCode ?? '').length === 5,
  );
}

/** Entregas válidas según la política de tarifas (CP / municipio / estado). */
export function validClientDeliveriesForScope(
  client: Pick<Client, 'deliveries'> | null | undefined,
  scope?: DestinationRateScope | string | null,
): ClientDelivery[] {
  const normalized = normalizeDestinationRateScope(scope);
  if (normalized === 'postal_code') {
    return validClientDeliveries(client);
  }
  return clientDeliveries(client).filter((row) => {
    if (normalized === 'municipality') {
      const parsed = parseMexicanCityMunicipalityLine(row.cityMunicipality ?? '');
      return !!(
        parsed.municipality.trim() &&
        (parsed.state.trim() || deliveryStateLabel(row) !== '—')
      );
    }
    return !!(row.cityMunicipality?.trim() || row.locality?.trim());
  });
}

/** Match de entrega del cliente por municipio/estado (sin CP). */
export function findClientDeliveryForScopedDestination(
  client: Pick<Client, 'deliveries'> | null | undefined,
  scope: DestinationRateScope | string | null | undefined,
  params: {
    municipalityName?: string;
    stateName?: string;
    cityMunicipality?: string;
  },
): ClientDelivery | undefined {
  const normalized = normalizeDestinationRateScope(scope);
  if (normalized === 'postal_code') {
    return undefined;
  }
  const wantState = normalizePlaceKey(
    params.stateName?.trim() ||
      parseMexicanCityMunicipalityLine(params.cityMunicipality ?? '').state ||
      (normalized === 'state' ? params.cityMunicipality ?? '' : ''),
  );
  const wantMuni = normalizePlaceKey(
    params.municipalityName?.trim() ||
      parseMexicanCityMunicipalityLine(params.cityMunicipality ?? '').municipality,
  );
  if (normalized === 'state' && !wantState) {
    return undefined;
  }
  if (normalized === 'municipality' && (!wantMuni || !wantState)) {
    return undefined;
  }
  const matches = validClientDeliveriesForScope(client, normalized).filter((row) => {
    const stateLabel = deliveryStateLabel(row);
    const rowState = normalizePlaceKey(stateLabel === '—' ? '' : stateLabel);
    if (rowState !== wantState) {
      return false;
    }
    if (normalized === 'municipality') {
      const muniLabel = deliveryMunicipalityLabel(row);
      const rowMuni = normalizePlaceKey(muniLabel === '—' ? '' : muniLabel);
      return rowMuni === wantMuni;
    }
    return true;
  });
  return matches[0];
}

export function uniqueClientDeliveryPostalCodes(
  client: Pick<Client, 'deliveries'> | null | undefined,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of validClientDeliveries(client)) {
    const cp = normalizeMxPostalCodeDigits(row.postalCode ?? '');
    if (seen.has(cp)) {
      continue;
    }
    seen.add(cp);
    out.push(cp);
  }
  return out;
}

export function findClientDeliveryForRoute(
  client: Pick<Client, 'deliveries'> | null | undefined,
  postalCode: string,
  locality?: string,
): ClientDelivery | undefined {
  const cp = normalizeMxPostalCodeDigits(postalCode);
  if (cp.length !== 5) {
    return undefined;
  }
  const matches = validClientDeliveries(client).filter(
    (row) => normalizeMxPostalCodeDigits(row.postalCode ?? '') === cp,
  );
  if (matches.length === 0) {
    return undefined;
  }
  const wantLocality = locality?.trim().toLowerCase();
  if (wantLocality) {
    const byLocality = matches.find(
      (row) => (row.locality ?? '').trim().toLowerCase() === wantLocality,
    );
    if (byLocality) {
      return byLocality;
    }
  }
  return matches[0];
}

export function deliveryLocationKey(row: ClientDelivery): string {
  const cp = normalizeMxPostalCodeDigits(row.postalCode ?? '');
  const locality = (row.locality ?? '').trim().toLowerCase();
  const consId = (row.settlementConsId ?? '').trim();
  const city = (row.cityMunicipality ?? '').trim().toLowerCase();
  // Sin CP (municipio/estado): la clave es ciudad + localidad, no el CP vacío.
  if (!cp) {
    return `|${city}|${locality}`;
  }
  return `${cp}|${consId}|${locality}|${city}`;
}

export function isSameClientDeliveryLocation(
  a: ClientDelivery,
  b: ClientDelivery,
): boolean {
  return deliveryLocationKey(a) === deliveryLocationKey(b);
}

export function deliveryPlaceLabel(row: ClientDelivery): string {
  const locality = row.locality?.trim();
  const cp = row.postalCode?.trim();
  const city = row.cityMunicipality?.trim();
  if (locality && cp) {
    return `${locality} (${cp})`;
  }
  return locality || city || cp || 'entrega';
}

export function deliveryStateLabel(row: ClientDelivery): string {
  const parsed = parseMexicanCityMunicipalityLine(row.cityMunicipality ?? '');
  return parsed.state.trim() || row.cityMunicipality?.trim() || '—';
}

export function deliveryMunicipalityLabel(row: ClientDelivery): string {
  const parsed = parseMexicanCityMunicipalityLine(row.cityMunicipality ?? '');
  return (
    parsed.municipality.trim() ||
    row.locality?.trim() ||
    row.cityMunicipality?.trim() ||
    '—'
  );
}

export function withClientDeliveries<T extends Pick<Client, 'deliveries'>>(
  client: T,
  deliveries: ClientDelivery[],
): T {
  return {
    ...client,
    deliveries,
  };
}
