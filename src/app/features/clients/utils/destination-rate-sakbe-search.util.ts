import { parseMexicanCityMunicipalityLine } from '@features/clients/utils/destination-rate-state-resolve.util';

/** SAKBÉ limita la longitud del parámetro `buscar` (~48 caracteres). */
export const DESTINATION_RATE_SAKBE_SEARCH_MAX_CHARS = 48;

export function destinationRateSakbeClampSearch(value: string): string {
  const t = value.trim();
  if (t.length <= DESTINATION_RATE_SAKBE_SEARCH_MAX_CHARS) {
    return t;
  }
  return t.slice(0, DESTINATION_RATE_SAKBE_SEARCH_MAX_CHARS).trim().replace(/,\s*[^,]*$/, '').trim();
}

/** Texto para `buscadestino` de INEGI SAKBÉ (municipio/estado; localidad solo si cabe en el límite). */
export function destinationRateSakbeSearchLabel(
  locality: string | undefined,
  cityMunicipality: string | undefined,
): string {
  const loc = (locality ?? '').trim();
  const rawPlace = (cityMunicipality ?? '').trim();
  const parsed = parseMexicanCityMunicipalityLine(rawPlace);
  const muni = parsed.municipality.trim();
  const state = parsed.state.trim();
  const place =
    muni && state
      ? `${muni}, ${state}`
      : muni || state || rawPlace;
  const placeOnly = destinationRateSakbeClampSearch(place);
  if (!loc) {
    return placeOnly;
  }
  const withLocality = destinationRateSakbeClampSearch(`${loc}, ${place}`);
  if (withLocality.includes(',') && withLocality.length <= DESTINATION_RATE_SAKBE_SEARCH_MAX_CHARS) {
    return withLocality;
  }
  return placeOnly;
}