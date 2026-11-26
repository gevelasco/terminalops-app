import type { RouteTollPlazaRow } from '@core/services/api/routing';
import { latLonFromTollPlazaRow } from '@features/clients/utils/destination-rate-inegi-point.util';
import {
  findMexicoStateForPoint,
  type MexicoStatesGeoJson,
} from '@features/trips/utils/trips-map-state-activity';

/** Estado MX por coordenadas de caseta (polígono `mexico-states.json`). */
export function tollPlazaRowsWithStateFromGeo(
  rows: readonly RouteTollPlazaRow[],
  geo: MexicoStatesGeoJson,
): RouteTollPlazaRow[] {
  return rows.map((row) => tollPlazaRowWithStateFromGeo(row, geo));
}

export function tollPlazaRowWithStateFromGeo(
  row: RouteTollPlazaRow,
  geo: MexicoStatesGeoJson,
): RouteTollPlazaRow {
  if (row.state?.trim()) {
    return row;
  }
  const ll = latLonFromTollPlazaRow(row);
  if (!ll) {
    return row;
  }
  const state = findMexicoStateForPoint(ll.lon, ll.lat, geo.features);
  return state ? { ...row, state } : row;
}

const MUNICIPALITY_INFER_BLOCK =
  /\s-\s|libramiento|viaducto|superv[ií]a|salida\b|t[uú]nel|v\.?\s*e\.?\s*t|poetas|marquesa|venta\b/i;

/** Muchas casetas llevan el nombre del municipio; evita corredores compuestos. */
export function inferTollPlazaMunicipalityFromName(name: string): string {
  const t = name.trim();
  if (!t || MUNICIPALITY_INFER_BLOCK.test(t)) {
    return '';
  }
  return t;
}

export function tollPlazaRowWithInferredMunicipality(
  row: RouteTollPlazaRow,
): RouteTollPlazaRow {
  if (row.municipality?.trim()) {
    return row;
  }
  const municipality = inferTollPlazaMunicipalityFromName(row.name);
  return municipality ? { ...row, municipality } : row;
}

export function tollPlazaRowsWithInferredMunicipality(
  rows: readonly RouteTollPlazaRow[],
): RouteTollPlazaRow[] {
  return rows.map(tollPlazaRowWithInferredMunicipality);
}

export function tollPlazaListLocationSuffix(row: {
  name?: string;
  municipality?: string;
  state?: string;
}): string {
  const municipality =
    row.municipality?.trim() ||
    inferTollPlazaMunicipalityFromName(row.name ?? '');
  const state = row.state?.trim() ?? '';
  return [municipality, state].filter((p) => p.length > 0).join(', ');
}