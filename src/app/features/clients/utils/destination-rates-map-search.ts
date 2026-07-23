import type { DestinationRate } from '@shared/models/destination-rate.models';
import { formatGroupedNumber } from '@shared/utils/format-grouped-number';
import {
  findMexicoStateForPoint,
  type MexicoStatesGeoJson,
} from '@features/trips/utils/trips-map-state-activity';

function priceTypeLabel(price: DestinationRate['prices'][number]): string {
  return (
    price.operationConfigurationName?.trim() ||
    price.operationConfigurationCode?.trim() ||
    'Maniobra'
  );
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

function compactDigitsAndLetters(value: string): string {
  return normalizeSearchText(value).replace(/[^a-z0-9]/g, '');
}

/** Estado MX del destino (si hay coordenadas + geo). */
export function resolveDestinationRateStateName(
  rate: DestinationRate,
  geoJson: MexicoStatesGeoJson | null | undefined,
): string {
  if (!geoJson) {
    return '';
  }
  const lat = rate.destinationLatitude;
  const lng = rate.destinationLongitude;
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return '';
  }
  return findMexicoStateForPoint(lng, lat, geoJson.features) ?? '';
}

function rateSearchTokens(
  rate: DestinationRate,
  stateName: string,
): { plain: string; compact: string } {
  const priceParts: string[] = [];
  for (const price of rate.prices) {
    const amount = price.clientCharge;
    priceParts.push(
      priceTypeLabel(price),
      String(amount),
      formatGroupedNumber(amount, { maxFractionDigits: 0 }),
      formatGroupedNumber(amount, { maxFractionDigits: 2 }),
      `$${formatGroupedNumber(amount, { maxFractionDigits: 0 })}`,
    );
  }

  const plain = normalizeSearchText(
    [
      rate.postalCode,
      rate.locality,
      rate.cityMunicipality,
      stateName,
      rate.originOperationalCenterName ?? '',
      rate.originLocality ?? '',
      ...priceParts,
    ].join(' '),
  );

  return { plain, compact: compactDigitsAndLetters(plain) };
}

/**
 * Filtra tarifas por CP, estado, municipio, colonia, tipo de tarifa o costo.
 * `stateByRateId` opcional: mapa id → estado (evita recalcular point-in-polygon).
 */
export function filterDestinationRatesByQuery(
  rates: readonly DestinationRate[],
  query: string,
  geoJson?: MexicoStatesGeoJson | null,
  stateByRateId?: ReadonlyMap<string, string>,
): DestinationRate[] {
  const q = query.trim();
  if (!q) {
    return [...rates];
  }
  const qPlain = normalizeSearchText(q);
  const qCompact = compactDigitsAndLetters(q);
  if (!qPlain && !qCompact) {
    return [...rates];
  }

  return rates.filter((rate) => {
    const stateName =
      stateByRateId?.get(rate.id) ??
      resolveDestinationRateStateName(rate, geoJson);
    const tokens = rateSearchTokens(rate, stateName);
    if (qPlain && tokens.plain.includes(qPlain)) {
      return true;
    }
    return Boolean(qCompact && tokens.compact.includes(qCompact));
  });
}

/** Precomputa estado por tarifa (para filtros / cards). */
export function buildDestinationRateStateById(
  rates: readonly DestinationRate[],
  geoJson: MexicoStatesGeoJson | null | undefined,
): Map<string, string> {
  const map = new Map<string, string>();
  if (!geoJson) {
    return map;
  }
  for (const rate of rates) {
    const state = resolveDestinationRateStateName(rate, geoJson);
    if (state) {
      map.set(rate.id, state);
    }
  }
  return map;
}
