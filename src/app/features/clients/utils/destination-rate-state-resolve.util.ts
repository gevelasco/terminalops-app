import type { MexicoStateGeoFeature } from '@features/trips/utils/trips-map-state-activity';

function normalizePlaceLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

/** Línea SEPOMex "municipio, estado" → partes. */
export function parseMexicanCityMunicipalityLine(cityMunicipality: string): {
  municipality: string;
  state: string;
} {
  const raw = cityMunicipality.trim();
  const comma = raw.lastIndexOf(',');
  if (comma > 0) {
    return {
      municipality: raw.slice(0, comma).trim(),
      state: raw.slice(comma + 1).trim(),
    };
  }
  return { municipality: raw, state: '' };
}

/** Etiqueta de estado → nombre del polígono en `mexico-states.json`. */
export function matchMexicoStateLabelToGeoName(
  stateLabel: string,
  features: readonly MexicoStateGeoFeature[],
): string | null {
  const norm = normalizePlaceLabel(stateLabel);
  if (!norm) {
    return null;
  }
  let partial: string | null = null;
  for (const feature of features) {
    const name = feature.properties?.name?.trim() ?? '';
    if (!name) {
      continue;
    }
    const nName = normalizePlaceLabel(name);
    if (nName === norm) {
      return name;
    }
    if (nName.includes(norm) || norm.includes(nName)) {
      partial = name;
    }
  }
  return partial;
}

export function mexicanSepomexGeocodeHints(
  locality: string,
  cityMunicipality: string,
): { state: string; municipality: string; settlement: string } {
  const { municipality, state } = parseMexicanCityMunicipalityLine(cityMunicipality);
  return {
    settlement: locality.trim(),
    municipality,
    state,
  };
}