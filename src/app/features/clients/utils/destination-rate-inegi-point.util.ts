import type { LatLon } from '@shared/services/osrm-driving-route.service';
import { isValidLatLon } from '@shared/services/lat-lon';

/** `inegiPoint` del API suele ser `"lat,lon"` redondeado desde SAKBÉ. */
export function latLonFromInegiTollPoint(raw: string | undefined): LatLon | null {
  const t = (raw ?? '').trim();
  if (!t) {
    return null;
  }
  const pair = /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/.exec(t);
  if (pair) {
    const lat = Number(pair[1]);
    const lon = Number(pair[2]);
    const point = { lat, lon };
    return isValidLatLon(point) ? point : null;
  }
  try {
    const json = JSON.parse(t) as { coordinates?: unknown };
    const coords = json?.coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      const lon = Number(coords[0]);
      const lat = Number(coords[1]);
      const point = { lat, lon };
      return isValidLatLon(point) ? point : null;
    }
  } catch {
    // no JSON
  }
  const wkt = /POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i.exec(t);
  if (wkt) {
    const lon = Number(wkt[1]);
    const lat = Number(wkt[2]);
    const point = { lat, lon };
    return isValidLatLon(point) ? point : null;
  }
  return null;
}

/** Coordenadas desde fila de caseta (`inegiPoint` o `plazaKey` INEGI). */
export function latLonFromTollPlazaRow(row: {
  inegiPoint?: string;
  plazaKey?: string;
}): LatLon | null {
  const fromPoint = latLonFromInegiTollPoint(row.inegiPoint);
  if (fromPoint) {
    return fromPoint;
  }
  const key = (row.plazaKey ?? '').trim();
  const embedded = /^inegi:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?):/.exec(key);
  if (!embedded) {
    return null;
  }
  const lat = Number(embedded[1]);
  const lon = Number(embedded[2]);
  const point = { lat, lon };
  return isValidLatLon(point) ? point : null;
}