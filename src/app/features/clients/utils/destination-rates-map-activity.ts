import type { DestinationRate } from '@shared/models/destination-rate.models';
import { formatGroupedNumber } from '@shared/utils/format-grouped-number';
import {
  findMexicoStateForPoint,
  type MexicoStatesGeoJson,
} from '@features/trips/utils/trips-map-state-activity';

export function countDestinationRatesByState(
  rates: readonly DestinationRate[],
  geoJson: MexicoStatesGeoJson,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const rate of rates) {
    const lat = rate.destinationLatitude;
    const lng = rate.destinationLongitude;
    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      continue;
    }
    const stateName = findMexicoStateForPoint(lng, lat, geoJson.features);
    if (!stateName) {
      continue;
    }
    counts.set(stateName, (counts.get(stateName) ?? 0) + 1);
  }
  return counts;
}

export function countDestinationRatesWithCoords(
  rates: readonly DestinationRate[],
): { withCoords: number; withoutCoords: number } {
  let withCoords = 0;
  let withoutCoords = 0;
  for (const rate of rates) {
    const lat = rate.destinationLatitude;
    const lng = rate.destinationLongitude;
    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      withoutCoords += 1;
    } else {
      withCoords += 1;
    }
  }
  return { withCoords, withoutCoords };
}

export function countActiveDestinationRates(
  rates: readonly DestinationRate[],
): number {
  return rates.reduce((n, rate) => (rate.active ? n + 1 : n), 0);
}

/** Tarifas cuyo destino cae dentro del estado (requiere coordenadas). */
export function destinationRatesInState(
  rates: readonly DestinationRate[],
  stateName: string,
  geoJson: MexicoStatesGeoJson,
): DestinationRate[] {
  const target = stateName.trim();
  if (!target) {
    return [];
  }
  const matched: DestinationRate[] = [];
  for (const rate of rates) {
    const lat = rate.destinationLatitude;
    const lng = rate.destinationLongitude;
    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      continue;
    }
    const state = findMexicoStateForPoint(lng, lat, geoJson.features);
    if (state === target) {
      matched.push(rate);
    }
  }
  return matched;
}

export type DestinationRateRoutePriceLine = {
  label: string;
  amount: number;
  amountLabel: string;
};

export type DestinationRateRouteCard = {
  rateId: string;
  postalCode: string;
  locality: string;
  cityMunicipality: string;
  stateName: string;
  originLabel: string;
  active: boolean;
  maneuverCount: number;
  prices: readonly DestinationRateRoutePriceLine[];
};

function formatRoutePriceAmount(amount: number): string {
  return `$${formatGroupedNumber(amount, { maxFractionDigits: 0 })}`;
}

function priceLabel(price: DestinationRate['prices'][number]): string {
  const name = price.operationConfigurationName?.trim();
  if (name) {
    return name;
  }
  const code = price.operationConfigurationCode?.trim();
  if (code) {
    return code;
  }
  return 'Maniobra';
}

function normalizePlaceLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

/**
 * True cuando `cityMunicipality` está vacío o es solo el estado
 * (típico del fallback Zippopotam sin municipio).
 */
export function cityMunicipalityNeedsEnrichment(
  cityMunicipality: string,
  stateName?: string,
): boolean {
  const raw = cityMunicipality.trim();
  if (!raw) {
    return true;
  }
  const state = stateName?.trim() ?? '';
  if (state && normalizePlaceLabel(raw) === normalizePlaceLabel(state)) {
    return true;
  }
  // "Jalisco" sin municipio: una sola palabra igual al estado ya cubierto;
  // también líneas sin coma que coinciden con el estado del mapa.
  if (!raw.includes(',') && state && normalizePlaceLabel(raw).includes(normalizePlaceLabel(state))) {
    return normalizePlaceLabel(raw) === normalizePlaceLabel(state);
  }
  return false;
}

/** Línea municipio/ciudad para cards (usa override por CP si hace falta). */
export function resolveRouteCardCityLine(
  card: Pick<DestinationRateRouteCard, 'cityMunicipality' | 'stateName' | 'postalCode'>,
  municipalityByCp?: ReadonlyMap<string, string>,
): string {
  const enriched = municipalityByCp?.get(card.postalCode)?.trim() ?? '';
  if (enriched) {
    const state = card.stateName.trim();
    if (state && !normalizePlaceLabel(enriched).includes(normalizePlaceLabel(state))) {
      return `${enriched}, ${state}`;
    }
    return enriched;
  }
  const raw = card.cityMunicipality.trim();
  if (!raw || cityMunicipalityNeedsEnrichment(raw, card.stateName)) {
    return '';
  }
  return raw;
}

/** Cards del panel lateral: una por tarifa/ruta (CP como identidad). */
export function buildDestinationRateRouteCards(
  rates: readonly DestinationRate[],
  stateByRateId?: ReadonlyMap<string, string>,
): DestinationRateRouteCard[] {
  return [...rates]
    .sort((a, b) => {
      const cp = a.postalCode.localeCompare(b.postalCode, 'es');
      if (cp !== 0) {
        return cp;
      }
      return a.locality.localeCompare(b.locality, 'es', { sensitivity: 'base' });
    })
    .map((rate) => {
      const origin =
        rate.originOperationalCenterName?.trim() ||
        rate.originOperationalCenterCode?.trim() ||
        rate.originLocality?.trim() ||
        rate.originPostalCode?.trim() ||
        '';
      return {
        rateId: rate.id,
        postalCode: rate.postalCode.trim(),
        locality: rate.locality.trim(),
        cityMunicipality: rate.cityMunicipality.trim(),
        stateName: stateByRateId?.get(rate.id)?.trim() ?? '',
        originLabel: origin,
        active: rate.active,
        maneuverCount: rate.maneuverCount ?? 0,
        prices: rate.prices.map((price) => ({
          label: priceLabel(price),
          amount: price.clientCharge,
          amountLabel: formatRoutePriceAmount(price.clientCharge),
        })),
      };
    });
}

export type DestinationRatesMapViewport = {
  boundingCoords?: [[number, number], [number, number]];
  center: [number, number];
  zoom: number;
};

const MEXICO_DEFAULT_VIEW: DestinationRatesMapViewport = {
  center: [-102, 24],
  zoom: 1.15,
};

/** Evita zoom excesivo cuando solo queda un destino/estado pequeño. */
const MIN_VIEW_SPAN_LNG = 4.5;
const MIN_VIEW_SPAN_LAT = 3.5;

type LonLatBounds = {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
};

function emptyBounds(): LonLatBounds {
  return {
    minLng: Infinity,
    minLat: Infinity,
    maxLng: -Infinity,
    maxLat: -Infinity,
  };
}

function expandBounds(bounds: LonLatBounds, lng: number, lat: number): void {
  bounds.minLng = Math.min(bounds.minLng, lng);
  bounds.minLat = Math.min(bounds.minLat, lat);
  bounds.maxLng = Math.max(bounds.maxLng, lng);
  bounds.maxLat = Math.max(bounds.maxLat, lat);
}

function expandBoundsFromRing(bounds: LonLatBounds, ring: number[][]): void {
  for (const point of ring) {
    const lng = point[0];
    const lat = point[1];
    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      expandBounds(bounds, lng, lat);
    }
  }
}

function expandBoundsFromStateGeometry(
  bounds: LonLatBounds,
  geometry: MexicoStatesGeoJson['features'][number]['geometry'],
): void {
  if (geometry.type === 'Polygon') {
    for (const ring of geometry.coordinates as number[][][]) {
      expandBoundsFromRing(bounds, ring);
    }
    return;
  }
  for (const polygon of geometry.coordinates as number[][][][]) {
    for (const ring of polygon) {
      expandBoundsFromRing(bounds, ring);
    }
  }
}

function viewportFromBounds(bounds: LonLatBounds): DestinationRatesMapViewport {
  let { minLng, minLat, maxLng, maxLat } = bounds;
  const midLng = (minLng + maxLng) / 2;
  const midLat = (minLat + maxLat) / 2;
  const spanLng = Math.max(maxLng - minLng, MIN_VIEW_SPAN_LNG);
  const spanLat = Math.max(maxLat - minLat, MIN_VIEW_SPAN_LAT);
  minLng = midLng - spanLng / 2;
  maxLng = midLng + spanLng / 2;
  minLat = midLat - spanLat / 2;
  maxLat = midLat + spanLat / 2;

  const padLng = Math.max(spanLng * 0.18, 0.75);
  const padLat = Math.max(spanLat * 0.18, 0.6);

  return {
    boundingCoords: [
      [minLng - padLng, maxLat + padLat],
      [maxLng + padLng, minLat - padLat],
    ],
    center: [midLng, midLat],
    zoom: 1,
  };
}

function viewportFromActiveStates(
  stateNames: readonly string[],
  geoJson: MexicoStatesGeoJson,
): DestinationRatesMapViewport | null {
  if (stateNames.length === 0) {
    return null;
  }
  const wanted = new Set(stateNames);
  const bounds = emptyBounds();
  let matched = 0;
  for (const feature of geoJson.features) {
    const name = feature.properties?.name?.trim();
    if (!name || !wanted.has(name)) {
      continue;
    }
    matched += 1;
    expandBoundsFromStateGeometry(bounds, feature.geometry);
  }
  if (matched === 0 || !Number.isFinite(bounds.minLng)) {
    return null;
  }
  return viewportFromBounds(bounds);
}

/**
 * Encuadre cerca de los destinos / estados activos.
 * Usa el polígono del estado (no solo el punto del CP) para evitar zoom excesivo
 * cuando el filtro deja un solo estado o pocos destinos cercanos.
 */
export function computeDestinationRatesMapViewport(
  rates: readonly DestinationRate[],
  geoJson?: MexicoStatesGeoJson | null,
): DestinationRatesMapViewport {
  if (geoJson) {
    const stateCounts = countDestinationRatesByState(rates, geoJson);
    const fromStates = viewportFromActiveStates([...stateCounts.keys()], geoJson);
    if (fromStates) {
      return fromStates;
    }
  }

  const bounds = emptyBounds();
  let count = 0;
  for (const rate of rates) {
    const lat = rate.destinationLatitude;
    const lng = rate.destinationLongitude;
    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      continue;
    }
    count += 1;
    expandBounds(bounds, lng, lat);
  }

  if (count === 0) {
    return MEXICO_DEFAULT_VIEW;
  }

  return viewportFromBounds(bounds);
}
