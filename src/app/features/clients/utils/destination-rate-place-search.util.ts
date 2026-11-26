import { parseMexicanCityMunicipalityLine } from '@features/clients/utils/destination-rate-state-resolve.util';

/** Límite práctico para etiquetas de origen/destino en cache keys / UI. */
export const DESTINATION_RATE_PLACE_SEARCH_MAX_CHARS = 48;

export function destinationRateClampPlaceSearch(value: string): string {
  const t = value.trim();
  if (t.length <= DESTINATION_RATE_PLACE_SEARCH_MAX_CHARS) {
    return t;
  }
  return t
    .slice(0, DESTINATION_RATE_PLACE_SEARCH_MAX_CHARS)
    .trim()
    .replace(/,\s*[^,]*$/, '')
    .trim();
}

/** Etiqueta corta municipio/estado (+ localidad si cabe) para contexto de ruta. */
export function destinationRatePlaceSearchLabel(
  locality: string | undefined,
  cityMunicipality: string | undefined,
): string {
  const loc = (locality ?? '').trim();
  const rawPlace = (cityMunicipality ?? '').trim();
  const parsed = parseMexicanCityMunicipalityLine(rawPlace);
  const muni = parsed.municipality.trim();
  const state = parsed.state.trim();
  const place = muni && state ? `${muni}, ${state}` : muni || state || rawPlace;
  const placeOnly = destinationRateClampPlaceSearch(place);
  if (!loc) {
    return placeOnly;
  }
  const withLocality = destinationRateClampPlaceSearch(`${loc}, ${place}`);
  if (
    withLocality.includes(',') &&
    withLocality.length <= DESTINATION_RATE_PLACE_SEARCH_MAX_CHARS
  ) {
    return withLocality;
  }
  return placeOnly;
}
