import type { RouteTollContext, RouteTollPlazaRow } from '@core/services/api/routing';
import { latLonFromTollPlazaRow } from '@features/clients/utils/destination-rate-inegi-point.util';
import type { LatLon } from '@shared/services/osrm-driving-route.service';

type RouteMapContext = Pick<
  RouteTollContext,
  'originLat' | 'originLon' | 'destinationLat' | 'destinationLon' | 'waypoints'
>;

/** ~25 m en latitud media de México. */
const DEDUPE_DEG = 0.00025;

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
 * Puntos OSRM del mapa «Ver ruta»:
 * origen → casetas agregadas por el usuario (en orden) → destino.
 * Los waypoints legacy del customizer, si existieran, van antes de las casetas.
 */
export function buildDestinationRateRouteMapDrivingPoints(params: {
  ctx: RouteMapContext;
  plazas?: readonly RouteTollPlazaRow[];
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
  const plazaPoints: LatLon[] = [];
  for (const plaza of params.plazas ?? []) {
    const ll = latLonFromTollPlazaRow(plaza);
    if (ll) {
      plazaPoints.push({ lat: ll.lat, lon: ll.lon });
    }
  }
  return dedupeConsecutiveRoutePoints([origin, ...userWps, ...plazaPoints, dest]);
}
