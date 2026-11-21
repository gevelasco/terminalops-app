import type { RouteTollPlazaRow, RouteTollsQuery } from '@core/services/api/routing';
import { latLonFromTollPlazaRow } from '@features/clients/utils/destination-rate-inegi-point.util';
import type { LatLon } from '@shared/services/osrm-driving-route.service';

type RouteMapContext = Pick<
  RouteTollsQuery,
  'originLat' | 'originLon' | 'destinationLat' | 'destinationLon' | 'waypoints'
>;

/** ~25 m en latitud media de México. */
const DEDUPE_DEG = 0.00025;

function routeLegProgress(origin: LatLon, dest: LatLon, p: LatLon): number {
  const ax = dest.lon - origin.lon;
  const ay = dest.lat - origin.lat;
  const bx = p.lon - origin.lon;
  const by = p.lat - origin.lat;
  const denom = ax * ax + ay * ay;
  if (denom < 1e-14) {
    return 0;
  }
  return (bx * ax + by * ay) / denom;
}

function nearlySamePoint(a: LatLon, b: LatLon): boolean {
  return Math.abs(a.lat - b.lat) <= DEDUPE_DEG && Math.abs(a.lon - b.lon) <= DEDUPE_DEG;
}

function dedupeConsecutiveRoutePoints(points: LatLon[]): LatLon[] {
  if (points.length < 2) {
    return points;
  }
  const out: LatLon[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = out[out.length - 1];
    if (!nearlySamePoint(prev, points[i])) {
      out.push(points[i]);
    }
  }
  return out.length >= 2 ? out : points.slice(0, 2);
}

/**
 * Puntos para OSRM: origen → casetas (orden de ruta) / intermedios → destino.
 * Sin pasar por las casetas, OSRM suele tomar otro corredor y la línea no cruza los marcadores.
 */
export function buildDestinationRateRouteMapDrivingPoints(params: {
  ctx: RouteMapContext;
  plazas: readonly RouteTollPlazaRow[];
}): LatLon[] {
  const origin: LatLon = { lat: params.ctx.originLat, lon: params.ctx.originLon };
  const dest: LatLon = {
    lat: params.ctx.destinationLat,
    lon: params.ctx.destinationLon,
  };

  const userWps: LatLon[] = (params.ctx.waypoints ?? []).map((w) => ({
    lat: w.lat,
    lon: w.lon,
  }));

  const tolls: LatLon[] = [];
  for (const plaza of params.plazas) {
    const point = latLonFromTollPlazaRow(plaza);
    if (point) {
      tolls.push(point);
    }
  }

  let intermediates: LatLon[];
  if (userWps.length === 0) {
    intermediates = tolls;
  } else if (tolls.length === 0) {
    intermediates = userWps;
  } else {
    const merged = [...userWps, ...tolls];
    merged.sort(
      (a, b) =>
        routeLegProgress(origin, dest, a) - routeLegProgress(origin, dest, b),
    );
    intermediates = merged;
  }

  return dedupeConsecutiveRoutePoints([origin, ...intermediates, dest]);
}