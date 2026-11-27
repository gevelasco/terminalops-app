import {
  findMexicoStateForPoint,
  type MexicoStateGeoFeature,
  type MexicoStatesGeoJson,
} from '@features/trips/utils/trips-map-state-activity';

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

/**
 * Resuelve municipio/estado para formularios.
 * Evita tratar un cityMunicipality de solo-estado (scope estado) como municipio.
 */
export function resolveDestinationRatePlaceFields(rate: {
  cityMunicipality?: string | null;
  municipalityName?: string | null;
  stateName?: string | null;
}): { municipality: string; state: string } {
  const parsed = parseMexicanCityMunicipalityLine(rate.cityMunicipality ?? '');
  let state = (rate.stateName ?? '').trim() || parsed.state.trim();
  let municipality = (rate.municipalityName ?? '').trim();

  if (!municipality && parsed.state) {
    municipality = parsed.municipality.trim();
  }

  // Sin coma: la línea era el estado (p. ej. tras política por estados).
  // No promover a municipio: capitales homónimas (Puebla, Oaxaca…) son válidas
  // solo cuando municipalityName o "muni, estado" ya lo traen.
  if (!parsed.state && parsed.municipality.trim()) {
    const alone = parsed.municipality.trim();
    if (!state) {
      state = alone;
    }
  }

  return { municipality, state };
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

/** Rechaza homónimos (p. ej. Colima geocodificado al norte de MX). */
export function coordsMatchMexicanStateHint(
  lat: number,
  lon: number,
  stateHint: string,
  geo: MexicoStatesGeoJson,
): boolean {
  const hint = stateHint.trim();
  if (!hint) {
    return true;
  }
  const resolved = findMexicoStateForPoint(lon, lat, geo.features);
  if (!resolved) {
    return true;
  }
  const expected = matchMexicoStateLabelToGeoName(hint, geo.features) ?? hint;
  const a = normalizePlaceLabel(resolved);
  const b = normalizePlaceLabel(expected);
  return a === b || a.includes(b) || b.includes(a);
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